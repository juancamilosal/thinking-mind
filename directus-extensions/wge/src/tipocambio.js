// Tipo de cambio: cuánto vale hoy un billete de cada país y cómo ha cambiado cada 30 minutos.
// El cálculo lo hace hook.js; aquí solo se consulta (para el equipo y para el portal del acudiente).
import { WgeError, ROLES, exigirRol, exigirEquipo, finDeFranja } from './lib.js';
import { FX_POR_DEFECTO } from './hook.js';

const deJsonFx = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

/** Tasas de cada país de una edición con su historial (lo más viejo primero) y cuándo es el próximo cálculo. */
export async function datosTipoCambio(db, edicionId, { limite = 200 } = {}) {
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

const deJsonPantalla = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

/**
 * Cómo se ha comportado cada empresa (fondo) ronda tras ronda: cuánto valdrían hoy 100 invertidos al comienzo.
 * Las rondas van de la más vieja a la más nueva; si una empresa no participó en una ronda, conserva su valor.
 */
export function seriesDeFondos(fondos, rondas) {
	return fondos.map((f) => {
		let valor = 100;
		const puntos = [{ ronda: null, valor }];
		let ultimo = null;
		for (const r of rondas) {
			const x = (r.resultados ?? []).find((y) => y.fondo_id === f.id);
			if (x) { valor = Math.round(valor * (1 + Number(x.rendimiento)) * 100) / 100; ultimo = Number(x.rendimiento); }
			puntos.push({ ronda: r.nombre, valor });
		}
		return { fondo_id: f.id, puntos, ultimo_rendimiento: ultimo };
	});
}

/** Los n primeros por `clave` (de mayor a menor; en empate, por nombre). */
export function primeros(lista, clave, n = 10) {
	return [...lista].filter((x) => Number(x[clave]) > 0)
		.sort((a, b) => Number(b[clave]) - Number(a[clave]) || `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`))
		.slice(0, n);
}

export function rutasTipoCambio(router, { ruta, db }) {
	/**
	 * GET /wge/ediciones/:id/pantalla: resumen de la economía para proyectar en un televisor (administradores y rol TV).
	 * Por país: tasa, su historial y los 10 estudiantes con más dinero (efectivo + cuenta + inversiones vigentes).
	 * Por empresa: cómo ha rendido ronda tras ronda y los 10 estudiantes que más han invertido en ella.
	 */
	router.get('/ediciones/:id/pantalla', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.ADMIN_WG, ROLES.TV);
		const fx = await datosTipoCambio(db, req.params.id);
		const edicionId = fx.edicion.id;
		const paises = [];
		for (const p of fx.paises) {
			const filas = await db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
				.leftJoin('wge_billeteras as b', function () { this.on('b.participante_id', 'pa.id').andOn('b.pais_id', 'pa.pais_id').andOnVal('b.tipo_dueno', 'estudiante'); })
				.leftJoin('wge_billeteras as c', function () { this.on('c.participante_id', 'pa.id').andOn('c.pais_id', 'pa.pais_id').andOnVal('c.tipo_dueno', 'cuenta'); })
				.where({ 'pa.edicion_id': edicionId, 'pa.pais_id': p.id }).whereRaw('coalesce(pa.retirado, false) = false')
				.select('pa.id', 'e.nombre', 'e.apellido', db.raw('coalesce(b.saldo, 0)::int as efectivo'), db.raw('coalesce(c.saldo, 0)::int as cuenta'),
					db.raw(`(select coalesce(sum(coalesce(i.valor_actual, i.monto)), 0) from wge_inversiones i where i.participante_id = pa.id and i.estado = 'abierta')::int as invertido`));
			const conTotal = filas.map((f) => ({ ...f, total: f.efectivo + f.cuenta + f.invertido }));
			paises.push({
				id: p.id, nombre: p.nombre, codigo_moneda: p.codigo_moneda, color: p.color, tasa_actual: p.tasa_actual,
				historial: p.historial.map((h) => ({ ventana: h.ventana, tasa: Number(h.tasa_nueva) })),
				estudiantes: filas.length,
				ranking: primeros(conTotal, 'total').map(({ id, ...resto }) => resto),
			});
		}
		const fondos = await db('wge_fondos').where('edicion_id', edicionId).orderBy('orden').select('id', 'nombre', 'logo', 'riesgo', 'activo');
		const rondas = (await db('wge_rondas').where({ edicion_id: edicionId, estado: 'liquidada' }).orderBy('cierre').select('nombre', 'resultados'))
			.map((r) => ({ ...r, resultados: deJsonPantalla(r.resultados) ?? [] }));
		const series = new Map(seriesDeFondos(fondos, rondas).map((s) => [s.fondo_id, s]));
		const tasaDe = new Map(paises.map((p) => [p.id, p.tasa_actual]));
		for (const f of fondos) {
			const inversores = await db('wge_inversiones as i').join('wge_rondas as r', 'r.id', 'i.ronda_id')
				.join('wge_participantes as pa', 'pa.id', 'i.participante_id').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
				.join('wge_paises as p', 'p.id', 'pa.pais_id')
				.where({ 'r.edicion_id': edicionId, 'i.fondo_id': f.id })
				.groupBy('pa.id', 'e.nombre', 'e.apellido', 'p.id', 'p.nombre', 'p.codigo_moneda', 'p.color')
				.select('e.nombre', 'e.apellido', 'p.id as pais_id', 'p.nombre as pais', 'p.codigo_moneda', 'p.color', db.raw('sum(i.monto)::int as invertido'));
			// Cada país tiene su moneda: para compararlos, se ordena por su valor en pesos (con la tasa de hoy)
			const enPesos = inversores.map((x) => ({ ...x, en_pesos: x.invertido * (tasaDe.get(x.pais_id) ?? fx.tasa_inicial) }));
			f.puntos = series.get(f.id)?.puntos ?? [{ ronda: null, valor: 100 }];
			f.ultimo_rendimiento = series.get(f.id)?.ultimo_rendimiento ?? null;
			f.ranking = primeros(enPesos, 'en_pesos');
		}
		return {
			edicion: fx.edicion, tasa_inicial: fx.tasa_inicial, intervalo_minutos: fx.intervalo_minutos, ahora: new Date(),
			rondas: rondas.length, paises, fondos,
		};
	}));

	/** GET /wge/ediciones/:id/tipo-cambio: para todo el equipo de la edición. */
	router.get('/ediciones/:id/tipo-cambio', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.ADMIN_WG, ROLES.BANCO, ROLES.DOCENTE, ROLES.CAJERO);
		await exigirEquipo(db, { edicionId: req.params.id, usuarioId: req.accountability.user, rol });
		return datosTipoCambio(db, req.params.id);
	}));
}
