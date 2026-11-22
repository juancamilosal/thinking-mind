// Rúbrica del docente: califica a cada estudiante con 4 criterios Sí/No (puntaje de 0 a 4) y marca la asistencia.
// No da billetes: los puntos alimentan el tipo de cambio de cada país (ver hook.js, referencia B = 2).
import { WgeError, ROLES, exigirRol, exigirEquipo } from './lib.js';

/** Los 4 criterios de la rúbrica (en el orden en que se muestran). */
export const CRITERIOS = ['uso_lengua', 'iniciativa', 'nivel_reto', 'colaboracion'];
export const IDIOMAS = ['ingles', 'frances'];
/** Minutos en los que el docente puede deshacer una calificación que puso por error. */
const MINUTOS_DESHACER = 10;

/** Valida los criterios (Sí = 1, No = 0) y devuelve la fila con su puntaje. */
export function armarCalificacion(datos) {
	const fila = {};
	for (const c of CRITERIOS) {
		const v = datos?.[c];
		if (v !== 0 && v !== 1 && v !== true && v !== false) throw new WgeError(400, 'VALOR_INVALIDO', 'Cada criterio debe ser Sí o No');
		fila[c] = v === true || v === 1 ? 1 : 0;
	}
	fila.puntaje = CRITERIOS.reduce((t, c) => t + fila[c], 0);
	if (datos?.idioma !== undefined && datos.idioma !== null && !IDIOMAS.includes(datos.idioma)) throw new WgeError(400, 'VALOR_INVALIDO', 'El idioma debe ser inglés o francés');
	fila.idioma = datos?.idioma ?? null;
	return fila;
}

/** Resumen de las calificaciones de un estudiante: cuántas y qué porcentaje de "Sí" en cada criterio. */
export function resumenCalificaciones(filas) {
	const total = filas.length;
	const criterios = Object.fromEntries(CRITERIOS.map((c) => [c, total ? Math.round((filas.reduce((t, f) => t + Number(f[c] ?? 0), 0) / total) * 100) : 0]));
	const ultima = filas.reduce((u, f) => (!u || new Date(f.date_created) > new Date(u) ? f.date_created : u), null);
	return { total, criterios, ultima };
}

export function rutasRubrica(router, { ruta, db }) {
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
			.select('ev.id', 'ev.participante_id', ...CRITERIOS.map((c) => `ev.${c}`), 'ev.puntaje', 'ev.idioma', 'ev.date_created', 'e.nombre', 'e.apellido');
		for (const r of recientes) r.se_puede_deshacer = Date.now() - new Date(r.date_created).getTime() < MINUTOS_DESHACER * 60000;
		return { edicion, paises, recientes, criterios: CRITERIOS };
	}));

	/** POST /wge/evaluaciones { participante_id, uso_lengua, iniciativa, nivel_reto, colaboracion, idioma }: califica y lo marca presente. */
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
			if (reciente) return { ...reciente, repetida: true };
			const nueva = { id: crypto.randomUUID(), participante_id: p.id, ...fila, date_created: new Date(), user_created: actor };
			await trx('wge_evaluaciones').insert(nueva);
			if (!p.presente) await trx('wge_participantes').where('id', p.id).update({ presente: true });
			return nueva;
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
