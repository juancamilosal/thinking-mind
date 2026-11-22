// Arqueo del banco: conteo de billetes físicos por denominación y su cuadre contra el saldo del sistema.
import { WgeError, ROLES, exigirRol, exigirEquipo, exigirResponsableBanco } from './lib.js';

/** Denominaciones impresas de cada país (iguales en Wonderland, Neverland y Dreamland). */
export const DENOMINACIONES = [1, 2, 5, 10, 50, 100, 200, 1000, 5000, 50000];

/** Valida el conteo { "1": 40, "5": 20, ... } y devuelve el conteo limpio y su total. */
export function totalDelConteo(conteo) {
	if (!conteo || typeof conteo !== 'object' || Array.isArray(conteo)) throw new WgeError(400, 'VALOR_INVALIDO', 'Falta el conteo de billetes');
	const limpio = {};
	let total = 0;
	for (const [den, cantidad] of Object.entries(conteo)) {
		const d = Number(den);
		if (!DENOMINACIONES.includes(d)) throw new WgeError(400, 'VALOR_INVALIDO', `No existe el billete de ${den}`);
		const n = Number(cantidad ?? 0);
		if (!Number.isInteger(n) || n < 0) throw new WgeError(400, 'VALOR_INVALIDO', `La cantidad de billetes de ${den} debe ser un entero de 0 en adelante`);
		if (n > 0) { limpio[d] = n; total += d * n; }
	}
	return { limpio, total };
}

/** Suma (o resta) al inventario el detalle de billetes de cada fila: { "50": 2, "1000": 1 }. */
function acumularBilletes(quedan, lista, signo) {
	for (const b of lista) {
		const detalle = typeof b === 'string' ? JSON.parse(b) : b;
		for (const [d, n] of Object.entries(detalle ?? {})) if (d in quedan) quedan[d] += signo * Number(n);
	}
}

/**
 * Billetes que quedan en el banco por denominación: los asignados, menos los que entregó a docentes,
 * más los que recibió de inversiones W-Funds, menos los que pagó al cobrar esas inversiones.
 * (La bienvenida no lleva detalle de billetes, así que es un tope: nunca bloquea de más.)
 */
export async function inventarioBanco(db, edicionId, paisId) {
	const pais = await db('wge_paises').where('id', paisId).first('provision_billetes');
	const asignados = (typeof pais?.provision_billetes === 'string' ? JSON.parse(pais.provision_billetes) : pais?.provision_billetes) ?? {};
	const banco = await db('wge_billeteras').where({ edicion_id: edicionId, pais_id: paisId, tipo_dueno: 'banco' }).first('id');
	const quedan = Object.fromEntries(DENOMINACIONES.map((d) => [d, Number(asignados[d] ?? 0)]));
	if (banco) {
		const salidas = await db('wge_transferencias').where({ billetera_origen_id: banco.id, estado: 'aplicada' }).whereNotNull('billetes').pluck('billetes');
		for (const b of salidas) {
			const detalle = typeof b === 'string' ? JSON.parse(b) : b;
			for (const [d, n] of Object.entries(detalle ?? {})) if (d in quedan) quedan[d] -= Number(n);
		}
	}
	const inversiones = await db('wge_inversiones as i').join('wge_participantes as p', 'p.id', 'i.participante_id')
		.join('wge_rondas as r', 'r.id', 'i.ronda_id').where({ 'r.edicion_id': edicionId, 'p.pais_id': paisId })
		.select('i.billetes', 'i.billetes_pago');
	acumularBilletes(quedan, inversiones.map((i) => i.billetes), 1);
	acumularBilletes(quedan, inversiones.map((i) => i.billetes_pago), -1);
	return quedan;
}

/** Billetes que tiene un docente por denominación: los que recibió del banco menos los que entregó. */
export async function inventarioDocente(db, edicionId, paisId, docenteId) {
	const quedan = Object.fromEntries(DENOMINACIONES.map((d) => [d, 0]));
	const billetera = await db('wge_billeteras').where({ edicion_id: edicionId, pais_id: paisId, tipo_dueno: 'docente', docente_id: docenteId }).first('id');
	if (!billetera) return quedan;
	const sumar = (lista, signo) => acumularBilletes(quedan, lista, signo);
	sumar(await db('wge_transferencias').where({ billetera_destino_id: billetera.id, estado: 'aplicada' }).whereNotNull('billetes').pluck('billetes'), 1);
	sumar(await db('wge_transferencias').where({ billetera_origen_id: billetera.id, estado: 'aplicada' }).whereNotNull('billetes').pluck('billetes'), -1);
	return quedan;
}

const leerBilletes = (b) => (typeof b === 'string' ? JSON.parse(b) : b) ?? null;

/**
 * Movimientos del banco de un país, con una descripción para la pantalla: de quién vienen o a quién van,
 * y qué billetes (cuando se registraron). Más los totales de todo lo que ha entrado y salido.
 */
export async function movimientosBanco(db, edicionId, paisId, limite = 100) {
	const banco = await db('wge_billeteras').where({ edicion_id: edicionId, pais_id: paisId, tipo_dueno: 'banco' }).first('id');
	if (!banco) return { movimientos: [], total_entro: 0, total_salio: 0 };
	const totales = await db('wge_movimientos').where('billetera_id', banco.id)
		.select(db.raw('coalesce(sum(case when monto > 0 then monto else 0 end), 0)::bigint as entro'), db.raw('coalesce(sum(case when monto < 0 then -monto else 0 end), 0)::bigint as salio'))
		.first();
	const filas = await db('wge_movimientos as m').leftJoin('directus_users as u', 'u.id', 'm.user_created')
		.where('m.billetera_id', banco.id).orderBy('m.consecutivo', 'desc').limit(limite)
		.select('m.id', 'm.tipo', 'm.monto', 'm.saldo_despues', 'm.referencia_tipo', 'm.referencia_id', 'm.date_created',
			db.raw("trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) as quien"));

	const ids = (tipo) => [...new Set(filas.filter((f) => f.referencia_tipo === tipo && f.referencia_id).map((f) => f.referencia_id))];
	const transferencias = new Map((ids('transferencia').length ? await db('wge_transferencias as t')
		.leftJoin('wge_billeteras as bd', 'bd.id', 't.billetera_destino_id').leftJoin('directus_users as u', 'u.id', 'bd.docente_id')
		.whereIn('t.id', ids('transferencia')).select('t.id', 't.billetes', 'u.first_name', 'u.last_name') : []).map((t) => [t.id, t]));
	const inversiones = new Map((ids('inversion').length ? await db('wge_inversiones as i')
		.join('wge_participantes as pa', 'pa.id', 'i.participante_id').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
		.leftJoin('wge_fondos as f', 'f.id', 'i.fondo_id')
		.whereIn('i.id', ids('inversion')).select('i.id', 'i.billetes', 'i.billetes_pago', 'e.nombre', 'e.apellido', 'f.nombre as fondo') : []).map((i) => [i.id, i]));
	const personas = [...ids('bienvenida'), ...ids('retiro')];
	const estudiantes = new Map((personas.length ? await db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
		.whereIn('pa.id', personas).select('pa.id', 'e.nombre', 'e.apellido') : []).map((x) => [x.id, x]));
	const nombre = (x) => `${x?.nombre ?? x?.first_name ?? ''} ${x?.apellido ?? x?.last_name ?? ''}`.trim();

	const movimientos = filas.map((f) => {
		const entra = Number(f.monto) > 0;
		let titulo = entra ? 'Entrada' : 'Salida';
		let billetes = null;
		if (f.referencia_tipo === 'transferencia') {
			const t = transferencias.get(f.referencia_id);
			titulo = `Entregado a ${nombre(t) || 'un docente'}`;
			billetes = leerBilletes(t?.billetes);
		} else if (f.referencia_tipo === 'inversion') {
			const i = inversiones.get(f.referencia_id);
			titulo = entra ? `Inversión de ${nombre(i)}${i?.fondo ? ' en ' + i.fondo : ''}` : `Liquidación a ${nombre(i)}${i?.fondo ? ' (' + i.fondo + ')' : ''}`;
			billetes = leerBilletes(entra ? i?.billetes : i?.billetes_pago);
		} else if (f.referencia_tipo === 'bienvenida') {
			titulo = `Bienvenida a ${nombre(estudiantes.get(f.referencia_id)) || 'un estudiante'}`;
		} else if (f.referencia_tipo === 'retiro') {
			titulo = `Devolución de ${nombre(estudiantes.get(f.referencia_id)) || 'un estudiante'} (retirado)`;
		} else if (f.referencia_tipo === 'provision_adicional') {
			titulo = 'Billetes agregados al banco';
		} else if (f.tipo === 'provision' || f.tipo === 'reverso') {
			titulo = entra ? 'Billetes asignados al banco' : 'Ajuste de billetes asignados';
		}
		return { id: f.id, tipo: f.tipo, entra, titulo, monto: Math.abs(Number(f.monto)), saldo_despues: Number(f.saldo_despues), fecha: f.date_created, quien: f.quien || '', billetes };
	});
	return { movimientos, total_entro: Number(totales?.entro ?? 0), total_salio: Number(totales?.salio ?? 0) };
}

/**
 * Movimientos del bolsillo de un estudiante (para el portal del acudiente): bienvenida, billetes del docente,
 * inversiones, pagos de las empresas, compras y devoluciones, con sus billetes cuando se registraron.
 */
export async function movimientosEstudiante(db, participanteId, paisId, limite = 50) {
	const billetera = await db('wge_billeteras').where({ participante_id: participanteId, pais_id: paisId, tipo_dueno: 'estudiante' }).first('id');
	if (!billetera) return { movimientos: [], total_entro: 0, total_salio: 0 };
	const totales = await db('wge_movimientos').where('billetera_id', billetera.id)
		.select(db.raw('coalesce(sum(case when monto > 0 then monto else 0 end), 0)::bigint as entro'), db.raw('coalesce(sum(case when monto < 0 then -monto else 0 end), 0)::bigint as salio'))
		.first();
	const filas = await db('wge_movimientos').where('billetera_id', billetera.id).orderBy('consecutivo', 'desc').limit(limite)
		.select('id', 'tipo', 'monto', 'referencia_tipo', 'referencia_id', 'date_created');
	const ids = (tipo) => [...new Set(filas.filter((f) => f.referencia_tipo === tipo && f.referencia_id).map((f) => f.referencia_id))];
	const transferencias = new Map((ids('transferencia').length ? await db('wge_transferencias as t')
		.leftJoin('wge_billeteras as bo', 'bo.id', 't.billetera_origen_id').leftJoin('directus_users as u', 'u.id', 'bo.docente_id')
		.whereIn('t.id', ids('transferencia')).select('t.id', 't.billetes', 'u.first_name', 'u.last_name') : []).map((t) => [t.id, t]));
	const inversiones = new Map((ids('inversion').length ? await db('wge_inversiones as i').leftJoin('wge_fondos as f', 'f.id', 'i.fondo_id')
		.whereIn('i.id', ids('inversion')).select('i.id', 'i.billetes', 'i.billetes_pago', 'f.nombre as fondo') : []).map((i) => [i.id, i]));

	const movimientos = filas.map((f) => {
		const entra = Number(f.monto) > 0;
		let titulo = entra ? 'Entrada' : 'Salida';
		let billetes = null;
		if (f.referencia_tipo === 'transferencia') {
			const t = transferencias.get(f.referencia_id);
			const docente = `${t?.first_name ?? ''} ${t?.last_name ?? ''}`.trim();
			titulo = docente ? `Recibió de ${docente}` : 'Recibió de su docente';
			billetes = leerBilletes(t?.billetes);
		} else if (f.referencia_tipo === 'inversion') {
			const i = inversiones.get(f.referencia_id);
			titulo = entra ? `Liquidación de ${i?.fondo ?? 'una empresa'}` : `Invirtió en ${i?.fondo ?? 'una empresa'}`;
			billetes = leerBilletes(entra ? i?.billetes_pago : i?.billetes);
		} else if (f.referencia_tipo === 'bienvenida' || f.tipo === 'bienvenida') {
			titulo = 'Billetes de bienvenida';
		} else if (f.referencia_tipo === 'venta' || f.tipo === 'compra') {
			titulo = 'Compra en GO•STORE';
		} else if (f.referencia_tipo === 'retiro') {
			titulo = 'Devolvió sus billetes al banco';
		}
		return { id: f.id, entra, titulo, monto: Math.abs(Number(f.monto)), fecha: f.date_created, billetes };
	});
	return { movimientos, total_entro: Number(totales?.entro ?? 0), total_salio: Number(totales?.salio ?? 0) };
}

export function rutasArqueo(router, { ruta, db }) {
	const saldoBanco = async (edicionId, paisId) => {
		const b = await db('wge_billeteras').where({ edicion_id: edicionId, pais_id: paisId, tipo_dueno: 'banco' }).first('saldo');
		return Number(b?.saldo ?? 0);
	};

	const permitir = async (req, rol, edicionId) => {
		exigirRol(rol, ROLES.BANCO, ROLES.ADMIN_WG);
		await exigirEquipo(db, { edicionId, usuarioId: req.accountability.user, rol });
	};

	/**
	 * GET /wge/ediciones/:id/reparto: por cada país que maneja el usuario, el saldo y los billetes del banco,
	 * los docentes del equipo que pueden recibir esa moneda (con lo que tienen) y las últimas entregas.
	 */
	router.get('/ediciones/:id/reparto', ruta(async (req, rol) => {
		const edicion = await db('wge_ediciones').where('id', req.params.id).first('id', 'nombre', 'estado');
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		await permitir(req, rol, edicion.id);
		const consulta = db('wge_paises').where('edicion_id', edicion.id).orderBy('orden').select('id', 'nombre', 'codigo_moneda', 'color');
		if (rol !== ROLES.ADMIN && rol !== ROLES.ADMIN_WG) consulta.where('responsable_banco', req.accountability.user);
		const paises = await consulta;
		for (const p of paises) {
			p.saldo_banco = await saldoBanco(edicion.id, p.id);
			p.inventario = await inventarioBanco(db, edicion.id, p.id);
			p.docentes = await db('wge_equipo as q').join('directus_users as u', 'u.id', 'q.usuario_id')
				.join('directus_roles as r', 'r.id', 'u.role')
				.leftJoin('wge_billeteras as b', function () {
					this.on('b.docente_id', 'q.usuario_id').andOnVal('b.pais_id', p.id).andOnVal('b.tipo_dueno', 'docente');
				})
				.where('q.edicion_id', edicion.id).where('r.name', ROLES.DOCENTE)
				.where((w) => w.whereNull('q.pais_id').orWhere('q.pais_id', p.id))
				.select('u.id', 'u.first_name as nombre', 'u.last_name as apellido', 'q.pais_id', db.raw('coalesce(b.saldo, 0)::int as saldo'),
					db.raw(`coalesce((select sum(t.monto) from wge_transferencias t join wge_billeteras bd on bd.id = t.billetera_destino_id
						where bd.docente_id = q.usuario_id and bd.pais_id = ? and t.estado = 'aplicada'), 0)::int as recibido`, [p.id]))
				.orderBy([{ column: 'u.first_name' }, { column: 'u.last_name' }]);
			p.entregas = await db('wge_transferencias as t').join('wge_billeteras as bo', 'bo.id', 't.billetera_origen_id')
				.join('wge_billeteras as bd', 'bd.id', 't.billetera_destino_id').leftJoin('directus_users as u', 'u.id', 'bd.docente_id')
				.where({ 'bo.pais_id': p.id, 'bo.tipo_dueno': 'banco', 'bd.tipo_dueno': 'docente' })
				.orderBy('t.date_created', 'desc').limit(20)
				.select('t.id', 't.monto', 't.billetes', 't.date_created', 'u.first_name as nombre', 'u.last_name as apellido');
		}
		return { edicion, denominaciones: DENOMINACIONES, paises };
	}));

	/**
	 * GET /wge/ediciones/:id/docente: lo que necesita la pantalla del docente, por cada país que maneja:
	 * sus billetes (saldo y por denominación), lo recibido del banco, sus entregas y los estudiantes del país.
	 */
	router.get('/ediciones/:id/docente', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.DOCENTE, ROLES.ADMIN_WG);
		const edicion = await db('wge_ediciones').where('id', req.params.id).first('id', 'nombre', 'estado');
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		const docenteId = rol === ROLES.DOCENTE ? req.accountability.user : (req.query?.docente_id || req.accountability.user);
		const miembro = await exigirEquipo(db, { edicionId: edicion.id, usuarioId: req.accountability.user, rol });
		const consulta = db('wge_paises').where('edicion_id', edicion.id).orderBy('orden').select('id', 'nombre', 'codigo_moneda', 'color');
		if (miembro?.pais_id) consulta.where('id', miembro.pais_id); // docente de un solo país
		const paises = await consulta;
		for (const p of paises) {
			const billetera = await db('wge_billeteras').where({ edicion_id: edicion.id, pais_id: p.id, tipo_dueno: 'docente', docente_id: docenteId }).first('id', 'saldo');
			p.saldo = Number(billetera?.saldo ?? 0);
			p.inventario = await inventarioDocente(db, edicion.id, p.id, docenteId);
			const suma = async (campo) => (billetera ? Number((await db('wge_transferencias').where({ [campo]: billetera.id, estado: 'aplicada' }).sum({ t: 'monto' }).first())?.t ?? 0) : 0);
			p.total_recibido = await suma('billetera_destino_id');
			p.total_entregado = await suma('billetera_origen_id');
			p.recibidos = billetera ? await db('wge_transferencias as t').join('wge_billeteras as bo', 'bo.id', 't.billetera_origen_id')
				.leftJoin('directus_users as u', 'u.id', 't.user_created')
				.where('t.billetera_destino_id', billetera.id).orderBy('t.date_created', 'desc').limit(50)
				.select('t.id', 't.monto', 't.billetes', 't.date_created', db.raw("trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) as quien")) : [];
			p.entregas = billetera ? await db('wge_transferencias as t').join('wge_billeteras as bd', 'bd.id', 't.billetera_destino_id')
				.join('wge_participantes as pa', 'pa.id', 'bd.participante_id').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
				.where('t.billetera_origen_id', billetera.id).orderBy('t.date_created', 'desc').limit(50)
				.select('t.id', 't.monto', 't.billetes', 't.date_created', 'e.nombre', 'e.apellido') : [];
			p.estudiantes = await db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
				.leftJoin('wge_billeteras as b', function () { this.on('b.participante_id', 'pa.id').andOn('b.pais_id', 'pa.pais_id'); })
				.where({ 'pa.edicion_id': edicion.id, 'pa.pais_id': p.id }).whereRaw('coalesce(pa.retirado, false) = false')
				.select('pa.id', 'pa.codigo', 'pa.presente', 'e.nombre', 'e.apellido', 'e.grado', db.raw('coalesce(b.saldo, 0)::int as saldo'))
				.orderBy([{ column: 'e.nombre' }, { column: 'e.apellido' }]);
		}
		return { edicion, denominaciones: DENOMINACIONES, paises };
	}));

	/** GET /wge/mis-ediciones: ediciones donde el usuario está en el equipo (los administrativos ven todas). */
	router.get('/mis-ediciones', ruta(async (req, rol) => {
		const q = db('wge_ediciones as e').whereNot('e.estado', 'cerrada').select('e.id', 'e.nombre', 'e.estado').orderBy('e.date_created', 'desc');
		if (rol !== ROLES.ADMIN && rol !== ROLES.ADMIN_WG) {
			q.join('wge_equipo as q', 'q.edicion_id', 'e.id').where('q.usuario_id', req.accountability.user);
		}
		return q;
	}));

	/** GET /wge/ediciones/:id/arqueo: países con el saldo del banco, último arqueo e historial. */
	router.get('/ediciones/:id/arqueo', ruta(async (req, rol) => {
		const edicion = await db('wge_ediciones').where('id', req.params.id).first('id', 'nombre', 'estado');
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		await permitir(req, rol, edicion.id);
		const consulta = db('wge_paises').where('edicion_id', edicion.id).orderBy('orden')
			.select('id', 'nombre', 'codigo_moneda', 'color', 'provision_inicial', 'provision_billetes', 'responsable_banco');
		// El colaborador del banco solo ve los países donde es el responsable del banco
		if (rol !== ROLES.ADMIN && rol !== ROLES.ADMIN_WG) consulta.where('responsable_banco', req.accountability.user);
		const paises = await consulta;
		for (const p of paises) {
			p.saldo_sistema = await saldoBanco(edicion.id, p.id);
			p.provision_inicial = Number(p.provision_inicial ?? 0);
			p.provision_billetes = (typeof p.provision_billetes === 'string' ? JSON.parse(p.provision_billetes) : p.provision_billetes) ?? {};
			p.en_circulacion = p.provision_inicial - p.saldo_sistema;
			Object.assign(p, await movimientosBanco(db, edicion.id, p.id));
		}
		const historial = await db('wge_arqueos as a').leftJoin('directus_users as u', 'u.id', 'a.user_created')
			.where('a.edicion_id', edicion.id).orderBy('a.date_created', 'desc').limit(50)
			.select('a.id', 'a.pais_id', 'a.conteo', 'a.total_contado', 'a.saldo_sistema', 'a.diferencia', 'a.observaciones', 'a.date_created',
				db.raw("trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) as responsable"));
		return { edicion, denominaciones: DENOMINACIONES, paises, historial };
	}));

	/** POST /wge/ediciones/:id/arqueos { pais_id, conteo, observaciones }: guarda el conteo y su diferencia. */
	router.post('/ediciones/:id/arqueos', ruta(async (req, rol) => {
		const edicion = await db('wge_ediciones').where('id', req.params.id).first('id');
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		await permitir(req, rol, edicion.id);
		if (typeof req.body?.pais_id !== 'string') throw new WgeError(400, 'VALOR_INVALIDO', 'Elige el país');
		const pais = await db('wge_paises').where({ id: req.body.pais_id, edicion_id: edicion.id }).first('id');
		if (!pais) throw new WgeError(400, 'VALOR_INVALIDO', 'El país no es de esta edición');
		await exigirResponsableBanco(db, { paisId: pais.id, usuarioId: req.accountability.user, rol });
		const { limpio, total } = totalDelConteo(req.body?.conteo);
		const saldo = await saldoBanco(edicion.id, pais.id);
		const fila = {
			id: crypto.randomUUID(), edicion_id: edicion.id, pais_id: pais.id, conteo: JSON.stringify(limpio),
			total_contado: total, saldo_sistema: saldo, diferencia: total - saldo,
			observaciones: typeof req.body?.observaciones === 'string' ? req.body.observaciones.trim().slice(0, 500) || null : null,
			date_created: new Date(), user_created: req.accountability.user,
		};
		await db('wge_arqueos').insert(fila);
		return { ...fila, conteo: limpio };
	}));
}
