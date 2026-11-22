// Generado por build.mjs: no editar a mano.
import { Readable } from 'node:stream';
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
		throw new WgeError(409, 'OTRO_PAIS', `${quien === 'Tu usuario' ? 'Eres' : quien + ' es'} docente de ${pais?.nombre ?? 'otro país'}; no maneja billetes de este país`);
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

// Administración de ediciones de WILL-GO ECONOMY (pantalla "Edición y participantes").
// Todo pasa por aquí con una lista de campos permitidos: los roles de Will Go no tocan /items de Directus,
// y ningún campo de dinero (saldos, tasas vigentes, movimientos) se puede escribir desde esta pantalla.

const CAMPOS_JSON = ['horario', 'parametros_fx'];

/** Qué se puede leer y escribir de cada parte de una edición. */
const SECCIONES = {
	paises: { tabla: 'wge_paises', campos: ['nombre', 'codigo_moneda', 'color', 'orden', 'responsable_banco'], orden: 'orden' },
	productos: { tabla: 'wge_productos', campos: ['nombre', 'foto', 'precio_cop', 'stock', 'maximo_por_estudiante', 'activo'], orden: 'nombre' },
	fondos: { tabla: 'wge_fondos', campos: ['nombre', 'historia', 'logo', 'a_que_se_dedica', 'por_que_invertir', 'riesgo', 'rendimiento_base', 'rendimiento_alterno', 'variacion', 'activo', 'orden'], orden: 'orden' },
};
const CAMPOS_EDICION = ['nombre', 'colegio_id', 'curso_id', 'edicion_programa', 'fecha_inicio', 'fecha_fin', 'horario', 'tasa_inicial', 'tope_minimo', 'tope_maximo', 'parametros_fx', 'investment_bill'];

/** Lo que trae toda edición nueva (se puede cambiar después). */
const PAISES_POR_DEFECTO = [
	{ nombre: 'Wonderland', codigo_moneda: 'WON', color: '#E0457B', orden: 1 },
	{ nombre: 'Neverland', codigo_moneda: 'NEV', color: '#C9A227', orden: 2 },
	{ nombre: 'Dreamland', codigo_moneda: 'DRE', color: '#4F7A3A', orden: 3 },
];
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

function rutasAdmin(router, { ruta, db, services, getSchema }) {
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
			await trx('wge_paises').insert(PAISES_POR_DEFECTO.map((p) => nueva(actor, { ...p, edicion_id: edicion.id, provision_inicial: 0 })));
			await trx('wge_fondos').insert(FONDOS_POR_DEFECTO.map((f, i) => nueva(actor, { ...f, edicion_id: edicion.id, activo: true, orden: i + 1 })));
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
		if (Object.keys(fila).length) await db('wge_ediciones').where('id', e.id).update(fila);
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
				});
				return db(s.tabla).where('id', actual.id).first();
			}
			if (Object.keys(fila).length) await db(s.tabla).where('id', actual.id).update(fila);
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
			.leftJoin('wge_billeteras as b', function () { this.on('b.participante_id', 'p.id').andOn('b.pais_id', 'p.pais_id'); })
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
			const conInversion = await trx('wge_inversiones as i').join('wge_participantes as p', 'p.id', 'i.participante_id')
				.join('estudiantes as e', 'e.id', 'p.estudiante_id').whereIn('i.participante_id', ids).whereIn('i.estado', ['abierta', 'por_cobrar'])
				.first('e.nombre', 'e.apellido');
			if (conInversion) throw new WgeError(409, 'INVERSION_ABIERTA', `${conInversion.nombre} ${conInversion.apellido} tiene una inversión en W-Funds sin terminar; retíralo cuando la ronda se cierre y haya cobrado`);
			let devueltos = 0;
			for (const p of lista) {
				if (p.retirado) continue;
				const billeteras = await trx('wge_billeteras').where('participante_id', p.id).where('saldo', '>', 0).orderBy('id');
				for (const b of billeteras) {
					const est = await billeteraBloqueada(trx, { edicionId: b.edicion_id, paisId: b.pais_id, tipo: 'estudiante', participanteId: p.id });
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
		}))).onConflict('clave_unica').ignore().returning('id');
		return { agregados: r.length };
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
		const conBilletes = await db('wge_billeteras').where({ edicion_id: fila.edicion_id, tipo_dueno: 'docente', docente_id: fila.usuario_id })
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
		const [{ suma }] = await db('wge_billeteras').where({ edicion_id: fila.edicion_id, tipo_dueno: 'docente', docente_id: fila.usuario_id }).sum({ suma: 'saldo' });
		if (Number(suma) > 0) throw new WgeError(409, 'TIENE_BILLETES', `Tiene ${Number(suma)} billetes sin entregar en esta edición; primero debe entregarlos`);
		await db('wge_equipo').where('id', fila.id).delete();
		return { quitado: true };
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
			titulo = entra ? `Inversión de ${nombre(i)}${i?.fondo ? ' en ' + i.fondo : ''}` : `Pago a ${nombre(i)}${i?.fondo ? ' (' + i.fondo + ')' : ''}`;
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

function rutasArqueo(router, { ruta, db }) {
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

// W-Funds: rondas de inversión en las empresas (fondos) de la edición.
// El estudiante entrega billetes al banco para invertir; al cerrar la ronda se calcula cuánto le toca
// y pasa a cobrar al banco, que le entrega billetes. Así el inventario físico del banco siempre cuadra.

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

/** Lo que recibe el estudiante al cobrar: lo invertido más (o menos) el rendimiento, sin bajar de 0. */
const pagoDeInversion = (monto, rendimiento) => Math.max(0, Math.floor(Number(monto) * (1 + Number(rendimiento))));

const leerJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

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
			.select('id', 'nombre', 'estado', 'apertura', 'cierre', 'resultados')).map((r) => ({ ...r, resultados: leerJson(r.resultados) ?? [] }));
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
				.leftJoin('wge_billeteras as b', function () { this.on('b.participante_id', 'pa.id').andOn('b.pais_id', 'pa.pais_id'); })
				.where({ 'pa.edicion_id': edicion.id, 'pa.pais_id': p.id }).whereRaw('coalesce(pa.retirado, false) = false')
				.select('pa.id', 'e.nombre', 'e.apellido', db.raw('coalesce(b.saldo, 0)::int as saldo'))
				.orderBy([{ column: 'e.nombre' }, { column: 'e.apellido' }]);
			const base = () => db('wge_inversiones as i').join('wge_participantes as pa', 'pa.id', 'i.participante_id')
				.join('estudiantes as e', 'e.id', 'pa.estudiante_id').join('wge_rondas as r', 'r.id', 'i.ronda_id')
				.where({ 'r.edicion_id': edicion.id, 'pa.pais_id': p.id });
			p.inversiones = abierta ? await base().where('i.ronda_id', abierta.id).orderBy('i.date_created', 'desc')
				.select('i.id', 'i.participante_id', 'i.fondo_id', 'i.monto', 'i.billetes', 'i.date_created', 'e.nombre', 'e.apellido') : [];
			p.por_cobrar = await base().where('i.estado', 'por_cobrar').orderBy([{ column: 'e.nombre' }, { column: 'e.apellido' }])
				.select('i.id', 'i.participante_id', 'i.fondo_id', 'i.monto', 'i.monto_pagado', 'i.rendimiento_final', 'r.nombre as ronda', 'e.nombre', 'e.apellido');
			p.cobradas = await base().where('i.estado', 'cobrada').orderBy('i.cobrado_en', 'desc').limit(20)
				.select('i.id', 'i.fondo_id', 'i.monto', 'i.monto_pagado', 'i.rendimiento_final', 'i.cobrado_en', 'r.nombre as ronda', 'e.nombre', 'e.apellido');
		}
		return { edicion, denominaciones: DENOMINACIONES, ronda: abierta, rondas, fondos, paises };
	}));

	/** POST /wge/ediciones/:id/rondas: abre una ronda nueva (solo una abierta a la vez). */
	router.post('/ediciones/:id/rondas', ruta(async (req, rol) => {
		const edicion = await db('wge_ediciones').where('id', req.params.id).first('id', 'estado');
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		await permitir(req, rol, edicion.id);
		if (edicion.estado !== 'abierta') throw new WgeError(409, 'EDICION_CERRADA', 'La edición no está abierta');
		return db.transaction(async (trx) => {
			await trx('wge_ediciones').where('id', edicion.id).forUpdate().first('id'); // una ronda a la vez, aunque toquen dos personas
			if (await trx('wge_rondas').where({ edicion_id: edicion.id, estado: 'abierta' }).first('id')) {
				throw new WgeError(409, 'RONDA_ABIERTA', 'Ya hay una ronda abierta; ciérrala antes de abrir otra');
			}
			const n = Number((await trx('wge_rondas').where('edicion_id', edicion.id).count({ n: '*' }).first())?.n ?? 0);
			const fila = {
				id: crypto.randomUUID(), edicion_id: edicion.id, nombre: `Ronda ${n + 1}`, apertura: new Date(), estado: 'abierta',
				date_created: new Date(), user_created: req.accountability.user,
			};
			await trx('wge_rondas').insert(fila);
			return fila;
		});
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
				tasa, puntos: Number(suma ?? 0), presentes: Number(n), tasaInicial: Number(edicion.tasa_inicial),
				topeMinimo: Number(edicion.tope_minimo), topeMaximo: Number(edicion.tope_maximo), parametros,
			});
			await trx('wge_fx').insert({
				id: crypto.randomUUID(), pais_id: pais.id, ventana: fin, participantes_presentes: Number(n),
				puntos: Number(suma ?? 0), indice: calculo.indice, tasa_anterior: tasa, tasa_nueva: calculo.nueva,
				date_created: new Date(),
			});
			await trx('wge_paises').where('id', pais.id).update({ tasa_actual: calculo.nueva });
			return { pais: pais.nombre, tasa_anterior: tasa, ...calculo };
		});
		if (r) resultados.push(r);
	}
	return resultados;
}

// Endpoints de WILL-GO ECONOMY: /wge/...
// Cada operación con billetes corre dentro de una transacción; si algo falla, no queda nada a medias.

const CLAVE_DUPLICADA = '23505'; // unique_violation de PostgreSQL

const configEndpoint = {
	id: 'wge',
	handler: (router, { database: db, logger, services, getSchema }) => {
		const ruta = (fn) => async (req, res) => {
			try {
				if (!req.accountability?.user) throw new WgeError(401, 'SIN_SESION', 'Debes iniciar sesión');
				const rol = await rolDelUsuario(db, req.accountability);
				res.json({ data: await fn(req, rol) });
			} catch (error) {
				if (error instanceof WgeError) return res.status(error.status).json({ errors: [{ message: error.message, extensions: { code: error.code } }] });
				logger.error(error, 'wge');
				res.status(500).json({ errors: [{ message: 'Error interno en Will Go Economy', extensions: { code: 'ERROR_INTERNO' } }] });
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
		 */
		router.post('/transferencias', ruta(async (req, rol) => {
			const { tipo } = req.body ?? {};
			// Si llegan los billetes entregados, el monto es su total
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
					origen = await billeteraBloqueada(trx, { edicionId: pais.edicion_id, paisId, tipo: 'banco' });
					if (detalle) {
						const quedan = await inventarioBanco(trx, pais.edicion_id, paisId);
						for (const [d, n] of Object.entries(detalle.limpio)) {
							if (n > quedan[d]) throw new WgeError(409, 'SIN_BILLETES', `En el banco solo quedan ${Math.max(quedan[d], 0)} billetes de ${Number(d).toLocaleString('es-CO')}`);
						}
					}
					destino = await billeteraBloqueada(trx, { edicionId: pais.edicion_id, paisId, tipo: 'docente', docenteId });
				} else if (tipo === 'docente_estudiante') {
					exigirRol(rol, ROLES.DOCENTE);
					const participante = await participanteConPais(trx, exigirTexto(req.body.participante_id, 'participante_id'));
					await edicionAbierta(trx, participante.edicion_id);
					paisId = participante.pais_id;
					const docenteId = rol === ROLES.ADMIN && req.body.docente_id ? req.body.docente_id : actor;
					await exigirEquipo(trx, { edicionId: participante.edicion_id, usuarioId: docenteId, rol: docenteId === actor ? rol : ROLES.DOCENTE, paisId, quien: docenteId === actor ? 'Tu usuario' : 'El docente' });
					origen = await billeteraBloqueada(trx, { edicionId: participante.edicion_id, paisId, tipo: 'docente', docenteId });
					if (detalle) {
						const tiene = await inventarioDocente(trx, participante.edicion_id, paisId, docenteId);
						for (const [d, n] of Object.entries(detalle.limpio)) {
							if (n > tiene[d]) throw new WgeError(409, 'SIN_BILLETES', `Solo tienes ${Math.max(tiene[d], 0)} billetes de ${Number(d).toLocaleString('es-CO')}`);
						}
					}
					destino = await billeteraBloqueada(trx, { edicionId: participante.edicion_id, paisId, tipo: 'estudiante', participanteId: participante.id });
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
		router.post('/ventas', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.CAJERO);
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
				const edicion = await edicionAbierta(trx, participante.edicion_id);
				await exigirEquipo(trx, { edicionId: edicion.id, usuarioId: actor, rol });
				const pais = await trx('wge_paises').where('id', participante.pais_id).first(); // la tasa vigente al momento de la compra
				const tasa = Number(pais.tasa_actual || edicion.tasa_inicial);
				const billetera = await billeteraBloqueada(trx, { edicionId: edicion.id, paisId: pais.id, tipo: 'estudiante', participanteId: participante.id });

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
					const precio = Math.ceil(Number(p.precio_cop) / tasa);
					total += precio * cantidad;
					lineas.push({ p, cantidad, precio });
				}

				const ventaId = crypto.randomUUID();
				const movimientoId = await moverSaldo(trx, billetera, { tipo: 'compra', monto: -total, actor, referenciaTipo: 'venta', referenciaId: ventaId });
				for (const { p, cantidad } of lineas) await trx('wge_productos').where('id', p.id).update({ stock: Number(p.stock) - cantidad });

				const recibo = `GS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${ventaId.slice(0, 8).toUpperCase()}`;
				const venta = {
					id: ventaId, edicion_id: edicion.id, participante_id: participante.id,
					tasa_aplicada: tasa, total_billetes: total, numero_recibo: recibo, movimiento_id: movimientoId,
					estado: 'pagada', clave_idempotencia: clave, date_created: new Date(), user_created: actor,
				};
				await trx('wge_ventas').insert(venta);
				await trx('wge_venta_items').insert(lineas.map(({ p, cantidad, precio }) => ({
					id: crypto.randomUUID(), venta_id: ventaId, producto_id: p.id, cantidad, precio_billetes: precio,
					date_created: new Date(), user_created: actor,
				})));
				return {
					...venta, saldo: billetera.saldo,
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
				if (ronda.estado !== 'abierta') throw new WgeError(409, 'RONDA_CERRADA', 'La ronda ya no recibe inversiones');
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
		 * POST /wge/rondas/:id/cerrar
		 * Calcula el rendimiento de cada empresa y deja cada inversión "por cobrar" con lo que le toca al estudiante.
		 * Los billetes se mueven cuando el estudiante pasa a cobrar al banco (POST /inversiones/:id/cobrar).
		 * La variación sale de una semilla guardada en la ronda, así el resultado se puede auditar y repetir.
		 */
		router.post('/rondas/:id/cerrar', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.BANCO, ROLES.ADMIN_WG);
			const actor = req.accountability.user;
			return db.transaction(async (trx) => {
				const ronda = await trx('wge_rondas').where('id', req.params.id).forUpdate().first();
				if (!ronda) throw new WgeError(404, 'NO_EXISTE', 'La ronda no existe');
				await exigirEquipo(trx, { edicionId: ronda.edicion_id, usuarioId: actor, rol });
				if (ronda.estado !== 'abierta') throw new WgeError(409, 'YA_LIQUIDADA', 'La ronda ya fue cerrada');

				const fondos = await trx('wge_fondos').where({ edicion_id: ronda.edicion_id, activo: true }).orderBy('orden');
				const votos = await trx('wge_votos').where('ronda_id', ronda.id).groupBy('fondo_id').select('fondo_id').count({ n: '*' });
				const semilla = ronda.semilla || `${ronda.id}:${crypto.randomUUID()}`;
				const resultados = calcularResultados(fondos, new Map(votos.map((v) => [v.fondo_id, Number(v.n)])), aleatorioConSemilla(semilla));
				const porFondo = new Map(resultados.map((r) => [r.fondo_id, r.rendimiento]));

				const inversiones = await trx('wge_inversiones').where({ ronda_id: ronda.id, estado: 'abierta' }).orderBy('id');
				let porCobrar = 0;
				for (const inv of inversiones) {
					const r = porFondo.get(inv.fondo_id) ?? 0;
					const pago = pagoDeInversion(inv.monto, r);
					// Si perdió todo no hay nada que cobrar
					await trx('wge_inversiones').where('id', inv.id).update(pago > 0
						? { rendimiento_final: r, monto_pagado: pago, estado: 'por_cobrar' }
						: { rendimiento_final: r, monto_pagado: 0, estado: 'cobrada', cobrado_en: new Date(), cobrado_por: actor, billetes_pago: JSON.stringify({}) });
					porCobrar += pago;
				}
				await trx('wge_rondas').where('id', ronda.id).update({ estado: 'liquidada', semilla, cierre: new Date(), resultados: JSON.stringify(resultados) });
				return { ronda_id: ronda.id, semilla, inversiones: inversiones.length, por_cobrar: porCobrar, fondos: resultados };
			});
		}));

		/**
		 * POST /wge/inversiones/:id/cobrar  { billetes }
		 * El banco entrega al estudiante exactamente lo que le toca, con billetes que tenga en su inventario.
		 */
		router.post('/inversiones/:id/cobrar', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.BANCO, ROLES.ADMIN_WG);
			const { limpio, total } = totalDelConteo(req.body?.billetes);
			const actor = req.accountability.user;
			return db.transaction(async (trx) => {
				const inv = await trx('wge_inversiones').where('id', req.params.id).forUpdate().first();
				if (!inv) throw new WgeError(404, 'NO_EXISTE', 'La inversión no existe');
				if (inv.estado === 'cobrada') return { ...inv, repetida: true };
				if (inv.estado !== 'por_cobrar') throw new WgeError(409, 'RONDA_ABIERTA', 'Esta inversión se cobra cuando se cierre la ronda');
				const participante = await trx('wge_participantes').where('id', inv.participante_id).first();
				const edicion = await edicionAbierta(trx, participante.edicion_id);
				await exigirEquipo(trx, { edicionId: edicion.id, usuarioId: actor, rol });
				await exigirResponsableBanco(trx, { paisId: participante.pais_id, usuarioId: actor, rol });
				const pago = Number(inv.monto_pagado);
				if (total !== pago) throw new WgeError(400, 'VALOR_INVALIDO', `Debes entregar exactamente ${pago} (elegiste ${total})`);
				const quedan = await inventarioBanco(trx, edicion.id, participante.pais_id);
				for (const [d, n] of Object.entries(limpio)) {
					if (n > (quedan[d] ?? 0)) throw new WgeError(409, 'SIN_BILLETES', `En el banco solo quedan ${Math.max(0, quedan[d] ?? 0)} billetes de ${d}`);
				}
				const banco = await billeteraBloqueada(trx, { edicionId: edicion.id, paisId: participante.pais_id, tipo: 'banco' });
				const estudiante = await billeteraBloqueada(trx, { edicionId: edicion.id, paisId: participante.pais_id, tipo: 'estudiante', participanteId: participante.id });
				await moverSaldo(trx, banco, { tipo: 'pago_fondo', monto: -pago, actor, referenciaTipo: 'inversion', referenciaId: inv.id });
				await moverSaldo(trx, estudiante, { tipo: 'pago_fondo', monto: pago, actor, referenciaTipo: 'inversion', referenciaId: inv.id });
				const cambios = { estado: 'cobrada', billetes_pago: JSON.stringify(limpio), cobrado_en: new Date(), cobrado_por: actor };
				await trx('wge_inversiones').where('id', inv.id).update(cambios);
				return { ...inv, ...cambios, billetes_pago: limpio, saldo: estudiante.saldo };
			});
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
					const participantes = await trx('wge_participantes').where({ edicion_id: edicion.id, pais_id: pais.id });
					resumen.bienvenidas += await darBienvenida(trx, edicion, participantes, actor);
				}
				await trx('wge_ediciones').where('id', edicion.id).update({ estado: 'abierta' });
				return resumen;
			});
		}));

		rutasFuncionarios(router, { ruta, db, services, getSchema });
		rutasAdmin(router, { ruta, db, services, getSchema });
		rutasArqueo(router, { ruta, db });
		rutasWfunds(router, { ruta, db });

		/** GET /wge/billetera/:codigo: saldo y últimos movimientos de un estudiante por su código (QR). */
		router.get('/billetera/:codigo', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.BANCO, ROLES.DOCENTE, ROLES.CAJERO);
			const p = await db('wge_participantes as p').join('estudiantes as e', 'e.id', 'p.estudiante_id')
				.leftJoin('wge_paises as pa', 'pa.id', 'p.pais_id')
				.where('p.codigo', String(req.params.codigo).toUpperCase())
				.first('p.id', 'p.edicion_id', 'p.pais_id', 'e.nombre', 'e.apellido', 'pa.nombre as pais', 'pa.codigo_moneda', 'pa.tasa_actual');
			if (!p) throw new WgeError(404, 'NO_EXISTE', 'No hay ningún estudiante con ese código');
			const billetera = p.pais_id ? await db('wge_billeteras').where({ participante_id: p.id, pais_id: p.pais_id }).first() : null;
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
