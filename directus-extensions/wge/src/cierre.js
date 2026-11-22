// Cierre de una edición: liquida lo que quede en marcha y arma el resumen final.
import { WgeError, ROLES, exigirRol } from './lib.js';
import { liquidarRonda, retirarInversion, valorDe } from './wfunds.js';

const deJsonCierre = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

/**
 * Rendimiento acumulado de cada empresa en las rondas liquidadas: (1 + r1) × (1 + r2) × … − 1.
 * Ordenado de la que más ganó a la que menos.
 */
export function rendimientoAcumulado(fondos, rondas) {
	const lista = fondos.map((f) => ({ fondo_id: f.id, nombre: f.nombre, logo: f.logo ?? null, factor: 1, rondas: 0, mejor: null, peor: null }));
	const porId = new Map(lista.map((f) => [f.fondo_id, f]));
	for (const r of rondas) {
		for (const res of deJsonCierre(r.resultados) ?? []) {
			const f = porId.get(res.fondo_id);
			if (!f) continue;
			const rend = Number(res.rendimiento ?? 0);
			f.factor *= 1 + rend;
			f.rondas++;
			f.mejor = f.mejor === null ? rend : Math.max(f.mejor, rend);
			f.peor = f.peor === null ? rend : Math.min(f.peor, rend);
		}
	}
	return lista
		.map(({ factor, ...f }) => ({ ...f, acumulado: Math.round((factor - 1) * 10000) / 10000 }))
		.sort((a, b) => b.acumulado - a.acumulado || a.nombre.localeCompare(b.nombre));
}

/** Resumen final (o parcial, si sigue abierta): estudiantes por riqueza, empresas, banco, caja y tienda por país. */
export async function resumenDelCierre(db, edicionId) {
	const edicion = await db('wge_ediciones').where('id', edicionId)
		.first('id', 'nombre', 'estado', 'fecha_inicio', 'fecha_fin', 'tasa_inicial', 'investment_bill');
	if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');

	const rondas = await db('wge_rondas').where({ edicion_id: edicionId, estado: 'liquidada' }).orderBy('apertura').select('id', 'nombre', 'resultados');
	const fondos = await db('wge_fondos').where('edicion_id', edicionId).orderBy('orden').select('id', 'nombre', 'logo');
	const empresas = rendimientoAcumulado(fondos, rondas);

	const paises = await db('wge_paises').where('edicion_id', edicionId).orderBy('orden')
		.select('id', 'nombre', 'codigo_moneda', 'color', 'provision_inicial', 'tasa_actual');
	for (const p of paises) {
		const saldo = async (tipo) => Number((await db('wge_billeteras').where({ edicion_id: edicionId, pais_id: p.id, tipo_dueno: tipo }).sum({ s: 'saldo' }).first())?.s ?? 0);
		p.provision_inicial = Number(p.provision_inicial ?? 0);
		p.saldo_banco = await saldo('banco');
		p.saldo_caja = await saldo('caja');
		p.saldo_docentes = await saldo('docente');
		const ventas = await db('wge_ventas').where({ edicion_id: edicionId, pais_id: p.id, estado: 'pagada' })
			.count({ n: '*' }).sum({ total: 'total_billetes' }).first();
		p.ventas = Number(ventas?.n ?? 0);
		p.total_ventas = Number(ventas?.total ?? 0);

		const estudiantes = await db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
			.leftJoin('wge_billeteras as b', function () { this.on('b.participante_id', 'pa.id').andOn('b.pais_id', 'pa.pais_id'); })
			.where({ 'pa.edicion_id': edicionId, 'pa.pais_id': p.id }).whereRaw('coalesce(pa.retirado, false) = false')
			.select('pa.id', 'e.nombre', 'e.apellido', db.raw('coalesce(b.saldo, 0)::int as saldo'));
		const ids = estudiantes.map((e) => e.id);
		const invertido = new Map();
		const ganado = new Map();
		if (ids.length) {
			for (const i of await db('wge_inversiones').whereIn('participante_id', ids).select('participante_id', 'estado', 'monto', 'valor_actual', 'monto_pagado')) {
				const final = i.estado === 'abierta' || i.estado === 'por_cobrar' ? valorDe(i) : Number(i.monto_pagado ?? valorDe(i));
				if (i.estado === 'abierta' || i.estado === 'por_cobrar') invertido.set(i.participante_id, (invertido.get(i.participante_id) ?? 0) + valorDe(i));
				ganado.set(i.participante_id, (ganado.get(i.participante_id) ?? 0) + final - Number(i.monto));
			}
		}
		const notas = ids.length ? await db('wge_evaluaciones').whereIn('participante_id', ids)
			.groupBy('participante_id').select('participante_id').avg({ promedio: 'puntaje' }).count({ n: '*' }) : [];
		const nota = new Map(notas.map((n) => [n.participante_id, { promedio: Math.round(Number(n.promedio) * 10) / 10, n: Number(n.n) }]));
		const compras = ids.length ? await db('wge_ventas').whereIn('participante_id', ids).where('estado', 'pagada')
			.groupBy('participante_id').select('participante_id').sum({ total: 'total_billetes' }) : [];
		const gastado = new Map(compras.map((c) => [c.participante_id, Number(c.total)]));

		p.estudiantes = estudiantes.map((e) => ({
			...e,
			invertido: invertido.get(e.id) ?? 0,
			total: e.saldo + (invertido.get(e.id) ?? 0),
			ganancia_fondos: ganado.get(e.id) ?? 0,
			gastado_tienda: gastado.get(e.id) ?? 0,
			rubrica: nota.get(e.id) ?? null,
		})).sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
		p.total_estudiantes = p.estudiantes.reduce((t, e) => t + e.total, 0);
	}
	return { edicion, rondas: rondas.length, empresas, paises, maximo_rubrica: 12 };
}

/**
 * Cierra la edición: liquida la ronda abierta (sin abrir otra), devuelve al saldo de cada estudiante lo que
 * tenga invertido (con su valor de hoy) y deja la edición en «cerrada». Después ya no se vende, ni se invierte,
 * ni se mueve la tasa.
 */
export async function cerrarEdicion(db, edicionId, actor) {
	return db.transaction(async (trx) => {
		const edicion = await trx('wge_ediciones').where('id', edicionId).forUpdate().first('id', 'estado');
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		if (edicion.estado === 'cerrada') throw new WgeError(409, 'EDICION_CERRADA', 'La edición ya fue cerrada');
		if (edicion.estado !== 'abierta') throw new WgeError(409, 'EDICION_EN_PREPARACION', 'La edición todavía no se ha abierto');

		const abiertas = await trx('wge_rondas').where({ edicion_id: edicionId, estado: 'abierta' }).orderBy('id').forUpdate();
		for (const r of abiertas) {
			await liquidarRonda(trx, r, actor);
			await trx('wge_rondas').where('id', r.id).update({ detenida: true });
		}
		const vigentes = await trx('wge_inversiones as i').join('wge_participantes as pa', 'pa.id', 'i.participante_id')
			.where('pa.edicion_id', edicionId).whereIn('i.estado', ['abierta', 'por_cobrar']).orderBy('i.id').forUpdate('i').select('i.*');
		let liquidado = 0;
		for (const inv of vigentes) liquidado += Number((await retirarInversion(trx, inv, actor)).monto_pagado ?? 0);

		await trx('wge_ediciones').where('id', edicionId).update({ estado: 'cerrada' });
		return { rondas_cerradas: abiertas.length, inversiones_liquidadas: vigentes.length, total_liquidado: liquidado };
	});
}

export function rutasCierre(router, { ruta, db }) {
	/** GET /wge/admin/ediciones/:id/resumen-final: el resumen (sirve también con la edición abierta, como vista previa). */
	router.get('/admin/ediciones/:id/resumen-final', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.ADMIN_WG);
		return resumenDelCierre(db, req.params.id);
	}));

	/** POST /wge/admin/ediciones/:id/cerrar { confirmar: "CERRAR" } */
	router.post('/admin/ediciones/:id/cerrar', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.ADMIN_WG);
		if (String(req.body?.confirmar ?? '').trim().toUpperCase() !== 'CERRAR') throw new WgeError(400, 'VALOR_INVALIDO', 'Escribe CERRAR para confirmar');
		const hecho = await cerrarEdicion(db, req.params.id, req.accountability.user);
		return { ...hecho, resumen: await resumenDelCierre(db, req.params.id) };
	}));
}
