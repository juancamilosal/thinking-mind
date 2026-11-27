// Rúbrica del docente (Especificación Maestra, sección 5): cada criterio de 0 a 3, puntaje de 0 a 12.
// El puntaje ÷ 3 son los "puntos de inmersión" que mueven el tipo de cambio de cada país (ver hook.js, referencia B = 2).
// Desde 5 puntos se recomienda una recompensa en billetes, que el docente entrega con sus propios billetes.
import { WgeError, ROLES, exigirRol, exigirEquipo } from './lib.js';

/** Los 4 criterios de la rúbrica (en el orden en que se muestran). */
export const CRITERIOS = ['uso_lengua', 'iniciativa', 'nivel_reto', 'colaboracion'];
export const IDIOMAS = ['ingles', 'frances'];
/** Minutos en los que el docente puede deshacer una calificación que puso por error. */
const MINUTOS_DESHACER = 10;

/** Nivel máximo de cada criterio y puntaje máximo de una calificación. */
export const NIVEL_MAXIMO = 3;
export const PUNTAJE_MAXIMO = NIVEL_MAXIMO * 4;

/** Recompensa recomendada por la Especificación Maestra: 5–6 = 2 billetes; 7–8 = 5; 9–10 = 10; 11–12 = 20. */
export function recompensaSugerida(puntaje) {
	const p = Number(puntaje);
	if (p >= 11) return 20;
	if (p >= 9) return 10;
	if (p >= 7) return 5;
	if (p >= 5) return 2;
	return 0;
}

/** Puntos de inmersión para el tipo de cambio: puntaje ÷ 3 (de 0 a 4; un estudiante en nivel 2 aporta 2,67). */
export const puntosDeInmersion = (puntaje) => Number(puntaje) / NIVEL_MAXIMO;

/** Valida los 4 niveles (0 a 3, todos obligatorios) y devuelve la fila con su puntaje. */
export function armarCalificacion(datos) {
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
export function resumenCalificaciones(filas) {
	const total = filas.length;
	const criterios = Object.fromEntries(CRITERIOS.map((c) => [c, total ? Math.round((filas.reduce((t, f) => t + Number(f[c] ?? 0), 0) / total) * 10) / 10 : 0]));
	const ultima = filas.reduce((u, f) => (!u || new Date(f.date_created) > new Date(u) ? f.date_created : u), null);
	return { total, criterios, ultima, maximo: NIVEL_MAXIMO };
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
			// Grupos del país (nombre y color); cada estudiante dice su grupo
			p.grupos = await db('wge_grupos').where({ edicion_id: edicion.id, pais_id: p.id }).orderBy([{ column: 'orden' }, { column: 'nombre' }]).select('id', 'nombre', 'color');
			p.estudiantes = await db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
				.where({ 'pa.edicion_id': edicion.id, 'pa.pais_id': p.id }).whereRaw('coalesce(pa.retirado, false) = false')
				.select('pa.id', 'pa.presente', 'pa.grupo_id', 'e.nombre', 'e.apellido',
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

	/**
	 * POST /wge/evaluaciones/grupo { grupo_id, participante_ids?, uso_lengua, iniciativa, nivel_reto, colaboracion, idioma, evidencia }
	 * Califica a todo el grupo (o a los estudiantes elegidos de él) con los mismos criterios, en una sola operación.
	 */
	router.post('/evaluaciones/grupo', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.DOCENTE, ROLES.ADMIN_WG);
		const fila = armarCalificacion(req.body);
		const actor = req.accountability.user;
		return db.transaction(async (trx) => {
			const g = await trx('wge_grupos').where('id', String(req.body?.grupo_id ?? '')).first('id', 'edicion_id', 'pais_id', 'nombre');
			if (!g) throw new WgeError(404, 'NO_EXISTE', 'El grupo no existe');
			const edicion = await trx('wge_ediciones').where('id', g.edicion_id).first('estado');
			if (edicion?.estado !== 'abierta') throw new WgeError(409, 'EDICION_CERRADA', 'La edición no está abierta');
			await exigirEquipo(trx, { edicionId: g.edicion_id, usuarioId: actor, rol, paisId: g.pais_id });
			const elegidos = Array.isArray(req.body?.participante_ids) ? req.body.participante_ids.filter((x) => typeof x === 'string') : null;
			const miembros = await trx('wge_participantes').where({ grupo_id: g.id, pais_id: g.pais_id }).whereRaw('coalesce(retirado, false) = false')
				.modify((q) => { if (elegidos) q.whereIn('id', elegidos); }).forUpdate().select('id', 'presente');
			if (!miembros.length) throw new WgeError(409, 'GRUPO_VACIO', 'El grupo no tiene estudiantes para calificar');
			// Doble toque: si este docente calificó a este grupo hace menos de 5 segundos, no se repite
			const reciente = await trx('wge_evaluaciones').whereIn('participante_id', miembros.map((m) => m.id)).where('user_created', actor)
				.where('date_created', '>', new Date(Date.now() - 5000)).first('id');
			if (reciente) return { calificados: 0, repetida: true, recompensa: recompensaSugerida(fila.puntaje) };
			const ahora = new Date();
			await trx('wge_evaluaciones').insert(miembros.map((m) => ({ id: crypto.randomUUID(), participante_id: m.id, ...fila, date_created: ahora, user_created: actor })));
			await trx('wge_participantes').whereIn('id', miembros.filter((m) => !m.presente).map((m) => m.id)).update({ presente: true });
			return { calificados: miembros.length, grupo: g.nombre, puntaje: fila.puntaje, recompensa: recompensaSugerida(fila.puntaje) };
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
