// Administración de ediciones de WILL-GO ECONOMY (pantalla "Edición y participantes").
// Todo pasa por aquí con una lista de campos permitidos: los roles de Will Go no tocan /items de Directus,
// y ningún campo de dinero (saldos, tasas vigentes, movimientos) se puede escribir desde esta pantalla.
import { Readable } from 'node:stream';
import { WgeError, ROLES, exigirRol, exigirTexto } from './lib.js';

const CAMPOS_JSON = ['horario', 'parametros_fx'];

/** Qué se puede leer y escribir de cada parte de una edición. */
export const SECCIONES = {
	paises: { tabla: 'wge_paises', campos: ['nombre', 'codigo_moneda', 'color', 'provision_inicial', 'orden'], orden: 'orden' },
	productos: { tabla: 'wge_productos', campos: ['nombre', 'foto', 'precio_cop', 'stock', 'maximo_por_estudiante', 'activo'], orden: 'nombre' },
	fondos: { tabla: 'wge_fondos', campos: ['nombre', 'historia', 'riesgo', 'rendimiento_base', 'rendimiento_alterno', 'variacion', 'activo', 'orden'], orden: 'orden' },
};
const CAMPOS_EDICION = ['nombre', 'colegio_id', 'curso_id', 'fecha_inicio', 'fecha_fin', 'horario', 'tasa_inicial', 'tope_minimo', 'tope_maximo', 'parametros_fx', 'investment_bill'];

/** Lo que trae toda edición nueva (se puede cambiar después). */
export const PAISES_POR_DEFECTO = [
	{ nombre: 'Wonderland', codigo_moneda: 'WON', color: '#3B82F6', orden: 1 },
	{ nombre: 'Neverland', codigo_moneda: 'NEV', color: '#22C55E', orden: 2 },
	{ nombre: 'Dreamland', codigo_moneda: 'DRE', color: '#A855F7', orden: 3 },
];
export const FONDOS_POR_DEFECTO = [
	{ nombre: 'CAPI GREEN', riesgo: 'bajo', rendimiento_base: 0.03, rendimiento_alterno: null, variacion: 0.02 },
	{ nombre: 'OCEAN GUARDIANS', riesgo: 'bajo', rendimiento_base: 0.02, rendimiento_alterno: null, variacion: 0.02 },
	{ nombre: 'LEGO FUTURE', riesgo: 'medio', rendimiento_base: 0.06, rendimiento_alterno: null, variacion: 0.05 },
	{ nombre: 'LES ARTISTES', riesgo: 'medio', rendimiento_base: 0.05, rendimiento_alterno: null, variacion: 0.05 },
	{ nombre: 'DREAM EXPLORERS', riesgo: 'alto', rendimiento_base: 0.1, rendimiento_alterno: -0.08, variacion: 0.12 },
];

const ENTEROS = ['provision_inicial', 'orden', 'precio_cop', 'stock', 'maximo_por_estudiante', 'tasa_inicial', 'investment_bill'];
const DECIMALES = ['rendimiento_base', 'rendimiento_alterno', 'variacion', 'tope_minimo', 'tope_maximo'];

/** Deja solo los campos permitidos y revisa que los números tengan sentido. */
export function limpiar(datos, permitidos) {
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
export function validarHorario(horario) {
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

export function rutasAdmin(router, { ruta, db, services, getSchema }) {
	const soloAdmin = (rol) => exigirRol(rol, ROLES.ADMIN_WG);
	const nueva = (actor, fila) => ({ id: crypto.randomUUID(), ...fila, date_created: new Date(), user_created: actor });

	const edicionExistente = async (id) => {
		const e = await db('wge_ediciones').where('id', id).first();
		if (!e) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		return e;
	};

	const resumenEdicion = async (e) => {
		const [{ total }] = await db('wge_participantes').where('edicion_id', e.id).count({ total: '*' });
		const [{ sinPais }] = await db('wge_participantes').where('edicion_id', e.id).whereNull('pais_id').count({ sinPais: '*' });
		const colegio = e.colegio_id ? await db('colegios').where('id', e.colegio_id).first('nombre') : null;
		const programa = e.curso_id ? await db('Cursos').where('id', e.curso_id).first('nombre') : null;
		return {
			...e, colegio_nombre: colegio?.nombre ?? null, programa_nombre: programa?.nombre ?? null,
			participantes: Number(total), sin_pais: Number(sinPais),
		};
	};

	/** Listas para los selectores del formulario. */
	router.get('/admin/catalogos', ruta(async (req, rol) => {
		soloAdmin(rol);
		const [colegios, programas] = await Promise.all([
			db('colegios').select('id', 'nombre').orderBy('nombre'),
			db('Cursos').select('id', 'nombre').orderBy('nombre'),
		]);
		return { colegios, programas };
	}));

	router.get('/admin/ediciones', ruta(async (req, rol) => {
		soloAdmin(rol);
		const ediciones = await db('wge_ediciones').orderBy('date_created', 'desc');
		return Promise.all(ediciones.map(resumenEdicion));
	}));

	/** Crea la edición con sus 3 países y los 5 fondos de siempre. */
	router.post('/admin/ediciones', ruta(async (req, rol) => {
		soloAdmin(rol);
		const actor = req.accountability.user;
		const fila = limpiar(req.body, CAMPOS_EDICION);
		exigirTexto(fila.nombre, 'nombre');
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
		return resumenEdicion(await edicionExistente(req.params.id));
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
		if (Object.keys(fila).length) await db('wge_ediciones').where('id', e.id).update(fila);
		return resumenEdicion(await edicionExistente(e.id));
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
			return db(s.tabla).where('edicion_id', req.params.id).orderBy(s.orden);
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
			if (nombre === 'paises' && e.estado !== 'borrador' && 'provision_inicial' in fila && fila.provision_inicial !== actual.provision_inicial) {
				throw new WgeError(409, 'EDICION_ABIERTA', 'La provisión del banco se define antes de abrir la edición');
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
		await edicionExistente(req.params.id);
		return db('wge_participantes as p')
			.join('estudiantes as e', 'e.id', 'p.estudiante_id')
			.leftJoin('colegios as c', 'c.id', 'e.colegio_id')
			.leftJoin('wge_billeteras as b', function () { this.on('b.participante_id', 'p.id').andOn('b.pais_id', 'p.pais_id'); })
			.where('p.edicion_id', req.params.id)
			.select('p.id', 'p.codigo', 'p.pais_id', 'p.presente', 'e.nombre', 'e.apellido', 'e.grado', 'c.nombre as colegio', db.raw('coalesce(b.saldo, 0)::int as saldo'))
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
		await db('wge_participantes').whereIn('id', ids).update(cambios);
		return { actualizados: ids.length };
	}));

	/** POST /wge/admin/fotos { nombre, tipo, base64 }: foto de un producto (la pantalla la reduce antes de enviarla). */
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

	/** GET /wge/foto/:id: muestra la foto de un producto a cualquier colaborador (sin abrir directus_files). */
	router.get('/foto/:id', async (req, res) => {
		try {
			if (!req.accountability?.user) return res.status(401).end();
			if (!(await db('wge_productos').where('foto', req.params.id).first('id'))) return res.status(404).end();
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
