// W-Funds: rondas de inversión en las empresas (fondos) de la edición.
// El estudiante entrega billetes al banco para invertir. Su inversión sigue invertida ronda tras ronda: en cada cierre
// su valor sube o baja con el rendimiento de la empresa (interés compuesto, redondeado hacia arriba) hasta que
// el estudiante pide retirarla; entonces recibe lo que vale en ese momento.
import { WgeError, ROLES, exigirRol, exigirEquipo, exigirResponsableBanco, limitar, aleatorioConSemilla, finDeFranja, proximoInicio, billeteraBloqueada, moverSaldo } from './lib.js';
import { DENOMINACIONES, inventarioBanco, totalDelConteo } from './arqueo.js';

/**
 * Rendimiento de cada fondo en una ronda:
 * base (o alterno, en riesgo alto, con 50 % de probabilidad) + bono por votos (±2 %) + variación al azar, limitado a ±20 %.
 * `azar` es un generador con semilla, para que el resultado se pueda auditar y repetir.
 */
export function calcularResultados(fondos, votosPorFondo, azar) {
	const totalVotos = [...votosPorFondo.values()].reduce((a, b) => a + b, 0);
	const resultados = [];
	for (const f of fondos) {
		const base = f.riesgo === 'alto' && f.rendimiento_alterno !== null && f.rendimiento_alterno !== undefined && azar() < 0.5
			? Number(f.rendimiento_alterno) : Number(f.rendimiento_base ?? 0);
		const votos = votosPorFondo.get(f.id) ?? 0;
		const bono = totalVotos ? limitar(0.04 * (votos / totalVotos - 1 / fondos.length), -0.02, 0.02) : 0;
		const variacion = (azar() * 2 - 1) * Number(f.variacion ?? 0);
		const rendimiento = Math.round(limitar(base + bono + variacion, -0.2, 0.2) * 10000) / 10000;
		resultados.push({ fondo_id: f.id, fondo: f.nombre, votos, base, bono, variacion, rendimiento });
	}
	return resultados;
}

/**
 * Lo que recibe el estudiante al cerrar la ronda: lo invertido más (o menos) el rendimiento,
 * redondeado SIEMPRE hacia arriba (105,2 → 106; 94,22 → 95) y sin bajar de 0.
 * Se quitan los decimales del cálculo binario (100 × 1,05 = 105,0000000001) antes de redondear.
 */
export const pagoDeInversion = (monto, rendimiento) => {
	const exacto = Math.round(Number(monto) * (1 + Number(rendimiento)) * 1e6) / 1e6;
	return Math.max(0, Math.ceil(exacto));
};

/** Lo que vale hoy una inversión (las de antes de este cambio no tienen valor_actual: valen lo invertido). */
export const valorDe = (inv) => Number(inv.valor_actual ?? inv.monto);

/**
 * Saca el dinero de una inversión: el estudiante recibe lo que vale hoy (sale del banco de su país) y la inversión
 * queda "retirada". Se usa cuando el estudiante pide retirar y cuando lo retiran de la edición.
 */
export async function retirarInversion(trx, inv, actor, billetes = null) {
	const valor = valorDe(inv);
	const participante = await trx('wge_participantes').where('id', inv.participante_id).first('id', 'edicion_id', 'pais_id');
	// Billetes físicos que el banco le entrega al estudiante (deben sumar lo que vale la inversión y estar en el banco)
	let billetesPago = null;
	if (billetes && valor > 0 && participante?.pais_id) {
		const { limpio, total } = totalDelConteo(billetes);
		if (total !== valor) throw new WgeError(400, 'VALOR_INVALIDO', `Los billetes suman ${total.toLocaleString('es-CO')} y debe entregar ${valor.toLocaleString('es-CO')}`);
		const quedan = await inventarioBanco(trx, participante.edicion_id, participante.pais_id);
		for (const [d, n] of Object.entries(limpio)) {
			if (n > quedan[d]) throw new WgeError(409, 'SIN_BILLETES', `En el banco solo quedan ${Math.max(quedan[d], 0)} billetes de ${Number(d).toLocaleString('es-CO')}`);
		}
		billetesPago = limpio;
	}
	if (valor > 0 && participante?.pais_id) {
		// Si invirtió desde su cuenta, el dinero vuelve a su cuenta (desde la cuenta virtual del banco); si no, en efectivo
		const desdeCuenta = await medioDeInversion(trx, inv.id) === 'cuenta';
		const banco = await billeteraBloqueada(trx, { edicionId: participante.edicion_id, paisId: participante.pais_id, tipo: desdeCuenta ? 'banco_virtual' : 'banco' });
		const estudiante = await billeteraBloqueada(trx, { edicionId: participante.edicion_id, paisId: participante.pais_id, tipo: desdeCuenta ? 'cuenta' : 'estudiante', participanteId: participante.id });
		await moverSaldo(trx, banco, { tipo: 'pago_fondo', monto: -valor, actor, referenciaTipo: 'inversion', referenciaId: inv.id });
		await moverSaldo(trx, estudiante, { tipo: 'pago_fondo', monto: valor, actor, referenciaTipo: 'inversion', referenciaId: inv.id });
	}
	const cambios = { estado: 'retirada', monto_pagado: valor, valor_actual: valor, cobrado_en: new Date(), cobrado_por: actor ?? null };
	if (billetesPago) cambios.billetes_pago = JSON.stringify(billetesPago);
	await trx('wge_inversiones').where('id', inv.id).update(cambios);
	return { ...inv, ...cambios };
}

const leerJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

/** De dónde salió el dinero de una inversión: 'cuenta' (tarjeta) o 'efectivo'. */
export async function medioDeInversion(db, inversionId) {
	const m = await db('wge_movimientos as m').join('wge_billeteras as b', 'b.id', 'm.billetera_id')
		.where({ 'm.referencia_tipo': 'inversion', 'm.referencia_id': inversionId }).where('m.monto', '<', 0).whereIn('b.tipo_dueno', ['estudiante', 'cuenta'])
		.first('b.tipo_dueno');
	return m?.tipo_dueno === 'cuenta' ? 'cuenta' : 'efectivo';
}

/** Duraciones que puede escoger el banco al abrir una ronda (minutos). */
export const DURACIONES_RONDA = [10, 15, 20, 30, 45, 60];
/** Si al horario le quedan menos de estos minutos, no se abre otra ronda. */
const MINIMO_RONDA = 5;

/**
 * Cuándo se cierra una ronda que abre `ahora`: a los `duracion` minutos, o antes si se acaba el horario.
 * Devuelve null si está fuera del horario o queda muy poco tiempo.
 */
export function cierreDeRonda(horario, ahora, duracion) {
	const fin = finDeFranja(horario, ahora);
	if (!fin) return null;
	const cierre = new Date(Math.min(ahora.getTime() + duracion * 60000, fin.getTime()));
	return cierre.getTime() - ahora.getTime() >= MINIMO_RONDA * 60000 ? cierre : null;
}

/** Abre una ronda nueva (la edición debe venir bloqueada con forUpdate). */
async function crearRonda(trx, edicion, duracion, actor, ahora = new Date()) {
	const cierre = cierreDeRonda(leerJson(edicion.horario), ahora, duracion);
	if (!cierre) return null;
	const n = Number((await trx('wge_rondas').where('edicion_id', edicion.id).count({ n: '*' }).first())?.n ?? 0);
	const fila = {
		id: crypto.randomUUID(), edicion_id: edicion.id, nombre: `Ronda ${n + 1}`, apertura: ahora, estado: 'abierta',
		duracion_minutos: duracion, cierre_programado: cierre, date_created: ahora, user_created: actor ?? null,
	};
	await trx('wge_rondas').insert(fila);
	return fila;
}

/**
 * Cierra una ronda (bloqueada con forUpdate): calcula el rendimiento de cada empresa y actualiza lo que vale
 * cada inversión vigente (interés compuesto, redondeado hacia arriba). El dinero sigue invertido en la
 * ronda siguiente hasta que el estudiante pida retirarlo.
 * La variación sale de una semilla guardada en la ronda, así el resultado se puede auditar y repetir.
 */
export async function liquidarRonda(trx, ronda, actor) {
	const fondos = await trx('wge_fondos').where({ edicion_id: ronda.edicion_id, activo: true }).orderBy('orden');
	const votos = await trx('wge_votos').where('ronda_id', ronda.id).groupBy('fondo_id').select('fondo_id').count({ n: '*' });
	const semilla = ronda.semilla || `${ronda.id}:${crypto.randomUUID()}`;
	const resultados = calcularResultados(fondos, new Map(votos.map((v) => [v.fondo_id, Number(v.n)])), aleatorioConSemilla(semilla));
	const porFondo = new Map(resultados.map((r) => [r.fondo_id, r.rendimiento]));

	// Todas las inversiones que siguen vigentes en la edición (de esta ronda o de rondas anteriores) crecen o bajan
	const inversiones = await trx('wge_inversiones as i').join('wge_rondas as r', 'r.id', 'i.ronda_id')
		.where({ 'r.edicion_id': ronda.edicion_id, 'i.estado': 'abierta' }).orderBy('i.id').forUpdate('i').select('i.*');
	let antes = 0, despues = 0;
	for (const inv of inversiones) {
		if (!porFondo.has(inv.fondo_id)) continue; // empresa desactivada: no se mueve esta ronda
		const rendimiento = porFondo.get(inv.fondo_id);
		const valor = valorDe(inv);
		const nuevo = pagoDeInversion(valor, rendimiento);
		const historial = [...(leerJson(inv.historial) ?? []), { ronda_id: ronda.id, ronda: ronda.nombre, rendimiento, antes: valor, despues: nuevo }];
		await trx('wge_inversiones').where('id', inv.id).update({ valor_actual: nuevo, rendimiento_final: rendimiento, historial: JSON.stringify(historial) });
		antes += valor;
		despues += nuevo;
	}
	await trx('wge_rondas').where('id', ronda.id).update({ estado: 'liquidada', semilla, cierre: new Date(), resultados: JSON.stringify(resultados) });
	return { ronda_id: ronda.id, semilla, inversiones: inversiones.length, valor_antes: antes, valor_despues: despues, fondos: resultados };
}

/** Cierra una ronda y, si `continuar`, abre la siguiente con la misma duración (si el horario lo permite). */
export async function cerrarYSeguir(db, rondaId, { actor, continuar, soloVencida = false }) {
	return db.transaction(async (trx) => {
		const ronda = await trx('wge_rondas').where('id', rondaId).forUpdate().first();
		if (!ronda) throw new WgeError(404, 'NO_EXISTE', 'La ronda no existe');
		if (ronda.estado !== 'abierta') return null; // otra persona (o la tarea automática) ya la cerró
		if (soloVencida && !(ronda.cierre_programado && new Date(ronda.cierre_programado) <= new Date())) return null;
		const resumen = await liquidarRonda(trx, ronda, actor);
		// «Cerrar y detener»: las rondas tampoco se reanudan solas en la siguiente franja del horario
		if (!continuar) await trx('wge_rondas').where('id', ronda.id).update({ detenida: true });
		let siguiente = null;
		if (continuar && ronda.duracion_minutos) {
			const edicion = await trx('wge_ediciones').where('id', ronda.edicion_id).forUpdate().first();
			if (edicion?.estado === 'abierta') siguiente = await crearRonda(trx, edicion, Number(ronda.duracion_minutos), actor);
		}
		return { ...resumen, siguiente };
	});
}

/**
 * Inversiones que quedaron "por cobrar" con una regla anterior: siguen invertidas con el valor que ya tenían
 * (redondeado hacia arriba). Corre con la tarea de cada minuto.
 */
export async function abonarPendientes(db) {
	const pendientes = await db('wge_inversiones').where('estado', 'por_cobrar').select('id', 'monto', 'rendimiento_final');
	for (const inv of pendientes) {
		await db('wge_inversiones').where({ id: inv.id, estado: 'por_cobrar' })
			.update({ estado: 'abierta', valor_actual: pagoDeInversion(inv.monto, Number(inv.rendimiento_final ?? 0)) });
	}
	return pendientes.length;
}

/**
 * ¿Las rondas de la edición siguen solas? Sí, si ya hubo una ronda con duración y el banco no la detuvo.
 * Devuelve la duración y, si no hay ronda abierta, cuándo arranca la próxima.
 */
export async function estadoRondas(db, edicionId) {
	const ultima = await db('wge_rondas').where('edicion_id', edicionId).orderBy('apertura', 'desc').first('estado', 'duracion_minutos', 'detenida');
	const automaticas = !!(ultima?.duracion_minutos && !ultima.detenida);
	if (!automaticas || ultima.estado === 'abierta') return { automaticas, duracion: ultima?.duracion_minutos ?? null, proxima: null };
	const horario = leerJson((await db('wge_ediciones').where('id', edicionId).first('horario'))?.horario);
	const ahora = new Date();
	// Dentro del horario arranca en el próximo minuto; fuera, al empezar la siguiente franja
	const proxima = finDeFranja(horario, ahora) ? ahora : proximoInicio(horario, ahora);
	return { automaticas, duracion: Number(ultima.duracion_minutos), proxima };
}

/**
 * Tarea de cada minuto: si una edición tiene las rondas andando (no detenidas) y no hay ronda abierta
 * —p. ej. se acabó la franja del horario y empezó la siguiente—, abre la ronda con la misma duración.
 */
export async function reanudarRondas(db) {
	const ediciones = await db('wge_ediciones').where('estado', 'abierta').pluck('id');
	const abiertas = [];
	for (const edicionId of ediciones) {
		const { automaticas, duracion } = await estadoRondas(db, edicionId);
		if (!automaticas || !duracion) continue;
		const fila = await db.transaction(async (trx) => {
			const edicion = await trx('wge_ediciones').where('id', edicionId).forUpdate().first();
			if (edicion?.estado !== 'abierta') return null;
			if (await trx('wge_rondas').where({ edicion_id: edicionId, estado: 'abierta' }).first('id')) return null;
			return crearRonda(trx, edicion, duracion, null); // null si estamos fuera del horario
		});
		if (fila) abiertas.push(fila);
	}
	return abiertas;
}

/** Tarea de cada minuto: cierra las rondas vencidas y abre la siguiente. */
export async function cerrarRondasVencidas(db) {
	const vencidas = await db('wge_rondas as r').join('wge_ediciones as e', 'e.id', 'r.edicion_id')
		.where('r.estado', 'abierta').whereNotNull('r.cierre_programado').where('r.cierre_programado', '<=', new Date())
		.select('r.id');
	const hechas = [];
	for (const r of vencidas) {
		const x = await cerrarYSeguir(db, r.id, { actor: null, continuar: true, soloVencida: true });
		if (x) hechas.push(x);
	}
	return hechas;
}

export function rutasWfunds(router, { ruta, db }) {
	const permitir = async (req, rol, edicionId) => {
		exigirRol(rol, ROLES.BANCO, ROLES.ADMIN_WG);
		await exigirEquipo(db, { edicionId, usuarioId: req.accountability.user, rol });
	};

	/**
	 * GET /wge/ediciones/:id/wfunds: la ronda abierta, las anteriores con sus resultados, las empresas,
	 * y por cada país que maneja el usuario: billetes del banco, estudiantes, inversiones de la ronda y pagos pendientes.
	 */
	router.get('/ediciones/:id/wfunds', ruta(async (req, rol) => {
		const edicion = await db('wge_ediciones').where('id', req.params.id).first('id', 'nombre', 'estado');
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		await permitir(req, rol, edicion.id);

		const rondas = (await db('wge_rondas').where('edicion_id', edicion.id).orderBy('apertura', 'desc')
			.select('id', 'nombre', 'estado', 'apertura', 'cierre', 'resultados', 'duracion_minutos', 'cierre_programado')).map((r) => ({ ...r, resultados: leerJson(r.resultados) ?? [] }));
		const abierta = rondas.find((r) => r.estado === 'abierta') ?? null;
		const fondos = await db('wge_fondos').where('edicion_id', edicion.id).orderBy('orden')
			.select('id', 'nombre', 'riesgo', 'logo', 'a_que_se_dedica', 'por_que_invertir', 'activo');

		const consulta = db('wge_paises').where('edicion_id', edicion.id).orderBy('orden').select('id', 'nombre', 'codigo_moneda', 'color');
		if (rol !== ROLES.ADMIN && rol !== ROLES.ADMIN_WG) consulta.where('responsable_banco', req.accountability.user);
		const paises = await consulta;
		for (const p of paises) {
			const banco = await db('wge_billeteras').where({ edicion_id: edicion.id, pais_id: p.id, tipo_dueno: 'banco' }).first('saldo');
			p.saldo_banco = Number(banco?.saldo ?? 0);
			p.inventario = await inventarioBanco(db, edicion.id, p.id);
			p.estudiantes = await db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
				.leftJoin('wge_billeteras as b', function () { this.on('b.participante_id', 'pa.id').andOn('b.pais_id', 'pa.pais_id').andOnVal('b.tipo_dueno', 'estudiante'); })
				.leftJoin('wge_billeteras as c', function () { this.on('c.participante_id', 'pa.id').andOn('c.pais_id', 'pa.pais_id').andOnVal('c.tipo_dueno', 'cuenta'); })
				.where({ 'pa.edicion_id': edicion.id, 'pa.pais_id': p.id }).whereRaw('coalesce(pa.retirado, false) = false')
				.select('pa.id', 'e.nombre', 'e.apellido', db.raw('coalesce(b.saldo, 0)::int as saldo'), db.raw('coalesce(c.saldo, 0)::int as cuenta'))
				.orderBy([{ column: 'e.nombre' }, { column: 'e.apellido' }]);
			const base = () => db('wge_inversiones as i').join('wge_participantes as pa', 'pa.id', 'i.participante_id')
				.join('estudiantes as e', 'e.id', 'pa.estudiante_id').join('wge_rondas as r', 'r.id', 'i.ronda_id')
				.where({ 'r.edicion_id': edicion.id, 'pa.pais_id': p.id });
			p.inversiones = abierta ? await base().where('i.ronda_id', abierta.id).orderBy('i.date_created', 'desc')
				.select('i.id', 'i.participante_id', 'i.fondo_id', 'i.monto', 'i.billetes', 'i.date_created', 'e.nombre', 'e.apellido') : [];
			p.vigentes = (await base().where('i.estado', 'abierta').orderBy([{ column: 'e.nombre' }, { column: 'e.apellido' }, { column: 'i.date_created' }])
				.select('i.id', 'i.participante_id', 'i.fondo_id', 'i.monto', 'i.valor_actual', 'i.historial', 'r.nombre as ronda', 'e.nombre', 'e.apellido'))
				.map((i) => ({ ...i, valor_actual: valorDe(i), historial: leerJson(i.historial) ?? [] }));
			for (const i of p.vigentes) i.medio = await medioDeInversion(db, i.id);
			p.retiradas = await base().whereIn('i.estado', ['retirada', 'cobrada']).orderBy('i.cobrado_en', 'desc').limit(50)
				.select('i.id', 'i.fondo_id', 'i.monto', 'i.monto_pagado', 'i.cobrado_en', 'r.nombre as ronda', 'e.nombre', 'e.apellido');
		}
		const horario = leerJson((await db('wge_ediciones').where('id', edicion.id).first('horario'))?.horario);
		const fin = finDeFranja(horario, new Date());
		return {
			edicion, denominaciones: DENOMINACIONES, ronda: abierta, rondas, fondos, paises,
			ahora: new Date(), fin_horario: fin, duraciones: DURACIONES_RONDA, reanudacion: await estadoRondas(db, edicion.id),
		};
	}));

	/** POST /wge/ediciones/:id/rondas/detener: las rondas dejan de reanudarse solas (hasta que el banco abra otra). */
	router.post('/ediciones/:id/rondas/detener', ruta(async (req, rol) => {
		const edicion = await db('wge_ediciones').where('id', req.params.id).first('id');
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		await permitir(req, rol, edicion.id);
		const ultima = await db('wge_rondas').where('edicion_id', edicion.id).orderBy('apertura', 'desc').first('id', 'estado');
		if (ultima?.estado === 'abierta') throw new WgeError(409, 'RONDA_ABIERTA', 'Hay una ronda abierta: ciérrala con «Cerrar y detener las rondas»');
		if (ultima) await db('wge_rondas').where('id', ultima.id).update({ detenida: true });
		return { detenidas: true };
	}));

	/** POST /wge/inversiones/:id/retirar: el estudiante saca su dinero; recibe lo que vale hoy la inversión. */
	router.post('/inversiones/:id/retirar', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.BANCO, ROLES.ADMIN_WG);
		const actor = req.accountability.user;
		return db.transaction(async (trx) => {
			const inv = await trx('wge_inversiones').where('id', req.params.id).forUpdate().first();
			if (!inv) throw new WgeError(404, 'NO_EXISTE', 'La inversión no existe');
			if (inv.estado !== 'abierta') throw new WgeError(409, 'YA_RETIRADA', 'Esta inversión ya fue retirada');
			const participante = await trx('wge_participantes').where('id', inv.participante_id).first('edicion_id', 'pais_id');
			await exigirEquipo(trx, { edicionId: participante.edicion_id, usuarioId: actor, rol });
			await exigirResponsableBanco(trx, { paisId: participante.pais_id, usuarioId: actor, rol });
			// Mientras se procesa el cierre de una ronda vencida no se retira (el valor está por cambiar)
			const procesando = await trx('wge_rondas').where({ edicion_id: participante.edicion_id, estado: 'abierta' })
				.where('cierre_programado', '<=', new Date()).first('id');
			if (procesando) throw new WgeError(409, 'PROCESANDO', 'Estamos calculando las ganancias de la ronda; intenta en un minuto');
			// El banco le entrega al estudiante lo que vale hoy la inversión (el detalle de billetes ya no se pide)
			return retirarInversion(trx, inv, actor, req.body?.billetes);
		});
	}));

	/** POST /wge/ediciones/:id/rondas { duracion_minutos }: abre una ronda (solo una a la vez, dentro del horario). */
	router.post('/ediciones/:id/rondas', ruta(async (req, rol) => {
		const edicion = await db('wge_ediciones').where('id', req.params.id).first('id', 'estado');
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		await permitir(req, rol, edicion.id);
		if (edicion.estado !== 'abierta') throw new WgeError(409, 'EDICION_CERRADA', 'La edición no está abierta');
		const duracion = Number(req.body?.duracion_minutos);
		if (!DURACIONES_RONDA.includes(duracion)) throw new WgeError(400, 'VALOR_INVALIDO', `La ronda debe durar ${DURACIONES_RONDA.join(', ')} minutos`);
		return db.transaction(async (trx) => {
			const bloqueada = await trx('wge_ediciones').where('id', edicion.id).forUpdate().first(); // una ronda a la vez, aunque toquen dos personas
			if (await trx('wge_rondas').where({ edicion_id: edicion.id, estado: 'abierta' }).first('id')) {
				throw new WgeError(409, 'RONDA_ABIERTA', 'Ya hay una ronda abierta; ciérrala antes de abrir otra');
			}
			const fila = await crearRonda(trx, bloqueada, duracion, req.accountability.user);
			if (!fila) throw new WgeError(409, 'FUERA_DE_HORARIO', 'Fuera del horario de la economía (o le quedan menos de 5 minutos)');
			return fila;
		});
	}));
}
