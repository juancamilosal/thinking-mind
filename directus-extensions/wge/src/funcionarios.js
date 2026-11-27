// Funcionarios de WILL-GO ECONOMY: quién soy, cambio de clave y perfiles que crea el Administrativo.
// Las cuentas se crean con el servicio de usuarios de Directus (que cifra la clave), pero solo
// con roles de Will Go: desde aquí nunca se puede crear ni tocar un usuario de otra parte de la plataforma.
import { WgeError, ROLES, exigirRol, exigirTexto, rolesDe, llavesDe, ROLES_COMBINABLES, esVinculado } from './lib.js';

/** Roles que maneja la pantalla de funcionarios. */
export const ROLES_FUNCIONARIOS = {
	docente: ROLES.DOCENTE,
	banco: ROLES.BANCO,
	cajero: ROLES.CAJERO,
	administrativo: ROLES.ADMIN_WG,
};
const NOMBRES_FUNCIONARIOS = Object.values(ROLES_FUNCIONARIOS);
const LLAVE_POR_NOMBRE = Object.fromEntries(Object.entries(ROLES_FUNCIONARIOS).map(([k, v]) => [v, k]));
const ROLES_FUNCIONARIOS_LLAVE = LLAVE_POR_NOMBRE;

/** Clave temporal fácil de dictar: sin letras que se confunden (0/O, 1/l/I). */
export function claveTemporal() {
	const letras = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
	const numeros = '23456789';
	const elegir = (texto, n) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (v) => texto[v % texto.length]).join('');
	return `${elegir(letras, 4)}-${elegir(numeros, 4)}`;
}

/** Reglas mínimas de una clave definitiva. */
export function validarClave(clave) {
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

export function rutasFuncionarios(router, { ruta, db, services, getSchema }) {
	const usuarios = async () => new services.UsersService({ schema: await getSchema(), accountability: null });

	const idDelRol = async (nombre) => {
		const r = await db('directus_roles').where('name', nombre).first('id');
		if (!r) throw new WgeError(500, 'ROL_NO_EXISTE', `No existe el rol ${nombre} en Directus`);
		return r.id;
	};

	// Colaboradores: cuentas con rol de Will-Go y cuentas de otras partes de la plataforma vinculadas (con roles de Will-Go)
	const consultaFuncionarios = () => db('directus_users as u').join('directus_roles as r', 'r.id', 'u.role')
		.where((w) => w.whereIn('r.name', NOMBRES_FUNCIONARIOS)
			.orWhere((v) => v.whereNot('r.name', ROLES.ADMIN).whereNotNull('u.wge_roles_extra').whereRaw("u.wge_roles_extra::text not in ('[]', 'null')")))
		.select('u.id', 'u.first_name as nombre', 'u.last_name as apellido', 'u.email', 'u.tipo_documento', 'u.numero_documento',
			'u.celular', 'u.status as estado', 'u.last_access as ultimo_ingreso', 'u.debe_cambiar_clave', 'r.name as rol_nombre', 'u.wge_roles_extra');

	// rol: el principal; roles: todos los que tiene, empezando por el principal
	const comoFuncionario = ({ wge_roles_extra, ...u }) => {
		const roles = llavesDe(rolesDe(u.rol_nombre, wge_roles_extra));
		const vinculado = esVinculado(u.rol_nombre);
		return {
			...u, rol: vinculado ? roles[0] : LLAVE_POR_NOMBRE[u.rol_nombre], roles, debe_cambiar_clave: !!u.debe_cambiar_clave,
			// Cuenta de otra parte de la plataforma: conserva su rol y su contraseña; en Will-Go solo tiene sus roles de Will-Go
			vinculado, rol_plataforma: vinculado ? u.rol_nombre : null,
		};
	};

	/**
	 * Ediciones vigentes (no cerradas y sin pasar su fecha final) en las que está cada colaborador,
	 * con lo que maneja en ella: el banco de algún país o la caja.
	 */
	const edicionesActivas = async (ids, cajeros = new Set()) => {
		if (!ids.length) return new Map();
		const hoy = new Date().toISOString().slice(0, 10);
		const filas = await db('wge_equipo as q').join('wge_ediciones as e', 'e.id', 'q.edicion_id')
			.whereIn('q.usuario_id', ids).whereNot('e.estado', 'cerrada')
			.where((w) => w.whereNull('e.fecha_fin').orWhere('e.fecha_fin', '>=', hoy))
			.select('q.usuario_id', 'e.id', 'e.nombre', 'e.estado')
			.orderBy('e.nombre');
		const bancos = filas.length ? await db('wge_paises').whereIn('edicion_id', [...new Set(filas.map((f) => f.id))])
			.whereIn('responsable_banco', ids).select('edicion_id', 'responsable_banco', 'nombre') : [];
		const mapa = new Map();
		for (const f of filas) {
			f.es_cajero = cajeros.has(f.usuario_id); // todo cajero del equipo vende con su propia caja
			const encargos = [
				...bancos.filter((b) => b.edicion_id === f.id && b.responsable_banco === f.usuario_id).map((b) => ({ tipo: 'banco', pais: b.nombre })),
				...(f.es_cajero ? [{ tipo: 'caja' }] : []),
			];
			if (!mapa.has(f.usuario_id)) mapa.set(f.usuario_id, []);
			mapa.get(f.usuario_id).push({ id: f.id, nombre: f.nombre, estado: f.estado, encargos });
		}
		return mapa;
	};

	/** Roles pedidos ({ roles: [...] } o, como antes, { rol }): el primero es el principal. El administrativo no se asigna aquí. */
	const leerRoles = (b) => {
		const lista = Array.isArray(b.roles) ? [...new Set(b.roles)] : b.rol !== undefined ? [b.rol] : null;
		if (!lista) return null;
		if (!lista.length || lista.some((r) => !ROLES_FUNCIONARIOS[r])) throw new WgeError(400, 'VALOR_INVALIDO', 'El rol debe ser docente, banco, cajero o administrativo');
		// Los perfiles administrativos no se crean ni se asignan desde Colaboradores
		if (lista.includes('administrativo')) throw new WgeError(403, 'SIN_PERMISO', 'El rol administrativo no se asigna desde aquí');
		return { principal: ROLES_FUNCIONARIOS[lista[0]], extra: lista.slice(1).filter((r) => ROLES_COMBINABLES.includes(r)) };
	};

	const funcionarioExistente = async (id) => {
		const u = await consultaFuncionarios().where('u.id', id).first();
		if (!u) throw new WgeError(404, 'NO_EXISTE', 'El colaborador no existe o no es de Will Go');
		return u;
	};

	/** GET /wge/yo: quién inició sesión y a qué parte de Will Go entra. */
	router.get('/yo', ruta(async (req, rol) => {
		const u = await db('directus_users').where('id', req.accountability.user)
			.first('id', 'first_name', 'last_name', 'email', 'role', 'debe_cambiar_clave', 'wge_roles_extra');
		const principal = u.role ? await db('directus_roles').where('id', u.role).first('name as nombre') : null;
		const esWillGo = [...NOMBRES_FUNCIONARIOS, ROLES.ADMIN].includes(rol);
		return {
			id: u.id, role: u.role, nombre: u.first_name, apellido: u.last_name, email: u.email,
			rol: rol === ROLES.ADMIN ? 'administrador' : (LLAVE_POR_NOMBRE[rol] ?? null),
			// Todos los roles asignados (quien tiene varios elige con cuál trabajar)
			roles: rol === ROLES.ADMIN ? ['administrador'] : llavesDe(rolesDe(principal?.nombre, u.wge_roles_extra)),
			vinculado: esVinculado(principal?.nombre),
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
		const comoLista = lista.map(comoFuncionario);
		const cajeros = new Set(comoLista.filter((u) => u.roles.includes('cajero')).map((u) => u.id));
		const activas = await edicionesActivas(lista.map((u) => u.id), cajeros);
		return comoLista.map((u) => ({ ...u, ediciones_activas: activas.get(u.id) ?? [] }));
	}));

	/** POST /wge/funcionarios { nombre, apellido, email, rol, tipo_documento, numero_documento, celular } */
	router.post('/funcionarios', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.ADMIN_WG);
		const b = req.body ?? {};
		const roles = leerRoles(b);
		if (!roles) throw new WgeError(400, 'VALOR_INVALIDO', 'El rol debe ser docente, banco, cajero o administrativo');
		const rolNombre = roles.principal;
		puedeManejar(rol, rolNombre);
		const email = validarCorreo(b.email);
		const existente = await db('directus_users as u').leftJoin('directus_roles as r', 'r.id', 'u.role')
			.whereRaw('lower(u.email) = ?', [email]).first('u.id', 'r.name as rol_nombre', 'u.wge_roles_extra');
		if (existente) {
			// Ya es colaborador de Will-Go (o administrador): no se crea de nuevo
			if (!esVinculado(existente.rol_nombre) || rolesDe(existente.rol_nombre, existente.wge_roles_extra).length) {
				throw new WgeError(409, 'CORREO_EXISTE', 'Ya existe un colaborador de Will-Go con ese correo');
			}
			// Cuenta de otra parte de la plataforma (p. ej. AYO): se vincula. Conserva su rol, sus datos y su contraseña;
			// en Will-Go recibe los roles pedidos (todos como roles de Will-Go).
			await (await usuarios()).updateOne(existente.id, { wge_roles_extra: [ROLES_FUNCIONARIOS_LLAVE[roles.principal], ...roles.extra] });
			return { funcionario: comoFuncionario(await funcionarioExistente(existente.id)), clave_temporal: null, vinculado: true };
		}
		const clave = claveTemporal();
		const id = await (await usuarios()).createOne({
			first_name: exigirTexto(b.nombre, 'nombre'), last_name: exigirTexto(b.apellido, 'apellido'), email,
			tipo_documento: b.tipo_documento || null, numero_documento: b.numero_documento ? String(b.numero_documento).trim() : null,
			celular: b.celular ? String(b.celular).trim() : null,
			role: await idDelRol(rolNombre), wge_roles_extra: roles.extra, status: 'active', password: clave, debe_cambiar_clave: true,
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
		const roles = leerRoles(b);
		const vinculado = esVinculado(actual.rol_nombre);
		if (vinculado && b.estado !== undefined) throw new WgeError(409, 'VINCULADO', 'Esta cuenta es de otra parte de la plataforma: para que no use Will-Go, quítala de Will-Go');
		if (roles) {
			puedeManejar(rol, roles.principal);
			if (vinculado) {
				// Su rol de la plataforma no se toca: solo cambian sus roles de Will-Go
				cambios.wge_roles_extra = [LLAVE_POR_NOMBRE[roles.principal], ...roles.extra];
			} else {
				cambios.role = await idDelRol(roles.principal);
				cambios.wge_roles_extra = roles.extra;
			}
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
		const vinculado = esVinculado(actual.rol_nombre);
		// Solo se bloquea si tiene historial en ediciones que siguen activas (en preparación o abiertas).
		// Lo de ediciones cerradas se conserva, pero sin su nombre (el «quién» queda en blanco).
		const activas = db('wge_ediciones').whereNot('estado', 'cerrada').select('id');
		const enActivas = [
			db('wge_movimientos as m').join('wge_billeteras as b', 'b.id', 'm.billetera_id').where('m.user_created', id).whereIn('b.edicion_id', activas),
			db('wge_transferencias').where('user_created', id).whereIn('edicion_id', activas),
			db('wge_evaluaciones as e').join('wge_participantes as p', 'p.id', 'e.participante_id').where('e.user_created', id).whereIn('p.edicion_id', activas),
			db('wge_ventas').where('user_created', id).whereIn('edicion_id', activas),
			db('wge_inversiones as i').join('wge_rondas as r', 'r.id', 'i.ronda_id').where((q) => q.where('i.user_created', id).orWhere('i.cobrado_por', id)).whereIn('r.edicion_id', activas),
			db('wge_arqueos').where('user_created', id).whereIn('edicion_id', activas),
			db('wge_billeteras as b').join('wge_movimientos as m', 'm.billetera_id', 'b.id').where('b.docente_id', id).whereIn('b.edicion_id', activas),
		];
		for (const consulta of enActivas) {
			if (await consulta.first(db.raw('1'))) {
				throw new WgeError(409, 'TIENE_HISTORIAL', `${actual.nombre} tiene movimientos en una edición activa; para no perder el historial, desactívalo en lugar de eliminarlo`);
			}
		}
		if (await db('wge_billeteras').where('docente_id', id).where('saldo', '>', 0).whereIn('edicion_id', activas).first('id')) {
			throw new WgeError(409, 'TIENE_BILLETES', `${actual.nombre} todavía tiene dinero; desactívalo en lugar de eliminarlo`);
		}
		await db.transaction(async (trx) => {
			await trx('wge_equipo').where('usuario_id', id).delete();
			await trx('wge_paises').where('responsable_banco', id).update({ responsable_banco: null });
			await trx('wge_ediciones').where('responsable_caja', id).update({ responsable_caja: null });
			// Sus billeteras sin movimientos se borran; las que tienen historial (ediciones cerradas) se quedan sin dueño
			await trx('wge_billeteras').where('docente_id', id).whereNotExists(trx('wge_movimientos as m').whereRaw('m.billetera_id = wge_billeteras.id')).delete();
			await trx('wge_billeteras').where('docente_id', id).update({ docente_id: null });
			// Estas referencias no se ponen en blanco solas al borrar el usuario
			await trx('wge_arqueos').where('user_created', id).update({ user_created: null });
			await trx('wge_equipo').where('user_created', id).update({ user_created: null });
		});
		// Una cuenta vinculada no se borra (es de otra parte de la plataforma): solo deja de ser colaborador de Will-Go
		if (vinculado) {
			await (await usuarios()).updateOne(id, { wge_roles_extra: null });
			return { eliminado: false, desvinculado: true };
		}
		await (await usuarios()).deleteOne(id);
		return { eliminado: true };
	}));

	/** POST /wge/funcionarios/:id/restablecer-clave: nueva clave temporal (se muestra una sola vez). */
	router.post('/funcionarios/:id/restablecer-clave', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.ADMIN_WG);
		const actual = await funcionarioExistente(req.params.id);
		puedeManejar(rol, actual.rol_nombre);
		if (esVinculado(actual.rol_nombre)) throw new WgeError(409, 'VINCULADO', 'Esta cuenta es de otra parte de la plataforma: usa su misma contraseña');
		const clave = claveTemporal();
		await (await usuarios()).updateOne(req.params.id, { password: clave, debe_cambiar_clave: true });
		return { funcionario: comoFuncionario(await funcionarioExistente(req.params.id)), clave_temporal: clave };
	}));
}
