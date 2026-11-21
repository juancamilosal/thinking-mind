// Generado por build.mjs: no editar a mano.
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
				.where('p.pais_id', pais.id).where('e.date_created', '>=', inicio).where('e.date_created', '<', fin)
				.sum({ suma: 'e.puntaje' }).first();
			const { n } = await trx('wge_participantes').where({ pais_id: pais.id, presente: true }).count({ n: '*' }).first();
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
			const monto = enteroPositivo(req.body?.monto, 'monto');
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
					// Bloqueo en orden fijo (banco antes que docente) para evitar bloqueos cruzados
					origen = await billeteraBloqueada(trx, { edicionId: pais.edicion_id, paisId, tipo: 'banco' });
					destino = await billeteraBloqueada(trx, { edicionId: pais.edicion_id, paisId, tipo: 'docente', docenteId });
				} else if (tipo === 'docente_estudiante') {
					exigirRol(rol, ROLES.DOCENTE);
					const participante = await participanteConPais(trx, exigirTexto(req.body.participante_id, 'participante_id'));
					await edicionAbierta(trx, participante.edicion_id);
					paisId = participante.pais_id;
					const docenteId = rol === ROLES.ADMIN && req.body.docente_id ? req.body.docente_id : actor;
					origen = await billeteraBloqueada(trx, { edicionId: participante.edicion_id, paisId, tipo: 'docente', docenteId });
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
					monto, estado: 'aplicada', clave_idempotencia: clave,
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

		/** POST /wge/inversiones  { participante_id, fondo_id, ronda_id, monto, clave_idempotencia } */
		router.post('/inversiones', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.BANCO);
			const monto = enteroPositivo(req.body?.monto, 'monto');
			const clave = exigirTexto(req.body?.clave_idempotencia, 'clave_idempotencia');
			const actor = req.accountability.user;

			return unaSolaVez('wge_inversiones', clave, async (trx) => {
				const participante = await participanteConPais(trx, exigirTexto(req.body.participante_id, 'participante_id'));
				const edicion = await edicionAbierta(trx, participante.edicion_id);
				const ronda = await trx('wge_rondas').where('id', exigirTexto(req.body.ronda_id, 'ronda_id')).forUpdate().first();
				if (!ronda || ronda.edicion_id !== edicion.id) throw new WgeError(404, 'NO_EXISTE', 'La ronda no existe en esta edición');
				if (ronda.estado !== 'abierta') throw new WgeError(409, 'RONDA_CERRADA', 'La ronda ya no recibe inversiones');
				const fondo = await trx('wge_fondos').where('id', exigirTexto(req.body.fondo_id, 'fondo_id')).first();
				if (!fondo || fondo.edicion_id !== edicion.id || !fondo.activo) throw new WgeError(404, 'NO_EXISTE', 'El fondo no está disponible');

				const billetera = await billeteraBloqueada(trx, { edicionId: edicion.id, paisId: participante.pais_id, tipo: 'estudiante', participanteId: participante.id });
				const id = crypto.randomUUID();
				await moverSaldo(trx, billetera, { tipo: 'inversion', monto: -monto, actor, referenciaTipo: 'inversion', referenciaId: id });
				const fila = {
					id, participante_id: participante.id, fondo_id: fondo.id, ronda_id: ronda.id, monto,
					estado: 'abierta', clave_idempotencia: clave, date_created: new Date(), user_created: actor,
				};
				await trx('wge_inversiones').insert(fila);
				return { ...fila, saldo: billetera.saldo };
			});
		}));

		/**
		 * POST /wge/rondas/:id/cerrar
		 * Rendimiento = base (o alterno, en riesgo alto) + bono por votos + variación según riesgo, limitado a ±20 %.
		 * La variación sale de una semilla guardada en la ronda, así el resultado se puede auditar y repetir.
		 */
		router.post('/rondas/:id/cerrar', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.ADMIN_WG);
			const actor = req.accountability.user;
			return db.transaction(async (trx) => {
				const ronda = await trx('wge_rondas').where('id', req.params.id).forUpdate().first();
				if (!ronda) throw new WgeError(404, 'NO_EXISTE', 'La ronda no existe');
				if (ronda.estado === 'liquidada') throw new WgeError(409, 'YA_LIQUIDADA', 'La ronda ya fue liquidada');

				const fondos = await trx('wge_fondos').where({ edicion_id: ronda.edicion_id, activo: true }).orderBy('orden');
				const votos = await trx('wge_votos').where('ronda_id', ronda.id).groupBy('fondo_id').select('fondo_id').count({ n: '*' });
				const votosPorFondo = new Map(votos.map((v) => [v.fondo_id, Number(v.n)]));
				const totalVotos = [...votosPorFondo.values()].reduce((a, b) => a + b, 0);
				const semilla = ronda.semilla || `${ronda.id}:${crypto.randomUUID()}`;
				const azar = aleatorioConSemilla(semilla);

				const resultados = new Map();
				for (const f of fondos) {
					const base = f.riesgo === 'alto' && f.rendimiento_alterno !== null && azar() < 0.5 ? Number(f.rendimiento_alterno) : Number(f.rendimiento_base ?? 0);
					const bono = totalVotos ? limitar(0.04 * ((votosPorFondo.get(f.id) ?? 0) / totalVotos - 1 / fondos.length), -0.02, 0.02) : 0;
					const variacion = (azar() * 2 - 1) * Number(f.variacion ?? 0);
					const rendimiento = Math.round(limitar(base + bono + variacion, -0.2, 0.2) * 10000) / 10000;
					resultados.set(f.id, { fondo: f.nombre, votos: votosPorFondo.get(f.id) ?? 0, base, bono, variacion, rendimiento });
				}

				const inversiones = await trx('wge_inversiones').where({ ronda_id: ronda.id, estado: 'abierta' }).orderBy('id');
				let pagado = 0;
				for (const inv of inversiones) {
					const r = resultados.get(inv.fondo_id)?.rendimiento ?? 0;
					const pago = Math.max(0, Math.floor(Number(inv.monto) * (1 + r)));
					const participante = await trx('wge_participantes').where('id', inv.participante_id).first();
					const billetera = await billeteraBloqueada(trx, { edicionId: ronda.edicion_id, paisId: participante.pais_id, tipo: 'estudiante', participanteId: participante.id });
					if (pago > 0) await moverSaldo(trx, billetera, { tipo: 'pago_fondo', monto: pago, actor, referenciaTipo: 'inversion', referenciaId: inv.id });
					await trx('wge_inversiones').where('id', inv.id).update({ rendimiento_final: r, monto_pagado: pago, estado: 'liquidada' });
					pagado += pago;
				}
				await trx('wge_rondas').where('id', ronda.id).update({ estado: 'liquidada', semilla, cierre: ronda.cierre ?? new Date() });
				return { ronda_id: ronda.id, semilla, total_votos: totalVotos, inversiones: inversiones.length, pagado, fondos: [...resultados.values()] };
			});
		}));

		/** POST /wge/ediciones/:id/sincronizar-participantes: trae a los inscritos en el programa de la edición. */
		router.post('/ediciones/:id/sincronizar-participantes', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.ADMIN_WG);
			const edicion = await db('wge_ediciones').where('id', req.params.id).first();
			if (!edicion?.curso_id) throw new WgeError(409, 'SIN_PROGRAMA', 'La edición no tiene programa asignado');
			const consulta = db('cuentas_cobrar as c').join('estudiantes as e', 'e.id', 'c.estudiante_id')
				.where('c.curso_id', edicion.curso_id).whereNotIn('c.estado', ['DEVOLUCION', 'FONDOS TRASLADADOS'])
				.distinct('e.id as estudiante_id');
			if (edicion.colegio_id) consulta.where('e.colegio_id', edicion.colegio_id);
			const inscritos = await consulta;
			let nuevos = 0;
			for (const { estudiante_id } of inscritos) {
				for (let intento = 0; intento < 5; intento++) {
					const codigo = Math.random().toString(36).slice(2, 8).toUpperCase();
					try {
						const r = await db('wge_participantes').insert({
							id: crypto.randomUUID(), edicion_id: edicion.id, estudiante_id, codigo, presente: false,
							clave_unica: `${edicion.id}:${estudiante_id}`, date_created: new Date(), user_created: req.accountability.user,
						}).onConflict('clave_unica').ignore().returning('id');
						if (r.length) nuevos++;
						break;
					} catch (error) {
						if (error?.code !== CLAVE_DUPLICADA) throw error; // código repetido: se intenta con otro
					}
				}
			}
			return { inscritos: inscritos.length, nuevos };
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
					const yaProvisionado = await trx('wge_movimientos').where({ billetera_id: banco.id, tipo: 'provision' }).first();
					if (!yaProvisionado && Number(pais.provision_inicial) > 0) {
						await moverSaldo(trx, banco, { tipo: 'provision', monto: Number(pais.provision_inicial), actor, referenciaTipo: 'edicion', referenciaId: edicion.id });
						resumen.provisiones++;
					}
					const bienvenida = Number(edicion.investment_bill ?? 0);
					if (bienvenida > 0) {
						const participantes = await trx('wge_participantes').where({ edicion_id: edicion.id, pais_id: pais.id }).orderBy('id');
						for (const p of participantes) {
							const billetera = await billeteraBloqueada(trx, { edicionId: edicion.id, paisId: pais.id, tipo: 'estudiante', participanteId: p.id });
							const yaRecibio = await trx('wge_movimientos').where({ billetera_id: billetera.id, tipo: 'bienvenida' }).first();
							if (yaRecibio) continue;
							await moverSaldo(trx, banco, { tipo: 'transferencia_salida', monto: -bienvenida, actor, referenciaTipo: 'bienvenida', referenciaId: p.id });
							await moverSaldo(trx, billetera, { tipo: 'bienvenida', monto: bienvenida, actor, referenciaTipo: 'bienvenida', referenciaId: p.id });
							resumen.bienvenidas++;
						}
					}
				}
				await trx('wge_ediciones').where('id', edicion.id).update({ estado: 'abierta' });
				return resumen;
			});
		}));

		rutasFuncionarios(router, { ruta, db, services, getSchema });

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
