// Funciones compartidas de WILL-GO ECONOMY.
// Todo lo que mueve billetes recibe una transacción de knex (trx) y bloquea las billeteras
// con FOR UPDATE, así dos operaciones simultáneas sobre la misma billetera se hacen en fila.

export class WgeError extends Error {
	constructor(status, code, message) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

export const ROLES = {
	BANCO: 'Banco Will Go',
	DOCENTE: 'Docente Will Go',
	CAJERO: 'Cajero Will Go',
	ADMIN_WG: 'Administrativo Will Go',
	ADMIN: 'Administrador',
};

/** Nombre del rol del usuario que hace la petición (Directus 11). */
export async function rolDelUsuario(db, accountability) {
	if (!accountability?.user) return null;
	if (accountability.admin) return ROLES.ADMIN;
	const fila = await db('directus_users as u')
		.leftJoin('directus_roles as r', 'r.id', 'u.role')
		.where('u.id', accountability.user)
		.first('r.name as nombre');
	return fila?.nombre ?? null;
}

export function exigirRol(rol, ...permitidos) {
	if (rol === ROLES.ADMIN) return;
	if (!permitidos.includes(rol)) throw new WgeError(403, 'SIN_PERMISO', 'Tu rol no puede hacer esta operación');
}

export function enteroPositivo(valor, campo) {
	const n = Number(valor);
	if (!Number.isInteger(n) || n <= 0) throw new WgeError(400, 'VALOR_INVALIDO', `${campo} debe ser un entero mayor que 0`);
	return n;
}

export function exigirTexto(valor, campo) {
	if (typeof valor !== 'string' || !valor.trim()) throw new WgeError(400, 'VALOR_INVALIDO', `Falta ${campo}`);
	return valor.trim();
}

/** Billetera de un dueño en una moneda; la crea si no existe. Siempre la devuelve bloqueada. */
export async function billeteraBloqueada(trx, { edicionId, paisId, tipo, docenteId = null, participanteId = null }) {
	const dueno = tipo === 'banco' ? 'banco' : tipo === 'docente' ? docenteId : participanteId;
	if (!dueno) throw new WgeError(400, 'VALOR_INVALIDO', 'Falta el dueño de la billetera');
	const clave = `${edicionId}:${paisId}:${tipo}:${dueno}`;
	await trx('wge_billeteras')
		.insert({
			id: crypto.randomUUID(),
			edicion_id: edicionId,
			pais_id: paisId,
			tipo_dueno: tipo,
			docente_id: docenteId,
			participante_id: participanteId,
			saldo: 0,
			consecutivo: 0,
			clave_unica: clave,
		})
		.onConflict('clave_unica')
		.ignore();
	return trx('wge_billeteras').where('clave_unica', clave).forUpdate().first();
}

export async function billeteraPorIdBloqueada(trx, id) {
	const b = await trx('wge_billeteras').where('id', id).forUpdate().first();
	if (!b) throw new WgeError(404, 'NO_EXISTE', 'La billetera no existe');
	return b;
}

/**
 * Registra un movimiento y actualiza el saldo de una billetera ya bloqueada.
 * El consecutivo único por billetera es la segunda barrera contra el gasto doble.
 */
export async function moverSaldo(trx, billetera, { tipo, monto, actor, referenciaTipo, referenciaId, clave }) {
	const saldo = Number(billetera.saldo) + monto;
	if (saldo < 0) throw new WgeError(409, 'SALDO_INSUFICIENTE', `Saldo insuficiente: hay ${billetera.saldo} billetes`);
	const consecutivo = Number(billetera.consecutivo) + 1;
	const id = crypto.randomUUID();
	await trx('wge_movimientos').insert({
		id,
		billetera_id: billetera.id,
		tipo,
		monto,
		saldo_despues: saldo,
		consecutivo,
		clave_consecutivo: `${billetera.id}:${consecutivo}`,
		clave_idempotencia: clave ?? null,
		referencia_tipo: referenciaTipo ?? null,
		referencia_id: referenciaId ?? null,
		date_created: new Date(),
		user_created: actor ?? null,
	});
	await trx('wge_billeteras').where('id', billetera.id).update({ saldo, consecutivo });
	billetera.saldo = saldo;
	billetera.consecutivo = consecutivo;
	return id;
}

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

/**
 * Si `ahora` cae dentro de una franja del horario (hora de Colombia), devuelve cuándo termina esa franja; si no, null.
 * El horario es [{ dia: "sabado", inicio: "08:00", fin: "18:00" }] o con { fecha: "2026-11-28" } en vez de día.
 */
export function finDeFranja(horario, ahora = new Date()) {
	if (!Array.isArray(horario)) return null;
	const { fecha, hora } = ahoraColombia(ahora);
	const dia = DIAS_SEMANA[new Date(`${fecha}T12:00:00Z`).getUTCDay()];
	let fin = null;
	for (const h of horario) {
		const aplica = h?.fecha ? h.fecha === fecha : String(h?.dia ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === dia;
		if (aplica && h.inicio <= hora && hora < h.fin) {
			const termina = new Date(`${fecha}T${h.fin}:00-05:00`);
			if (!fin || termina > fin) fin = termina;
		}
	}
	return fin;
}

/** Cuándo empieza la próxima franja del horario después de `ahora` (busca hasta 8 días); null si no hay. */
export function proximoInicio(horario, ahora = new Date()) {
	if (!Array.isArray(horario)) return null;
	const hoy = ahoraColombia(ahora).fecha;
	let mejor = null;
	for (let d = 0; d <= 8; d++) {
		const fecha = new Date(Date.parse(`${hoy}T12:00:00Z`) + d * 86400000).toISOString().slice(0, 10);
		const dia = DIAS_SEMANA[new Date(`${fecha}T12:00:00Z`).getUTCDay()];
		for (const h of horario) {
			const aplica = h?.fecha ? h.fecha === fecha : String(h?.dia ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === dia;
			if (!aplica || !h.inicio) continue;
			const inicio = new Date(`${fecha}T${h.inicio}:00-05:00`);
			if (inicio > ahora && (!mejor || inicio < mejor)) mejor = inicio;
		}
		if (mejor) return mejor;
	}
	return null;
}

/** Fecha y hora actuales en Colombia (UTC-5, sin horario de verano). */
export function ahoraColombia(fecha = new Date()) {
	const local = new Date(fecha.getTime() - 5 * 60 * 60 * 1000);
	return { fecha: local.toISOString().slice(0, 10), hora: local.toISOString().slice(11, 16) };
}

/** Generador pseudoaleatorio reproducible a partir de un texto (semilla auditable). */
export function aleatorioConSemilla(semilla) {
	let h = 2166136261;
	for (const c of semilla) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	return () => {
		h += 0x6d2b79f5;
		let t = h;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

const CLAVE_REPETIDA = '23505'; // unique_violation de PostgreSQL

/**
 * Trae a la edición a los estudiantes inscritos en su programa (y colegio, si la edición tiene uno).
 * No cuenta las cuentas devueltas ni trasladadas. Nunca duplica: se puede llamar cuantas veces se quiera.
 */
export async function traerInscritos(db, edicion, actor) {
	if (!edicion?.curso_id || edicion.estado === 'cerrada') return { inscritos: 0, nuevos: 0, quitados: 0 };
	const consulta = db('cuentas_cobrar as c').join('estudiantes as e', 'e.id', 'c.estudiante_id')
		.leftJoin('wge_participantes as p', function () { this.on('p.estudiante_id', 'e.id').andOnVal('p.edicion_id', edicion.id); })
		.where('c.curso_id', edicion.curso_id).whereNotIn('c.estado', ['DEVOLUCION', 'FONDOS TRASLADADOS'])
		.distinct('e.id as estudiante_id', db.raw('p.id is not null as ya_esta'));
	if (edicion.colegio_id) consulta.where('e.colegio_id', edicion.colegio_id);
	// Solo los inscritos en ESA edición del programa (la siguiente vez que el colegio repita el programa es otra edición)
	if (edicion.edicion_programa) consulta.where('c.edicion_programa', String(edicion.edicion_programa));
	const inscritos = await consulta;
	let nuevos = 0;
	for (const { estudiante_id, ya_esta } of inscritos) {
		if (ya_esta) continue;
		for (let intento = 0; intento < 5; intento++) {
			const codigo = Array.from(crypto.getRandomValues(new Uint32Array(6)), (v) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v % 32]).join('');
			try {
				const r = await db('wge_participantes').insert({
					id: crypto.randomUUID(), edicion_id: edicion.id, estudiante_id, codigo, presente: false,
					clave_unica: `${edicion.id}:${estudiante_id}`, date_created: new Date(), user_created: actor ?? null,
				}).onConflict('clave_unica').ignore().returning('id');
				if (r.length) nuevos++;
				break;
			} catch (error) {
				if (error?.code !== CLAVE_REPETIDA) throw error; // código repetido: se intenta con otro
			}
		}
	}
	const quitados = await quitarLosQueNoCorresponden(db, edicion);
	return { inscritos: inscritos.length, nuevos, quitados };
}

/**
 * Consulta (para usar dentro de whereRaw/select) que dice si el estudiante de la fila "p"/"e" corresponde a la edición:
 * es del colegio de la edición y tiene una inscripción de ese programa y de esa edición (aunque esté devuelta).
 */
export function sqlCorresponde(edicion) {
	const condiciones = ['cc.estudiante_id = e.id', 'cc.curso_id = ?'];
	const valores = [edicion.curso_id];
	if (edicion.edicion_programa) { condiciones.push('cc.edicion_programa = ?'); valores.push(String(edicion.edicion_programa)); }
	let sql = `exists (select 1 from cuentas_cobrar cc where ${condiciones.join(' and ')})`;
	if (edicion.colegio_id) { sql = `(e.colegio_id = ? and ${sql})`; valores.unshift(edicion.colegio_id); }
	return { sql, valores };
}

/**
 * Saca a los participantes que ya no corresponden a la edición (otro colegio, otra edición del programa, o sin
 * inscripción), por ejemplo después de cambiarle la oferta. Solo a quienes no tienen historial: billetes,
 * compras, inversiones ni rúbrica. Los demás se quedan y la pantalla los marca para retirarlos a mano.
 */
async function quitarLosQueNoCorresponden(db, edicion) {
	if (!edicion.curso_id) return 0;
	const ajenos = await db('wge_participantes as p').join('estudiantes as e', 'e.id', 'p.estudiante_id')
		.where('p.edicion_id', edicion.id)
		.whereRaw(`not ${sqlCorresponde(edicion).sql}`, sqlCorresponde(edicion).valores)
		.whereNotExists(db('wge_movimientos as m').join('wge_billeteras as b', 'b.id', 'm.billetera_id').whereRaw('b.participante_id = p.id'))
		.whereNotExists(db('wge_evaluaciones as ev').whereRaw('ev.participante_id = p.id'))
		.whereNotExists(db('wge_ventas as v').whereRaw('v.participante_id = p.id'))
		.whereNotExists(db('wge_inversiones as i').whereRaw('i.participante_id = p.id'))
		.pluck('p.id');
	if (!ajenos.length) return 0;
	await db.transaction(async (trx) => {
		await trx('wge_billeteras').whereIn('participante_id', ajenos).delete(); // vacías: no tienen movimientos
		await trx('wge_participantes').whereIn('id', ajenos).delete();
	});
	return ajenos.length;
}

/**
 * Entrega la bienvenida (Investment Bill) a los participantes con país que todavía no la recibieron.
 * Sale del banco del país de cada uno. Debe llamarse dentro de una transacción.
 */
export async function darBienvenida(trx, edicion, participantes, actor) {
	const monto = Number(edicion.investment_bill ?? 0);
	let entregadas = 0;
	if (monto <= 0) return entregadas;
	const ordenados = [...participantes].filter((p) => p.pais_id && !p.retirado).sort((a, b) => (a.pais_id + a.id).localeCompare(b.pais_id + b.id));
	for (const p of ordenados) {
		const banco = await billeteraBloqueada(trx, { edicionId: edicion.id, paisId: p.pais_id, tipo: 'banco' });
		const billetera = await billeteraBloqueada(trx, { edicionId: edicion.id, paisId: p.pais_id, tipo: 'estudiante', participanteId: p.id });
		if (await trx('wge_movimientos').where({ billetera_id: billetera.id, tipo: 'bienvenida' }).first('id')) continue;
		await moverSaldo(trx, banco, { tipo: 'transferencia_salida', monto: -monto, actor, referenciaTipo: 'bienvenida', referenciaId: p.id });
		await moverSaldo(trx, billetera, { tipo: 'bienvenida', monto, actor, referenciaTipo: 'bienvenida', referenciaId: p.id });
		entregadas++;
	}
	return entregadas;
}

/**
 * Un colaborador solo opera en las ediciones donde está en el equipo (los administrativos, en todas).
 * Si el docente tiene país asignado, solo maneja billetes de ese país. Devuelve la fila del equipo.
 */
export async function exigirEquipo(db, { edicionId, usuarioId, rol, paisId = null, quien = 'Tu usuario' }) {
	if (rol === ROLES.ADMIN || rol === ROLES.ADMIN_WG) return null;
	const fila = await db('wge_equipo').where({ edicion_id: edicionId, usuario_id: usuarioId }).first();
	if (!fila) throw new WgeError(403, 'FUERA_DEL_EQUIPO', `${quien} no hace parte del equipo de esta edición`);
	if (paisId && fila.pais_id && fila.pais_id !== paisId) {
		const pais = await db('wge_paises').where('id', fila.pais_id).first('nombre');
		throw new WgeError(409, 'OTRO_PAIS', `${quien === 'Tu usuario' ? 'Eres' : quien + ' es'} docente de ${pais?.nombre ?? 'otro país'}; no maneja billetes de este país`);
	}
	return fila;
}

/** Si el país tiene responsable del banco, solo esa persona (o un administrativo) opera su banco. */
export async function exigirResponsableBanco(db, { paisId, usuarioId, rol }) {
	if (rol === ROLES.ADMIN || rol === ROLES.ADMIN_WG) return;
	const pais = await db('wge_paises as p').leftJoin('directus_users as u', 'u.id', 'p.responsable_banco')
		.where('p.id', paisId).first('p.nombre', 'p.responsable_banco', 'u.first_name', 'u.last_name');
	if (pais?.responsable_banco && pais.responsable_banco !== usuarioId) {
		throw new WgeError(403, 'OTRO_RESPONSABLE', `El banco de ${pais.nombre} lo maneja ${`${pais.first_name ?? ''} ${pais.last_name ?? ''}`.trim()}`);
	}
}
