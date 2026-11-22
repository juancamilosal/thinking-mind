// Funcionarios de WILL-GO ECONOMY: quién soy, cambio de clave y perfiles que crea el Administrativo.
// Las cuentas se crean con el servicio de usuarios de Directus (que cifra la clave), pero solo
// con roles de Will Go: desde aquí nunca se puede crear ni tocar un usuario de otra parte de la plataforma.
import { WgeError, ROLES, exigirRol, exigirTexto } from './lib.js';

/** Roles que maneja la pantalla de funcionarios. */
export const ROLES_FUNCIONARIOS = {
	docente: ROLES.DOCENTE,
	banco: ROLES.BANCO,
	cajero: ROLES.CAJERO,
	administrativo: ROLES.ADMIN_WG,
};
const NOMBRES_FUNCIONARIOS = Object.values(ROLES_FUNCIONARIOS);
const LLAVE_POR_NOMBRE = Object.fromEntries(Object.entries(ROLES_FUNCIONARIOS).map(([k, v]) => [v, k]));

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
