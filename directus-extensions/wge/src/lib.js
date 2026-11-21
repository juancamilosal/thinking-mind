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
