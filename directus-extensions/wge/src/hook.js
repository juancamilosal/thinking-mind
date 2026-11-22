// Tipo de cambio de WILL-GO ECONOMY.
// Cada 5 minutos revisa si terminó una ventana (por defecto de 30 min) dentro del horario de la edición.
// Si terminó, calcula la nueva tasa de cada país con la fórmula del documento y la guarda.
// Fuera del horario no hace nada: la tasa queda congelada y el día siguiente continúa desde el último valor.
import { ahoraColombia, limitar } from './lib.js';
import { cerrarRondasVencidas, abonarPendientes, reanudarRondas } from './wfunds.js';

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

// Valores del documento; cada edición puede cambiarlos en parametros_fx.
export const FX_POR_DEFECTO = {
	intervalo_minutos: 30,
	referencia: 2, // B: índice con el que la tasa no se mueve
	sensibilidad: 0.006, // cambio de la tasa por cada punto del índice sobre B
	variacion_minima: -0.012,
	variacion_maxima: 0.024,
	indice_maximo: 6,
};

/** ¿La hora local (HH:MM) de esa fecha está dentro del horario? Acepta {fecha:"2026-11-28"} o {dia:"sabado"}. */
export function dentroDelHorario(horario, fecha, hora) {
	if (!Array.isArray(horario) || !horario.length) return false;
	const dia = DIAS[new Date(`${fecha}T12:00:00Z`).getUTCDay()];
	return horario.some((h) => {
		const aplica = h.fecha ? h.fecha === fecha : String(h.dia ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === dia;
		return aplica && h.inicio <= hora && hora < h.fin;
	});
}

/** Fórmula del documento: I = P / N; variación = s·(I − B), limitada; nueva tasa limitada a los topes. */
export function nuevaTasa({ tasa, puntos, presentes, tasaInicial, topeMinimo, topeMaximo, parametros }) {
	const p = { ...FX_POR_DEFECTO, ...(parametros ?? {}) };
	const indice = limitar(puntos / Math.max(presentes, 1), 0, p.indice_maximo);
	const variacion = limitar(p.sensibilidad * (indice - p.referencia), p.variacion_minima, p.variacion_maxima);
	const nueva = limitar(Math.round(tasa * (1 + variacion)), Math.round(topeMinimo * tasaInicial), Math.round(topeMaximo * tasaInicial));
	return { indice, variacion, nueva };
}

export default ({ schedule }, { database: db, logger }) => {
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

	schedule('*/5 * * * *', async () => {
		try {
			const ediciones = await db('wge_ediciones').where('estado', 'abierta');
			for (const edicion of ediciones) await procesarEdicion(db, edicion, new Date());
		} catch (error) {
			logger.error(error, 'wge: tipo de cambio');
		}
	});
};

export async function procesarEdicion(db, edicion, ahora) {
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
