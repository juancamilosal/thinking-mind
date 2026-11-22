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

export function rutasTipoCambio(router, { ruta, db }) {
	/** GET /wge/ediciones/:id/tipo-cambio: para todo el equipo de la edición. */
	router.get('/ediciones/:id/tipo-cambio', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.ADMIN_WG, ROLES.BANCO, ROLES.DOCENTE, ROLES.CAJERO);
		await exigirEquipo(db, { edicionId: req.params.id, usuarioId: req.accountability.user, rol });
		return datosTipoCambio(db, req.params.id);
	}));
}
