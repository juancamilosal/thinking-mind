// Generado por build.mjs: no editar a mano.
import { Readable } from 'node:stream';
import { createHash as sha256Base, randomInt as enteroSeguro, randomBytes as bytesSeguros } from 'node:crypto';
// Funciones compartidas de WILL-GO ECONOMY.
// Todo lo que mueve billetes recibe una transacción de knex (trx) y bloquea las billeteras
// con FOR UPDATE, así dos operaciones simultáneas sobre la misma billetera se hacen en fila.

class WgeError extends Error {
	constructor(status, code, message) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

const ROLES = {
	BANCO: 'Banco Will Go',
	DOCENTE: 'Docente Will Go',
	CAJERO: 'Cajero Will Go',
	ADMIN_WG: 'Administrativo Will Go',
	ADMIN: 'Administrador',
};

/** Nombre del rol del usuario que hace la petición (Directus 11). */
async function rolDelUsuario(db, accountability) {
	if (!accountability?.user) return null;
	if (accountability.admin) return ROLES.ADMIN;
	const fila = await db('directus_users as u')
		.leftJoin('directus_roles as r', 'r.id', 'u.role')
		.where('u.id', accountability.user)
		.first('r.name as nombre');
	return fila?.nombre ?? null;
}

function exigirRol(rol, ...permitidos) {
	if (rol === ROLES.ADMIN) return;
	if (!permitidos.includes(rol)) throw new WgeError(403, 'SIN_PERMISO', 'Tu rol no puede hacer esta operación');
}

function enteroPositivo(valor, campo) {
	const n = Number(valor);
	if (!Number.isInteger(n) || n <= 0) throw new WgeError(400, 'VALOR_INVALIDO', `${campo} debe ser un entero mayor que 0`);
	return n;
}

function exigirTexto(valor, campo) {
	if (typeof valor !== 'string' || !valor.trim()) throw new WgeError(400, 'VALOR_INVALIDO', `Falta ${campo}`);
	return valor.trim();
}

/** Billetera de un dueño en una moneda; la crea si no existe. Siempre la devuelve bloqueada. */
async function billeteraBloqueada(trx, { edicionId, paisId, tipo, docenteId = null, participanteId = null }) {
	// 'cuenta' es la cuenta electrónica (tarjeta débito) de un estudiante o de un docente; sus billetes quedan en el banco
	// 'banco_virtual' es la cuenta virtual del banco: dinero sin billetes, para transferir a las cuentas de los docentes
	const dueno = tipo === 'banco' || tipo === 'caja' || tipo === 'banco_virtual' ? tipo : tipo === 'docente' ? docenteId : tipo === 'cuenta' ? (participanteId ?? docenteId) : participanteId;
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

async function billeteraPorIdBloqueada(trx, id) {
	const b = await trx('wge_billeteras').where('id', id).forUpdate().first();
	if (!b) throw new WgeError(404, 'NO_EXISTE', 'La billetera no existe');
	return b;
}

/**
 * Registra un movimiento y actualiza el saldo de una billetera ya bloqueada.
 * El consecutivo único por billetera es la segunda barrera contra el gasto doble.
 */
async function moverSaldo(trx, billetera, { tipo, monto, actor, referenciaTipo, referenciaId, clave }) {
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
function finDeFranja(horario, ahora = new Date()) {
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
function proximoInicio(horario, ahora = new Date()) {
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
function ahoraColombia(fecha = new Date()) {
	const local = new Date(fecha.getTime() - 5 * 60 * 60 * 1000);
	return { fecha: local.toISOString().slice(0, 10), hora: local.toISOString().slice(11, 16) };
}

/** Generador pseudoaleatorio reproducible a partir de un texto (semilla auditable). */
function aleatorioConSemilla(semilla) {
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

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

const CLAVE_REPETIDA = '23505'; // unique_violation de PostgreSQL

/**
 * Trae a la edición a los estudiantes inscritos en su programa (y colegio, si la edición tiene uno).
 * No cuenta las cuentas devueltas ni trasladadas. Nunca duplica: se puede llamar cuantas veces se quiera.
 */
async function traerInscritos(db, edicion, actor) {
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
function sqlCorresponde(edicion) {
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
async function darBienvenida(trx, edicion, participantes, actor) {
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
async function exigirEquipo(db, { edicionId, usuarioId, rol, paisId = null, quien = 'Tu usuario' }) {
	if (rol === ROLES.ADMIN || rol === ROLES.ADMIN_WG) return null;
	const fila = await db('wge_equipo').where({ edicion_id: edicionId, usuario_id: usuarioId }).first();
	if (!fila) throw new WgeError(403, 'FUERA_DEL_EQUIPO', `${quien} no hace parte del equipo de esta edición`);
	if (paisId && fila.pais_id && fila.pais_id !== paisId) {
		const pais = await db('wge_paises').where('id', fila.pais_id).first('nombre');
		const nombrePais = pais?.nombre ?? 'otro país';
		if (quien === 'Tu usuario') throw new WgeError(409, 'OTRO_PAIS', `Eres docente de ${nombrePais}; no maneja billetes de este país`);
		throw new WgeError(409, 'OTRO_PAIS', `${quien} es docente de ${nombrePais}; no maneja billetes de este país`);
	}
	return fila;
}

/** Si el país tiene responsable del banco, solo esa persona (o un administrativo) opera su banco. */
async function exigirResponsableBanco(db, { paisId, usuarioId, rol }) {
	if (rol === ROLES.ADMIN || rol === ROLES.ADMIN_WG) return;
	const pais = await db('wge_paises as p').leftJoin('directus_users as u', 'u.id', 'p.responsable_banco')
		.where('p.id', paisId).first('p.nombre', 'p.responsable_banco', 'u.first_name', 'u.last_name');
	if (pais?.responsable_banco && pais.responsable_banco !== usuarioId) {
		throw new WgeError(403, 'OTRO_RESPONSABLE', `El banco de ${pais.nombre} lo maneja ${`${pais.first_name ?? ''} ${pais.last_name ?? ''}`.trim()}`);
	}
}

// Traducción de los mensajes de error de WILL-GO ECONOMY (es → en, fr).
// Los mensajes se siguen escribiendo en español en el código; al responder se traducen según el
// encabezado Accept-Language. Cada entrada es [español, inglés, francés]; en el texto español, $1, $2…
// marcan los valores que van dentro del mensaje (los ${...} del código) y se reinsertan tal cual.

const IDIOMAS_APP = ['es', 'en', 'fr'];

/** Idioma de la petición según Accept-Language: el primero que sea en, fr o es; si no hay, 'es'. */
function idiomaDe(req) {
	const encabezado = req?.headers?.['accept-language'];
	const texto = Array.isArray(encabezado) ? encabezado.join(',') : String(encabezado ?? '');
	const preferidos = texto.split(',')
		.map((parte, i) => {
			const [etiqueta, ...params] = parte.trim().toLowerCase().split(';');
			const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
			const peso = q ? Number(q.slice(2)) : 1;
			return { idioma: etiqueta.split('-')[0].trim(), peso: Number.isFinite(peso) ? peso : 0, i };
		})
		.filter((p) => p.peso > 0 && IDIOMAS_APP.includes(p.idioma))
		.sort((a, b) => b.peso - a.peso || a.i - b.i);
	return preferidos[0]?.idioma ?? 'es';
}

const TRADUCCIONES = [
	// Generales y sesión
	['Error interno en Will Go Economy', 'Internal error in Will Go Economy', 'Erreur interne dans Will Go Economy'],
	['Debes iniciar sesión', 'You must sign in', 'Vous devez vous connecter'],
	// Cuentas, llaves y tarjeta débito
	['Escribe o escanea la llave', 'Type or scan the key', 'Saisissez ou scannez la clé'],
	['No hay ninguna cuenta con la llave $1', 'There is no account with the key $1', "Aucun compte n'a la clé $1"],
	['Elige los billetes que consigna el estudiante', 'Choose the bills the student is depositing', "Choisissez les billets que l'élève dépose"],
	['Elige los billetes que le entregas al estudiante', 'Choose the bills you give the student', "Choisissez les billets que vous remettez à l'élève"],
	['En su cuenta solo hay $1', 'Their account only has $1', "Son compte ne contient que $1"],
	['Una transferencia electrónica no lleva billetes', 'An electronic transfer has no bills', "Un virement électronique n'a pas de billets"],
	['Esa tarjeta es de $1 $2', 'That card belongs to $1 $2', 'Cette carte appartient à $1 $2'],
	['En la cuenta virtual del banco solo hay $1', "The bank's virtual account only has $1", 'Le compte virtuel de la banque ne contient que $1'],
	['Escribe el monto a cargar', 'Enter the amount to load', 'Saisissez le montant à charger'],
	['El monto es demasiado grande', 'The amount is too large', 'Le montant est trop élevé'],
	['Tu rol no puede hacer esta operación', 'Your role cannot perform this operation', 'Votre rôle ne permet pas cette opération'],
	['$1 debe ser un entero mayor que 0', '$1 must be a whole number greater than 0', '$1 doit être un entier supérieur à 0'],
	['Falta $1', 'Missing $1', 'Il manque $1'],
	['Falta el dueño de la billetera', 'The wallet owner is missing', 'Le propriétaire du portefeuille est manquant'],
	['La billetera no existe', 'The wallet does not exist', "Le portefeuille n'existe pas"],
	['Saldo insuficiente: hay $1 billetes', 'Insufficient balance: there are $1 bills', 'Solde insuffisant : il y a $1 billets'],
	['$1 no hace parte del equipo de esta edición', "$1 is not part of this edition's team", "$1 ne fait pas partie de l'équipe de cette édition"],
	['Tu usuario no hace parte del equipo de esta edición', "You are not part of this edition's team", "Vous ne faites pas partie de l'équipe de cette édition"],
	['El docente no hace parte del equipo de esta edición', "The teacher is not part of this edition's team", "L'enseignant ne fait pas partie de l'équipe de cette édition"],
	['Eres docente de $1; no maneja billetes de este país', 'You are a teacher for $1; you cannot handle bills from this country', 'Vous êtes enseignant pour $1 ; vous ne pouvez pas gérer les billets de ce pays'],
	['Eres docente de otro país; no maneja billetes de este país', 'You are a teacher for another country; you cannot handle bills from this country', 'Vous êtes enseignant pour un autre pays ; vous ne pouvez pas gérer les billets de ce pays'],
	['$1 es docente de $2; no maneja billetes de este país', '$1 is a teacher for $2; they cannot handle bills from this country', '$1 est enseignant pour $2 ; il ne peut pas gérer les billets de ce pays'],
	['El docente es docente de $1; no maneja billetes de este país', 'The teacher is assigned to $1; they cannot handle bills from this country', "L'enseignant est affecté à $1 ; il ne peut pas gérer les billets de ce pays"],
	['El banco de $1 lo maneja $2', "$1's bank is managed by $2", 'La banque de $1 est gérée par $2'],

	// Portal de acudientes
	['Tu sesión terminó; vuelve a entrar', 'Your session has ended; please sign in again', 'Votre session a expiré ; veuillez vous reconnecter'],
	['Escribe tu número de documento', 'Enter your ID number', "Saisissez votre numéro de pièce d'identité"],
	['Ya te enviamos varios códigos; espera unos minutos y revisa tu correo', 'We already sent you several codes; wait a few minutes and check your email', 'Nous vous avons déjà envoyé plusieurs codes ; patientez quelques minutes et consultez vos e-mails'],
	['El código no es correcto o ya venció', 'The code is incorrect or has expired', 'Le code est incorrect ou a expiré'],
	['Esta ronda ya cerró; podrás votar en la siguiente', 'This round has closed; you can vote in the next one', 'Cette manche est terminée ; vous pourrez voter à la suivante'],
	['No tienes estudiantes en esta edición', 'You have no students in this edition', "Vous n'avez aucun élève dans cette édition"],
	['La empresa no está disponible', 'The company is not available', "L'entreprise n'est pas disponible"],
	['Ya usaste tus $1 votos de esta ronda; quita uno para votar por otra empresa', 'You already used your $1 votes this round; remove one to vote for another company', 'Vous avez déjà utilisé vos $1 votes de cette manche ; retirez-en un pour voter pour une autre entreprise'],

	// Administración de ediciones
	['$1 debe ser un número entero de 0 en adelante', '$1 must be a whole number, 0 or greater', '$1 doit être un nombre entier supérieur ou égal à 0'],
	['$1 debe ser un número', '$1 must be a number', '$1 doit être un nombre'],
	['A qué se dedica: máximo 160 letras', 'What it does: 160 characters max', 'Activité : 160 caractères maximum'],
	['Por qué invertir: máximo 600 letras', 'Why invest: 600 characters max', 'Pourquoi investir : 600 caractères maximum'],
	['riesgo debe ser bajo, medio o alto', 'Risk must be low, medium or high', 'Le risque doit être faible, moyen ou élevé'],
	['Parámetros del tipo de cambio inválidos', 'Invalid exchange rate settings', 'Paramètres du taux de change invalides'],
	['El tipo de cambio se calcula cada $1 minutos', 'The exchange rate can be calculated every $1 minutes', 'Le taux de change peut être calculé toutes les $1 minutes'],
	['Falta el nombre', 'The name is missing', 'Le nom est manquant'],
	['El tope mínimo debe ser menor que el máximo', 'The minimum limit must be lower than the maximum', 'La limite minimale doit être inférieure à la maximale'],
	['El horario debe ser una lista', 'The schedule must be a list', "L'horaire doit être une liste"],
	['Cada franja del horario necesita hora de inicio y de fin (inicio antes que fin)', 'Each schedule slot needs a start and end time (start before end)', 'Chaque créneau horaire doit avoir une heure de début et de fin (début avant fin)'],
	['Fecha del horario inválida', 'Invalid schedule date', "Date d'horaire invalide"],
	['Cada franja necesita un día de la semana o una fecha', 'Each slot needs a weekday or a date', 'Chaque créneau doit avoir un jour de la semaine ou une date'],
	['La edición no existe', 'The edition does not exist', "L'édition n'existe pas"],
	['Elige el programa habilitado en el colegio (con su número de edición)', 'Choose the program enabled at the school (with its edition number)', "Choisissez le programme activé dans l'école (avec son numéro d'édition)"],
	['Ya existe la edición «$1» para ese colegio, programa y número de edición', 'The edition “$1” already exists for that school, program and edition number', "L'édition « $1 » existe déjà pour cette école, ce programme et ce numéro d'édition"],
	['La edición ya fue cerrada', 'The edition has already been closed', "L'édition a déjà été clôturée"],
	['La tasa inicial no se puede cambiar con la edición abierta', 'The initial exchange rate cannot be changed while the edition is open', "Le taux initial ne peut pas être modifié pendant que l'édition est ouverte"],
	['No se puede cambiar el programa: la edición ya tiene participantes', 'The program cannot be changed: the edition already has participants', "Impossible de changer le programme : l'édition a déjà des participants"],
	['El encargado de la caja debe ser un colaborador con rol Cajero', 'The checkout manager must be a staff member with the Cashier role', 'Le responsable de la caisse doit être un collaborateur avec le rôle Caissier'],
	['Esta edición ya tiene movimientos de billetes y no se puede eliminar, para no perder el historial', 'This edition already has bill transactions and cannot be deleted, so the history is kept', "Cette édition a déjà des mouvements de billets et ne peut pas être supprimée, afin de conserver l'historique"],
	['Los países se agregan antes de abrir la edición', 'Countries are added before opening the edition', "Les pays s'ajoutent avant d'ouvrir l'édition"],
	['Falta el precio', 'The price is missing', 'Le prix est manquant'],
	['No existe', 'Does not exist', "N'existe pas"],
	['La provisión del banco se define antes de abrir la edición', "The bank's supply is set before opening the edition", "La dotation de la banque se définit avant d'ouvrir l'édition"],
	['El responsable del banco debe ser un colaborador con rol Banco', 'The bank manager must be a staff member with the Bank role', 'Le responsable de la banque doit être un collaborateur avec le rôle Banque'],
	['No hay participantes seleccionados', 'No participants selected', 'Aucun participant sélectionné'],
	['Algún participante no existe', 'A participant does not exist', "Un des participants n'existe pas"],
	['Hay estudiantes retirados en la selección; reintégralos primero', 'The selection includes withdrawn students; reinstate them first', "La sélection contient des élèves retirés ; réintégrez-les d'abord"],
	['Los participantes deben ser de la misma edición', 'Participants must be from the same edition', 'Les participants doivent appartenir à la même édition'],
	['El país no es de esta edición', 'The country is not part of this edition', 'Le pays ne fait pas partie de cette édition'],
	['$1 $2 ya tiene billetes en su moneda actual; no se puede cambiar de país', '$1 $2 already has bills in their current currency; the country cannot be changed', '$1 $2 a déjà des billets dans sa monnaie actuelle ; impossible de changer de pays'],
	['No hay cambios', 'No changes', 'Aucune modification'],
	['Escribe cuántos billetes entran al banco', 'Enter how many bills go into the bank', 'Indiquez combien de billets entrent à la banque'],
	['El país no existe', 'The country does not exist', "Le pays n'existe pas"],
	['Con la edición en preparación, edita los billetes impresos directamente', 'While the edition is being prepared, edit the printed bills directly', "Tant que l'édition est en préparation, modifiez directement les billets imprimés"],
	['No hay estudiantes seleccionados', 'No students selected', 'Aucun élève sélectionné'],
	['Algún estudiante no existe', 'A student does not exist', "Un des élèves n'existe pas"],
	['Los estudiantes deben ser de la misma edición', 'Students must be from the same edition', 'Les élèves doivent appartenir à la même édition'],
	['No hay colaboradores seleccionados', 'No staff members selected', 'Aucun collaborateur sélectionné'],
	['Algún usuario no es colaborador de Will Go', 'A user is not a Will Go staff member', "Un des utilisateurs n'est pas collaborateur de Will Go"],
	['No hace parte del equipo', 'Not part of the team', "Ne fait pas partie de l'équipe"],
	['El docente tiene billetes de otro país; primero debe entregarlos o devolverlos', 'The teacher has bills from another country; they must hand them out or return them first', "L'enseignant a des billets d'un autre pays ; il doit d'abord les distribuer ou les rendre"],
	['Tiene $1 billetes sin entregar en esta edición; primero debe entregarlos', 'They have $1 bills not yet handed out in this edition; they must hand them out first', "Il reste $1 billets non distribués dans cette édition ; ils doivent d'abord être distribués"],
	['La foto debe ser JPG, PNG o WEBP', 'The photo must be JPG, PNG or WEBP', 'La photo doit être au format JPG, PNG ou WEBP'],
	['La foto debe pesar menos de 2 MB', 'The photo must be smaller than 2 MB', 'La photo doit peser moins de 2 Mo'],

	// Arqueo, banco y caja
	['Falta el conteo de billetes', 'The bill count is missing', 'Le comptage des billets est manquant'],
	['No existe el billete de $1', 'There is no $1 bill', "Le billet de $1 n'existe pas"],
	['La cantidad de billetes de $1 debe ser un entero de 0 en adelante', 'The number of $1 bills must be a whole number, 0 or greater', 'Le nombre de billets de $1 doit être un entier supérieur ou égal à 0'],
	['Elige el país', 'Choose the country', 'Choisissez le pays'],
	['La edición todavía no tiene encargado de la caja', 'The edition does not have a checkout manager yet', "L'édition n'a pas encore de responsable de caisse"],
	['La caja la maneja $1', 'The checkout is managed by $1', 'La caisse est gérée par $1'],
	['Elige los billetes que entregas al banco', 'Choose the bills you are handing to the bank', 'Choisissez les billets que vous remettez à la banque'],
	['En la caja solo hay $1 billetes de $2', 'The checkout only has $1 bills of $2', 'La caisse ne contient que $1 billets de $2'],
	['En la caja solo hay $1 billetes de $2 para el vuelto', 'The checkout only has $1 bills of $2 for change', 'La caisse ne contient que $1 billets de $2 pour la monnaie rendue'],
	['La edición todavía no se ha abierto', 'The edition has not been opened yet', "L'édition n'a pas encore été ouverte"],
	['Escribe CERRAR para confirmar', 'Type CERRAR to confirm', 'Tapez CERRAR pour confirmer'],

	// Transferencias y GO•STORE
	['La edición no está abierta', 'The edition is not open', "L'édition n'est pas ouverte"],
	['El participante no existe', 'The participant does not exist', "Le participant n'existe pas"],
	['El estudiante fue retirado de la edición', 'The student was withdrawn from the edition', "L'élève a été retiré de l'édition"],
	['El participante no tiene país asignado', 'The participant has no country assigned', "Le participant n'a pas de pays attribué"],
	['El destinatario no es docente de Will Go', 'The recipient is not a Will Go teacher', "Le destinataire n'est pas enseignant de Will Go"],
	['En el banco solo quedan $1 billetes de $2', 'The bank only has $1 bills of $2 left', 'Il ne reste que $1 billets de $2 à la banque'],
	['Solo tienes $1 billetes de $2', 'You only have $1 bills of $2', "Vous n'avez que $1 billets de $2"],
	['tipo debe ser banco_docente o docente_estudiante', 'tipo must be banco_docente or docente_estudiante', 'tipo doit être banco_docente ou docente_estudiante'],
	['La venta no tiene productos', 'The sale has no products', "La vente n'a aucun produit"],
	['Algún producto no existe', 'A product does not exist', "Un des produits n'existe pas"],
	['$1 no está disponible en esta edición', '$1 is not available in this edition', "$1 n'est pas disponible dans cette édition"],
	['No hay suficientes unidades de $1', 'Not enough units of $1', "Il n'y a pas assez d'unités de $1"],
	['Máximo $1 de $2 por estudiante', 'Maximum $1 of $2 per student', 'Maximum $1 de $2 par élève'],
	['El total es $1; el estudiante entregó $2', 'The total is $1; the student paid $2', "Le total est de $1 ; l'élève a remis $2"],
	['El vuelto debe ser $1 (marcaste $2)', 'The change must be $1 (you entered $2)', 'La monnaie rendue doit être de $1 (vous avez indiqué $2)'],
	['El estudiante solo tiene $1 billetes', 'The student only has $1 bills', "L'élève n'a que $1 billets"],
	['Elige los billetes que entrega el estudiante', 'Choose the bills the student is handing over', "Choisissez les billets que l'élève remet"],
	['La ronda no existe en esta edición', 'The round does not exist in this edition', "La manche n'existe pas dans cette édition"],
	['La ronda ya cerró; espera la siguiente', 'The round has closed; wait for the next one', 'La manche est terminée ; attendez la suivante'],
	['La ronda no existe', 'The round does not exist', "La manche n'existe pas"],
	['La ronda ya fue cerrada', 'The round has already been closed', 'La manche a déjà été clôturée'],
	['La edición no tiene programa asignado', 'The edition has no program assigned', "L'édition n'a pas de programme attribué"],
	['La edición no tiene países', 'The edition has no countries', "L'édition n'a aucun pays"],
	['No hay ningún estudiante con ese código', 'There is no student with that code', "Aucun élève n'a ce code"],

	// Colaboradores
	['La clave debe tener al menos 8 caracteres, con letras y números', 'The password must be at least 8 characters long, with letters and numbers', 'Le mot de passe doit contenir au moins 8 caractères, avec des lettres et des chiffres'],
	['El correo no es válido', 'The email is not valid', "L'adresse e-mail n'est pas valide"],
	['Solo el administrador general puede manejar perfiles administrativos', 'Only the general administrator can manage administrative profiles', "Seul l'administrateur général peut gérer les profils administratifs"],
	['No existe el rol $1 en Directus', 'The role $1 does not exist in Directus', "Le rôle $1 n'existe pas dans Directus"],
	['El colaborador no existe o no es de Will Go', 'The staff member does not exist or is not from Will Go', "Le collaborateur n'existe pas ou n'appartient pas à Will Go"],
	['El rol debe ser docente, banco, cajero o administrativo', 'The role must be teacher, bank, cashier or administrative', 'Le rôle doit être enseignant, banque, caissier ou administratif'],
	['Ya existe un usuario con ese correo', 'A user with that email already exists', 'Un utilisateur avec cette adresse e-mail existe déjà'],
	['No puedes desactivar tu propio usuario', 'You cannot deactivate your own user', 'Vous ne pouvez pas désactiver votre propre utilisateur'],
	['estado debe ser active o suspended', 'estado must be active or suspended', 'estado doit être active ou suspended'],
	['No puedes eliminar tu propio usuario', 'You cannot delete your own user', 'Vous ne pouvez pas supprimer votre propre utilisateur'],
	['$1 ya tiene movimientos en Will-Go; para no perder el historial, desactívalo en lugar de eliminarlo', '$1 already has activity in Will-Go; to keep the history, deactivate them instead of deleting them', "$1 a déjà des mouvements dans Will-Go ; pour conserver l'historique, désactivez-le au lieu de le supprimer"],
	['$1 todavía tiene billetes; desactívalo en lugar de eliminarlo', '$1 still has bills; deactivate them instead of deleting them', '$1 a encore des billets ; désactivez-le au lieu de le supprimer'],

	// Rúbrica
	['Elige el nivel (0 a 3) de los 4 criterios', 'Choose the level (0 to 3) for all 4 criteria', 'Choisissez le niveau (0 à 3) des 4 critères'],
	['El idioma debe ser inglés o francés', 'The language must be English or French', "La langue doit être l'anglais ou le français"],
	['El estudiante no existe', 'The student does not exist', "L'élève n'existe pas"],
	['El estudiante no tiene país asignado', 'The student has no country assigned', "L'élève n'a pas de pays attribué"],
	['La calificación no existe', 'The grade does not exist', "L'évaluation n'existe pas"],
	['Solo puedes deshacer tus calificaciones', 'You can only undo your own grades', 'Vous ne pouvez annuler que vos propres évaluations'],
	['Solo se puede deshacer en los primeros $1 minutos', 'It can only be undone within the first $1 minutes', "L'annulation n'est possible que pendant les $1 premières minutes"],

	// W-Funds
	['Los billetes suman $1 y debe entregar $2', 'The bills add up to $1 and you must hand over $2', 'Les billets totalisent $1 et vous devez remettre $2'],
	['Hay una ronda abierta: ciérrala con «Cerrar y detener las rondas»', 'A round is open: close it with “Close and stop rounds”', 'Une manche est ouverte : clôturez-la avec « Clôturer et arrêter les manches »'],
	['La inversión no existe', 'The investment does not exist', "L'investissement n'existe pas"],
	['Esta inversión ya fue retirada', 'This investment has already been withdrawn', 'Cet investissement a déjà été retiré'],
	['Estamos calculando las ganancias de la ronda; intenta en un minuto', "We're calculating the round's earnings; try again in a minute", 'Nous calculons les gains de la manche ; réessayez dans une minute'],
	['Indica los billetes que le entregas al estudiante', 'Specify the bills you are handing to the student', "Indiquez les billets que vous remettez à l'élève"],
	['La ronda debe durar $1 minutos', 'The round must last $1 minutes', 'La manche doit durer $1 minutes'],
	['Ya hay una ronda abierta; ciérrala antes de abrir otra', 'A round is already open; close it before opening another', "Une manche est déjà ouverte ; clôturez-la avant d'en ouvrir une autre"],
	['Fuera del horario de la economía (o le quedan menos de 5 minutos)', 'Outside the economy schedule (or less than 5 minutes remain)', "En dehors de l'horaire de l'économie (ou il reste moins de 5 minutes)"],
];

const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Los mensajes sin valores se buscan exactos; los demás, con regex. Primero las plantillas con más texto fijo,
// para que «… billetes de $2 para el vuelto» gane sobre «… billetes de $2».
const MENSAJES_EXACTOS = new Map();
const PATRONES_MENSAJES = [];
for (const [es, en, fr] of TRADUCCIONES) {
	if (!/\$\d/.test(es)) { MENSAJES_EXACTOS.set(es, { en, fr }); continue; }
	const partes = es.split(/\$\d/);
	PATRONES_MENSAJES.push({
		regex: new RegExp(`^${partes.map(escaparRegex).join('(.+?)')}$`, 's'),
		fijo: partes.join('').length,
		en, fr,
	});
}
PATRONES_MENSAJES.sort((a, b) => b.fijo - a.fijo);

/** Cantidad de mensajes traducibles (exactos + plantillas). */
const TOTAL_MENSAJES = MENSAJES_EXACTOS.size + PATRONES_MENSAJES.length;

/** Traduce un mensaje de error (escrito en español) al idioma pedido; si no lo conoce, lo deja en español. */
function traducirMensaje(mensaje, idioma) {
	if (idioma !== 'en' && idioma !== 'fr') return mensaje;
	const texto = String(mensaje ?? '');
	const exacto = MENSAJES_EXACTOS.get(texto);
	if (exacto) return exacto[idioma];
	for (const patron of PATRONES_MENSAJES) {
		const m = patron.regex.exec(texto);
		if (m) return patron[idioma].replace(/\$(\d)/g, (_, n) => m[Number(n)] ?? '');
	}
	return mensaje;
}

// Funcionarios de WILL-GO ECONOMY: quién soy, cambio de clave y perfiles que crea el Administrativo.
// Las cuentas se crean con el servicio de usuarios de Directus (que cifra la clave), pero solo
// con roles de Will Go: desde aquí nunca se puede crear ni tocar un usuario de otra parte de la plataforma.

/** Roles que maneja la pantalla de funcionarios. */
const ROLES_FUNCIONARIOS = {
	docente: ROLES.DOCENTE,
	banco: ROLES.BANCO,
	cajero: ROLES.CAJERO,
	administrativo: ROLES.ADMIN_WG,
};
const NOMBRES_FUNCIONARIOS = Object.values(ROLES_FUNCIONARIOS);
const LLAVE_POR_NOMBRE = Object.fromEntries(Object.entries(ROLES_FUNCIONARIOS).map(([k, v]) => [v, k]));

/** Clave temporal fácil de dictar: sin letras que se confunden (0/O, 1/l/I). */
function claveTemporal() {
	const letras = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
	const numeros = '23456789';
	const elegir = (texto, n) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (v) => texto[v % texto.length]).join('');
	return `${elegir(letras, 4)}-${elegir(numeros, 4)}`;
}

/** Reglas mínimas de una clave definitiva. */
function validarClave(clave) {
	if (typeof clave !== 'string' || clave.length < 8 || !/[A-Za-z]/.test(clave) || !/\d/.test(clave)) {
		throw new WgeError(400, 'CLAVE_DEBIL', 'La clave debe tener al menos 8 caracteres, con letras y números');
	}
	return clave;
}

function validarCorreo(valor) {
	const correo = exigirTexto(valor, 'correo').toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new WgeError(400, 'VALOR_INVALIDO', 'El correo no es válido');
	return correo;
}

/** Solo el Administrador general puede crear o tocar a otro Administrativo. */
function puedeManejar(rolActor, rolDestino) {
	if (rolDestino === ROLES.ADMIN_WG && rolActor !== ROLES.ADMIN) {
		throw new WgeError(403, 'SIN_PERMISO', 'Solo el administrador general puede manejar perfiles administrativos');
	}
}

function rutasFuncionarios(router, { ruta, db, services, getSchema }) {
	const usuarios = async () => new services.UsersService({ schema: await getSchema(), accountability: null });

	const idDelRol = async (nombre) => {
		const r = await db('directus_roles').where('name', nombre).first('id');
		if (!r) throw new WgeError(500, 'ROL_NO_EXISTE', `No existe el rol ${nombre} en Directus`);
		return r.id;
	};

	const consultaFuncionarios = () => db('directus_users as u').join('directus_roles as r', 'r.id', 'u.role')
		.whereIn('r.name', NOMBRES_FUNCIONARIOS)
		.select('u.id', 'u.first_name as nombre', 'u.last_name as apellido', 'u.email', 'u.tipo_documento', 'u.numero_documento',
			'u.celular', 'u.status as estado', 'u.last_access as ultimo_ingreso', 'u.debe_cambiar_clave', 'r.name as rol_nombre');

	const comoFuncionario = (u) => ({ ...u, rol: LLAVE_POR_NOMBRE[u.rol_nombre], debe_cambiar_clave: !!u.debe_cambiar_clave });

	const funcionarioExistente = async (id) => {
		const u = await consultaFuncionarios().where('u.id', id).first();
		if (!u) throw new WgeError(404, 'NO_EXISTE', 'El colaborador no existe o no es de Will Go');
		return u;
	};

	/** GET /wge/yo: quién inició sesión y a qué parte de Will Go entra. */
	router.get('/yo', ruta(async (req, rol) => {
		const u = await db('directus_users').where('id', req.accountability.user)
			.first('id', 'first_name', 'last_name', 'email', 'role', 'debe_cambiar_clave');
		const esWillGo = [...NOMBRES_FUNCIONARIOS, ROLES.ADMIN].includes(rol);
		return {
			id: u.id, role: u.role, nombre: u.first_name, apellido: u.last_name, email: u.email,
			rol: rol === ROLES.ADMIN ? 'administrador' : (LLAVE_POR_NOMBRE[rol] ?? null),
			es_will_go: esWillGo, debe_cambiar_clave: !!u.debe_cambiar_clave,
		};
	}));

	/** POST /wge/cambiar-clave { nueva }: el usuario define su clave definitiva. */
	router.post('/cambiar-clave', ruta(async (req) => {
		const nueva = validarClave(req.body?.nueva);
		await (await usuarios()).updateOne(req.accountability.user, { password: nueva, debe_cambiar_clave: false });
		return { ok: true };
	}));

	/** GET /wge/funcionarios */
	router.get('/funcionarios', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.ADMIN_WG);
		const lista = await consultaFuncionarios().orderBy([{ column: 'u.first_name' }, { column: 'u.last_name' }]);
		return lista.map(comoFuncionario);
	}));

	/** POST /wge/funcionarios { nombre, apellido, email, rol, tipo_documento, numero_documento, celular } */
	router.post('/funcionarios', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.ADMIN_WG);
		const b = req.body ?? {};
		const rolNombre = ROLES_FUNCIONARIOS[b.rol];
		if (!rolNombre) throw new WgeError(400, 'VALOR_INVALIDO', 'El rol debe ser docente, banco, cajero o administrativo');
		puedeManejar(rol, rolNombre);
		const email = validarCorreo(b.email);
		if (await db('directus_users').whereRaw('lower(email) = ?', [email]).first('id')) {
			throw new WgeError(409, 'CORREO_EXISTE', 'Ya existe un usuario con ese correo');
		}
		const clave = claveTemporal();
		const id = await (await usuarios()).createOne({
			first_name: exigirTexto(b.nombre, 'nombre'), last_name: exigirTexto(b.apellido, 'apellido'), email,
			tipo_documento: b.tipo_documento || null, numero_documento: b.numero_documento ? String(b.numero_documento).trim() : null,
			celular: b.celular ? String(b.celular).trim() : null,
			role: await idDelRol(rolNombre), status: 'active', password: clave, debe_cambiar_clave: true,
		});
		return { funcionario: comoFuncionario(await funcionarioExistente(id)), clave_temporal: clave };
	}));

	/** PATCH /wge/funcionarios/:id { nombre, apellido, rol, tipo_documento, numero_documento, celular, estado } */
	router.patch('/funcionarios/:id', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.ADMIN_WG);
		const actual = await funcionarioExistente(req.params.id);
		puedeManejar(rol, actual.rol_nombre);
		if (req.params.id === req.accountability.user && req.body?.estado && req.body.estado !== 'active') {
			throw new WgeError(409, 'VALOR_INVALIDO', 'No puedes desactivar tu propio usuario');
		}
		const b = req.body ?? {};
		const cambios = {};
		if (b.nombre !== undefined) cambios.first_name = exigirTexto(b.nombre, 'nombre');
		if (b.apellido !== undefined) cambios.last_name = exigirTexto(b.apellido, 'apellido');
		for (const campo of ['tipo_documento', 'numero_documento', 'celular']) if (b[campo] !== undefined) cambios[campo] = b[campo] ? String(b[campo]).trim() : null;
		if (b.estado !== undefined) {
			if (!['active', 'suspended'].includes(b.estado)) throw new WgeError(400, 'VALOR_INVALIDO', 'estado debe ser active o suspended');
			cambios.status = b.estado;
		}
		if (b.rol !== undefined) {
			const nuevo = ROLES_FUNCIONARIOS[b.rol];
			if (!nuevo) throw new WgeError(400, 'VALOR_INVALIDO', 'El rol debe ser docente, banco, cajero o administrativo');
			puedeManejar(rol, nuevo);
			cambios.role = await idDelRol(nuevo);
		}
		if (Object.keys(cambios).length) await (await usuarios()).updateOne(req.params.id, cambios);
		return comoFuncionario(await funcionarioExistente(req.params.id));
	}));

	/**
	 * DELETE /wge/funcionarios/:id: elimina al colaborador si nunca movió nada en Will-Go.
	 * Si ya tiene historial (entregas, ventas, calificaciones…) no se borra para no perderlo: se desactiva.
	 */
	router.delete('/funcionarios/:id', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.ADMIN_WG);
		const actual = await funcionarioExistente(req.params.id);
		puedeManejar(rol, actual.rol_nombre);
		const id = req.params.id;
		if (id === req.accountability.user) throw new WgeError(409, 'VALOR_INVALIDO', 'No puedes eliminar tu propio usuario');
		const conHistorial = [
			['wge_movimientos', 'user_created'], ['wge_transferencias', 'user_created'], ['wge_evaluaciones', 'user_created'],
			['wge_ventas', 'user_created'], ['wge_inversiones', 'user_created'], ['wge_inversiones', 'cobrado_por'], ['wge_arqueos', 'user_created'],
		];
		for (const [tabla, campo] of conHistorial) {
			if (await db(tabla).where(campo, id).first(db.raw('1'))) {
				throw new WgeError(409, 'TIENE_HISTORIAL', `${actual.nombre} ya tiene movimientos en Will-Go; para no perder el historial, desactívalo en lugar de eliminarlo`);
			}
		}
		if (await db('wge_billeteras').where('docente_id', id).where('saldo', '>', 0).first('id')) {
			throw new WgeError(409, 'TIENE_BILLETES', `${actual.nombre} todavía tiene billetes; desactívalo en lugar de eliminarlo`);
		}
		await db.transaction(async (trx) => {
			await trx('wge_equipo').where('usuario_id', id).delete();
			await trx('wge_paises').where('responsable_banco', id).update({ responsable_banco: null });
			await trx('wge_ediciones').where('responsable_caja', id).update({ responsable_caja: null });
			await trx('wge_billeteras').where('docente_id', id).delete();
		});
		await (await usuarios()).deleteOne(id);
		return { eliminado: true };
	}));

	/** POST /wge/funcionarios/:id/restablecer-clave: nueva clave temporal (se muestra una sola vez). */
	router.post('/funcionarios/:id/restablecer-clave', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.ADMIN_WG);
		const actual = await funcionarioExistente(req.params.id);
		puedeManejar(rol, actual.rol_nombre);
		const clave = claveTemporal();
		await (await usuarios()).updateOne(req.params.id, { password: clave, debe_cambiar_clave: true });
		return { funcionario: comoFuncionario(await funcionarioExistente(req.params.id)), clave_temporal: clave };
	}));
}

// Avisos por correo a los colaboradores cuando quedan asignados a una edición (equipo, banco de un país o caja).

/** Dónde entran los colaboradores. */
const URL_APP_COLABORADORES = 'https://appthinkingmind.com/login-will-go';

const NOMBRE_ROL_AVISO = {
	es: { [ROLES.DOCENTE]: 'Docente', [ROLES.BANCO]: 'Banco', [ROLES.CAJERO]: 'Cajero', [ROLES.ADMIN_WG]: 'Administrativo' },
	en: { [ROLES.DOCENTE]: 'Teacher', [ROLES.BANCO]: 'Bank', [ROLES.CAJERO]: 'Cashier', [ROLES.ADMIN_WG]: 'Administrative staff' },
	fr: { [ROLES.DOCENTE]: 'Enseignant', [ROLES.BANCO]: 'Banque', [ROLES.CAJERO]: 'Caissier', [ROLES.ADMIN_WG]: 'Administratif' },
};

const DIAS_AVISO = {
	es: { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' },
	en: { lunes: 'Monday', martes: 'Tuesday', miercoles: 'Wednesday', jueves: 'Thursday', viernes: 'Friday', sabado: 'Saturday', domingo: 'Sunday' },
	fr: { lunes: 'Lundi', martes: 'Mardi', miercoles: 'Mercredi', jueves: 'Jeudi', viernes: 'Vendredi', sabado: 'Samedi', domingo: 'Dimanche' },
};

const LOCALE_AVISO = { es: 'es-CO', en: 'en-US', fr: 'fr-FR' };

const TEXTOS_AVISO = {
	es: {
		asunto: (ed) => `Quedaste en el equipo de ${ed} · Will-Go Economy`,
		hola: (n) => `Hola, ${n}`,
		intro: { equipo: 'Te agregaron como colaborador de esta edición de Will-Go Economy.', banco: (p) => `Quedaste como <b>responsable del banco de ${p}</b> en esta edición de Will-Go Economy.`, caja: 'Quedaste como <b>encargado de la caja de GO•STORE</b> en esta edición de Will-Go Economy.' },
		edicion: 'Edición', colegio: 'Colegio', programa: 'Programa', rol: 'Tu rol', pais: 'País', inicio: 'Inicio', fin: 'Fin', horario: 'Horario',
		numero: (n) => `Edición ${n}`, sinFecha: 'Por definir', sinHorario: 'Por definir', todosPaises: 'Todos los países',
		entrar: 'Entrar a Will-Go', usuario: (c) => `Tu usuario es <b>${c}</b>. Si es tu primera vez, usa la clave temporal que te entregó el administrativo.`,
		pie: 'Este correo se envió porque te asignaron en Will-Go Economy de Thinking Mind.',
	},
	en: {
		asunto: (ed) => `You're on the team for ${ed} · Will-Go Economy`,
		hola: (n) => `Hi ${n},`,
		intro: { equipo: 'You were added as a staff member of this Will-Go Economy edition.', banco: (p) => `You are now <b>in charge of the ${p} bank</b> in this Will-Go Economy edition.`, caja: 'You are now <b>in charge of the GO•STORE checkout</b> in this Will-Go Economy edition.' },
		edicion: 'Edition', colegio: 'School', programa: 'Program', rol: 'Your role', pais: 'Country', inicio: 'Starts', fin: 'Ends', horario: 'Schedule',
		numero: (n) => `Edition ${n}`, sinFecha: 'To be defined', sinHorario: 'To be defined', todosPaises: 'All countries',
		entrar: 'Go to Will-Go', usuario: (c) => `Your username is <b>${c}</b>. If this is your first time, use the temporary password the administrative staff gave you.`,
		pie: 'You received this email because you were assigned in Will-Go Economy by Thinking Mind.',
	},
	fr: {
		asunto: (ed) => `Vous faites partie de l'équipe de ${ed} · Will-Go Economy`,
		hola: (n) => `Bonjour ${n},`,
		intro: { equipo: 'Vous avez été ajouté comme collaborateur de cette édition de Will-Go Economy.', banco: (p) => `Vous êtes désormais <b>responsable de la banque de ${p}</b> dans cette édition de Will-Go Economy.`, caja: 'Vous êtes désormais <b>responsable de la caisse GO•STORE</b> dans cette édition de Will-Go Economy.' },
		edicion: 'Édition', colegio: 'École', programa: 'Programme', rol: 'Votre rôle', pais: 'Pays', inicio: 'Début', fin: 'Fin', horario: 'Horaire',
		numero: (n) => `Édition ${n}`, sinFecha: 'À définir', sinHorario: 'À définir', todosPaises: 'Tous les pays',
		entrar: 'Accéder à Will-Go', usuario: (c) => `Votre identifiant est <b>${c}</b>. Si c'est votre première connexion, utilisez le mot de passe temporaire remis par l'administration.`,
		pie: "Vous recevez cet e-mail car vous avez été affecté dans Will-Go Economy de Thinking Mind.",
	},
};

const limpiarHtml = (v) => String(v ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
const leerJsonAviso = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

function fechaAviso(valor, idioma) {
	if (!valor) return null;
	const d = new Date(valor);
	if (Number.isNaN(d.getTime())) return null;
	return d.toLocaleDateString(LOCALE_AVISO[idioma], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** «Sábado 08:00–18:00 · Domingo 08:00–18:00» (o fechas exactas). */
function horarioAviso(horario, idioma = 'es') {
	const lista = leerJsonAviso(horario);
	if (!Array.isArray(lista) || !lista.length) return null;
	return lista.map((h) => {
		const cuando = h.fecha ? fechaAviso(h.fecha, idioma) : (DIAS_AVISO[idioma][String(h.dia ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()] ?? h.dia);
		return `${cuando} ${h.inicio}–${h.fin}`;
	}).join(' · ');
}

/**
 * Asunto y HTML del aviso. `encargo`: 'equipo' (lo agregaron al equipo), 'banco' (responsable del banco de `pais`)
 * o 'caja' (encargado de la caja).
 */
function correoAsignacion({ nombre, correo, rol, encargo = 'equipo', pais = null, edicion, idioma = 'es' }) {
	const l = TEXTOS_AVISO[idioma] ? idioma : 'es';
	const t = TEXTOS_AVISO[l];
	const intro = encargo === 'banco' ? t.intro.banco(limpiarHtml(pais)) : encargo === 'caja' ? t.intro.caja : t.intro.equipo;
	const filas = [
		[t.edicion, `${limpiarHtml(edicion.nombre)}${edicion.edicion_programa ? ` · ${t.numero(limpiarHtml(edicion.edicion_programa))}` : ''}`],
		[t.colegio, limpiarHtml(edicion.colegio) || '—'],
		[t.programa, limpiarHtml(edicion.programa) || '—'],
		[t.rol, NOMBRE_ROL_AVISO[l][rol] ?? limpiarHtml(rol)],
		...(encargo === 'banco' || rol === ROLES.DOCENTE ? [[t.pais, limpiarHtml(pais) || t.todosPaises]] : []),
		[t.inicio, fechaAviso(edicion.fecha_inicio, l) ?? t.sinFecha],
		[t.fin, fechaAviso(edicion.fecha_fin, l) ?? t.sinFecha],
		[t.horario, horarioAviso(edicion.horario, l) ?? t.sinHorario],
	];
	const tabla = filas.map(([k, v]) => `<tr><td style="padding:8px 12px;color:#6b7280;font-size:14px;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:8px 12px;font-size:14px;color:#111827;font-weight:600">${v}</td></tr>`).join('');
	return {
		subject: t.asunto(String(edicion.nombre ?? '')),
		html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#1f2937">
			<p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:3px;color:#ff6b1a">WILL-GO ECONOMY</p>
			<h2 style="margin:0 0 12px">${t.hola(limpiarHtml(nombre))}</h2>
			<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${intro}</p>
			<table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px">${tabla}</table>
			<p style="margin:24px 0"><a href="${URL_APP_COLABORADORES}" style="background:#ff6b1a;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:10px;display:inline-block">${t.entrar}</a></p>
			<p style="font-size:14px;color:#374151;line-height:1.5">${t.usuario(limpiarHtml(correo))}</p>
			<p style="font-size:12px;color:#9ca3af;margin-top:24px">${t.pie}</p></div>`,
	};
}

/**
 * Envía el aviso a cada colaborador. Nunca hace fallar la operación que lo dispara: si el correo falla, queda en el log.
 * avisos: [{ usuarioId, encargo, paisId }]
 */
async function enviarAvisos({ db, services, getSchema, env, logger }, edicionId, avisos, idioma = 'es') {
	if (!avisos.length || !services?.MailService) return 0;
	try {
		const edicion = await db('wge_ediciones as e').leftJoin('colegios as c', 'c.id', 'e.colegio_id').leftJoin('Cursos as k', 'k.id', 'e.curso_id')
			.where('e.id', edicionId).first('e.nombre', 'e.edicion_programa', 'e.fecha_inicio', 'e.fecha_fin', 'e.horario', 'c.nombre as colegio', 'k.nombre as programa');
		if (!edicion) return 0;
		const mail = new services.MailService({ schema: await getSchema(), knex: db });
		let enviados = 0;
		for (const a of avisos) {
			try {
				const u = await db('directus_users as u').join('directus_roles as r', 'r.id', 'u.role').where('u.id', a.usuarioId)
					.first('u.email', 'u.first_name', 'u.status', 'r.name as rol');
				if (!u?.email || u.status !== 'active') continue;
				// País: el del encargo (banco) o el que tenga en el equipo (docente)
				let paisId = a.paisId ?? null;
				if (!paisId && a.encargo !== 'banco') paisId = (await db('wge_equipo').where({ edicion_id: edicionId, usuario_id: a.usuarioId }).first('pais_id'))?.pais_id ?? null;
				const pais = paisId ? (await db('wge_paises').where('id', paisId).first('nombre'))?.nombre : null;
				const contenido = correoAsignacion({ nombre: u.first_name, correo: u.email, rol: u.rol, encargo: a.encargo, pais, edicion, idioma });
				await mail.send({ to: u.email, ...(env?.EMAIL_FROM ? { from: { name: 'Thinking Mind', address: env.EMAIL_FROM } } : {}), ...contenido });
				enviados++;
			} catch (error) {
				logger?.warn?.(`wge: no se pudo enviar el aviso a ${a.usuarioId}: ${error?.message ?? error}`);
			}
		}
		return enviados;
	} catch (error) {
		logger?.warn?.(`wge: avisos de la edición ${edicionId} no enviados: ${error?.message ?? error}`);
		return 0;
	}
}

// Administración de ediciones de WILL-GO ECONOMY (pantalla "Edición y participantes").
// Todo pasa por aquí con una lista de campos permitidos: los roles de Will Go no tocan /items de Directus,
// y ningún campo de dinero (saldos, tasas vigentes, movimientos) se puede escribir desde esta pantalla.

const CAMPOS_JSON = ['horario', 'parametros_fx'];
/** Cada cuántos minutos puede recalcularse el tipo de cambio (dividen la hora exacta, así los cálculos caen en horas redondas). */
const INTERVALOS_FX = [10, 15, 20, 30, 60];

/** Qué se puede leer y escribir de cada parte de una edición. */
const SECCIONES = {
	paises: { tabla: 'wge_paises', campos: ['nombre', 'codigo_moneda', 'color', 'orden', 'responsable_banco'], orden: 'orden' },
	productos: { tabla: 'wge_productos', campos: ['nombre', 'foto', 'precio_cop', 'stock', 'maximo_por_estudiante', 'activo'], orden: 'nombre' },
	fondos: { tabla: 'wge_fondos', campos: ['nombre', 'historia', 'logo', 'a_que_se_dedica', 'por_que_invertir', 'riesgo', 'rendimiento_base', 'rendimiento_alterno', 'variacion', 'activo', 'orden'], orden: 'orden' },
};
const CAMPOS_EDICION = ['nombre', 'colegio_id', 'curso_id', 'edicion_programa', 'fecha_inicio', 'fecha_fin', 'horario', 'tasa_inicial', 'tope_minimo', 'tope_maximo', 'parametros_fx', 'investment_bill', 'responsable_caja'];

/** Lo que trae toda edición nueva (se puede cambiar después). */
const PAISES_POR_DEFECTO = [
	{ nombre: 'Wonderland', codigo_moneda: 'WON', color: '#3B82F6', orden: 1 },
	{ nombre: 'Neverland', codigo_moneda: 'NEV', color: '#22C55E', orden: 2 },
	{ nombre: 'Dreamland', codigo_moneda: 'DRE', color: '#A855F7', orden: 3 },
];
/** Países para una edición nueva: los de la última edición creada, o PAISES_POR_DEFECTO si no hay ninguna. */
async function paisesDeReferencia(db) {
	const ultima = await db('wge_ediciones').orderBy('date_created', 'desc').first('id');
	const previos = ultima ? await db('wge_paises').where('edicion_id', ultima.id).orderBy('orden').select('nombre', 'codigo_moneda', 'color', 'orden') : [];
	return previos.length ? previos.map((p, i) => ({ nombre: p.nombre, codigo_moneda: p.codigo_moneda, color: p.color, orden: p.orden ?? i + 1 })) : PAISES_POR_DEFECTO;
}

const FONDOS_POR_DEFECTO = [
	{ nombre: 'CAPI GREEN', riesgo: 'bajo', rendimiento_base: 0.03, rendimiento_alterno: null, variacion: 0.02,
		a_que_se_dedica: 'Sembramos bosques y producimos energía con el sol y el viento.',
		por_que_invertir: 'Todo el mundo necesita energía limpia\nCrece despacio, pero seguro\nCuidas el planeta mientras ganas' },
	{ nombre: 'OCEAN GUARDIANS', riesgo: 'bajo', rendimiento_base: 0.02, rendimiento_alterno: null, variacion: 0.02,
		a_que_se_dedica: 'Limpiamos los océanos y reciclamos el plástico que sacamos del mar.',
		por_que_invertir: 'Cada vez más empresas pagan por reciclar\nEs la inversión más tranquila\nAyudas a salvar a los animales del mar' },
	{ nombre: 'LEGO FUTURE', riesgo: 'medio', rendimiento_base: 0.06, rendimiento_alterno: null, variacion: 0.05,
		a_que_se_dedica: 'Diseñamos juguetes y robots para aprender construyendo.',
		por_que_invertir: 'Niños de todo el mundo quieren nuestros productos\nInventamos algo nuevo cada temporada\nPuede ganar más que un fondo tranquilo' },
	{ nombre: 'LES ARTISTES', riesgo: 'medio', rendimiento_base: 0.05, rendimiento_alterno: null, variacion: 0.05,
		a_que_se_dedica: 'Producimos música, películas y arte de nuevos talentos.',
		por_que_invertir: 'Un solo éxito puede hacernos ganar mucho\nTrabajamos con artistas de todos los países\nEl público siempre busca algo nuevo' },
	{ nombre: 'NOVA AI', riesgo: 'alto', rendimiento_base: 0.1, rendimiento_alterno: -0.08, variacion: 0.12,
		a_que_se_dedica: 'Creamos inteligencia artificial que ayuda a las personas a resolver problemas e inventar el futuro.',
		por_que_invertir: 'La inteligencia artificial está en todas partes\nSi nuestro invento funciona, es el fondo que más gana\nOjo: si el invento falla, puedes perder billetes' },
];

/**
 * Lo último que se cargó de cada empresa en cualquier edición (por nombre): logo y textos.
 * Sirve para que las ediciones nuevas y los fondos vacíos los reutilicen.
 */
async function fondosCargados(db) {
	const filas = await db('wge_fondos').where((w) => w.whereNotNull('logo').orWhereNotNull('a_que_se_dedica'))
		.orderBy('date_created', 'desc').select('nombre', 'logo', 'a_que_se_dedica', 'por_que_invertir', 'date_created');
	const porNombre = new Map();
	for (const f of filas) {
		const n = String(f.nombre ?? '').trim().toUpperCase();
		const previo = porNombre.get(n) ?? {};
		porNombre.set(n, {
			logo: previo.logo ?? f.logo ?? null,
			a_que_se_dedica: previo.a_que_se_dedica ?? f.a_que_se_dedica ?? null,
			por_que_invertir: previo.por_que_invertir ?? f.por_que_invertir ?? null,
		});
	}
	// Si ninguna edición conserva el logo (p. ej. se borraron todas), se busca en los archivos subidos:
	// los logos se guardan con el título «Will-Go · logo-<NOMBRE>.<ext>»
	for (const archivo of await logosGuardados(db)) {
		const previo = porNombre.get(archivo.nombre) ?? {};
		if (!previo.logo) porNombre.set(archivo.nombre, { ...previo, logo: archivo.id });
	}
	return porNombre;
}

/** Logos de fondos subidos alguna vez (directus_files con título «Will-Go · logo-…»), el más reciente por nombre. */
async function logosGuardados(db) {
	let filas = [];
	try {
		filas = await db('directus_files').where('title', 'like', 'Will-Go · logo-%').orderBy('uploaded_on', 'desc').select('id', 'title');
	} catch { return []; }
	const vistos = new Map();
	for (const f of filas) {
		const nombre = String(f.title).replace(/^Will-Go · logo-/, '').replace(/\.[a-z0-9]+$/i, '').trim().toUpperCase();
		if (nombre && !vistos.has(nombre)) vistos.set(nombre, { id: f.id, nombre });
	}
	return [...vistos.values()];
}

/** Texto de ejemplo para un fondo (por su nombre o, si no, por su posición). */
function ejemploDeFondo(fondo) {
	const n = String(fondo?.nombre ?? '').trim().toUpperCase();
	const f = FONDOS_POR_DEFECTO.find((x) => x.nombre === n) ?? FONDOS_POR_DEFECTO[(Number(fondo?.orden) || 0) - 1];
	return f ? { a_que_se_dedica: f.a_que_se_dedica, por_que_invertir: f.por_que_invertir } : null;
}

const ENTEROS = ['provision_inicial', 'orden', 'precio_cop', 'stock', 'maximo_por_estudiante', 'tasa_inicial', 'investment_bill'];
const DECIMALES = ['rendimiento_base', 'rendimiento_alterno', 'variacion', 'tope_minimo', 'tope_maximo'];

/** Deja solo los campos permitidos y revisa que los números tengan sentido. */
function limpiar(datos, permitidos) {
	const fila = {};
	for (const campo of permitidos) {
		if (!(campo in (datos ?? {}))) continue;
		let v = datos[campo];
		if (v === '' || v === undefined) v = null;
		if (v !== null && ENTEROS.includes(campo)) {
			v = Number(v);
			if (!Number.isInteger(v) || v < 0) throw new WgeError(400, 'VALOR_INVALIDO', `${campo} debe ser un número entero de 0 en adelante`);
		}
		if (v !== null && DECIMALES.includes(campo)) {
			v = Number(v);
			if (!Number.isFinite(v)) throw new WgeError(400, 'VALOR_INVALIDO', `${campo} debe ser un número`);
		}
		if (v !== null && campo === 'a_que_se_dedica' && String(v).length > 160) throw new WgeError(400, 'VALOR_INVALIDO', 'A qué se dedica: máximo 160 letras');
		if (v !== null && campo === 'por_que_invertir' && String(v).length > 600) throw new WgeError(400, 'VALOR_INVALIDO', 'Por qué invertir: máximo 600 letras');
		if (campo === 'riesgo' && v !== null && !['bajo', 'medio', 'alto'].includes(v)) throw new WgeError(400, 'VALOR_INVALIDO', 'riesgo debe ser bajo, medio o alto');
		if (campo === 'horario' && v !== null) v = validarHorario(v);
		if (campo === 'parametros_fx' && v !== null) {
			if (typeof v !== 'object' || Array.isArray(v)) throw new WgeError(400, 'VALOR_INVALIDO', 'Parámetros del tipo de cambio inválidos');
			if ('intervalo_minutos' in v && !INTERVALOS_FX.includes(Number(v.intervalo_minutos))) {
				throw new WgeError(400, 'VALOR_INVALIDO', `El tipo de cambio se calcula cada ${INTERVALOS_FX.join(', ')} minutos`);
			}
			if ('intervalo_minutos' in v) v = { ...v, intervalo_minutos: Number(v.intervalo_minutos) };
		}
		if (CAMPOS_JSON.includes(campo) && v !== null) v = JSON.stringify(v);
		if (typeof v === 'string' && !CAMPOS_JSON.includes(campo)) v = v.trim();
		fila[campo] = v;
	}
	if ('nombre' in fila && !fila.nombre) throw new WgeError(400, 'VALOR_INVALIDO', 'Falta el nombre');
	if (fila.tope_minimo != null && fila.tope_maximo != null && fila.tope_minimo >= fila.tope_maximo) {
		throw new WgeError(400, 'VALOR_INVALIDO', 'El tope mínimo debe ser menor que el máximo');
	}
	return fila;
}

const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIAS_HORARIO = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
function validarHorario(horario) {
	if (!Array.isArray(horario)) throw new WgeError(400, 'VALOR_INVALIDO', 'El horario debe ser una lista');
	return horario.map((h) => {
		if (!HORA_VALIDA.test(h?.inicio ?? '') || !HORA_VALIDA.test(h?.fin ?? '') || h.inicio >= h.fin) {
			throw new WgeError(400, 'VALOR_INVALIDO', 'Cada franja del horario necesita hora de inicio y de fin (inicio antes que fin)');
		}
		if (h.fecha) {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(h.fecha)) throw new WgeError(400, 'VALOR_INVALIDO', 'Fecha del horario inválida');
			return { fecha: h.fecha, inicio: h.inicio, fin: h.fin };
		}
		if (!DIAS_HORARIO.includes(h?.dia)) throw new WgeError(400, 'VALOR_INVALIDO', 'Cada franja necesita un día de la semana o una fecha');
		return { dia: h.dia, inicio: h.inicio, fin: h.fin };
	});
}

function rutasAdmin(router, { ruta, db, services, getSchema, env, logger }) {
	/** Avisa por correo a los colaboradores asignados (sin esperar: el correo nunca frena ni hace fallar la operación). */
	const avisar = (req, edicionId, avisos) => { enviarAvisos({ db, services, getSchema, env, logger }, edicionId, avisos, idiomaDe(req)).catch(() => {}); };

	const soloAdmin = (rol) => exigirRol(rol, ROLES.ADMIN_WG);
	const nueva = (actor, fila) => ({ id: crypto.randomUUID(), ...fila, date_created: new Date(), user_created: actor });

	const edicionExistente = async (id) => {
		const e = await db('wge_ediciones').where('id', id).first();
		if (!e) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		return e;
	};

	/** Una sola edición de Will-Go por oferta (colegio + programa + número de edición). */
	const validarOferta = async (fila, idActual = null) => {
		if (!fila.curso_id || !fila.edicion_programa) throw new WgeError(400, 'VALOR_INVALIDO', 'Elige el programa habilitado en el colegio (con su número de edición)');
		const repetida = await db('wge_ediciones').where({ curso_id: fila.curso_id, edicion_programa: String(fila.edicion_programa) })
			.where((q) => (fila.colegio_id ? q.where('colegio_id', fila.colegio_id) : q.whereNull('colegio_id')))
			.modify((q) => { if (idActual) q.whereNot('id', idActual); }).first('nombre');
		if (repetida) throw new WgeError(409, 'OFERTA_REPETIDA', `Ya existe la edición «${repetida.nombre}» para ese colegio, programa y número de edición`);
	};

	const resumenEdicion = async (e) => {
		const activos = () => db('wge_participantes').where('edicion_id', e.id).whereRaw('coalesce(retirado, false) = false');
		const [{ total }] = await activos().count({ total: '*' });
		const [{ sinPais }] = await activos().whereNull('pais_id').count({ sinPais: '*' });
		const [{ retirados }] = await db('wge_participantes').where({ edicion_id: e.id, retirado: true }).count({ retirados: '*' });
		const [{ equipo }] = await db('wge_equipo').where('edicion_id', e.id).count({ equipo: '*' });
		const colegio = e.colegio_id ? await db('colegios').where('id', e.colegio_id).first('nombre') : null;
		const programa = e.curso_id ? await db('Cursos').where('id', e.curso_id).first('nombre') : null;
		return {
			...e, colegio_nombre: colegio?.nombre ?? null, programa_nombre: programa?.nombre ?? null,
			participantes: Number(total), sin_pais: Number(sinPais), retirados: Number(retirados), equipo: Number(equipo),
		};
	};

	/** Listas para los selectores del formulario. */
	router.get('/admin/catalogos', ruta(async (req, rol) => {
		soloAdmin(rol);
		const [colegios, programas, ofertas] = await Promise.all([
			db('colegios').select('id', 'nombre').orderBy('nombre'),
			db('Cursos').select('id', 'nombre').orderBy('nombre'),
			// Cada programa habilitado en un colegio con su número de edición (lo que se elige al crear la edición)
			db('colegios_cursos as cc').join('Cursos as k', 'k.id', 'cc.curso_id').leftJoin('colegios as c', 'c.id', 'cc.colegio_id')
				.whereNotNull('cc.edicion')
				.select('cc.id', 'cc.colegio_id', 'c.nombre as colegio', 'cc.curso_id', 'k.nombre as programa', 'cc.edicion', 'cc.fecha_finalizacion',
					db.raw(`(select we.nombre from wge_ediciones we where we.colegio_id is not distinct from cc.colegio_id
						and we.curso_id = cc.curso_id and we.edicion_programa = cc.edicion::text limit 1) as edicion_will_go`))
				.orderBy([{ column: 'k.nombre' }, { column: 'c.nombre' }]),
		]);
		return { colegios, programas, ofertas };
	}));

	router.get('/admin/ediciones', ruta(async (req, rol) => {
		soloAdmin(rol);
		const ediciones = await db('wge_ediciones').orderBy('date_created', 'desc');
		for (const e of ediciones) await traerInscritos(db, e, req.accountability.user);
		return Promise.all(ediciones.map(resumenEdicion));
	}));

	/** Crea la edición con sus 3 países y los 5 fondos de siempre. */
	router.post('/admin/ediciones', ruta(async (req, rol) => {
		soloAdmin(rol);
		const actor = req.accountability.user;
		const fila = limpiar(req.body, CAMPOS_EDICION);
		exigirTexto(fila.nombre, 'nombre');
		await validarOferta(fila);
		const id = await db.transaction(async (trx) => {
			const edicion = nueva(actor, {
				tasa_inicial: 1000, tope_minimo: 0.7, tope_maximo: 1.8, investment_bill: 0,
				horario: JSON.stringify([{ dia: 'sabado', inicio: '08:00', fin: '18:00' }, { dia: 'domingo', inicio: '08:00', fin: '18:00' }]),
				parametros_fx: JSON.stringify({}), zona_horaria: 'America/Bogota', ...fila, estado: 'borrador',
			});
			await trx('wge_ediciones').insert(edicion);
			// Los países salen como en la última edición creada (nombre, moneda y color); si no hay, los de siempre
			await trx('wge_paises').insert((await paisesDeReferencia(trx)).map((p) => nueva(actor, { ...p, edicion_id: edicion.id, provision_inicial: 0 })));
			// Cada fondo trae el logo y los textos que ya se cargaron en otras ediciones (si no, los de ejemplo)
			const cargados = await fondosCargados(trx);
			await trx('wge_fondos').insert(FONDOS_POR_DEFECTO.map((f, i) => {
				const c = cargados.get(f.nombre);
				return nueva(actor, {
					...f, edicion_id: edicion.id, activo: true, orden: i + 1, logo: c?.logo ?? null,
					a_que_se_dedica: c?.a_que_se_dedica || f.a_que_se_dedica, por_que_invertir: c?.por_que_invertir || f.por_que_invertir,
				});
			}));
			return edicion.id;
		});
		return resumenEdicion(await edicionExistente(id));
	}));

	router.get('/admin/ediciones/:id', ruta(async (req, rol) => {
		soloAdmin(rol);
		const e = await edicionExistente(req.params.id);
		const { nuevos, quitados } = await traerInscritos(db, e, req.accountability.user);
		return { ...(await resumenEdicion(e)), nuevos, quitados };
	}));

	router.patch('/admin/ediciones/:id', ruta(async (req, rol) => {
		soloAdmin(rol);
		const e = await edicionExistente(req.params.id);
		if (e.estado === 'cerrada') throw new WgeError(409, 'EDICION_CERRADA', 'La edición ya fue cerrada');
		const fila = limpiar(req.body, CAMPOS_EDICION);
		if (e.estado === 'abierta' && 'tasa_inicial' in fila && fila.tasa_inicial !== e.tasa_inicial) {
			throw new WgeError(409, 'EDICION_ABIERTA', 'La tasa inicial no se puede cambiar con la edición abierta');
		}
		if ('curso_id' in fila && fila.curso_id !== e.curso_id) {
			const [{ n }] = await db('wge_participantes').where('edicion_id', e.id).count({ n: '*' });
			if (Number(n) > 0) throw new WgeError(409, 'TIENE_PARTICIPANTES', 'No se puede cambiar el programa: la edición ya tiene participantes');
		}
		if (['colegio_id', 'curso_id', 'edicion_programa'].some((k) => k in fila)) {
			await validarOferta({ colegio_id: e.colegio_id, curso_id: e.curso_id, edicion_programa: e.edicion_programa, ...fila }, e.id);
		}
		if (fila.responsable_caja) {
			const esCajero = await db('directus_users as u').join('directus_roles as r', 'r.id', 'u.role')
				.where({ 'u.id': fila.responsable_caja, 'r.name': ROLES.CAJERO }).first('u.id');
			if (!esCajero) throw new WgeError(400, 'VALOR_INVALIDO', 'El encargado de la caja debe ser un colaborador con rol Cajero');
			// Queda en el equipo de la edición
			await db('wge_equipo').insert(nueva(req.accountability.user, {
				edicion_id: e.id, usuario_id: fila.responsable_caja, clave_unica: `${e.id}:${fila.responsable_caja}`,
			})).onConflict('clave_unica').ignore();
		}
		if (Object.keys(fila).length) await db('wge_ediciones').where('id', e.id).update(fila);
		if (fila.responsable_caja && fila.responsable_caja !== e.responsable_caja) avisar(req, e.id, [{ usuarioId: fila.responsable_caja, encargo: 'caja' }]);
		const actualizada = await edicionExistente(e.id);
		const { nuevos, quitados } = await traerInscritos(db, actualizada, req.accountability.user);
		return { ...(await resumenEdicion(actualizada)), nuevos, quitados };
	}));

	/**
	 * DELETE /wge/admin/ediciones/:id
	 * Solo si nunca se movió un billete (ni provisión, ni ventas, ni inversiones): así no se pierde dinero ni historial.
	 * Borra todo lo que cuelga de la edición; los estudiantes y los pagos de la plataforma no se tocan.
	 */
	router.delete('/admin/ediciones/:id', ruta(async (req, rol) => {
		soloAdmin(rol);
		const e = await edicionExistente(req.params.id);
		return db.transaction(async (trx) => {
			const conMovimientos = await trx('wge_movimientos as m').join('wge_billeteras as b', 'b.id', 'm.billetera_id')
				.where('b.edicion_id', e.id).first('m.id');
			const conVentas = await trx('wge_ventas').where('edicion_id', e.id).first('id');
			if (conMovimientos || conVentas) {
				throw new WgeError(409, 'TIENE_MOVIMIENTOS', 'Esta edición ya tiene movimientos de billetes y no se puede eliminar, para no perder el historial');
			}
			const rondas = trx('wge_rondas').where('edicion_id', e.id).select('id');
			const participantes = trx('wge_participantes').where('edicion_id', e.id).select('id');
			const paises = trx('wge_paises').where('edicion_id', e.id).select('id');
			await trx('wge_votos').whereIn('ronda_id', rondas).delete();
			await trx('wge_inversiones').whereIn('ronda_id', rondas).delete();
			await trx('wge_rondas').where('edicion_id', e.id).delete();
			await trx('wge_evaluaciones').whereIn('participante_id', participantes).delete();
			await trx('wge_transferencias').where('edicion_id', e.id).delete();
			await trx('wge_billeteras').where('edicion_id', e.id).delete();
			await trx('wge_fx').whereIn('pais_id', paises).delete();
			await trx('wge_participantes').where('edicion_id', e.id).delete();
			await trx('wge_productos').where('edicion_id', e.id).delete();
			await trx('wge_fondos').where('edicion_id', e.id).delete();
			await trx('wge_equipo').where('edicion_id', e.id).delete();
			await trx('wge_paises').where('edicion_id', e.id).delete();
			await trx('wge_ediciones').where('id', e.id).delete();
			return { eliminada: true, nombre: e.nombre };
		});
	}));

	// Países, productos y fondos de una edición
	for (const [nombre, s] of Object.entries(SECCIONES)) {
		router.get(`/admin/ediciones/:id/${nombre}`, ruta(async (req, rol) => {
			soloAdmin(rol);
			await edicionExistente(req.params.id);
			const filas = await db(s.tabla).where('edicion_id', req.params.id).orderBy(s.orden);
			if (nombre === 'paises') {
				// Cuánto hay en el banco y cuánto circula (provisión que ya salió del banco)
				for (const p of filas) {
					const banco = await db('wge_billeteras').where({ edicion_id: req.params.id, pais_id: p.id, tipo_dueno: 'banco' }).first('saldo');
					const provisto = await db('wge_movimientos as m').join('wge_billeteras as b', 'b.id', 'm.billetera_id')
						.where({ 'b.edicion_id': req.params.id, 'b.pais_id': p.id, 'b.tipo_dueno': 'banco', 'm.tipo': 'provision' }).sum({ t: 'm.monto' }).first();
					p.saldo_banco = Number(banco?.saldo ?? 0);
					p.saldo_virtual = (await virtualDelBanco(db, req.params.id, p.id)).saldo;
					p.en_circulacion = Number(provisto?.t ?? 0) - p.saldo_banco;
				}
			}
			if (nombre === 'fondos') for (const f of filas) f.ejemplo = ejemploDeFondo(f);
			return filas;
		}));

		router.post(`/admin/ediciones/:id/${nombre}`, ruta(async (req, rol) => {
			soloAdmin(rol);
			const e = await edicionExistente(req.params.id);
			if (nombre === 'paises' && e.estado !== 'borrador') throw new WgeError(409, 'EDICION_ABIERTA', 'Los países se agregan antes de abrir la edición');
			const fila = nueva(req.accountability.user, { ...limpiar(req.body, s.campos), edicion_id: e.id });
			exigirTexto(fila.nombre, 'nombre');
			if (nombre === 'productos' && fila.precio_cop == null) throw new WgeError(400, 'VALOR_INVALIDO', 'Falta el precio');
			await db(s.tabla).insert(fila);
			return db(s.tabla).where('id', fila.id).first();
		}));

		router.patch(`/admin/${nombre}/:itemId`, ruta(async (req, rol) => {
			soloAdmin(rol);
			const actual = await db(s.tabla).where('id', req.params.itemId).first();
			if (!actual) throw new WgeError(404, 'NO_EXISTE', 'No existe');
			const e = await edicionExistente(actual.edicion_id);
			const fila = limpiar(req.body, s.campos);
			if (nombre === 'paises' && req.body && 'provision_billetes' in req.body) {
				// La provisión se define por billetes impresos: el total sale del conteo
				const { limpio, total } = totalDelConteo(req.body.provision_billetes ?? {});
				fila.provision_billetes = JSON.stringify(limpio);
				fila.provision_inicial = total;
			}
			if (nombre === 'paises' && e.estado !== 'borrador' && 'provision_inicial' in fila && fila.provision_inicial !== actual.provision_inicial) {
				throw new WgeError(409, 'EDICION_ABIERTA', 'La provisión del banco se define antes de abrir la edición');
			}
			if (nombre === 'paises' && fila.responsable_banco) {
				const esBanco = await db('directus_users as u').join('directus_roles as r', 'r.id', 'u.role')
					.where({ 'u.id': fila.responsable_banco, 'r.name': ROLES.BANCO }).first('u.id');
				if (!esBanco) throw new WgeError(400, 'VALOR_INVALIDO', 'El responsable del banco debe ser un colaborador con rol Banco');
				// Queda en el equipo de la edición
				await db('wge_equipo').insert(nueva(req.accountability.user, {
					edicion_id: actual.edicion_id, usuario_id: fila.responsable_banco, clave_unica: `${actual.edicion_id}:${fila.responsable_banco}`,
				})).onConflict('clave_unica').ignore();
			}
			// Aviso por correo al nuevo responsable del banco (cuando el cambio quede guardado)
			const avisarBanco = nombre === 'paises' && fila.responsable_banco && fila.responsable_banco !== actual.responsable_banco
				? () => avisar(req, actual.edicion_id, [{ usuarioId: fila.responsable_banco, encargo: 'banco', paisId: actual.id }]) : () => {};
			if (nombre === 'paises' && 'provision_inicial' in fila && e.estado === 'borrador') {
				// El banco recibe los billetes apenas se registran (y se ajusta si se corrigen), para poder contarlos antes de abrir
				await db.transaction(async (trx) => {
					await trx(s.tabla).where('id', actual.id).update(fila);
					const banco = await billeteraBloqueada(trx, { edicionId: e.id, paisId: actual.id, tipo: 'banco' });
					const diferencia = Number(fila.provision_inicial) - Number(banco.saldo);
					if (diferencia !== 0) {
						await moverSaldo(trx, banco, {
							tipo: diferencia > 0 ? 'provision' : 'reverso', monto: diferencia, actor: req.accountability.user,
							referenciaTipo: 'provision', referenciaId: actual.id,
						});
					}
					await igualarVirtual(trx, e.id, actual.id, req.accountability.user);
				});
				avisarBanco();
				return db(s.tabla).where('id', actual.id).first();
			}
			if (Object.keys(fila).length) await db(s.tabla).where('id', actual.id).update(fila);
			avisarBanco();
			return db(s.tabla).where('id', actual.id).first();
		}));
	}

	/** Los productos con ventas no se borran: se desactivan, para no perder el historial. */
	router.delete('/admin/productos/:itemId', ruta(async (req, rol) => {
		soloAdmin(rol);
		const p = await db('wge_productos').where('id', req.params.itemId).first();
		if (!p) throw new WgeError(404, 'NO_EXISTE', 'No existe');
		if (await db('wge_venta_items').where('producto_id', p.id).first('id')) {
			await db('wge_productos').where('id', p.id).update({ activo: false });
			return { borrado: false, desactivado: true };
		}
		await db('wge_productos').where('id', p.id).delete();
		return { borrado: true };
	}));

	/** Participantes con su nombre, colegio, país y saldo. */
	router.get('/admin/ediciones/:id/participantes', ruta(async (req, rol) => {
		soloAdmin(rol);
		const e = await edicionExistente(req.params.id);
		await traerInscritos(db, e, req.accountability.user);
		return db('wge_participantes as p')
			.join('estudiantes as e', 'e.id', 'p.estudiante_id')
			.leftJoin('colegios as c', 'c.id', 'e.colegio_id')
			.leftJoin('wge_billeteras as b', function () { this.on('b.participante_id', 'p.id').andOn('b.pais_id', 'p.pais_id').andOnVal('b.tipo_dueno', 'estudiante'); })
			.where('p.edicion_id', req.params.id)
			.select('p.id', 'p.codigo', 'p.pais_id', 'p.presente', 'p.retirado', 'p.motivo_retiro', 'p.fecha_retiro',
				'e.nombre', 'e.apellido', 'e.grado', 'e.colegio_id', 'c.nombre as colegio', db.raw('coalesce(b.saldo, 0)::int as saldo'),
				// Pidió reembolso: todas sus cuentas del programa están devueltas o trasladadas
				db.raw(`${sqlCorresponde(e).sql} as corresponde`, sqlCorresponde(e).valores),
				db.raw(`not exists (select 1 from cuentas_cobrar cc where cc.estudiante_id = e.id and cc.curso_id = ?
					and cc.estado not in ('DEVOLUCION', 'FONDOS TRASLADADOS')) as pidio_reembolso`, [e.curso_id]))
			.orderBy([{ column: 'e.apellido' }, { column: 'e.nombre' }]);
	}));

	/**
	 * PATCH /wge/admin/participantes { ids, pais_id?, presente? }
	 * No se cambia de país a quien ya tiene billetes en otra moneda: los billetes no se convierten solos.
	 */
	router.patch('/admin/participantes', ruta(async (req, rol) => {
		soloAdmin(rol);
		const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === 'string') : [];
		if (!ids.length) throw new WgeError(400, 'VALOR_INVALIDO', 'No hay participantes seleccionados');
		const cambios = {};
		const lista = await db('wge_participantes').whereIn('id', ids);
		if (lista.length !== ids.length) throw new WgeError(404, 'NO_EXISTE', 'Algún participante no existe');
		if (lista.some((p) => p.retirado)) throw new WgeError(409, 'RETIRADO', 'Hay estudiantes retirados en la selección; reintégralos primero');
		const ediciones = new Set(lista.map((p) => p.edicion_id));
		if (ediciones.size !== 1) throw new WgeError(400, 'VALOR_INVALIDO', 'Los participantes deben ser de la misma edición');
		if ('pais_id' in (req.body ?? {})) {
			const paisId = req.body.pais_id || null;
			if (paisId && !(await db('wge_paises').where({ id: paisId, edicion_id: [...ediciones][0] }).first('id'))) {
				throw new WgeError(400, 'VALOR_INVALIDO', 'El país no es de esta edición');
			}
			const conBilletes = await db('wge_billeteras as b').join('wge_participantes as p', 'p.id', 'b.participante_id')
				.join('estudiantes as e', 'e.id', 'p.estudiante_id')
				.whereIn('b.participante_id', ids).where('b.saldo', '<>', 0)
				.modify((q) => { if (paisId) q.whereNot('b.pais_id', paisId); })
				.first('e.nombre', 'e.apellido');
			if (conBilletes) throw new WgeError(409, 'TIENE_BILLETES', `${conBilletes.nombre} ${conBilletes.apellido} ya tiene billetes en su moneda actual; no se puede cambiar de país`);
			cambios.pais_id = paisId;
		}
		if ('presente' in (req.body ?? {})) cambios.presente = !!req.body.presente;
		if (!Object.keys(cambios).length) throw new WgeError(400, 'VALOR_INVALIDO', 'No hay cambios');
		const edicion = await edicionExistente([...ediciones][0]);
		// Con la edición abierta, quien recibe país recibe también su bienvenida, en la misma operación
		return db.transaction(async (trx) => {
			await trx('wge_participantes').whereIn('id', ids).update(cambios);
			let bienvenidas = 0;
			if (cambios.pais_id && edicion.estado === 'abierta') {
				bienvenidas = await darBienvenida(trx, edicion, await trx('wge_participantes').whereIn('id', ids), req.accountability.user);
			}
			return { actualizados: ids.length, bienvenidas };
		});
	}));

	/**
	 * POST /wge/admin/paises/:id/cargar-virtual { monto }
	 * Carga saldo a la cuenta virtual del banco de un país (dinero sin billetes). Con él el banco transfiere a las
	 * cuentas de los docentes. Solo suma; se puede cargar en preparación o con la edición abierta.
	 */
	router.post('/admin/paises/:id/cargar-virtual', ruta(async (req, rol) => {
		soloAdmin(rol);
		const monto = Number(req.body?.monto);
		if (!Number.isInteger(monto) || monto <= 0) throw new WgeError(400, 'VALOR_INVALIDO', 'Escribe el monto a cargar');
		if (monto > 1_000_000_000) throw new WgeError(400, 'VALOR_INVALIDO', 'El monto es demasiado grande');
		return db.transaction(async (trx) => {
			const pais = await trx('wge_paises').where('id', req.params.id).forUpdate().first();
			if (!pais) throw new WgeError(404, 'NO_EXISTE', 'El país no existe');
			const e = await trx('wge_ediciones').where('id', pais.edicion_id).first();
			if (e.estado === 'cerrada') throw new WgeError(409, 'EDICION_CERRADA', 'La edición ya fue cerrada');
			const virtual = await billeteraBloqueada(trx, { edicionId: e.id, paisId: pais.id, tipo: 'banco_virtual' });
			await moverSaldo(trx, virtual, { tipo: 'carga_virtual', monto, actor: req.accountability.user, referenciaTipo: 'carga_virtual', referenciaId: pais.id });
			return { cargado: monto, saldo_virtual: Number(virtual.saldo) };
		});
	}));

	/**
	 * POST /wge/admin/paises/:id/provisionar { billetes: { "1": 100, ... }, nota }
	 * Con la edición abierta, agrega billetes impresos al banco de un país (solo suma: lo que ya salió puede estar
	 * circulando). Queda un movimiento de provisión y se actualiza el detalle de billetes del país.
	 */
	router.post('/admin/paises/:id/provisionar', ruta(async (req, rol) => {
		soloAdmin(rol);
		const actor = req.accountability.user;
		const { limpio, total } = totalDelConteo(req.body?.billetes ?? {});
		if (total <= 0) throw new WgeError(400, 'VALOR_INVALIDO', 'Escribe cuántos billetes entran al banco');
		return db.transaction(async (trx) => {
			const pais = await trx('wge_paises').where('id', req.params.id).forUpdate().first();
			if (!pais) throw new WgeError(404, 'NO_EXISTE', 'El país no existe');
			const e = await trx('wge_ediciones').where('id', pais.edicion_id).first();
			if (e.estado === 'cerrada') throw new WgeError(409, 'EDICION_CERRADA', 'La edición ya fue cerrada');
			if (e.estado === 'borrador') throw new WgeError(409, 'EDICION_EN_PREPARACION', 'Con la edición en preparación, edita los billetes impresos directamente');
			const banco = await billeteraBloqueada(trx, { edicionId: e.id, paisId: pais.id, tipo: 'banco' });
			await moverSaldo(trx, banco, { tipo: 'provision', monto: total, actor, referenciaTipo: 'provision_adicional', referenciaId: pais.id });
			const previos = (typeof pais.provision_billetes === 'string' ? JSON.parse(pais.provision_billetes) : pais.provision_billetes) ?? {};
			const suma = { ...previos };
			for (const [d, n] of Object.entries(limpio)) suma[d] = Number(suma[d] ?? 0) + n;
			await trx('wge_paises').where('id', pais.id).update({
				provision_billetes: JSON.stringify(suma), provision_inicial: Number(pais.provision_inicial ?? 0) + total,
			});
			await igualarVirtual(trx, e.id, pais.id, actor);
			return { agregado: total, saldo_banco: banco.saldo, provision_total: Number(pais.provision_inicial ?? 0) + total };
		});
	}));

	/**
	 * POST /wge/admin/participantes/retirar { ids, motivo }
	 * El estudiante queda fuera de la edición (no vuelve con la carga automática de inscritos).
	 * Si tiene billetes, vuelven al banco de su país; si tiene una inversión abierta, no se puede retirar todavía.
	 */
	router.post('/admin/participantes/retirar', ruta(async (req, rol) => {
		soloAdmin(rol);
		const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === 'string') : [];
		if (!ids.length) throw new WgeError(400, 'VALOR_INVALIDO', 'No hay estudiantes seleccionados');
		const motivo = exigirTexto(req.body?.motivo, 'motivo').slice(0, 200);
		const actor = req.accountability.user;
		return db.transaction(async (trx) => {
			const lista = await trx('wge_participantes as p').join('estudiantes as e', 'e.id', 'p.estudiante_id')
				.whereIn('p.id', ids).orderBy('p.id').select('p.*', 'e.nombre', 'e.apellido');
			if (lista.length !== ids.length) throw new WgeError(404, 'NO_EXISTE', 'Algún estudiante no existe');
			if (new Set(lista.map((p) => p.edicion_id)).size !== 1) throw new WgeError(400, 'VALOR_INVALIDO', 'Los estudiantes deben ser de la misma edición');
			// Sus inversiones en W-Funds se retiran primero (vuelven a su saldo) y luego todo su saldo vuelve al banco
			const vigentes = await trx('wge_inversiones').whereIn('participante_id', ids).whereIn('estado', ['abierta', 'por_cobrar']).orderBy('id').forUpdate();
			for (const inv of vigentes) await retirarInversion(trx, inv, actor);
			let devueltos = 0;
			for (const p of lista) {
				if (p.retirado) continue;
				const billeteras = await trx('wge_billeteras').where('participante_id', p.id).where('saldo', '>', 0).orderBy('id');
				for (const b of billeteras) {
					const est = await billeteraBloqueada(trx, { edicionId: b.edicion_id, paisId: b.pais_id, tipo: b.tipo_dueno, participanteId: p.id });
					const banco = await billeteraBloqueada(trx, { edicionId: b.edicion_id, paisId: b.pais_id, tipo: 'banco' });
					const saldo = Number(est.saldo);
					if (saldo <= 0) continue;
					await moverSaldo(trx, est, { tipo: 'reverso', monto: -saldo, actor, referenciaTipo: 'retiro', referenciaId: p.id });
					await moverSaldo(trx, banco, { tipo: 'reverso', monto: saldo, actor, referenciaTipo: 'retiro', referenciaId: p.id });
					devueltos += saldo;
				}
			}
			await trx('wge_participantes').whereIn('id', ids).update({ retirado: true, motivo_retiro: motivo, fecha_retiro: new Date(), presente: false });
			return { retirados: ids.length, billetes_devueltos: devueltos };
		});
	}));

	/** POST /wge/admin/participantes/reintegrar { ids }: vuelve a la edición (sin billetes; la bienvenida no se repite). */
	router.post('/admin/participantes/reintegrar', ruta(async (req, rol) => {
		soloAdmin(rol);
		const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === 'string') : [];
		if (!ids.length) throw new WgeError(400, 'VALOR_INVALIDO', 'No hay estudiantes seleccionados');
		const n = await db('wge_participantes').whereIn('id', ids).update({ retirado: false, motivo_retiro: null, fecha_retiro: null });
		return { reintegrados: n };
	}));

	// ---------- Equipo de la edición ----------
	const ROLES_EQUIPO = { [ROLES.DOCENTE]: 'docente', [ROLES.BANCO]: 'banco', [ROLES.CAJERO]: 'cajero', [ROLES.ADMIN_WG]: 'administrativo' };

	/** GET /wge/admin/ediciones/:id/equipo: colaboradores de la edición con su rol, país y billetes en mano. */
	router.get('/admin/ediciones/:id/equipo', ruta(async (req, rol) => {
		soloAdmin(rol);
		const e = await edicionExistente(req.params.id);
		const filas = await db('wge_equipo as q').join('directus_users as u', 'u.id', 'q.usuario_id')
			.leftJoin('directus_roles as r', 'r.id', 'u.role').leftJoin('wge_paises as pa', 'pa.id', 'q.pais_id')
			.where('q.edicion_id', e.id)
			.select('q.id', 'q.usuario_id', 'q.pais_id', 'pa.nombre as pais', 'u.first_name as nombre', 'u.last_name as apellido', 'u.email',
				'u.status as estado', 'r.name as rol_nombre',
				db.raw(`coalesce((select sum(b.saldo) from wge_billeteras b where b.edicion_id = q.edicion_id
					and b.tipo_dueno = 'docente' and b.docente_id = q.usuario_id), 0)::int as billetes`))
			.orderBy([{ column: 'u.first_name' }, { column: 'u.last_name' }]);
		return filas.map((f) => ({ ...f, rol: ROLES_EQUIPO[f.rol_nombre] ?? null }));
	}));

	/** POST /wge/admin/ediciones/:id/equipo { usuario_ids }: agrega colaboradores (solo usuarios con rol de Will Go). */
	router.post('/admin/ediciones/:id/equipo', ruta(async (req, rol) => {
		soloAdmin(rol);
		const e = await edicionExistente(req.params.id);
		const ids = Array.isArray(req.body?.usuario_ids) ? req.body.usuario_ids.filter((x) => typeof x === 'string') : [];
		if (!ids.length) throw new WgeError(400, 'VALOR_INVALIDO', 'No hay colaboradores seleccionados');
		const validos = await db('directus_users as u').join('directus_roles as r', 'r.id', 'u.role')
			.whereIn('u.id', ids).whereIn('r.name', Object.keys(ROLES_EQUIPO)).pluck('u.id');
		if (validos.length !== ids.length) throw new WgeError(400, 'VALOR_INVALIDO', 'Algún usuario no es colaborador de Will Go');
		const r = await db('wge_equipo').insert(validos.map((usuario_id) => nueva(req.accountability.user, {
			edicion_id: e.id, usuario_id, clave_unica: `${e.id}:${usuario_id}`,
		}))).onConflict('clave_unica').ignore().returning('usuario_id');
		// Aviso por correo a quienes quedaron en el equipo (los que ya estaban no reciben otro)
		avisar(req, e.id, r.map((x) => ({ usuarioId: x.usuario_id ?? x, encargo: 'equipo' })));
		return { agregados: r.length };
	}));

	/** POST /wge/admin/ediciones/:id/equipo/avisar: reenvía el aviso a todo el equipo (p. ej. si cambiaron fechas u horario). */
	router.post('/admin/ediciones/:id/equipo/avisar', ruta(async (req, rol) => {
		soloAdmin(rol);
		const e = await edicionExistente(req.params.id);
		const equipo = await db('wge_equipo').where('edicion_id', e.id).pluck('usuario_id');
		const bancos = new Map((await db('wge_paises').where('edicion_id', e.id).whereNotNull('responsable_banco').select('id', 'responsable_banco')).map((p) => [p.responsable_banco, p.id]));
		const avisos = equipo.map((usuarioId) => (usuarioId === e.responsable_caja ? { usuarioId, encargo: 'caja' }
			: bancos.has(usuarioId) ? { usuarioId, encargo: 'banco', paisId: bancos.get(usuarioId) } : { usuarioId, encargo: 'equipo' }));
		const enviados = await enviarAvisos({ db, services, getSchema, env, logger }, e.id, avisos, idiomaDe(req));
		return { equipo: equipo.length, enviados };
	}));

	/** PATCH /wge/admin/equipo/:id { pais_id }: país del docente (o null para que maneje todos). */
	router.patch('/admin/equipo/:id', ruta(async (req, rol) => {
		soloAdmin(rol);
		const fila = await db('wge_equipo').where('id', req.params.id).first();
		if (!fila) throw new WgeError(404, 'NO_EXISTE', 'No hace parte del equipo');
		const paisId = req.body?.pais_id || null;
		if (paisId && !(await db('wge_paises').where({ id: paisId, edicion_id: fila.edicion_id }).first('id'))) {
			throw new WgeError(400, 'VALOR_INVALIDO', 'El país no es de esta edición');
		}
		const conBilletes = await db('wge_billeteras').where({ edicion_id: fila.edicion_id, docente_id: fila.usuario_id }).whereIn('tipo_dueno', ['docente', 'cuenta'])
			.where('saldo', '>', 0).modify((q) => { if (paisId) q.whereNot('pais_id', paisId); }).first('id');
		if (conBilletes) throw new WgeError(409, 'TIENE_BILLETES', 'El docente tiene billetes de otro país; primero debe entregarlos o devolverlos');
		await db('wge_equipo').where('id', fila.id).update({ pais_id: paisId });
		return { ok: true };
	}));

	/** DELETE /wge/admin/equipo/:id: lo saca del equipo (si no tiene billetes en mano en esta edición). */
	router.delete('/admin/equipo/:id', ruta(async (req, rol) => {
		soloAdmin(rol);
		const fila = await db('wge_equipo').where('id', req.params.id).first();
		if (!fila) throw new WgeError(404, 'NO_EXISTE', 'No hace parte del equipo');
		const [{ suma }] = await db('wge_billeteras').where({ edicion_id: fila.edicion_id, docente_id: fila.usuario_id }).whereIn('tipo_dueno', ['docente', 'cuenta']).sum({ suma: 'saldo' });
		if (Number(suma) > 0) throw new WgeError(409, 'TIENE_BILLETES', `Tiene ${Number(suma)} billetes sin entregar en esta edición; primero debe entregarlos`);
		await db('wge_equipo').where('id', fila.id).delete();
		return { quitado: true };
	}));

	/** GET /wge/admin/logos-fondos: logos ya cargados en cualquier edición (para elegir uno sin volver a subirlo). */
	router.get('/admin/logos-fondos', ruta(async (req, rol) => {
		soloAdmin(rol);
		const filas = await db('wge_fondos').whereNotNull('logo').orderBy('date_created', 'desc').select('logo', 'nombre');
		const vistos = new Map();
		for (const f of filas) if (!vistos.has(f.logo)) vistos.set(f.logo, { id: f.logo, nombre: f.nombre });
		// También los logos subidos que ya no están en ninguna edición
		for (const a of await logosGuardados(db)) if (!vistos.has(a.id)) vistos.set(a.id, { id: a.id, nombre: a.nombre });
		return [...vistos.values()];
	}));

	/** POST /wge/admin/ediciones/:id/fondos/completar: llena los fondos sin logo o sin textos con lo ya cargado (por nombre). */
	router.post('/admin/ediciones/:id/fondos/completar', ruta(async (req, rol) => {
		soloAdmin(rol);
		const e = await edicionExistente(req.params.id);
		const cargados = await fondosCargados(db);
		let completados = 0;
		for (const f of await db('wge_fondos').where('edicion_id', e.id)) {
			const c = cargados.get(String(f.nombre ?? '').trim().toUpperCase());
			const ej = ejemploDeFondo(f);
			const cambios = {};
			if (!f.logo && c?.logo) cambios.logo = c.logo;
			if (!f.a_que_se_dedica && (c?.a_que_se_dedica || ej?.a_que_se_dedica)) cambios.a_que_se_dedica = c?.a_que_se_dedica || ej.a_que_se_dedica;
			if (!f.por_que_invertir && (c?.por_que_invertir || ej?.por_que_invertir)) cambios.por_que_invertir = c?.por_que_invertir || ej.por_que_invertir;
			if (Object.keys(cambios).length) { await db('wge_fondos').where('id', f.id).update(cambios); completados++; }
		}
		return { completados };
	}));

	/** POST /wge/admin/fotos { nombre, tipo, base64 }: foto de un producto o logo de un fondo (la pantalla la reduce antes de enviarla). */
	router.post('/admin/fotos', ruta(async (req, rol) => {
		soloAdmin(rol);
		const tipo = String(req.body?.tipo ?? '');
		if (!['image/jpeg', 'image/png', 'image/webp'].includes(tipo)) throw new WgeError(400, 'VALOR_INVALIDO', 'La foto debe ser JPG, PNG o WEBP');
		const datos = Buffer.from(String(req.body?.base64 ?? ''), 'base64');
		if (!datos.length || datos.length > 2_000_000) throw new WgeError(400, 'VALOR_INVALIDO', 'La foto debe pesar menos de 2 MB');
		const archivos = new services.FilesService({ schema: await getSchema(), accountability: null });
		const nombre = String(req.body?.nombre || 'producto').replace(/[^\w.\- ]/g, '').slice(0, 80) || 'producto';
		const id = await archivos.uploadOne(Readable.from(datos), {
			filename_download: nombre, type: tipo, storage: 'local', title: `Will-Go · ${nombre}`,
		});
		return { id };
	}));

	/** GET /wge/foto/:id: muestra la foto de un producto o el logo de un fondo a cualquier colaborador (sin abrir directus_files). */
	router.get('/foto/:id', async (req, res) => {
		try {
			if (!req.accountability?.user) return res.status(401).end();
			const esFoto = (await db('wge_productos').where('foto', req.params.id).first('id')) || (await db('wge_fondos').where('logo', req.params.id).first('id'));
			if (!esFoto) return res.status(404).end();
			const activos = new services.AssetsService({ schema: await getSchema(), accountability: null });
			const { stream, file } = await activos.getAsset(req.params.id, { transformationParams: { width: 480, height: 480, fit: 'cover', quality: 80 } });
			res.setHeader('Content-Type', file.type ?? 'image/jpeg');
			res.setHeader('Cache-Control', 'private, max-age=86400');
			stream.pipe(res);
		} catch {
			res.status(404).end();
		}
	});
}

// Arqueo del banco: conteo de billetes físicos por denominación y su cuadre contra el saldo del sistema.

/** Denominaciones impresas de cada país (iguales en Wonderland, Neverland y Dreamland). */
const DENOMINACIONES = [1, 2, 5, 10, 50, 100, 200, 1000, 5000, 50000];

/** Valida el conteo { "1": 40, "5": 20, ... } y devuelve el conteo limpio y su total. */
function totalDelConteo(conteo) {
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
/** Dinero en las cuentas electrónicas (tarjetas) de un país: sus billetes están guardados en el banco. */
async function saldoCuentas(db, edicionId, paisId) {
	const r = await db('wge_billeteras').where({ edicion_id: edicionId, pais_id: paisId, tipo_dueno: 'cuenta' }).sum({ s: 'saldo' }).first();
	return Number(r?.s ?? 0);
}

/**
 * Cuenta virtual del banco de un país: su saldo y todo lo que el administrador ha cargado (dinero que no tiene
 * billetes impresos detrás).
 */
async function virtualDelBanco(db, edicionId, paisId) {
	const b = await db('wge_billeteras').where({ edicion_id: edicionId, pais_id: paisId, tipo_dueno: 'banco_virtual' }).first('id', 'saldo');
	if (!b) return { saldo: 0, cargado: 0 };
	const r = await db('wge_movimientos').where({ billetera_id: b.id, tipo: 'carga_virtual' }).sum({ t: 'monto' }).first();
	return { saldo: Number(b.saldo ?? 0), cargado: Number(r?.t ?? 0) };
}

/**
 * El saldo virtual del banco va a la par de los billetes impresos: cada vez que cambian (al registrarlos, al
 * agregar más o al corregirlos en preparación) se carga la diferencia. Lo que se cargue a mano va aparte.
 * Si se imprimieron menos, solo se descuenta lo que el banco todavía tenga en su cuenta virtual.
 */
async function igualarVirtual(trx, edicionId, paisId, actor = null) {
	const pais = await trx('wge_paises').where('id', paisId).first('provision_inicial');
	const virtual = await billeteraBloqueada(trx, { edicionId, paisId, tipo: 'banco_virtual' });
	const r = await trx('wge_movimientos').where({ billetera_id: virtual.id, tipo: 'carga_virtual', referencia_tipo: 'igual_billetes' }).sum({ t: 'monto' }).first();
	let diferencia = Number(pais?.provision_inicial ?? 0) - Number(r?.t ?? 0);
	if (diferencia < 0) diferencia = Math.max(diferencia, -Number(virtual.saldo));
	if (!diferencia) return 0;
	await moverSaldo(trx, virtual, { tipo: 'carga_virtual', monto: diferencia, actor, referenciaTipo: 'igual_billetes', referenciaId: paisId });
	return diferencia;
}

/**
 * Billetes que deben estar físicamente en el banco: su saldo en efectivo, más el dinero de las cuentas
 * (docentes y estudiantes) y de la cuenta virtual del banco, menos lo que se cargó como saldo virtual
 * (ese dinero nunca tuvo billetes).
 */
async function saldoFisicoBanco(db, edicionId, paisId) {
	const b = await db('wge_billeteras').where({ edicion_id: edicionId, pais_id: paisId, tipo_dueno: 'banco' }).first('saldo');
	const v = await virtualDelBanco(db, edicionId, paisId);
	return Number(b?.saldo ?? 0) + await saldoCuentas(db, edicionId, paisId) + v.saldo - v.cargado;
}

async function inventarioBanco(db, edicionId, paisId) {
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
	if (banco) {
		// Billetes que la caja GO•STORE le entregó al banco
		acumularBilletes(quedan, await db('wge_transferencias').where({ billetera_destino_id: banco.id, estado: 'aplicada' }).whereNotNull('billetes').pluck('billetes'), 1);
	}
	// Cuentas electrónicas: los billetes que se consignan quedan en el banco y los que se retiran salen de él
	const conCuenta = (lado) => db('wge_transferencias as t').join('wge_billeteras as w', 'w.id', `t.billetera_${lado}_id`)
		.where({ 't.edicion_id': edicionId, 't.pais_id': paisId, 't.estado': 'aplicada', 'w.tipo_dueno': 'cuenta' }).whereNotNull('t.billetes').pluck('t.billetes');
	acumularBilletes(quedan, await conCuenta('destino'), 1);
	acumularBilletes(quedan, await conCuenta('origen'), -1);
	const inversiones = await db('wge_inversiones as i').join('wge_participantes as p', 'p.id', 'i.participante_id')
		.join('wge_rondas as r', 'r.id', 'i.ronda_id').where({ 'r.edicion_id': edicionId, 'p.pais_id': paisId })
		.select('i.billetes', 'i.billetes_pago');
	acumularBilletes(quedan, inversiones.map((i) => i.billetes), 1);
	acumularBilletes(quedan, inversiones.map((i) => i.billetes_pago), -1);
	return quedan;
}

/** Billetes que tiene un docente por denominación: los que recibió del banco menos los que entregó. */
async function inventarioDocente(db, edicionId, paisId, docenteId) {
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
async function movimientosBanco(db, edicionId, paisId, limite = 100) {
	const billeteras = await db('wge_billeteras').where({ edicion_id: edicionId, pais_id: paisId }).whereIn('tipo_dueno', ['banco', 'banco_virtual']).select('id', 'tipo_dueno');
	if (!billeteras.length) return { movimientos: [], total_entro: 0, total_salio: 0, virtual_entro: 0, virtual_salio: 0 };
	const virtual = new Set(billeteras.filter((b) => b.tipo_dueno === 'banco_virtual').map((b) => b.id));
	const idsBanco = billeteras.map((b) => b.id);
	// Totales por billetera: el efectivo (billetes) y la cuenta virtual se llevan por separado
	const totalesPorBilletera = await db('wge_movimientos').whereIn('billetera_id', idsBanco).groupBy('billetera_id')
		.select('billetera_id', db.raw('coalesce(sum(case when monto > 0 then monto else 0 end), 0)::bigint as entro'), db.raw('coalesce(sum(case when monto < 0 then -monto else 0 end), 0)::bigint as salio'));
	const suma = (esVirtual, campo) => totalesPorBilletera.filter((t) => virtual.has(t.billetera_id) === esVirtual).reduce((a, t) => a + Number(t[campo]), 0);
	// Los últimos `limite` de cada una, para que muchos movimientos de una no escondan los de la otra
	const filas = (await Promise.all(idsBanco.map((id) => db('wge_movimientos as m').leftJoin('directus_users as u', 'u.id', 'm.user_created')
		.where('m.billetera_id', id).orderBy('m.consecutivo', 'desc').limit(limite)
		.select('m.id', 'm.billetera_id', 'm.tipo', 'm.monto', 'm.saldo_despues', 'm.referencia_tipo', 'm.referencia_id', 'm.date_created',
			db.raw("trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) as quien")))))
		.flat().sort((a, b) => new Date(b.date_created) - new Date(a.date_created));

	const ids = (tipo) => [...new Set(filas.filter((f) => f.referencia_tipo === tipo && f.referencia_id).map((f) => f.referencia_id))];
	const transferencias = new Map((ids('transferencia').length ? await db('wge_transferencias as t')
		.leftJoin('wge_billeteras as bd', 'bd.id', 't.billetera_destino_id').leftJoin('directus_users as u', 'u.id', 'bd.docente_id')
		.whereIn('t.id', ids('transferencia')).select('t.id', 't.billetes', 'u.first_name', 'u.last_name', 'bd.tipo_dueno as destino_tipo') : []).map((t) => [t.id, t]));
	const ventasConTarjeta = new Map((ids('venta').length ? await db('wge_ventas as v').join('wge_participantes as pa', 'pa.id', 'v.participante_id')
		.join('estudiantes as e', 'e.id', 'pa.estudiante_id').whereIn('v.id', ids('venta')).select('v.id', 'e.nombre', 'e.apellido') : []).map((v) => [v.id, v]));
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
			titulo = entra ? 'Recibido de la caja GO•STORE'
				: t?.destino_tipo === 'cuenta' ? `Transferencia a ${nombre(t) || 'un docente'}` : `Entregado a ${nombre(t) || 'un docente'}`;
			billetes = leerBilletes(t?.billetes);
		} else if (f.tipo === 'pago_tarjeta') {
			const v = ventasConTarjeta.get(f.referencia_id);
			titulo = `Pago con tarjeta en GO•STORE${v ? ' · ' + nombre(v) : ''}`;
		} else if (f.referencia_tipo === 'inversion') {
			const i = inversiones.get(f.referencia_id);
			titulo = entra ? `Inversión de ${nombre(i)}${i?.fondo ? ' en ' + i.fondo : ''}` : `Retiro de ${nombre(i)}${i?.fondo ? ' (' + i.fondo + ')' : ''}`;
			billetes = leerBilletes(entra ? i?.billetes : i?.billetes_pago);
		} else if (f.referencia_tipo === 'bienvenida') {
			titulo = `Bienvenida a ${nombre(estudiantes.get(f.referencia_id)) || 'un estudiante'}`;
		} else if (f.referencia_tipo === 'retiro') {
			titulo = `Devolución de ${nombre(estudiantes.get(f.referencia_id)) || 'un estudiante'} (retirado)`;
		} else if (f.tipo === 'carga_virtual') {
			titulo = 'Saldo virtual cargado al banco';
		} else if (f.referencia_tipo === 'provision_adicional') {
			titulo = 'Billetes agregados al banco';
		} else if (f.tipo === 'provision' || f.tipo === 'reverso') {
			titulo = entra ? 'Billetes asignados al banco' : 'Ajuste de billetes asignados';
		}
		return { id: f.id, tipo: f.tipo, medio: virtual.has(f.billetera_id) ? 'virtual' : 'efectivo', entra, titulo, monto: Math.abs(Number(f.monto)), saldo_despues: Number(f.saldo_despues), fecha: f.date_created, quien: f.quien || '', billetes };
	});
	return {
		movimientos,
		total_entro: suma(false, 'entro'), total_salio: suma(false, 'salio'),
		virtual_entro: suma(true, 'entro'), virtual_salio: suma(true, 'salio'),
	};
}

/**
 * Movimientos de un estudiante (para el portal del acudiente): su bolsillo (billetes) y su cuenta (tarjeta débito).
 * Cada movimiento dice en qué `medio` ocurrió. Los totales no cuentan lo que pasa entre su bolsillo y su cuenta.
 */
async function movimientosEstudiante(db, participanteId, paisId, limite = 50) {
	const billeteras = await db('wge_billeteras').where({ participante_id: participanteId, pais_id: paisId }).whereIn('tipo_dueno', ['estudiante', 'cuenta']).select('id', 'tipo_dueno');
	if (!billeteras.length) return { movimientos: [], total_entro: 0, total_salio: 0 };
	const medio = new Map(billeteras.map((b) => [b.id, b.tipo_dueno === 'cuenta' ? 'cuenta' : 'efectivo']));
	const internos = ['consignacion', 'retiro_cuenta'];
	const totales = await db('wge_movimientos').whereIn('billetera_id', [...medio.keys()]).whereNotIn('tipo', internos)
		.select(db.raw('coalesce(sum(case when monto > 0 then monto else 0 end), 0)::bigint as entro'), db.raw('coalesce(sum(case when monto < 0 then -monto else 0 end), 0)::bigint as salio'))
		.first();
	const filas = await db('wge_movimientos').whereIn('billetera_id', [...medio.keys()]).orderBy('date_created', 'desc').orderBy('consecutivo', 'desc').limit(limite)
		.select('id', 'billetera_id', 'tipo', 'monto', 'referencia_tipo', 'referencia_id', 'date_created');
	const ids = (tipo) => [...new Set(filas.filter((f) => f.referencia_tipo === tipo && f.referencia_id).map((f) => f.referencia_id))];
	const transferencias = new Map((ids('transferencia').length ? await db('wge_transferencias as t')
		.leftJoin('wge_billeteras as bo', 'bo.id', 't.billetera_origen_id').leftJoin('directus_users as u', 'u.id', 'bo.docente_id')
		.whereIn('t.id', ids('transferencia')).select('t.id', 't.billetes', 'u.first_name', 'u.last_name') : []).map((t) => [t.id, t]));
	const inversiones = new Map((ids('inversion').length ? await db('wge_inversiones as i').leftJoin('wge_fondos as f', 'f.id', 'i.fondo_id')
		.whereIn('i.id', ids('inversion')).select('i.id', 'i.billetes', 'i.billetes_pago', 'f.nombre as fondo') : []).map((i) => [i.id, i]));

	const movimientos = filas.map((f) => {
		const entra = Number(f.monto) > 0;
		const m = medio.get(f.billetera_id);
		let titulo = entra ? 'Entrada' : 'Salida';
		let billetes = null;
		if (f.tipo === 'consignacion') {
			titulo = m === 'cuenta' ? 'Consignación en su cuenta' : 'Consignó en su cuenta';
		} else if (f.tipo === 'retiro_cuenta') {
			titulo = m === 'cuenta' ? 'Retiro de su cuenta' : 'Retiró de su cuenta';
		} else if (f.tipo === 'pago_tarjeta') {
			titulo = 'Pagó con tarjeta en GO•STORE';
		} else if (f.referencia_tipo === 'transferencia') {
			const t = transferencias.get(f.referencia_id);
			const docente = `${t?.first_name ?? ''} ${t?.last_name ?? ''}`.trim();
			titulo = m === 'cuenta' ? (docente ? `Transferencia de ${docente}` : 'Transferencia de su docente') : (docente ? `Recibió de ${docente}` : 'Recibió de su docente');
		} else if (f.referencia_tipo === 'inversion') {
			const i = inversiones.get(f.referencia_id);
			titulo = entra ? `Retiró su inversión de ${i?.fondo ?? 'una empresa'}` : `Invirtió en ${i?.fondo ?? 'una empresa'}`;
			billetes = leerBilletes(entra ? i?.billetes_pago : i?.billetes);
		} else if (f.referencia_tipo === 'bienvenida' || f.tipo === 'bienvenida') {
			titulo = 'Billetes de bienvenida';
		} else if (f.referencia_tipo === 'venta' || f.tipo === 'compra') {
			titulo = 'Compra en GO•STORE';
		} else if (f.referencia_tipo === 'retiro') {
			titulo = m === 'cuenta' ? 'Su cuenta volvió al banco' : 'Devolvió sus billetes al banco';
		}
		if (f.referencia_tipo === 'transferencia' && !billetes) billetes = leerBilletes(transferencias.get(f.referencia_id)?.billetes);
		return { id: f.id, entra, titulo, monto: Math.abs(Number(f.monto)), fecha: f.date_created, billetes, medio: m };
	});
	return { movimientos, total_entro: Number(totales?.entro ?? 0), total_salio: Number(totales?.salio ?? 0) };
}

function rutasArqueo(router, { ruta, db }) {
	/**
	 * Billetes que deben estar físicamente en el banco: su propio saldo más el dinero de todas las cuentas
	 * electrónicas (docentes y estudiantes), porque esos billetes se quedan guardados en el banco.
	 */
	const saldoPropioBanco = async (edicionId, paisId) => {
		const b = await db('wge_billeteras').where({ edicion_id: edicionId, pais_id: paisId, tipo_dueno: 'banco' }).first('saldo');
		return Number(b?.saldo ?? 0);
	};
	const saldoBanco = (edicionId, paisId) => saldoFisicoBanco(db, edicionId, paisId);

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
			p.saldo_banco = await saldoPropioBanco(edicion.id, p.id); // lo que el banco puede repartir en billetes (sin el dinero de las cuentas)
			p.saldo_virtual = (await virtualDelBanco(db, edicion.id, p.id)).saldo; // lo que puede transferir a las cuentas de los docentes
			p.inventario = await inventarioBanco(db, edicion.id, p.id);
			p.docentes = await db('wge_equipo as q').join('directus_users as u', 'u.id', 'q.usuario_id')
				.join('directus_roles as r', 'r.id', 'u.role')
				.leftJoin('wge_billeteras as b', function () {
					this.on('b.docente_id', 'q.usuario_id').andOnVal('b.pais_id', p.id).andOnVal('b.tipo_dueno', 'docente');
				})
				.where('q.edicion_id', edicion.id).where('r.name', ROLES.DOCENTE)
				.where((w) => w.whereNull('q.pais_id').orWhere('q.pais_id', p.id))
				.select('u.id', 'u.first_name as nombre', 'u.last_name as apellido', 'q.pais_id', db.raw('coalesce(b.saldo, 0)::int as saldo'),
					db.raw(`coalesce((select c.saldo from wge_billeteras c where c.docente_id = q.usuario_id and c.pais_id = ? and c.tipo_dueno = 'cuenta'), 0)::int as cuenta`, [p.id]),
					db.raw(`coalesce((select sum(t.monto) from wge_transferencias t join wge_billeteras bd on bd.id = t.billetera_destino_id
						where bd.docente_id = q.usuario_id and bd.pais_id = ? and t.estado = 'aplicada'), 0)::int as recibido`, [p.id]))
				.orderBy([{ column: 'u.first_name' }, { column: 'u.last_name' }]);
			p.entregas = await db('wge_transferencias as t').join('wge_billeteras as bo', 'bo.id', 't.billetera_origen_id')
				.join('wge_billeteras as bd', 'bd.id', 't.billetera_destino_id').leftJoin('directus_users as u', 'u.id', 'bd.docente_id')
				.where({ 'bo.pais_id': p.id, 'bo.tipo_dueno': 'banco' }).whereIn('bd.tipo_dueno', ['docente', 'cuenta']).whereNotNull('bd.docente_id')
				.orderBy('t.date_created', 'desc').limit(20)
				.select('t.id', 't.monto', 't.billetes', 't.date_created', 'u.first_name as nombre', 'u.last_name as apellido',
					db.raw("case when bd.tipo_dueno = 'cuenta' then 'transferencia' else 'billetes' end as medio"));
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
			const cuentaDoc = await db('wge_billeteras').where({ edicion_id: edicion.id, pais_id: p.id, tipo_dueno: 'cuenta', docente_id: docenteId }).first('id', 'saldo');
			p.cuenta = Number(cuentaDoc?.saldo ?? 0);
			const mias = [billetera?.id, cuentaDoc?.id].filter(Boolean);
			const suma = async (campo) => (mias.length ? Number((await db('wge_transferencias').whereIn(campo, mias).where({ estado: 'aplicada' }).sum({ t: 'monto' }).first())?.t ?? 0) : 0);
			p.total_recibido = await suma('billetera_destino_id');
			p.total_entregado = await suma('billetera_origen_id');
			const medio = db.raw("case when bd.tipo_dueno = 'cuenta' then 'transferencia' else 'billetes' end as medio");
			p.recibidos = mias.length ? await db('wge_transferencias as t').join('wge_billeteras as bd', 'bd.id', 't.billetera_destino_id')
				.leftJoin('directus_users as u', 'u.id', 't.user_created')
				.whereIn('t.billetera_destino_id', mias).orderBy('t.date_created', 'desc').limit(50)
				.select('t.id', 't.monto', 't.billetes', 't.date_created', medio, db.raw("trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) as quien")) : [];
			p.entregas = mias.length ? await db('wge_transferencias as t').join('wge_billeteras as bd', 'bd.id', 't.billetera_destino_id')
				.join('wge_participantes as pa', 'pa.id', 'bd.participante_id').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
				.whereIn('t.billetera_origen_id', mias).orderBy('t.date_created', 'desc').limit(50)
				.select('t.id', 't.monto', 't.billetes', 't.date_created', 'e.nombre', 'e.apellido', medio) : [];
			p.estudiantes = await db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
				.leftJoin('wge_billeteras as b', function () { this.on('b.participante_id', 'pa.id').andOn('b.pais_id', 'pa.pais_id').andOnVal('b.tipo_dueno', 'estudiante'); })
				.where({ 'pa.edicion_id': edicion.id, 'pa.pais_id': p.id }).whereRaw('coalesce(pa.retirado, false) = false')
				.leftJoin('wge_billeteras as c', function () { this.on('c.participante_id', 'pa.id').andOn('c.pais_id', 'pa.pais_id').andOnVal('c.tipo_dueno', 'cuenta'); })
				.select('pa.id', 'pa.codigo', 'pa.llave', 'pa.presente', 'e.nombre', 'e.apellido', 'e.grado', db.raw('coalesce(b.saldo, 0)::int as saldo'), db.raw('coalesce(c.saldo, 0)::int as cuenta'))
				.orderBy([{ column: 'e.nombre' }, { column: 'e.apellido' }]);
		}
		return { edicion, denominaciones: DENOMINACIONES, paises };
	}));

	/**
	 * GET /wge/mis-ediciones: ediciones vigentes donde el usuario está en el equipo (los administrativos ven todas).
	 * Vigente = no está cerrada y su programa no ha terminado (fecha de fin hoy o después, hora de Colombia).
	 */
	router.get('/mis-ediciones', ruta(async (req, rol) => {
		const hoy = ahoraColombia().fecha;
		const q = db('wge_ediciones as e').whereNot('e.estado', 'cerrada')
			.where((w) => w.whereNull('e.fecha_fin').orWhere('e.fecha_fin', '>=', hoy))
			.leftJoin('colegios as c', 'c.id', 'e.colegio_id').leftJoin('Cursos as k', 'k.id', 'e.curso_id')
			.select('e.id', 'e.nombre', 'e.estado', 'e.edicion_programa', 'e.fecha_inicio', 'e.fecha_fin', 'c.nombre as colegio', 'k.nombre as programa')
			.orderBy([{ column: 'e.fecha_inicio', order: 'asc' }, { column: 'e.date_created', order: 'desc' }]);
		if (rol !== ROLES.ADMIN && rol !== ROLES.ADMIN_WG) {
			q.join('wge_equipo as q', 'q.edicion_id', 'e.id').where('q.usuario_id', req.accountability.user);
		}
		return q;
	}));

	/**
	 * GET /wge/mi-menu: qué secciones puede usar el usuario hoy, para mostrar en el menú solo lo que le sirve.
	 * equipo = está en el equipo de alguna edición vigente; banco = es responsable del banco de algún país de una
	 * edición vigente; caja = es el encargado de la caja de una edición vigente. Los administrativos lo ven todo.
	 */
	router.get('/mi-menu', ruta(async (req, rol) => {
		if (rol === ROLES.ADMIN || rol === ROLES.ADMIN_WG) return { equipo: true, banco: true, caja: true };
		const usuario = req.accountability.user;
		const hoy = ahoraColombia().fecha;
		const vigentes = () => db('wge_ediciones as e').whereNot('e.estado', 'cerrada')
			.where((w) => w.whereNull('e.fecha_fin').orWhere('e.fecha_fin', '>=', hoy));
		const equipo = !!(await vigentes().join('wge_equipo as q', 'q.edicion_id', 'e.id').where('q.usuario_id', usuario).first('e.id'));
		const banco = equipo && !!(await vigentes().join('wge_paises as p', 'p.edicion_id', 'e.id').where('p.responsable_banco', usuario).first('e.id'));
		const caja = equipo && !!(await vigentes().where('e.responsable_caja', usuario).first('e.id'));
		return { equipo, banco, caja };
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
			p.en_cuentas = await saldoCuentas(db, edicion.id, p.id);
			Object.assign(p, Object.fromEntries(Object.entries(await virtualDelBanco(db, edicion.id, p.id)).map(([k, v]) => [`virtual_${k}`, v])));
			p.inventario = await inventarioBanco(db, edicion.id, p.id);
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

// W-Funds: rondas de inversión en las empresas (fondos) de la edición.
// El estudiante entrega billetes al banco para invertir. Su inversión sigue invertida ronda tras ronda: en cada cierre
// su valor sube o baja con el rendimiento de la empresa (interés compuesto, redondeado hacia arriba) hasta que
// el estudiante pide retirarla; entonces recibe lo que vale en ese momento.

/**
 * Rendimiento de cada fondo en una ronda:
 * base (o alterno, en riesgo alto, con 50 % de probabilidad) + bono por votos (±2 %) + variación al azar, limitado a ±20 %.
 * `azar` es un generador con semilla, para que el resultado se pueda auditar y repetir.
 */
function calcularResultados(fondos, votosPorFondo, azar) {
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
const pagoDeInversion = (monto, rendimiento) => {
	const exacto = Math.round(Number(monto) * (1 + Number(rendimiento)) * 1e6) / 1e6;
	return Math.max(0, Math.ceil(exacto));
};

/** Lo que vale hoy una inversión (las de antes de este cambio no tienen valor_actual: valen lo invertido). */
const valorDe = (inv) => Number(inv.valor_actual ?? inv.monto);

/**
 * Saca el dinero de una inversión: el estudiante recibe lo que vale hoy (sale del banco de su país) y la inversión
 * queda "retirada". Se usa cuando el estudiante pide retirar y cuando lo retiran de la edición.
 */
async function retirarInversion(trx, inv, actor, billetes = null) {
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
		const banco = await billeteraBloqueada(trx, { edicionId: participante.edicion_id, paisId: participante.pais_id, tipo: 'banco' });
		const estudiante = await billeteraBloqueada(trx, { edicionId: participante.edicion_id, paisId: participante.pais_id, tipo: 'estudiante', participanteId: participante.id });
		await moverSaldo(trx, banco, { tipo: 'pago_fondo', monto: -valor, actor, referenciaTipo: 'inversion', referenciaId: inv.id });
		await moverSaldo(trx, estudiante, { tipo: 'pago_fondo', monto: valor, actor, referenciaTipo: 'inversion', referenciaId: inv.id });
	}
	const cambios = { estado: 'retirada', monto_pagado: valor, valor_actual: valor, cobrado_en: new Date(), cobrado_por: actor ?? null };
	if (billetesPago) cambios.billetes_pago = JSON.stringify(billetesPago);
	await trx('wge_inversiones').where('id', inv.id).update(cambios);
	return { ...inv, ...cambios };
}

const leerJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

/** Duraciones que puede escoger el banco al abrir una ronda (minutos). */
const DURACIONES_RONDA = [10, 15, 20, 30, 45, 60];
/** Si al horario le quedan menos de estos minutos, no se abre otra ronda. */
const MINIMO_RONDA = 5;

/**
 * Cuándo se cierra una ronda que abre `ahora`: a los `duracion` minutos, o antes si se acaba el horario.
 * Devuelve null si está fuera del horario o queda muy poco tiempo.
 */
function cierreDeRonda(horario, ahora, duracion) {
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
async function liquidarRonda(trx, ronda, actor) {
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
async function cerrarYSeguir(db, rondaId, { actor, continuar, soloVencida = false }) {
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
async function abonarPendientes(db) {
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
async function estadoRondas(db, edicionId) {
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
async function reanudarRondas(db) {
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
async function cerrarRondasVencidas(db) {
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

function rutasWfunds(router, { ruta, db }) {
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
				.where({ 'pa.edicion_id': edicion.id, 'pa.pais_id': p.id }).whereRaw('coalesce(pa.retirado, false) = false')
				.select('pa.id', 'e.nombre', 'e.apellido', db.raw('coalesce(b.saldo, 0)::int as saldo'))
				.orderBy([{ column: 'e.nombre' }, { column: 'e.apellido' }]);
			const base = () => db('wge_inversiones as i').join('wge_participantes as pa', 'pa.id', 'i.participante_id')
				.join('estudiantes as e', 'e.id', 'pa.estudiante_id').join('wge_rondas as r', 'r.id', 'i.ronda_id')
				.where({ 'r.edicion_id': edicion.id, 'pa.pais_id': p.id });
			p.inversiones = abierta ? await base().where('i.ronda_id', abierta.id).orderBy('i.date_created', 'desc')
				.select('i.id', 'i.participante_id', 'i.fondo_id', 'i.monto', 'i.billetes', 'i.date_created', 'e.nombre', 'e.apellido') : [];
			p.vigentes = (await base().where('i.estado', 'abierta').orderBy([{ column: 'e.nombre' }, { column: 'e.apellido' }, { column: 'i.date_created' }])
				.select('i.id', 'i.participante_id', 'i.fondo_id', 'i.monto', 'i.valor_actual', 'i.historial', 'r.nombre as ronda', 'e.nombre', 'e.apellido'))
				.map((i) => ({ ...i, valor_actual: valorDe(i), historial: leerJson(i.historial) ?? [] }));
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
			// El banco entrega billetes físicos: se exigen para que su inventario cuadre
			if (valorDe(inv) > 0 && !req.body?.billetes) throw new WgeError(400, 'VALOR_INVALIDO', 'Indica los billetes que le entregas al estudiante');
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

// Rúbrica del docente (Especificación Maestra, sección 5): cada criterio de 0 a 3, puntaje de 0 a 12.
// El puntaje ÷ 3 son los "puntos de inmersión" que mueven el tipo de cambio de cada país (ver hook.js, referencia B = 2).
// Desde 5 puntos se recomienda una recompensa en billetes, que el docente entrega con sus propios billetes.

/** Los 4 criterios de la rúbrica (en el orden en que se muestran). */
const CRITERIOS = ['uso_lengua', 'iniciativa', 'nivel_reto', 'colaboracion'];
const IDIOMAS = ['ingles', 'frances'];
/** Minutos en los que el docente puede deshacer una calificación que puso por error. */
const MINUTOS_DESHACER = 10;

/** Nivel máximo de cada criterio y puntaje máximo de una calificación. */
const NIVEL_MAXIMO = 3;
const PUNTAJE_MAXIMO = NIVEL_MAXIMO * 4;

/** Recompensa recomendada por la Especificación Maestra: 5–6 = 2 billetes; 7–8 = 5; 9–10 = 10; 11–12 = 20. */
function recompensaSugerida(puntaje) {
	const p = Number(puntaje);
	if (p >= 11) return 20;
	if (p >= 9) return 10;
	if (p >= 7) return 5;
	if (p >= 5) return 2;
	return 0;
}

/** Puntos de inmersión para el tipo de cambio: puntaje ÷ 3 (de 0 a 4; un estudiante en nivel 2 aporta 2,67). */
const puntosDeInmersion = (puntaje) => Number(puntaje) / NIVEL_MAXIMO;

/** Valida los 4 niveles (0 a 3, todos obligatorios) y devuelve la fila con su puntaje. */
function armarCalificacion(datos) {
	const fila = {};
	for (const c of CRITERIOS) {
		const v = datos?.[c];
		if (!Number.isInteger(v) || v < 0 || v > NIVEL_MAXIMO) throw new WgeError(400, 'VALOR_INVALIDO', 'Elige el nivel (0 a 3) de los 4 criterios');
		fila[c] = v;
	}
	fila.puntaje = CRITERIOS.reduce((t, c) => t + fila[c], 0);
	if (datos?.idioma !== undefined && datos.idioma !== null && !IDIOMAS.includes(datos.idioma)) throw new WgeError(400, 'VALOR_INVALIDO', 'El idioma debe ser inglés o francés');
	fila.idioma = datos?.idioma ?? null;
	const evidencia = typeof datos?.evidencia === 'string' ? datos.evidencia.trim().slice(0, 255) : '';
	fila.evidencia = evidencia || null;
	return fila;
}

/** Resumen de las calificaciones de un estudiante: cuántas y el nivel promedio (0 a 3) de cada criterio. */
function resumenCalificaciones(filas) {
	const total = filas.length;
	const criterios = Object.fromEntries(CRITERIOS.map((c) => [c, total ? Math.round((filas.reduce((t, f) => t + Number(f[c] ?? 0), 0) / total) * 10) / 10 : 0]));
	const ultima = filas.reduce((u, f) => (!u || new Date(f.date_created) > new Date(u) ? f.date_created : u), null);
	return { total, criterios, ultima, maximo: NIVEL_MAXIMO };
}

function rutasRubrica(router, { ruta, db }) {
	const inicioDelDia = () => { const d = new Date(Date.now() - 5 * 3600000); d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() + 5 * 3600000); };

	/** El docente solo maneja su país (si tiene uno asignado en el equipo). */
	const paisPermitido = async (req, rol, edicionId, paisId) => {
		const miembro = await exigirEquipo(db, { edicionId, usuarioId: req.accountability.user, rol, paisId });
		return miembro;
	};

	/**
	 * GET /wge/ediciones/:id/rubrica: por cada país que maneja el docente, sus estudiantes con asistencia,
	 * cuántas veces los calificó hoy y la última calificación; la tasa actual; y sus calificaciones recientes.
	 */
	router.get('/ediciones/:id/rubrica', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.DOCENTE, ROLES.ADMIN_WG);
		const edicion = await db('wge_ediciones').where('id', req.params.id).first('id', 'nombre', 'estado', 'tasa_inicial');
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		const miembro = await exigirEquipo(db, { edicionId: edicion.id, usuarioId: req.accountability.user, rol });
		const consulta = db('wge_paises').where('edicion_id', edicion.id).orderBy('orden').select('id', 'nombre', 'codigo_moneda', 'color', 'tasa_actual');
		if (miembro?.pais_id) consulta.where('id', miembro.pais_id);
		const paises = await consulta;
		const hoy = inicioDelDia();
		for (const p of paises) {
			p.tasa_actual = Number(p.tasa_actual ?? edicion.tasa_inicial);
			p.estudiantes = await db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
				.where({ 'pa.edicion_id': edicion.id, 'pa.pais_id': p.id }).whereRaw('coalesce(pa.retirado, false) = false')
				.select('pa.id', 'pa.presente', 'e.nombre', 'e.apellido',
					db.raw('(select count(*) from wge_evaluaciones ev where ev.participante_id = pa.id and ev.date_created >= ?)::int as hoy', [hoy]),
					db.raw('(select max(ev.date_created) from wge_evaluaciones ev where ev.participante_id = pa.id) as ultima'))
				.orderBy([{ column: 'e.nombre' }, { column: 'e.apellido' }]);
		}
		const recientes = await db('wge_evaluaciones as ev').join('wge_participantes as pa', 'pa.id', 'ev.participante_id')
			.join('estudiantes as e', 'e.id', 'pa.estudiante_id')
			.where({ 'pa.edicion_id': edicion.id, 'ev.user_created': req.accountability.user })
			.orderBy('ev.date_created', 'desc').limit(30)
			.select('ev.id', 'ev.participante_id', ...CRITERIOS.map((c) => `ev.${c}`), 'ev.puntaje', 'ev.idioma', 'ev.evidencia', 'ev.date_created', 'e.nombre', 'e.apellido');
		for (const r of recientes) {
			r.se_puede_deshacer = Date.now() - new Date(r.date_created).getTime() < MINUTOS_DESHACER * 60000;
			r.recompensa = recompensaSugerida(r.puntaje);
		}
		return { edicion, paises, recientes, criterios: CRITERIOS, nivel_maximo: NIVEL_MAXIMO, puntaje_maximo: PUNTAJE_MAXIMO };
	}));

	/**
	 * POST /wge/evaluaciones { participante_id, uso_lengua, iniciativa, nivel_reto, colaboracion (0 a 3), idioma, evidencia }
	 * Califica, lo marca presente y devuelve la recompensa recomendada en billetes.
	 */
	router.post('/evaluaciones', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.DOCENTE, ROLES.ADMIN_WG);
		const fila = armarCalificacion(req.body);
		const actor = req.accountability.user;
		return db.transaction(async (trx) => {
			const p = await trx('wge_participantes').where('id', String(req.body?.participante_id ?? '')).forUpdate().first();
			if (!p) throw new WgeError(404, 'NO_EXISTE', 'El estudiante no existe');
			if (p.retirado) throw new WgeError(409, 'RETIRADO', 'El estudiante fue retirado de la edición');
			if (!p.pais_id) throw new WgeError(409, 'SIN_PAIS', 'El estudiante no tiene país asignado');
			const edicion = await trx('wge_ediciones').where('id', p.edicion_id).first('estado');
			if (edicion?.estado !== 'abierta') throw new WgeError(409, 'EDICION_CERRADA', 'La edición no está abierta');
			await exigirEquipo(trx, { edicionId: p.edicion_id, usuarioId: actor, rol, paisId: p.pais_id });
			// Doble toque: si este docente ya calificó al estudiante hace menos de 5 segundos, no se repite
			const reciente = await trx('wge_evaluaciones').where({ participante_id: p.id, user_created: actor })
				.where('date_created', '>', new Date(Date.now() - 5000)).first();
			if (reciente) return { ...reciente, repetida: true, recompensa: recompensaSugerida(reciente.puntaje) };
			const nueva = { id: crypto.randomUUID(), participante_id: p.id, ...fila, date_created: new Date(), user_created: actor };
			await trx('wge_evaluaciones').insert(nueva);
			if (!p.presente) await trx('wge_participantes').where('id', p.id).update({ presente: true });
			return { ...nueva, recompensa: recompensaSugerida(nueva.puntaje) };
		});
	}));

	/** DELETE /wge/evaluaciones/:id: el docente deshace su calificación (solo los primeros minutos). */
	router.delete('/evaluaciones/:id', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.DOCENTE, ROLES.ADMIN_WG);
		const ev = await db('wge_evaluaciones').where('id', req.params.id).first();
		if (!ev) throw new WgeError(404, 'NO_EXISTE', 'La calificación no existe');
		const esAdmin = rol === ROLES.ADMIN || rol === ROLES.ADMIN_WG;
		if (!esAdmin && ev.user_created !== req.accountability.user) throw new WgeError(403, 'SIN_PERMISO', 'Solo puedes deshacer tus calificaciones');
		if (!esAdmin && Date.now() - new Date(ev.date_created).getTime() > MINUTOS_DESHACER * 60000) {
			throw new WgeError(409, 'MUY_TARDE', `Solo se puede deshacer en los primeros ${MINUTOS_DESHACER} minutos`);
		}
		await db('wge_evaluaciones').where('id', ev.id).delete();
		return { borrada: true };
	}));

	/** PATCH /wge/asistencia { participante_id, presente }: el docente marca presente o ausente. */
	router.patch('/asistencia', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.DOCENTE, ROLES.ADMIN_WG);
		const p = await db('wge_participantes').where('id', String(req.body?.participante_id ?? '')).first('id', 'edicion_id', 'pais_id', 'retirado');
		if (!p) throw new WgeError(404, 'NO_EXISTE', 'El estudiante no existe');
		if (p.retirado) throw new WgeError(409, 'RETIRADO', 'El estudiante fue retirado de la edición');
		await paisPermitido(req, rol, p.edicion_id, p.pais_id);
		const presente = req.body?.presente === true;
		await db('wge_participantes').where('id', p.id).update({ presente });
		return { participante_id: p.id, presente };
	}));
}

// Tipo de cambio de WILL-GO ECONOMY.
// Cada 5 minutos revisa si terminó una ventana (por defecto de 30 min) dentro del horario de la edición.
// Si terminó, calcula la nueva tasa de cada país con la fórmula del documento y la guarda.
// Fuera del horario no hace nada: la tasa queda congelada y el día siguiente continúa desde el último valor.

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

// Valores del documento; cada edición puede cambiarlos en parametros_fx.
const FX_POR_DEFECTO = {
	intervalo_minutos: 30,
	referencia: 2, // B: índice con el que la tasa no se mueve
	sensibilidad: 0.006, // cambio de la tasa por cada punto del índice sobre B
	variacion_minima: -0.012,
	variacion_maxima: 0.024,
	indice_maximo: 6,
};

/** ¿La hora local (HH:MM) de esa fecha está dentro del horario? Acepta {fecha:"2026-11-28"} o {dia:"sabado"}. */
function dentroDelHorario(horario, fecha, hora) {
	if (!Array.isArray(horario) || !horario.length) return false;
	const dia = DIAS[new Date(`${fecha}T12:00:00Z`).getUTCDay()];
	return horario.some((h) => {
		const aplica = h.fecha ? h.fecha === fecha : String(h.dia ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === dia;
		return aplica && h.inicio <= hora && hora < h.fin;
	});
}

/** Fórmula del documento: I = P / N; variación = s·(I − B), limitada; nueva tasa limitada a los topes. */
function nuevaTasa({ tasa, puntos, presentes, tasaInicial, topeMinimo, topeMaximo, parametros }) {
	const p = { ...FX_POR_DEFECTO, ...(parametros ?? {}) };
	const indice = limitar(puntos / Math.max(presentes, 1), 0, p.indice_maximo);
	const variacion = limitar(p.sensibilidad * (indice - p.referencia), p.variacion_minima, p.variacion_maxima);
	const nueva = limitar(Math.round(tasa * (1 + variacion)), Math.round(topeMinimo * tasaInicial), Math.round(topeMaximo * tasaInicial));
	return { indice, variacion, nueva };
}

const configHook = ({ schedule }, { database: db, logger }) => {
	// W-Funds: cada minuto cierra las rondas que ya cumplieron su tiempo y abre la siguiente
	schedule('* * * * *', async () => {
		try {
			const abonadas = await abonarPendientes(db);
			if (abonadas) logger.info(`wge: ${abonadas} inversiones pendientes abonadas`);
			const hechas = await cerrarRondasVencidas(db);
			for (const h of hechas) logger.info(`wge: ronda ${h.ronda_id} cerrada sola (${h.inversiones} inversiones)${h.siguiente ? `; abierta ${h.siguiente.nombre}` : ''}`);
			// Al empezar una nueva franja del horario, las rondas arrancan solas con la misma duración
			for (const r of await reanudarRondas(db)) logger.info(`wge: ${r.nombre} abierta sola al empezar el horario`);
		} catch (error) {
			logger.error(error, 'wge: cierre de rondas');
		}
	});

	// Saldo virtual a la par de los billetes en las ediciones en curso (también pone al día las que ya existían)
	schedule('*/5 * * * *', async () => {
		try {
			const paises = await db('wge_paises as p').join('wge_ediciones as e', 'e.id', 'p.edicion_id').whereIn('e.estado', ['borrador', 'abierta']).select('p.id', 'p.edicion_id');
			for (const p of paises) {
				const n = await db.transaction((trx) => igualarVirtual(trx, p.edicion_id, p.id));
				if (n) logger.info(`wge: saldo virtual del país ${p.id} ajustado en ${n}`);
			}
		} catch (error) {
			logger.error(error, 'wge: saldo virtual');
		}
	});

	schedule('*/5 * * * *', async () => {
		try {
			const ediciones = await db('wge_ediciones').where('estado', 'abierta');
			for (const edicion of ediciones) await procesarEdicion(db, edicion, new Date());
		} catch (error) {
			logger.error(error, 'wge: tipo de cambio');
		}
	});
};

async function procesarEdicion(db, edicion, ahora) {
	const parametros = { ...FX_POR_DEFECTO, ...(edicion.parametros_fx ?? {}) };
	const minutos = Math.max(5, Number(parametros.intervalo_minutos) || 30);
	// La ventana que acaba de terminar: [inicio, fin)
	const fin = new Date(Math.floor(ahora.getTime() / (minutos * 60000)) * minutos * 60000);
	const inicio = new Date(fin.getTime() - minutos * 60000);
	// Solo cuenta si toda la ventana estuvo dentro del horario (se mira su primer y último minuto)
	const a = ahoraColombia(inicio);
	const b = ahoraColombia(new Date(fin.getTime() - 60000));
	if (!dentroDelHorario(edicion.horario, a.fecha, a.hora) || !dentroDelHorario(edicion.horario, b.fecha, b.hora)) return [];

	const paises = await db('wge_paises').where('edicion_id', edicion.id).orderBy('id');
	const resultados = [];
	for (const pais of paises) {
		const r = await db.transaction(async (trx) => {
			const actual = await trx('wge_paises').where('id', pais.id).forUpdate().first();
			// Una sola tasa por país y ventana, aunque el proceso corra dos veces
			if (await trx('wge_fx').where({ pais_id: pais.id, ventana: fin }).first()) return null;
			const { suma } = await trx('wge_evaluaciones as e').join('wge_participantes as p', 'p.id', 'e.participante_id')
				.where('p.pais_id', pais.id).whereRaw('coalesce(p.retirado, false) = false').where('e.date_created', '>=', inicio).where('e.date_created', '<', fin)
				.sum({ suma: 'e.puntaje' }).first();
			const { n } = await trx('wge_participantes').where({ pais_id: pais.id, presente: true }).whereRaw('coalesce(retirado, false) = false').count({ n: '*' }).first();
			const tasa = Number(actual.tasa_actual || edicion.tasa_inicial);
			const calculo = nuevaTasa({
				// Puntos de inmersión = puntaje de la rúbrica (0 a 12) ÷ 3
				tasa, puntos: Number(suma ?? 0) / 3, presentes: Number(n), tasaInicial: Number(edicion.tasa_inicial),
				topeMinimo: Number(edicion.tope_minimo), topeMaximo: Number(edicion.tope_maximo), parametros,
			});
			await trx('wge_fx').insert({
				id: crypto.randomUUID(), pais_id: pais.id, ventana: fin, participantes_presentes: Number(n),
				puntos: Number(suma ?? 0) / 3, indice: calculo.indice, tasa_anterior: tasa, tasa_nueva: calculo.nueva,
				date_created: new Date(),
			});
			await trx('wge_paises').where('id', pais.id).update({ tasa_actual: calculo.nueva });
			return { pais: pais.nombre, tasa_anterior: tasa, ...calculo };
		});
		if (r) resultados.push(r);
	}
	return resultados;
}

// Tipo de cambio: cuánto vale hoy un billete de cada país y cómo ha cambiado cada 30 minutos.
// El cálculo lo hace hook.js; aquí solo se consulta (para el equipo y para el portal del acudiente).

const deJsonFx = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

/** Tasas de cada país de una edición con su historial (lo más viejo primero) y cuándo es el próximo cálculo. */
async function datosTipoCambio(db, edicionId, { limite = 200 } = {}) {
	const edicion = await db('wge_ediciones').where('id', edicionId)
		.first('id', 'nombre', 'estado', 'tasa_inicial', 'tope_minimo', 'tope_maximo', 'parametros_fx', 'horario');
	if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
	const parametros = { ...FX_POR_DEFECTO, ...(deJsonFx(edicion.parametros_fx) ?? {}) };
	const minutos = Math.max(5, Number(parametros.intervalo_minutos) || 30);
	const inicial = Number(edicion.tasa_inicial);
	const paises = await db('wge_paises').where('edicion_id', edicion.id).orderBy('orden').select('id', 'nombre', 'codigo_moneda', 'color', 'tasa_actual');
	for (const p of paises) {
		p.tasa_actual = Number(p.tasa_actual ?? inicial);
		p.presentes = Number((await db('wge_participantes').where({ pais_id: p.id, presente: true }).whereRaw('coalesce(retirado, false) = false').count({ n: '*' }).first())?.n ?? 0);
		p.historial = (await db('wge_fx').where('pais_id', p.id).orderBy('ventana', 'desc').limit(limite)
			.select('ventana', 'participantes_presentes', 'puntos', 'indice', 'tasa_anterior', 'tasa_nueva'))
			.reverse().map((h) => ({ ...h, puntos: Number(h.puntos), indice: Number(h.indice), participantes_presentes: Number(h.participantes_presentes) }));
	}
	// El próximo cálculo es al terminar la ventana actual, si estamos dentro del horario
	const ahora = new Date();
	const enHorario = !!finDeFranja(deJsonFx(edicion.horario), ahora);
	const proximo = enHorario && edicion.estado === 'abierta' ? new Date(Math.ceil(ahora.getTime() / (minutos * 60000)) * minutos * 60000) : null;
	return {
		edicion: { id: edicion.id, nombre: edicion.nombre, estado: edicion.estado },
		tasa_inicial: inicial,
		tope_minimo: Math.round(Number(edicion.tope_minimo ?? 0.7) * inicial),
		tope_maximo: Math.round(Number(edicion.tope_maximo ?? 1.8) * inicial),
		intervalo_minutos: minutos,
		referencia: Number(parametros.referencia),
		ahora, proximo_calculo: proximo,
		paises,
	};
}

function rutasTipoCambio(router, { ruta, db }) {
	/** GET /wge/ediciones/:id/tipo-cambio: para todo el equipo de la edición. */
	router.get('/ediciones/:id/tipo-cambio', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.ADMIN_WG, ROLES.BANCO, ROLES.DOCENTE, ROLES.CAJERO);
		await exigirEquipo(db, { edicionId: req.params.id, usuarioId: req.accountability.user, rol });
		return datosTipoCambio(db, req.params.id);
	}));
}

// Cuentas electrónicas de los estudiantes: llave (como la llave Bre-B) y tarjeta débito con QR (sin clave).
// Los billetes que se consignan quedan guardados en el banco; la cuenta es lo que el estudiante tiene «en el banco».

/** «Sofía Gómez» → «sofia.gomez» (solo letras a-z y un punto). */
function baseDeLlave(nombre, apellido) {
	const limpio = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/)[0] ?? '';
	const base = [limpio(nombre), limpio(apellido)].filter(Boolean).join('.').slice(0, 24);
	return base || 'estudiante';
}

/** La primera llave libre: @sofia.gomez, @sofia.gomez2, @sofia.gomez3… */
function llaveLibre(base, ocupadas) {
	if (!ocupadas.has(`@${base}`)) return `@${base}`;
	for (let i = 2; ; i++) if (!ocupadas.has(`@${base}${i}`)) return `@${base}${i}`;
}

/** Normaliza lo que se escribe o escanea: «Sofia.Gomez», «@sofia.gomez», «WG:@sofia.gomez» → «@sofia.gomez». */
function normalizarLlave(texto) {
	const t = String(texto ?? '').trim().toLowerCase().replace(/^wg:/, '');
	if (!t) return '';
	return t.startsWith('@') ? t : `@${t}`;
}

/** Da llave a los estudiantes de la edición que todavía no tienen (únicas en toda la plataforma). */
async function asegurarLlaves(db, edicionId) {
	const sinLlave = await db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
		.where('pa.edicion_id', edicionId).whereNull('pa.llave').select('pa.id', 'e.nombre', 'e.apellido').orderBy('pa.id');
	if (!sinLlave.length) return 0;
	const ocupadas = new Set(await db('wge_participantes').whereNotNull('llave').pluck('llave'));
	for (const p of sinLlave) {
		const llave = llaveLibre(baseDeLlave(p.nombre, p.apellido), ocupadas);
		ocupadas.add(llave);
		await db('wge_participantes').where({ id: p.id }).whereNull('llave').update({ llave });
	}
	return sinLlave.length;
}

/** Participante por su llave (o el texto del QR), con su país y estado de la tarjeta. */
async function participantePorLlave(db, texto) {
	const llave = normalizarLlave(texto);
	if (!llave) throw new WgeError(400, 'VALOR_INVALIDO', 'Escribe o escanea la llave');
	const p = await db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id').leftJoin('wge_paises as ps', 'ps.id', 'pa.pais_id')
		.where('pa.llave', llave).first('pa.id', 'pa.edicion_id', 'pa.pais_id', 'pa.retirado', 'pa.llave', 'e.nombre', 'e.apellido', 'ps.nombre as pais', 'ps.codigo_moneda');
	if (!p) throw new WgeError(404, 'LLAVE_NO_EXISTE', `No hay ninguna cuenta con la llave ${llave}`);
	if (p.retirado) throw new WgeError(409, 'RETIRADO', 'El estudiante fue retirado de la edición');
	if (!p.pais_id) throw new WgeError(409, 'SIN_PAIS', 'El participante no tiene país asignado');
	return p;
}

const saldoDe = async (db, where) => Number((await db('wge_billeteras').where(where).first('saldo'))?.saldo ?? 0);

function rutasCuentas(router, { ruta, db, unaSolaVez }) {
	/** El banco solo atiende las cuentas de los países que maneja. */
	const permitirBanco = async (trxODb, req, rol, participante) => {
		exigirRol(rol, ROLES.BANCO, ROLES.ADMIN_WG);
		await exigirEquipo(trxODb, { edicionId: participante.edicion_id, usuarioId: req.accountability.user, rol });
		await exigirResponsableBanco(trxODb, { paisId: participante.pais_id, usuarioId: req.accountability.user, rol });
	};
	const participanteActivo = async (trxODb, id) => {
		const p = await trxODb('wge_participantes').where('id', id).first();
		if (!p) throw new WgeError(404, 'NO_EXISTE', 'El participante no existe');
		if (p.retirado) throw new WgeError(409, 'RETIRADO', 'El estudiante fue retirado de la edición');
		if (!p.pais_id) throw new WgeError(409, 'SIN_PAIS', 'El participante no tiene país asignado');
		return p;
	};
	const edicionAbiertaCuentas = async (trx, id) => {
		const e = await trx('wge_ediciones').where('id', id).first('id', 'estado');
		if (e?.estado !== 'abierta') throw new WgeError(409, 'EDICION_CERRADA', 'La edición no está abierta');
	};

	/**
	 * GET /wge/ediciones/:id/cuentas: por cada país que maneja el banco, sus estudiantes con efectivo, cuenta,
	 * llave y estado de la tarjeta; sus docentes con billetes y cuenta; y los billetes del banco (para retiros).
	 */
	router.get('/ediciones/:id/cuentas', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.BANCO, ROLES.ADMIN_WG);
		const edicion = await db('wge_ediciones').where('id', req.params.id).first('id', 'nombre', 'estado');
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		await exigirEquipo(db, { edicionId: edicion.id, usuarioId: req.accountability.user, rol });
		await asegurarLlaves(db, edicion.id);
		const consulta = db('wge_paises').where('edicion_id', edicion.id).orderBy('orden').select('id', 'nombre', 'codigo_moneda', 'color');
		if (rol !== ROLES.ADMIN && rol !== ROLES.ADMIN_WG) consulta.where('responsable_banco', req.accountability.user);
		const paises = await consulta;
		for (const p of paises) {
			p.inventario = await inventarioBanco(db, edicion.id, p.id);
			p.estudiantes = await db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
				.leftJoin('wge_billeteras as b', function () { this.on('b.participante_id', 'pa.id').andOn('b.pais_id', 'pa.pais_id').andOnVal('b.tipo_dueno', 'estudiante'); })
				.leftJoin('wge_billeteras as c', function () { this.on('c.participante_id', 'pa.id').andOn('c.pais_id', 'pa.pais_id').andOnVal('c.tipo_dueno', 'cuenta'); })
				.where({ 'pa.edicion_id': edicion.id, 'pa.pais_id': p.id }).whereRaw('coalesce(pa.retirado, false) = false')
				.select('pa.id', 'e.nombre', 'e.apellido', 'pa.llave',
					db.raw('coalesce(b.saldo, 0)::int as efectivo'), db.raw('coalesce(c.saldo, 0)::int as cuenta'))
				.orderBy([{ column: 'e.nombre' }, { column: 'e.apellido' }]);
			p.en_cuentas = p.estudiantes.reduce((t, e) => t + e.cuenta, 0);
		}
		return { edicion, denominaciones: DENOMINACIONES, paises };
	}));

	/** GET /wge/ediciones/:id/tarjetas: tarjetas para imprimir (nombre, país, color y llave) de los países que maneja. */
	router.get('/ediciones/:id/tarjetas', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.BANCO, ROLES.ADMIN_WG);
		const edicion = await db('wge_ediciones').where('id', req.params.id).first('id', 'nombre');
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		await exigirEquipo(db, { edicionId: edicion.id, usuarioId: req.accountability.user, rol });
		await asegurarLlaves(db, edicion.id);
		const q = db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id').join('wge_paises as ps', 'ps.id', 'pa.pais_id')
			.where('pa.edicion_id', edicion.id).whereRaw('coalesce(pa.retirado, false) = false')
			.select('pa.id', 'e.nombre', 'e.apellido', 'pa.llave', 'ps.id as pais_id', 'ps.nombre as pais', 'ps.color', 'ps.codigo_moneda')
			.orderBy([{ column: 'ps.orden' }, { column: 'e.nombre' }, { column: 'e.apellido' }]);
		if (rol !== ROLES.ADMIN && rol !== ROLES.ADMIN_WG) q.where('ps.responsable_banco', req.accountability.user);
		return { edicion, tarjetas: await q };
	}));

	/**
	 * GET /wge/cuentas/llave/:llave: a quién pertenece una llave (para transferir o cobrar con tarjeta).
	 * Lo usan banco, docentes y caja de la misma edición.
	 */
	router.get('/cuentas/llave/:llave', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.BANCO, ROLES.DOCENTE, ROLES.CAJERO, ROLES.ADMIN_WG);
		const p = await participantePorLlave(db, req.params.llave);
		await exigirEquipo(db, { edicionId: p.edicion_id, usuarioId: req.accountability.user, rol });
		return {
			participante_id: p.id, llave: p.llave, nombre: p.nombre, apellido: p.apellido, pais_id: p.pais_id, pais: p.pais,
			codigo_moneda: p.codigo_moneda, edicion_id: p.edicion_id,
		};
	}));

	/** POST /wge/cuentas/consignar { participante_id, billetes, clave_idempotencia }: billetes del estudiante → su cuenta. */
	router.post('/cuentas/consignar', ruta(async (req, rol) => {
		const { limpio, total } = totalDelConteo(req.body?.billetes);
		if (!total) throw new WgeError(400, 'VALOR_INVALIDO', 'Elige los billetes que consigna el estudiante');
		const clave = exigirTexto(req.body?.clave_idempotencia, 'clave_idempotencia');
		const actor = req.accountability.user;
		return unaSolaVez('wge_transferencias', clave, async (trx) => {
			const p = await participanteActivo(trx, exigirTexto(req.body?.participante_id, 'participante_id'));
			await permitirBanco(trx, req, rol, p);
			await edicionAbiertaCuentas(trx, p.edicion_id);
			const efectivo = await billeteraBloqueada(trx, { edicionId: p.edicion_id, paisId: p.pais_id, tipo: 'estudiante', participanteId: p.id });
			const cuenta = await billeteraBloqueada(trx, { edicionId: p.edicion_id, paisId: p.pais_id, tipo: 'cuenta', participanteId: p.id });
			const id = crypto.randomUUID();
			await moverSaldo(trx, efectivo, { tipo: 'consignacion', monto: -total, actor, referenciaTipo: 'transferencia', referenciaId: id });
			await moverSaldo(trx, cuenta, { tipo: 'consignacion', monto: total, actor, referenciaTipo: 'transferencia', referenciaId: id });
			const fila = {
				id, edicion_id: p.edicion_id, pais_id: p.pais_id, billetera_origen_id: efectivo.id, billetera_destino_id: cuenta.id,
				monto: total, estado: 'aplicada', clave_idempotencia: clave, billetes: JSON.stringify(limpio), date_created: new Date(), user_created: actor,
			};
			await trx('wge_transferencias').insert(fila);
			return { ...fila, efectivo: efectivo.saldo, cuenta: cuenta.saldo };
		});
	}));

	/** POST /wge/cuentas/retirar { participante_id, billetes, clave_idempotencia }: de la cuenta → billetes en mano. */
	router.post('/cuentas/retirar', ruta(async (req, rol) => {
		const { limpio, total } = totalDelConteo(req.body?.billetes);
		if (!total) throw new WgeError(400, 'VALOR_INVALIDO', 'Elige los billetes que le entregas al estudiante');
		const clave = exigirTexto(req.body?.clave_idempotencia, 'clave_idempotencia');
		const actor = req.accountability.user;
		const previo = await participanteActivo(db, exigirTexto(req.body?.participante_id, 'participante_id'));
		await permitirBanco(db, req, rol, previo);
		return unaSolaVez('wge_transferencias', clave, async (trx) => {
			const p = await participanteActivo(trx, previo.id);
			await edicionAbiertaCuentas(trx, p.edicion_id);
			const cuenta = await billeteraBloqueada(trx, { edicionId: p.edicion_id, paisId: p.pais_id, tipo: 'cuenta', participanteId: p.id });
			if (Number(cuenta.saldo) < total) throw new WgeError(409, 'SALDO_INSUFICIENTE', `En su cuenta solo hay ${cuenta.saldo}`);
			const quedan = await inventarioBanco(trx, p.edicion_id, p.pais_id);
			for (const [d, n] of Object.entries(limpio)) {
				if (n > quedan[d]) throw new WgeError(409, 'SIN_BILLETES', `En el banco solo quedan ${Math.max(quedan[d], 0)} billetes de ${Number(d).toLocaleString('es-CO')}`);
			}
			const efectivo = await billeteraBloqueada(trx, { edicionId: p.edicion_id, paisId: p.pais_id, tipo: 'estudiante', participanteId: p.id });
			const id = crypto.randomUUID();
			await moverSaldo(trx, cuenta, { tipo: 'retiro_cuenta', monto: -total, actor, referenciaTipo: 'transferencia', referenciaId: id });
			await moverSaldo(trx, efectivo, { tipo: 'retiro_cuenta', monto: total, actor, referenciaTipo: 'transferencia', referenciaId: id });
			const fila = {
				id, edicion_id: p.edicion_id, pais_id: p.pais_id, billetera_origen_id: cuenta.id, billetera_destino_id: efectivo.id,
				monto: total, estado: 'aplicada', clave_idempotencia: clave, billetes: JSON.stringify(limpio), date_created: new Date(), user_created: actor,
			};
			await trx('wge_transferencias').insert(fila);
			return { ...fila, efectivo: efectivo.saldo, cuenta: cuenta.saldo };
		});
	}));

	return { saldoDe };
}

// Caja GO•STORE: un encargado por edición vende los productos de la tienda.
// El estudiante paga con billetes físicos de su país; la caja da el vuelto con los billetes que tiene.
// Los billetes se quedan en la caja (una billetera por país) hasta que el encargado los entrega al banco.

const leerBilletesCaja = (b) => (typeof b === 'string' ? JSON.parse(b) : b) ?? {};

/** Billetes que hay hoy en la caja de un país: recibidos en ventas − vuelto dado − entregados al banco. */
async function inventarioCaja(db, edicionId, paisId) {
	const quedan = Object.fromEntries(DENOMINACIONES.map((d) => [d, 0]));
	const sumar = (lista, signo) => {
		for (const b of lista) for (const [d, n] of Object.entries(leerBilletesCaja(b))) if (d in quedan) quedan[d] += signo * Number(n);
	};
	const ventas = await db('wge_ventas').where({ edicion_id: edicionId, pais_id: paisId, estado: 'pagada' }).select('billetes_recibidos', 'billetes_vuelto');
	sumar(ventas.map((v) => v.billetes_recibidos), 1);
	sumar(ventas.map((v) => v.billetes_vuelto), -1);
	const caja = await db('wge_billeteras').where({ edicion_id: edicionId, pais_id: paisId, tipo_dueno: 'caja' }).first('id');
	if (caja) sumar(await db('wge_transferencias').where({ billetera_origen_id: caja.id, estado: 'aplicada' }).whereNotNull('billetes').pluck('billetes'), -1);
	return quedan;
}

/** Solo el encargado de la caja de la edición (o un administrativo) vende y entrega al banco. */
async function exigirResponsableCaja(db, { edicionId, usuarioId, rol }) {
	if (rol === ROLES.ADMIN || rol === ROLES.ADMIN_WG) return;
	const e = await db('wge_ediciones as e').leftJoin('directus_users as u', 'u.id', 'e.responsable_caja')
		.where('e.id', edicionId).first('e.responsable_caja', 'u.first_name', 'u.last_name');
	// Sin encargado asignado, cualquier cajero del equipo de la edición puede vender (el equipo se revisa antes)
	if (!e?.responsable_caja) return;
	if (e.responsable_caja !== usuarioId) throw new WgeError(403, 'OTRO_RESPONSABLE', `La caja la maneja ${`${e.first_name ?? ''} ${e.last_name ?? ''}`.trim()}`);
}

/** Precio en billetes de un producto con la tasa de un país (siempre hacia arriba). */
const precioEnBilletesCaja = (precioCop, tasa) => Math.ceil(Number(precioCop) / Math.max(Number(tasa), 1));

function rutasCaja(router, { ruta, db }) {
	const permitir = async (req, rol, edicionId) => {
		exigirRol(rol, ROLES.CAJERO, ROLES.ADMIN_WG);
		await exigirEquipo(db, { edicionId, usuarioId: req.accountability.user, rol });
	};

	/** GET /wge/ediciones/:id/caja: productos, estudiantes con su saldo, billetes de la caja por país, ventas y entregas. */
	router.get('/ediciones/:id/caja', ruta(async (req, rol) => {
		const edicion = await db('wge_ediciones as e').leftJoin('directus_users as u', 'u.id', 'e.responsable_caja').where('e.id', req.params.id)
			.first('e.id', 'e.nombre', 'e.estado', 'e.tasa_inicial', 'e.responsable_caja', db.raw("trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) as responsable"));
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		await permitir(req, rol, edicion.id);
		const esAdmin = rol === ROLES.ADMIN || rol === ROLES.ADMIN_WG;
		const paises = await db('wge_paises').where('edicion_id', edicion.id).orderBy('orden').select('id', 'nombre', 'codigo_moneda', 'color', 'tasa_actual');
		for (const p of paises) {
			p.tasa_actual = Number(p.tasa_actual ?? edicion.tasa_inicial);
			const caja = await db('wge_billeteras').where({ edicion_id: edicion.id, pais_id: p.id, tipo_dueno: 'caja' }).first('saldo');
			p.saldo_caja = Number(caja?.saldo ?? 0);
			p.inventario = await inventarioCaja(db, edicion.id, p.id);
		}
		const productos = await db('wge_productos').where({ edicion_id: edicion.id, activo: true }).orderBy('nombre')
			.select('id', 'nombre', 'foto', 'precio_cop', 'stock', 'maximo_por_estudiante');
		// Unidades vendidas de cada producto (ventas pagadas)
		const vendidos = await db('wge_venta_items as i').join('wge_ventas as v', 'v.id', 'i.venta_id')
			.where({ 'v.edicion_id': edicion.id, 'v.estado': 'pagada' }).groupBy('i.producto_id').select('i.producto_id').sum({ n: 'i.cantidad' });
		const porProducto = new Map(vendidos.map((v) => [v.producto_id, Number(v.n)]));
		for (const p of productos) p.vendidos = porProducto.get(p.id) ?? 0;
		const estudiantes = await db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
			.leftJoin('wge_billeteras as b', function () { this.on('b.participante_id', 'pa.id').andOn('b.pais_id', 'pa.pais_id').andOnVal('b.tipo_dueno', 'estudiante'); })
			.where('pa.edicion_id', edicion.id).whereNotNull('pa.pais_id').whereRaw('coalesce(pa.retirado, false) = false')
			.leftJoin('wge_billeteras as c', function () { this.on('c.participante_id', 'pa.id').andOn('c.pais_id', 'pa.pais_id').andOnVal('c.tipo_dueno', 'cuenta'); })
			.select('pa.id', 'pa.pais_id', 'pa.llave', 'e.nombre', 'e.apellido', db.raw('coalesce(b.saldo, 0)::int as saldo'), db.raw('coalesce(c.saldo, 0)::int as cuenta'))
			.orderBy([{ column: 'e.nombre' }, { column: 'e.apellido' }]);
		// Lo que cada estudiante ya compró de cada producto (para el máximo por estudiante)
		const compras = await db('wge_venta_items as i').join('wge_ventas as v', 'v.id', 'i.venta_id')
			.where({ 'v.edicion_id': edicion.id, 'v.estado': 'pagada' }).groupBy('v.participante_id', 'i.producto_id')
			.select('v.participante_id', 'i.producto_id').sum({ n: 'i.cantidad' });
		const comprado = {};
		for (const c of compras) (comprado[c.participante_id] ??= {})[c.producto_id] = Number(c.n);
		const ventas = await db('wge_ventas as v').join('wge_participantes as pa', 'pa.id', 'v.participante_id').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
			.where('v.edicion_id', edicion.id).orderBy('v.date_created', 'desc').limit(50)
			.select('v.id', 'v.numero_recibo', 'v.total_billetes', 'v.tasa_aplicada', 'v.pais_id', db.raw("coalesce(v.metodo_pago, 'efectivo') as metodo_pago"), 'v.billetes_recibidos', 'v.billetes_vuelto', 'v.date_created', 'e.nombre', 'e.apellido');
		const items = ventas.length ? await db('wge_venta_items as i').join('wge_productos as p', 'p.id', 'i.producto_id')
			.whereIn('i.venta_id', ventas.map((v) => v.id)).select('i.venta_id', 'p.nombre', 'i.cantidad', 'i.precio_billetes') : [];
		for (const v of ventas) {
			v.items = items.filter((i) => i.venta_id === v.id).map(({ venta_id, ...x }) => x);
			v.billetes_recibidos = leerBilletesCaja(v.billetes_recibidos);
			v.billetes_vuelto = leerBilletesCaja(v.billetes_vuelto);
		}
		const entregas = await db('wge_transferencias as t').join('wge_billeteras as bo', 'bo.id', 't.billetera_origen_id')
			.leftJoin('directus_users as u', 'u.id', 't.user_created')
			.where({ 'bo.edicion_id': edicion.id, 'bo.tipo_dueno': 'caja' }).orderBy('t.date_created', 'desc').limit(30)
			.select('t.id', 't.pais_id', 't.monto', 't.billetes', 't.date_created', db.raw("trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) as quien"));
		return {
			edicion, puede_vender: esAdmin || edicion.responsable_caja === req.accountability.user || (!edicion.responsable_caja && rol === ROLES.CAJERO),
			denominaciones: DENOMINACIONES, paises, productos, estudiantes, comprado, ventas, entregas,
		};
	}));

	/** POST /wge/ediciones/:id/caja/entregar { pais_id, billetes, clave_idempotencia }: la caja entrega billetes al banco del país. */
	router.post('/ediciones/:id/caja/entregar', ruta(async (req, rol) => {
		const edicionId = req.params.id;
		await permitir(req, rol, edicionId);
		await exigirResponsableCaja(db, { edicionId, usuarioId: req.accountability.user, rol });
		const { limpio, total } = totalDelConteo(req.body?.billetes);
		if (!total) throw new WgeError(400, 'VALOR_INVALIDO', 'Elige los billetes que entregas al banco');
		const clave = exigirTexto(req.body?.clave_idempotencia, 'clave_idempotencia');
		const actor = req.accountability.user;
		const previa = await db('wge_transferencias').where('clave_idempotencia', clave).first();
		if (previa) return { ...previa, repetida: true };
		return db.transaction(async (trx) => {
			const pais = await trx('wge_paises').where({ id: String(req.body?.pais_id ?? ''), edicion_id: edicionId }).first('id', 'nombre');
			if (!pais) throw new WgeError(404, 'NO_EXISTE', 'El país no es de esta edición');
			const caja = await billeteraBloqueada(trx, { edicionId, paisId: pais.id, tipo: 'caja' });
			const quedan = await inventarioCaja(trx, edicionId, pais.id);
			for (const [d, n] of Object.entries(limpio)) {
				if (n > (quedan[d] ?? 0)) throw new WgeError(409, 'SIN_BILLETES', `En la caja solo hay ${Math.max(0, quedan[d] ?? 0)} billetes de ${d}`);
			}
			const banco = await billeteraBloqueada(trx, { edicionId, paisId: pais.id, tipo: 'banco' });
			const id = crypto.randomUUID();
			await moverSaldo(trx, caja, { tipo: 'transferencia_salida', monto: -total, actor, referenciaTipo: 'transferencia', referenciaId: id });
			await moverSaldo(trx, banco, { tipo: 'transferencia_entrada', monto: total, actor, referenciaTipo: 'transferencia', referenciaId: id });
			const fila = {
				id, edicion_id: edicionId, pais_id: pais.id, billetera_origen_id: caja.id, billetera_destino_id: banco.id, monto: total,
				estado: 'aplicada', clave_idempotencia: clave, billetes: JSON.stringify(limpio), date_created: new Date(), user_created: actor,
			};
			await trx('wge_transferencias').insert(fila);
			return { ...fila, billetes: limpio };
		});
	}));
}

// Cierre de una edición: liquida lo que quede en marcha y arma el resumen final.

const deJsonCierre = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

/**
 * Rendimiento acumulado de cada empresa en las rondas liquidadas: (1 + r1) × (1 + r2) × … − 1.
 * Ordenado de la que más ganó a la que menos.
 */
function rendimientoAcumulado(fondos, rondas) {
	const lista = fondos.map((f) => ({ fondo_id: f.id, nombre: f.nombre, logo: f.logo ?? null, factor: 1, rondas: 0, mejor: null, peor: null }));
	const porId = new Map(lista.map((f) => [f.fondo_id, f]));
	for (const r of rondas) {
		for (const res of deJsonCierre(r.resultados) ?? []) {
			const f = porId.get(res.fondo_id);
			if (!f) continue;
			const rend = Number(res.rendimiento ?? 0);
			f.factor *= 1 + rend;
			f.rondas++;
			f.mejor = f.mejor === null ? rend : Math.max(f.mejor, rend);
			f.peor = f.peor === null ? rend : Math.min(f.peor, rend);
		}
	}
	return lista
		.map(({ factor, ...f }) => ({ ...f, acumulado: Math.round((factor - 1) * 10000) / 10000 }))
		.sort((a, b) => b.acumulado - a.acumulado || a.nombre.localeCompare(b.nombre));
}

/** Resumen final (o parcial, si sigue abierta): estudiantes por riqueza, empresas, banco, caja y tienda por país. */
async function resumenDelCierre(db, edicionId) {
	const edicion = await db('wge_ediciones').where('id', edicionId)
		.first('id', 'nombre', 'estado', 'fecha_inicio', 'fecha_fin', 'tasa_inicial', 'investment_bill');
	if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');

	const rondas = await db('wge_rondas').where({ edicion_id: edicionId, estado: 'liquidada' }).orderBy('apertura').select('id', 'nombre', 'resultados');
	const fondos = await db('wge_fondos').where('edicion_id', edicionId).orderBy('orden').select('id', 'nombre', 'logo');
	const empresas = rendimientoAcumulado(fondos, rondas);

	const paises = await db('wge_paises').where('edicion_id', edicionId).orderBy('orden')
		.select('id', 'nombre', 'codigo_moneda', 'color', 'provision_inicial', 'tasa_actual');
	for (const p of paises) {
		const saldo = async (tipo) => Number((await db('wge_billeteras').where({ edicion_id: edicionId, pais_id: p.id, tipo_dueno: tipo }).sum({ s: 'saldo' }).first())?.s ?? 0);
		p.provision_inicial = Number(p.provision_inicial ?? 0);
		p.saldo_banco = await saldo('banco');
		p.saldo_caja = await saldo('caja');
		p.saldo_docentes = await saldo('docente');
		p.saldo_cuentas = await saldo('cuenta');
		p.saldo_virtual = await saldo('banco_virtual');
		const ventas = await db('wge_ventas').where({ edicion_id: edicionId, pais_id: p.id, estado: 'pagada' })
			.count({ n: '*' }).sum({ total: 'total_billetes' }).first();
		p.ventas = Number(ventas?.n ?? 0);
		p.total_ventas = Number(ventas?.total ?? 0);

		const estudiantes = await db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
			.leftJoin('wge_billeteras as b', function () { this.on('b.participante_id', 'pa.id').andOn('b.pais_id', 'pa.pais_id').andOnVal('b.tipo_dueno', 'estudiante'); })
			.where({ 'pa.edicion_id': edicionId, 'pa.pais_id': p.id }).whereRaw('coalesce(pa.retirado, false) = false')
			.leftJoin('wge_billeteras as c', function () { this.on('c.participante_id', 'pa.id').andOn('c.pais_id', 'pa.pais_id').andOnVal('c.tipo_dueno', 'cuenta'); })
			.select('pa.id', 'e.nombre', 'e.apellido', db.raw('coalesce(b.saldo, 0)::int as saldo'), db.raw('coalesce(c.saldo, 0)::int as cuenta'));
		const ids = estudiantes.map((e) => e.id);
		const invertido = new Map();
		const ganado = new Map();
		if (ids.length) {
			for (const i of await db('wge_inversiones').whereIn('participante_id', ids).select('participante_id', 'estado', 'monto', 'valor_actual', 'monto_pagado')) {
				const final = i.estado === 'abierta' || i.estado === 'por_cobrar' ? valorDe(i) : Number(i.monto_pagado ?? valorDe(i));
				if (i.estado === 'abierta' || i.estado === 'por_cobrar') invertido.set(i.participante_id, (invertido.get(i.participante_id) ?? 0) + valorDe(i));
				ganado.set(i.participante_id, (ganado.get(i.participante_id) ?? 0) + final - Number(i.monto));
			}
		}
		const notas = ids.length ? await db('wge_evaluaciones').whereIn('participante_id', ids)
			.groupBy('participante_id').select('participante_id').avg({ promedio: 'puntaje' }).count({ n: '*' }) : [];
		const nota = new Map(notas.map((n) => [n.participante_id, { promedio: Math.round(Number(n.promedio) * 10) / 10, n: Number(n.n) }]));
		const compras = ids.length ? await db('wge_ventas').whereIn('participante_id', ids).where('estado', 'pagada')
			.groupBy('participante_id').select('participante_id').sum({ total: 'total_billetes' }) : [];
		const gastado = new Map(compras.map((c) => [c.participante_id, Number(c.total)]));

		p.estudiantes = estudiantes.map((e) => ({
			...e,
			invertido: invertido.get(e.id) ?? 0,
			total: e.saldo + e.cuenta + (invertido.get(e.id) ?? 0),
			ganancia_fondos: ganado.get(e.id) ?? 0,
			gastado_tienda: gastado.get(e.id) ?? 0,
			rubrica: nota.get(e.id) ?? null,
		})).sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
		p.total_estudiantes = p.estudiantes.reduce((t, e) => t + e.total, 0);
	}
	return { edicion, rondas: rondas.length, empresas, paises, maximo_rubrica: 12 };
}

/**
 * Cierra la edición: liquida la ronda abierta (sin abrir otra), devuelve al saldo de cada estudiante lo que
 * tenga invertido (con su valor de hoy) y deja la edición en «cerrada». Después ya no se vende, ni se invierte,
 * ni se mueve la tasa.
 */
async function cerrarEdicion(db, edicionId, actor) {
	return db.transaction(async (trx) => {
		const edicion = await trx('wge_ediciones').where('id', edicionId).forUpdate().first('id', 'estado');
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		if (edicion.estado === 'cerrada') throw new WgeError(409, 'EDICION_CERRADA', 'La edición ya fue cerrada');
		if (edicion.estado !== 'abierta') throw new WgeError(409, 'EDICION_EN_PREPARACION', 'La edición todavía no se ha abierto');

		const abiertas = await trx('wge_rondas').where({ edicion_id: edicionId, estado: 'abierta' }).orderBy('id').forUpdate();
		for (const r of abiertas) {
			await liquidarRonda(trx, r, actor);
			await trx('wge_rondas').where('id', r.id).update({ detenida: true });
		}
		const vigentes = await trx('wge_inversiones as i').join('wge_participantes as pa', 'pa.id', 'i.participante_id')
			.where('pa.edicion_id', edicionId).whereIn('i.estado', ['abierta', 'por_cobrar']).orderBy('i.id').forUpdate('i').select('i.*');
		let liquidado = 0;
		for (const inv of vigentes) liquidado += Number((await retirarInversion(trx, inv, actor)).monto_pagado ?? 0);

		await trx('wge_ediciones').where('id', edicionId).update({ estado: 'cerrada' });
		return { rondas_cerradas: abiertas.length, inversiones_liquidadas: vigentes.length, total_liquidado: liquidado };
	});
}

function rutasCierre(router, { ruta, db }) {
	/** GET /wge/admin/ediciones/:id/resumen-final: el resumen (sirve también con la edición abierta, como vista previa). */
	router.get('/admin/ediciones/:id/resumen-final', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.ADMIN_WG);
		return resumenDelCierre(db, req.params.id);
	}));

	/** POST /wge/admin/ediciones/:id/cerrar { confirmar: "CERRAR" } */
	router.post('/admin/ediciones/:id/cerrar', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.ADMIN_WG);
		if (String(req.body?.confirmar ?? '').trim().toUpperCase() !== 'CERRAR') throw new WgeError(400, 'VALOR_INVALIDO', 'Escribe CERRAR para confirmar');
		const hecho = await cerrarEdicion(db, req.params.id, req.accountability.user);
		return { ...hecho, resumen: await resumenDelCierre(db, req.params.id) };
	}));
}

// Portal del acudiente: entra con su documento y un código de 6 dígitos que le llega al correo.
// No usa usuarios de Directus: la sesión es un token propio (se guarda cifrado) que viaja en el cuerpo de cada petición.
// Nunca responde 401 (la plataforma lo toma como "sesión de colaborador vencida"); la sesión vencida es 403.

const MINUTOS_CODIGO = 10;
const MAX_INTENTOS = 5;
const MAX_CODIGOS_15_MIN = 3;
const DIAS_SESION = 4;
/** Votos que tiene cada acudiente por ronda (en empresas distintas). */
const VOTOS_POR_RONDA = 2;

const sha256 = (texto) => sha256Base('sha256').update(String(texto)).digest('hex');
const soloDigitos = (v) => String(v ?? '').replace(/\D/g, '');

/** "camilo@gmail.com" → "c****o@gmail.com" */
function ocultarCorreo(correo) {
	const [usuario, dominio] = String(correo ?? '').split('@');
	if (!usuario || !dominio) return null;
	const visible = usuario.length <= 2 ? usuario[0] : `${usuario[0]}${'*'.repeat(Math.min(usuario.length - 2, 6))}${usuario.at(-1)}`;
	return `${visible}@${dominio}`;
}

const TEXTOS_CORREO_CODIGO = {
	es: {
		asunto: (codigo) => `Tu código de Will-Go: ${codigo}`,
		hola: (nombre) => `Hola, ${nombre}`,
		intro: 'Este es tu código para entrar al portal de acudientes de Will-Go Economy:',
		vence: (minutos) => `Vence en ${minutos} minutos. Si no lo pediste, ignora este correo.`,
	},
	en: {
		asunto: (codigo) => `Your Will-Go code: ${codigo}`,
		hola: (nombre) => `Hello, ${nombre}`,
		intro: 'This is your code to sign in to the Will-Go Economy parent portal:',
		vence: (minutos) => `It expires in ${minutos} minutes. If you did not request it, ignore this email.`,
	},
	fr: {
		asunto: (codigo) => `Votre code Will-Go : ${codigo}`,
		hola: (nombre) => `Bonjour ${nombre},`,
		intro: 'Voici votre code pour accéder au portail des parents de Will-Go Economy :',
		vence: (minutos) => `Il expire dans ${minutos} minutes. Si vous ne l'avez pas demandé, ignorez cet e-mail.`,
	},
};

/** Asunto y cuerpo (HTML) del correo con el código de entrada, en el idioma pedido (es, en o fr). */
function correoCodigoAcudiente({ nombre, codigo, minutos, idioma = 'es' }) {
	const t = TEXTOS_CORREO_CODIGO[idioma] ?? TEXTOS_CORREO_CODIGO.es;
	const limpio = String(nombre ?? '').replace(/[<>&]/g, '');
	return {
		subject: t.asunto(codigo),
		html: `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#1f2937">
				<h2 style="margin:0 0 8px">${t.hola(limpio)}</h2>
				<p>${t.intro}</p>
				<p style="font-size:36px;font-weight:800;letter-spacing:8px;margin:16px 0">${codigo}</p>
				<p style="color:#6b7280;font-size:14px">${t.vence(minutos)}</p></div>`,
	};
}

const deJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

/** Nombre con el que llegan los correos de Will-Go (Directus usaría el nombre del proyecto, «Directus»). */
const REMITENTE_CORREOS = 'Thinking Mind';

function rutasAcudientes(router, { db, services, getSchema, logger, env }) {
	const publica = (fn) => async (req, res) => {
		try {
			res.json({ data: await fn(req) });
		} catch (error) {
			const idioma = idiomaDe(req);
			if (error instanceof WgeError) return res.status(error.status === 401 ? 403 : error.status).json({ errors: [{ message: traducirMensaje(error.message, idioma), extensions: { code: error.code } }] });
			logger.error(error, 'wge: portal acudiente');
			res.status(500).json({ errors: [{ message: traducirMensaje('Error interno en Will Go Economy', idioma), extensions: { code: 'ERROR_INTERNO' } }] });
		}
	};

	const documentoNormal = "regexp_replace(coalesce(numero_documento, ''), '[^0-9]', '', 'g')";

	/**
	 * Hijos (participantes activos) de un grupo de acudientes. Un estudiante es hijo si el acudiente aparece
	 * en su ficha (estudiantes.acudiente) o si fue quien lo inscribió y pagó (cuentas_cobrar.cliente_id).
	 */
	const participantesDe = (ids) => db('wge_participantes as p').join('estudiantes as e', 'e.id', 'p.estudiante_id')
		.join('wge_ediciones as ed', 'ed.id', 'p.edicion_id')
		.whereNot('ed.estado', 'cerrada').whereRaw('coalesce(p.retirado, false) = false')
		.where((w) => w.whereIn('e.acudiente', ids)
			.orWhereExists(db('cuentas_cobrar as cc').whereRaw('cc.estudiante_id = e.id').whereIn('cc.cliente_id', ids).select(db.raw('1'))));

	/** Todos los registros de clientes con el mismo documento (la plataforma a veces tiene al acudiente repetido). */
	const mismaPersona = async (acudienteId) => {
		const doc = await db('clientes').where('id', acudienteId).first(db.raw(`${documentoNormal} as doc`));
		if (!doc?.doc) return [acudienteId];
		const ids = await db('clientes').whereRaw(`${documentoNormal} = ?`, [doc.doc]).pluck('id');
		return ids.length ? ids : [acudienteId];
	};

	/** El acudiente con ese documento que tiene hijos en una edición activa (prefiere el registro que tiene correo). */
	const acudienteActivo = async (documento) => {
		const candidatos = await db('clientes').whereRaw(`${documentoNormal} = ?`, [documento])
			.orderByRaw('(email is null or email = \'\') asc').select('id', 'nombre', 'apellido', 'email');
		if (!candidatos.length) return null;
		const tieneHijos = await participantesDe(candidatos.map((c) => c.id)).first('p.id');
		return tieneHijos ? candidatos[0] : null;
	};

	const sesion = async (req) => {
		const token = String(req.body?.sesion ?? '');
		if (token.length < 32) throw new WgeError(403, 'SESION_VENCIDA', 'Tu sesión terminó; vuelve a entrar');
		const fila = await db('wge_sesiones_acudiente').where('token_hash', sha256(token)).where('expira', '>', new Date()).first('acudiente_id');
		if (!fila) throw new WgeError(403, 'SESION_VENCIDA', 'Tu sesión terminó; vuelve a entrar');
		return fila.acudiente_id;
	};

	/** POST /wge/acudiente/codigo { documento }: envía el código al correo registrado (sin decir si el documento existe). */
	router.post('/acudiente/codigo', publica(async (req) => {
		const documento = soloDigitos(req.body?.documento);
		if (documento.length < 5) throw new WgeError(400, 'VALOR_INVALIDO', 'Escribe tu número de documento');
		const acudiente = await acudienteActivo(documento);
		const respuesta = { enviado: true, correo: null };
		if (!acudiente?.email) return respuesta;

		const recientes = await db('wge_codigos_acudiente').where('acudiente_id', acudiente.id)
			.where('date_created', '>', new Date(Date.now() - 15 * 60000)).count({ n: '*' }).first();
		if (Number(recientes?.n ?? 0) >= MAX_CODIGOS_15_MIN) throw new WgeError(429, 'DEMASIADOS', 'Ya te enviamos varios códigos; espera unos minutos y revisa tu correo');

		const codigo = String(enteroSeguro(0, 1000000)).padStart(6, '0');
		await db('wge_codigos_acudiente').insert({
			id: crypto.randomUUID(), acudiente_id: acudiente.id, codigo_hash: sha256(`${acudiente.id}:${codigo}`),
			expira: new Date(Date.now() + MINUTOS_CODIGO * 60000), intentos: 0, usado: false, date_created: new Date(),
		});
		const correo = new services.MailService({ schema: await getSchema(), knex: db });
		await correo.send({
			to: acudiente.email,
			// Remitente «Thinking Mind <EMAIL_FROM>»; sin EMAIL_FROM, Directus usa su remitente por defecto
			...(env?.EMAIL_FROM ? { from: { name: REMITENTE_CORREOS, address: env.EMAIL_FROM } } : {}),
			...correoCodigoAcudiente({ nombre: acudiente.nombre, codigo, minutos: MINUTOS_CODIGO, idioma: idiomaDe(req) }),
		});
		return { ...respuesta, correo: ocultarCorreo(acudiente.email) };
	}));

	/** POST /wge/acudiente/entrar { documento, codigo }: valida el código y abre una sesión. */
	router.post('/acudiente/entrar', publica(async (req) => {
		const documento = soloDigitos(req.body?.documento);
		const codigo = soloDigitos(req.body?.codigo);
		const invalido = new WgeError(400, 'CODIGO_INVALIDO', 'El código no es correcto o ya venció');
		if (codigo.length !== 6) throw invalido;
		const acudiente = await acudienteActivo(documento);
		if (!acudiente) throw invalido;
		return db.transaction(async (trx) => {
			const fila = await trx('wge_codigos_acudiente').where({ acudiente_id: acudiente.id, usado: false })
				.where('expira', '>', new Date()).orderBy('date_created', 'desc').forUpdate().first();
			if (!fila || Number(fila.intentos) >= MAX_INTENTOS) throw invalido;
			if (fila.codigo_hash !== sha256(`${acudiente.id}:${codigo}`)) {
				await trx('wge_codigos_acudiente').where('id', fila.id).increment('intentos', 1);
				throw invalido;
			}
			await trx('wge_codigos_acudiente').where('id', fila.id).update({ usado: true });
			const token = bytesSeguros(32).toString('hex');
			await trx('wge_sesiones_acudiente').insert({
				id: crypto.randomUUID(), acudiente_id: acudiente.id, token_hash: sha256(token),
				expira: new Date(Date.now() + DIAS_SESION * 86400000), date_created: new Date(),
			});
			return { sesion: token, nombre: acudiente.nombre };
		});
	}));

	/** POST /wge/acudiente/salir { sesion } */
	router.post('/acudiente/salir', publica(async (req) => {
		const token = String(req.body?.sesion ?? '');
		if (token) await db('wge_sesiones_acudiente').where('token_hash', sha256(token)).delete();
		return { salio: true };
	}));

	/**
	 * POST /wge/acudiente/panel { sesion }: sus hijos con saldo e inversiones y, por cada edición,
	 * la ronda abierta (para el reloj), su voto, las empresas y el rendimiento de las rondas cerradas.
	 */
	router.post('/acudiente/panel', publica(async (req) => {
		const acudienteId = await sesion(req);
		const acudiente = await db('clientes').where('id', acudienteId).first('nombre', 'apellido');
		const familia = await mismaPersona(acudienteId);
		const hijos = await participantesDe(familia).leftJoin('wge_paises as pa', 'pa.id', 'p.pais_id')
			.leftJoin('wge_billeteras as b', function () { this.on('b.participante_id', 'p.id').andOn('b.pais_id', 'p.pais_id').andOnVal('b.tipo_dueno', 'estudiante'); })
			.orderBy([{ column: 'e.nombre' }, { column: 'e.apellido' }])
			.leftJoin('wge_billeteras as c', function () { this.on('c.participante_id', 'p.id').andOn('c.pais_id', 'p.pais_id').andOnVal('c.tipo_dueno', 'cuenta'); })
			.select('p.id', 'p.edicion_id', 'p.pais_id', 'p.llave', 'e.nombre', 'e.apellido', 'pa.nombre as pais', 'pa.color', 'pa.codigo_moneda',
				db.raw('coalesce(b.saldo, 0)::int as saldo'), db.raw('coalesce(c.saldo, 0)::int as cuenta'));
		for (const h of hijos) {
			Object.assign(h, h.pais_id ? await movimientosEstudiante(db, h.id, h.pais_id) : { movimientos: [], total_entro: 0, total_salio: 0 });
			delete h.pais_id;
			h.rubrica = resumenCalificaciones(await db('wge_evaluaciones').where('participante_id', h.id).select(...CRITERIOS, 'date_created'));
			h.inversiones = (await db('wge_inversiones as i').join('wge_fondos as f', 'f.id', 'i.fondo_id').join('wge_rondas as r', 'r.id', 'i.ronda_id')
				.where('i.participante_id', h.id).orderBy('i.date_created', 'desc').limit(30)
				.select('i.id', 'i.monto', 'i.estado', 'i.monto_pagado', 'i.valor_actual', 'i.historial', 'f.nombre as fondo', 'r.nombre as ronda'))
				.map((i) => ({ ...i, valor: i.estado === 'abierta' ? Number(i.valor_actual ?? i.monto) : Number(i.monto_pagado ?? i.monto), historial: deJson(i.historial) ?? [] }));
		}
		const ediciones = [];
		for (const edicionId of [...new Set(hijos.map((h) => h.edicion_id))]) {
			const edicion = await db('wge_ediciones').where('id', edicionId).first('id', 'nombre', 'estado');
			const ronda = await db('wge_rondas').where({ edicion_id: edicionId, estado: 'abierta' })
				.first('id', 'nombre', 'apertura', 'cierre_programado', 'duracion_minutos');
			const votos = ronda ? await db('wge_votos').where({ acudiente_id: acudienteId, ronda_id: ronda.id }).orderBy('date_created').pluck('fondo_id') : [];
			const fondos = await db('wge_fondos').where({ edicion_id: edicionId, activo: true }).orderBy('orden')
				.select('id', 'nombre', 'riesgo', 'logo', 'a_que_se_dedica', 'por_que_invertir');
			const cerradas = (await db('wge_rondas').where({ edicion_id: edicionId, estado: 'liquidada' }).orderBy('apertura')
				.select('id', 'nombre', 'resultados')).map((r) => ({ ...r, resultados: (deJson(r.resultados) ?? []).map((x) => ({ fondo_id: x.fondo_id, rendimiento: x.rendimiento })) }));
			const { proxima } = ronda ? { proxima: null } : await estadoRondas(db, edicionId);
			const fx = await datosTipoCambio(db, edicionId, { limite: 100 });
			const tipoCambio = {
				tasa_inicial: fx.tasa_inicial, proximo_calculo: fx.proximo_calculo, intervalo_minutos: fx.intervalo_minutos,
				paises: fx.paises.map((p) => ({ id: p.id, nombre: p.nombre, codigo_moneda: p.codigo_moneda, color: p.color, tasa_actual: p.tasa_actual,
					historial: p.historial.map((h) => ({ ventana: h.ventana, tasa_anterior: h.tasa_anterior, tasa_nueva: h.tasa_nueva })) })),
			};
			ediciones.push({ ...edicion, ronda: ronda ? { ...ronda, mis_votos: votos, votos_por_ronda: VOTOS_POR_RONDA } : null, proxima_ronda: proxima, fondos, rondas: cerradas, tipo_cambio: tipoCambio });
		}
		return { acudiente, ahora: new Date(), hijos, ediciones };
	}));

	/**
	 * POST /wge/acudiente/votar { sesion, ronda_id, fondo_id, quitar }
	 * Cada acudiente tiene VOTOS_POR_RONDA votos por ronda, en empresas distintas. Con quitar=true retira el voto
	 * de esa empresa (para cambiarlo). Solo mientras la ronda esté abierta.
	 */
	router.post('/acudiente/votar', publica(async (req) => {
		const acudienteId = await sesion(req);
		return db.transaction(async (trx) => {
			const ronda = await trx('wge_rondas').where('id', String(req.body?.ronda_id ?? '')).forUpdate().first();
			if (!ronda || ronda.estado !== 'abierta' || (ronda.cierre_programado && new Date(ronda.cierre_programado) <= new Date())) {
				throw new WgeError(409, 'RONDA_CERRADA', 'Esta ronda ya cerró; podrás votar en la siguiente');
			}
			const tieneHijo = await participantesDe(await mismaPersona(acudienteId)).where('p.edicion_id', ronda.edicion_id).first('p.id');
			if (!tieneHijo) throw new WgeError(403, 'SIN_PERMISO', 'No tienes estudiantes en esta edición');
			const fondo = await trx('wge_fondos').where({ id: String(req.body?.fondo_id ?? ''), edicion_id: ronda.edicion_id, activo: true }).first('id', 'nombre');
			if (!fondo) throw new WgeError(404, 'NO_EXISTE', 'La empresa no está disponible');
			const mios = () => trx('wge_votos').where({ acudiente_id: acudienteId, ronda_id: ronda.id });
			const clave = `${acudienteId}:${ronda.id}:${fondo.id}`;
			if (req.body?.quitar === true) {
				await mios().where('fondo_id', fondo.id).delete();
			} else if (!(await mios().where('fondo_id', fondo.id).first('id'))) {
				const usados = Number((await mios().count({ n: '*' }).first())?.n ?? 0);
				if (usados >= VOTOS_POR_RONDA) throw new WgeError(409, 'SIN_VOTOS', `Ya usaste tus ${VOTOS_POR_RONDA} votos de esta ronda; quita uno para votar por otra empresa`);
				await trx('wge_votos').insert({ id: crypto.randomUUID(), acudiente_id: acudienteId, fondo_id: fondo.id, ronda_id: ronda.id, clave_unica: clave, date_created: new Date() });
			}
			const misVotos = await mios().orderBy('date_created').pluck('fondo_id');
			return { ronda_id: ronda.id, fondo: fondo.nombre, mis_votos: misVotos };
		});
	}));

	/** GET /wge/acudiente/logo/:id: logo de una empresa (son ficticias; no necesita sesión). */
	router.get('/acudiente/logo/:id', async (req, res) => {
		try {
			if (!(await db('wge_fondos').where('logo', req.params.id).first('id'))) return res.status(404).end();
			const activos = new services.AssetsService({ schema: await getSchema(), accountability: null });
			const { stream, file } = await activos.getAsset(req.params.id, { transformationParams: { width: 480, height: 480, fit: 'cover', quality: 80 } });
			res.setHeader('Content-Type', file.type ?? 'image/jpeg');
			res.setHeader('Cache-Control', 'public, max-age=86400');
			stream.pipe(res);
		} catch {
			res.status(404).end();
		}
	});
}

// Endpoints de WILL-GO ECONOMY: /wge/...
// Cada operación con billetes corre dentro de una transacción; si algo falla, no queda nada a medias.

const CLAVE_DUPLICADA = '23505'; // unique_violation de PostgreSQL

const configEndpoint = {
	id: 'wge',
	handler: (router, { database: db, logger, services, getSchema, env }) => {
		rutasAcudientes(router, { db, services, getSchema, logger, env });
		const ruta = (fn) => async (req, res) => {
			try {
				if (!req.accountability?.user) throw new WgeError(401, 'SIN_SESION', 'Debes iniciar sesión');
				const rol = await rolDelUsuario(db, req.accountability);
				res.json({ data: await fn(req, rol) });
			} catch (error) {
				const idioma = idiomaDe(req);
				if (error instanceof WgeError) return res.status(error.status).json({ errors: [{ message: traducirMensaje(error.message, idioma), extensions: { code: error.code } }] });
				logger.error(error, 'wge');
				res.status(500).json({ errors: [{ message: traducirMensaje('Error interno en Will Go Economy', idioma), extensions: { code: 'ERROR_INTERNO' } }] });
			}
		};

		// Si la misma petición llega dos veces (doble toque, reintento), devuelve el resultado ya guardado.
		const unaSolaVez = async (tabla, clave, operacion) => {
			const previo = await db(tabla).where('clave_idempotencia', clave).first();
			if (previo) return { ...previo, repetida: true };
			try {
				return await db.transaction(operacion);
			} catch (error) {
				if (error?.code === CLAVE_DUPLICADA) {
					const ya = await db(tabla).where('clave_idempotencia', clave).first();
					if (ya) return { ...ya, repetida: true };
				}
				throw error;
			}
		};

		const edicionAbierta = async (trx, edicionId) => {
			const edicion = await trx('wge_ediciones').where('id', edicionId).first();
			if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
			if (edicion.estado !== 'abierta') throw new WgeError(409, 'EDICION_CERRADA', 'La edición no está abierta');
			return edicion;
		};

		const participanteConPais = async (trx, participanteId) => {
			const p = await trx('wge_participantes').where('id', participanteId).first();
			if (!p) throw new WgeError(404, 'NO_EXISTE', 'El participante no existe');
			if (p.retirado) throw new WgeError(409, 'RETIRADO', 'El estudiante fue retirado de la edición');
			if (!p.pais_id) throw new WgeError(409, 'SIN_PAIS', 'El participante no tiene país asignado');
			return p;
		};

		/**
		 * POST /wge/transferencias
		 * Banco → docente: { tipo: "banco_docente", pais_id, docente_id, monto, clave_idempotencia }
		 * Docente → estudiante: { tipo: "docente_estudiante", participante_id, monto, clave_idempotencia }
		 * Con { electronica: true } es una transferencia entre cuentas, sin billetes: banco → cuenta del docente, o
		 * cuenta del docente → cuenta del estudiante (que se puede indicar con su llave: { llave: "@sofia.gomez" }).
		 */
		router.post('/transferencias', ruta(async (req, rol) => {
			const { tipo } = req.body ?? {};
			// Si llegan los billetes entregados, el monto es su total
			const electronica = req.body?.electronica === true;
			if (electronica && req.body?.billetes) throw new WgeError(400, 'VALOR_INVALIDO', 'Una transferencia electrónica no lleva billetes');
			const detalle = req.body?.billetes ? totalDelConteo(req.body.billetes) : null;
			const monto = detalle ? enteroPositivo(detalle.total, 'monto') : enteroPositivo(req.body?.monto, 'monto');
			const clave = exigirTexto(req.body?.clave_idempotencia, 'clave_idempotencia');
			const actor = req.accountability.user;

			return unaSolaVez('wge_transferencias', clave, async (trx) => {
				let paisId, origen, destino;
				if (tipo === 'banco_docente') {
					exigirRol(rol, ROLES.BANCO);
					paisId = exigirTexto(req.body.pais_id, 'pais_id');
					const docenteId = exigirTexto(req.body.docente_id, 'docente_id');
					if ((await rolDelUsuario(trx, { user: docenteId })) !== ROLES.DOCENTE) throw new WgeError(409, 'NO_ES_DOCENTE', 'El destinatario no es docente de Will Go');
					const pais = await trx('wge_paises').where('id', paisId).first();
					if (!pais) throw new WgeError(404, 'NO_EXISTE', 'El país no existe');
					await edicionAbierta(trx, pais.edicion_id);
					await exigirEquipo(trx, { edicionId: pais.edicion_id, usuarioId: actor, rol });
					await exigirResponsableBanco(trx, { paisId, usuarioId: actor, rol });
					await exigirEquipo(trx, { edicionId: pais.edicion_id, usuarioId: docenteId, rol: ROLES.DOCENTE, paisId, quien: 'El docente' });
					// Bloqueo en orden fijo (banco antes que docente) para evitar bloqueos cruzados
					// En billetes sale del efectivo del banco; electrónica, de su cuenta virtual
					origen = await billeteraBloqueada(trx, { edicionId: pais.edicion_id, paisId, tipo: electronica ? 'banco_virtual' : 'banco' });
					if (electronica && Number(origen.saldo) < monto) {
						throw new WgeError(409, 'SALDO_INSUFICIENTE', `En la cuenta virtual del banco solo hay ${Number(origen.saldo)}`);
					}
					if (detalle) {
						const quedan = await inventarioBanco(trx, pais.edicion_id, paisId);
						for (const [d, n] of Object.entries(detalle.limpio)) {
							if (n > quedan[d]) throw new WgeError(409, 'SIN_BILLETES', `En el banco solo quedan ${Math.max(quedan[d], 0)} billetes de ${Number(d).toLocaleString('es-CO')}`);
						}
					}
					destino = await billeteraBloqueada(trx, { edicionId: pais.edicion_id, paisId, tipo: electronica ? 'cuenta' : 'docente', docenteId });
				} else if (tipo === 'docente_estudiante') {
					exigirRol(rol, ROLES.DOCENTE);
					const participanteId = req.body?.llave ? (await participantePorLlave(trx, req.body.llave)).id : exigirTexto(req.body.participante_id, 'participante_id');
					const participante = await participanteConPais(trx, participanteId);
					await edicionAbierta(trx, participante.edicion_id);
					paisId = participante.pais_id;
					const docenteId = rol === ROLES.ADMIN && req.body.docente_id ? req.body.docente_id : actor;
					await exigirEquipo(trx, { edicionId: participante.edicion_id, usuarioId: docenteId, rol: docenteId === actor ? rol : ROLES.DOCENTE, paisId, quien: docenteId === actor ? 'Tu usuario' : 'El docente' });
					origen = await billeteraBloqueada(trx, { edicionId: participante.edicion_id, paisId, tipo: electronica ? 'cuenta' : 'docente', docenteId });
					if (detalle) {
						const tiene = await inventarioDocente(trx, participante.edicion_id, paisId, docenteId);
						for (const [d, n] of Object.entries(detalle.limpio)) {
							if (n > tiene[d]) throw new WgeError(409, 'SIN_BILLETES', `Solo tienes ${Math.max(tiene[d], 0)} billetes de ${Number(d).toLocaleString('es-CO')}`);
						}
					}
					destino = await billeteraBloqueada(trx, { edicionId: participante.edicion_id, paisId, tipo: electronica ? 'cuenta' : 'estudiante', participanteId: participante.id });
				} else {
					throw new WgeError(400, 'VALOR_INVALIDO', 'tipo debe ser banco_docente o docente_estudiante');
				}

				const id = crypto.randomUUID();
				await moverSaldo(trx, origen, { tipo: 'transferencia_salida', monto: -monto, actor, referenciaTipo: 'transferencia', referenciaId: id });
				await moverSaldo(trx, destino, { tipo: 'transferencia_entrada', monto, actor, referenciaTipo: 'transferencia', referenciaId: id });
				const fila = {
					id, edicion_id: origen.edicion_id, pais_id: paisId,
					billetera_origen_id: origen.id, billetera_destino_id: destino.id,
					monto, estado: 'aplicada', clave_idempotencia: clave, billetes: detalle ? JSON.stringify(detalle.limpio) : null,
					date_created: new Date(), user_created: actor,
				};
				await trx('wge_transferencias').insert(fila);
				return { ...fila, saldo_origen: origen.saldo, saldo_destino: destino.saldo };
			});
		}));

		/**
		 * POST /wge/ventas
		 * { participante_id, items: [{ producto_id, cantidad }], clave_idempotencia }
		 * Precio en billetes = techo(precio en COP educativo / tasa vigente del país del estudiante).
		 */
		/**
		 * POST /wge/ventas { participante_id, items: [{ producto_id, cantidad }], billetes_recibidos, billetes_vuelto, clave_idempotencia }
		 * El estudiante paga con billetes de su país; la caja recibe lo que entregó y da el vuelto (recibido − total).
		 */
		router.post('/ventas', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.CAJERO, ROLES.ADMIN_WG);
			// Con tarjeta débito ({ metodo: "tarjeta", llave }) se descuenta de la cuenta del estudiante: sin billetes ni vuelto
			const conTarjeta = req.body?.metodo === 'tarjeta';
			const recibidos = totalDelConteo(conTarjeta ? {} : req.body?.billetes_recibidos ?? {});
			const vuelto = totalDelConteo(conTarjeta ? {} : req.body?.billetes_vuelto ?? {});
			const clave = exigirTexto(req.body?.clave_idempotencia, 'clave_idempotencia');
			const items = Array.isArray(req.body?.items) ? req.body.items : [];
			if (!items.length) throw new WgeError(400, 'VALOR_INVALIDO', 'La venta no tiene productos');
			const pedido = new Map();
			for (const it of items) {
				const productoId = exigirTexto(it?.producto_id, 'producto_id');
				pedido.set(productoId, (pedido.get(productoId) ?? 0) + enteroPositivo(it?.cantidad, 'cantidad'));
			}
			const actor = req.accountability.user;

			return unaSolaVez('wge_ventas', clave, async (trx) => {
				const participante = await participanteConPais(trx, exigirTexto(req.body.participante_id, 'participante_id'));
				if (conTarjeta) {
					// La tarjeta escaneada (o la llave escrita) debe ser la del estudiante que compra
					const dueno = await participantePorLlave(trx, exigirTexto(req.body?.llave, 'llave'));
					if (dueno.id !== participante.id) throw new WgeError(409, 'TARJETA_DE_OTRO', `Esa tarjeta es de ${dueno.nombre} ${dueno.apellido}`);
				}
				const edicion = await edicionAbierta(trx, participante.edicion_id);
				await exigirEquipo(trx, { edicionId: edicion.id, usuarioId: actor, rol });
				await exigirResponsableCaja(trx, { edicionId: edicion.id, usuarioId: actor, rol });
				const pais = await trx('wge_paises').where('id', participante.pais_id).first(); // la tasa vigente al momento de la compra
				const tasa = Number(pais.tasa_actual || edicion.tasa_inicial);
				const billetera = await billeteraBloqueada(trx, { edicionId: edicion.id, paisId: pais.id, tipo: conTarjeta ? 'cuenta' : 'estudiante', participanteId: participante.id });

				const productos = await trx('wge_productos').whereIn('id', [...pedido.keys()]).orderBy('id').forUpdate();
				if (productos.length !== pedido.size) throw new WgeError(404, 'NO_EXISTE', 'Algún producto no existe');

				let total = 0;
				const lineas = [];
				for (const p of productos) {
					const cantidad = pedido.get(p.id);
					if (p.edicion_id !== edicion.id || !p.activo) throw new WgeError(409, 'PRODUCTO_NO_DISPONIBLE', `${p.nombre} no está disponible en esta edición`);
					if (Number(p.stock) < cantidad) throw new WgeError(409, 'SIN_STOCK', `No hay suficientes unidades de ${p.nombre}`);
					if (p.maximo_por_estudiante) {
						const ya = await trx('wge_venta_items as i').join('wge_ventas as v', 'v.id', 'i.venta_id')
							.where({ 'v.participante_id': participante.id, 'i.producto_id': p.id, 'v.estado': 'pagada' })
							.sum({ total: 'i.cantidad' }).first();
						if (Number(ya?.total ?? 0) + cantidad > p.maximo_por_estudiante) throw new WgeError(409, 'MAXIMO_POR_ESTUDIANTE', `Máximo ${p.maximo_por_estudiante} de ${p.nombre} por estudiante`);
					}
					const precio = precioEnBilletesCaja(p.precio_cop, tasa);
					total += precio * cantidad;
					lineas.push({ p, cantidad, precio });
				}

				// Billetes: lo recibido debe alcanzar y el vuelto debe ser exacto, con billetes que la caja tenga (o que acaba de recibir)
				if (!conTarjeta && recibidos.total < total) throw new WgeError(409, 'PAGO_INSUFICIENTE', `El total es ${total}; el estudiante entregó ${recibidos.total}`);
				if (!conTarjeta && recibidos.total - vuelto.total !== total) throw new WgeError(400, 'VUELTO_INCORRECTO', `El vuelto debe ser ${recibidos.total - total} (marcaste ${vuelto.total})`);
				if (vuelto.total) {
					const hay = await inventarioCaja(trx, edicion.id, pais.id);
					for (const [d, n] of Object.entries(vuelto.limpio)) {
						const disponibles = (hay[d] ?? 0) + (recibidos.limpio[d] ?? 0);
						if (n > disponibles) throw new WgeError(409, 'SIN_BILLETES', `En la caja solo hay ${Math.max(0, disponibles)} billetes de ${d} para el vuelto`);
					}
				}
				if (Number(billetera.saldo) < total) {
					throw conTarjeta ? new WgeError(409, 'SALDO_INSUFICIENTE', `En su cuenta solo hay ${billetera.saldo}`)
						: new WgeError(409, 'SALDO_INSUFICIENTE', `El estudiante solo tiene ${billetera.saldo} billetes`);
				}

				const ventaId = crypto.randomUUID();
				const movimientoId = await moverSaldo(trx, billetera, { tipo: conTarjeta ? 'pago_tarjeta' : 'compra', monto: -total, actor, referenciaTipo: 'venta', referenciaId: ventaId });
				// En efectivo los billetes quedan en la caja; con tarjeta el dinero pasa de la cuenta a la cuenta virtual del banco
				const recibe = await billeteraBloqueada(trx, { edicionId: edicion.id, paisId: pais.id, tipo: conTarjeta ? 'banco_virtual' : 'caja' });
				await moverSaldo(trx, recibe, { tipo: conTarjeta ? 'pago_tarjeta' : 'compra', monto: total, actor, referenciaTipo: 'venta', referenciaId: ventaId });
				for (const { p, cantidad } of lineas) await trx('wge_productos').where('id', p.id).update({ stock: Number(p.stock) - cantidad });

				const recibo = `GS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${ventaId.slice(0, 8).toUpperCase()}`;
				const venta = {
					id: ventaId, edicion_id: edicion.id, participante_id: participante.id,
					tasa_aplicada: tasa, total_billetes: total, numero_recibo: recibo, movimiento_id: movimientoId,
					estado: 'pagada', clave_idempotencia: clave, date_created: new Date(), user_created: actor,
					pais_id: pais.id, billetes_recibidos: JSON.stringify(recibidos.limpio), billetes_vuelto: JSON.stringify(vuelto.limpio),
					metodo_pago: conTarjeta ? 'tarjeta' : 'efectivo',
				};
				await trx('wge_ventas').insert(venta);
				await trx('wge_venta_items').insert(lineas.map(({ p, cantidad, precio }) => ({
					id: crypto.randomUUID(), venta_id: ventaId, producto_id: p.id, cantidad, precio_billetes: precio,
					date_created: new Date(), user_created: actor,
				})));
				return {
					...venta, saldo: billetera.saldo, billetes_recibidos: recibidos.limpio, billetes_vuelto: vuelto.limpio,
					items: lineas.map(({ p, cantidad, precio }) => ({ producto_id: p.id, nombre: p.nombre, cantidad, precio_billetes: precio })),
				};
			});
		}));

		/**
		 * POST /wge/inversiones  { participante_id, fondo_id, ronda_id, billetes, clave_idempotencia }
		 * El estudiante entrega billetes al banco de su país: salen de su saldo y entran al banco.
		 */
		router.post('/inversiones', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.BANCO, ROLES.ADMIN_WG);
			const { limpio, total: monto } = totalDelConteo(req.body?.billetes);
			if (!monto) throw new WgeError(400, 'VALOR_INVALIDO', 'Elige los billetes que entrega el estudiante');
			const clave = exigirTexto(req.body?.clave_idempotencia, 'clave_idempotencia');
			const actor = req.accountability.user;

			return unaSolaVez('wge_inversiones', clave, async (trx) => {
				const participante = await participanteConPais(trx, exigirTexto(req.body.participante_id, 'participante_id'));
				const edicion = await edicionAbierta(trx, participante.edicion_id);
				await exigirEquipo(trx, { edicionId: edicion.id, usuarioId: actor, rol });
				await exigirResponsableBanco(trx, { paisId: participante.pais_id, usuarioId: actor, rol });
				const ronda = await trx('wge_rondas').where('id', exigirTexto(req.body.ronda_id, 'ronda_id')).forUpdate().first();
				if (!ronda || ronda.edicion_id !== edicion.id) throw new WgeError(404, 'NO_EXISTE', 'La ronda no existe en esta edición');
				if (ronda.estado !== 'abierta' || (ronda.cierre_programado && new Date(ronda.cierre_programado) <= new Date())) {
					throw new WgeError(409, 'RONDA_CERRADA', 'La ronda ya cerró; espera la siguiente');
				}
				const fondo = await trx('wge_fondos').where('id', exigirTexto(req.body.fondo_id, 'fondo_id')).first();
				if (!fondo || fondo.edicion_id !== edicion.id || !fondo.activo) throw new WgeError(404, 'NO_EXISTE', 'La empresa no está disponible');

				const estudiante = await billeteraBloqueada(trx, { edicionId: edicion.id, paisId: participante.pais_id, tipo: 'estudiante', participanteId: participante.id });
				if (Number(estudiante.saldo) < monto) throw new WgeError(409, 'SALDO_INSUFICIENTE', `El estudiante solo tiene ${estudiante.saldo} billetes`);
				const banco = await billeteraBloqueada(trx, { edicionId: edicion.id, paisId: participante.pais_id, tipo: 'banco' });
				const id = crypto.randomUUID();
				await moverSaldo(trx, estudiante, { tipo: 'inversion', monto: -monto, actor, referenciaTipo: 'inversion', referenciaId: id });
				await moverSaldo(trx, banco, { tipo: 'inversion', monto, actor, referenciaTipo: 'inversion', referenciaId: id });
				const fila = {
					id, participante_id: participante.id, fondo_id: fondo.id, ronda_id: ronda.id, monto, billetes: JSON.stringify(limpio),
					estado: 'abierta', clave_idempotencia: clave, date_created: new Date(), user_created: actor,
				};
				await trx('wge_inversiones').insert(fila);
				return { ...fila, billetes: limpio, saldo: estudiante.saldo };
			});
		}));

		/**
		 * POST /wge/rondas/:id/cerrar { continuar }
		 * Cierra la ronda ya (sin esperar su hora). Con continuar=true abre la siguiente con la misma duración.
		 */
		router.post('/rondas/:id/cerrar', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.BANCO, ROLES.ADMIN_WG);
			const actor = req.accountability.user;
			const ronda = await db('wge_rondas').where('id', req.params.id).first('id', 'edicion_id', 'estado');
			if (!ronda) throw new WgeError(404, 'NO_EXISTE', 'La ronda no existe');
			await exigirEquipo(db, { edicionId: ronda.edicion_id, usuarioId: actor, rol });
			const r = await cerrarYSeguir(db, ronda.id, { actor, continuar: req.body?.continuar === true });
			if (!r) throw new WgeError(409, 'YA_LIQUIDADA', 'La ronda ya fue cerrada');
			return r;
		}));

		/** POST /wge/ediciones/:id/sincronizar-participantes: trae a los inscritos (también se hace solo al consultar). */
		router.post('/ediciones/:id/sincronizar-participantes', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.ADMIN_WG);
			const edicion = await db('wge_ediciones').where('id', req.params.id).first();
			if (!edicion?.curso_id) throw new WgeError(409, 'SIN_PROGRAMA', 'La edición no tiene programa asignado');
			return traerInscritos(db, edicion, req.accountability.user);
		}));

		/**
		 * POST /wge/ediciones/:id/abrir
		 * Carga la provisión del banco en cada moneda y entrega el Investment Bill a quien tenga país.
		 * Se puede llamar varias veces: lo ya entregado no se repite.
		 */
		router.post('/ediciones/:id/abrir', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.ADMIN_WG);
			const actor = req.accountability.user;
			return db.transaction(async (trx) => {
				const edicion = await trx('wge_ediciones').where('id', req.params.id).forUpdate().first();
				if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
				if (edicion.estado === 'cerrada') throw new WgeError(409, 'EDICION_CERRADA', 'La edición ya fue cerrada');
				const paises = await trx('wge_paises').where('edicion_id', edicion.id).orderBy('id');
				if (!paises.length) throw new WgeError(409, 'SIN_PAISES', 'La edición no tiene países');
				const resumen = { provisiones: 0, bienvenidas: 0 };

				for (const pais of paises) {
					if (!pais.tasa_actual) await trx('wge_paises').where('id', pais.id).update({ tasa_actual: edicion.tasa_inicial });
					const banco = await billeteraBloqueada(trx, { edicionId: edicion.id, paisId: pais.id, tipo: 'banco' });
					// Normalmente el banco ya recibió sus billetes al registrarlos; esto cubre ediciones viejas sin ese movimiento
					const yaProvisionado = await trx('wge_movimientos').where({ billetera_id: banco.id }).whereIn('tipo', ['provision', 'reverso']).first();
					if (!yaProvisionado && Number(pais.provision_inicial) > 0) {
						await moverSaldo(trx, banco, { tipo: 'provision', monto: Number(pais.provision_inicial), actor, referenciaTipo: 'edicion', referenciaId: edicion.id });
						resumen.provisiones++;
					}
					await igualarVirtual(trx, edicion.id, pais.id, actor);
					const participantes = await trx('wge_participantes').where({ edicion_id: edicion.id, pais_id: pais.id });
					resumen.bienvenidas += await darBienvenida(trx, edicion, participantes, actor);
				}
				await trx('wge_ediciones').where('id', edicion.id).update({ estado: 'abierta' });
				return resumen;
			});
		}));

		rutasFuncionarios(router, { ruta, db, services, getSchema });
		rutasAdmin(router, { ruta, db, services, getSchema, env, logger });
		rutasArqueo(router, { ruta, db });
		rutasWfunds(router, { ruta, db });
		rutasRubrica(router, { ruta, db });
		rutasCierre(router, { ruta, db });
		rutasTipoCambio(router, { ruta, db });
		rutasCuentas(router, { ruta, db, unaSolaVez });
		rutasCaja(router, { ruta, db });

		/** GET /wge/billetera/:codigo: saldo y últimos movimientos de un estudiante por su código (QR). */
		router.get('/billetera/:codigo', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.BANCO, ROLES.DOCENTE, ROLES.CAJERO);
			const p = await db('wge_participantes as p').join('estudiantes as e', 'e.id', 'p.estudiante_id')
				.leftJoin('wge_paises as pa', 'pa.id', 'p.pais_id')
				.where('p.codigo', String(req.params.codigo).toUpperCase())
				.first('p.id', 'p.edicion_id', 'p.pais_id', 'e.nombre', 'e.apellido', 'pa.nombre as pais', 'pa.codigo_moneda', 'pa.tasa_actual');
			if (!p) throw new WgeError(404, 'NO_EXISTE', 'No hay ningún estudiante con ese código');
			const billetera = p.pais_id ? await db('wge_billeteras').where({ participante_id: p.id, pais_id: p.pais_id, tipo_dueno: 'estudiante' }).first() : null;
			const movimientos = billetera
				? await db('wge_movimientos').where('billetera_id', billetera.id).orderBy('consecutivo', 'desc').limit(20)
					.select('tipo', 'monto', 'saldo_despues', 'date_created')
				: [];
			return { participante: p, saldo: billetera ? Number(billetera.saldo) : 0, movimientos };
		}));
	},
};

export default {
	hooks: [{ name: 'wge-fx', config: configHook }],
	endpoints: [{ name: 'wge', config: configEndpoint }],
	operations: [],
};
