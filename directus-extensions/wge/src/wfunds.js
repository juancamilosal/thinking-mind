// W-Funds: rondas de inversión en las empresas (fondos) de la edición.
// El estudiante entrega billetes al banco para invertir; al cerrar la ronda se calcula cuánto le toca
// y pasa a cobrar al banco, que le entrega billetes. Así el inventario físico del banco siempre cuadra.
import { WgeError, ROLES, exigirRol, exigirEquipo, limitar } from './lib.js';
import { DENOMINACIONES, inventarioBanco } from './arqueo.js';

/**
 * Rendimiento de cada fondo en una ronda:
 * base (o alterno, en riesgo alto, con 50 % de probabilidad) + bono por votos (±2 %) + variación al azar, limitado a ±20 %.
 * `azar` es un generador con semilla, para que el resultado se pueda auditar y repetir.
 */
export function calcularResultados(fondos, votosPorFondo, azar) {
	const totalVotos = [...votosPorFondo.values()].reduce((a, b) => a + b, 0);
	const resultados = [];
	for (const f of fondos) {
		const base = f.riesgo === 'alto' && f.rendimiento_alterno !== null && f.rendimiento_alterno !== undefined && azar() < 0.5
			? Number(f.rendimiento_alterno) : Number(f.rendimiento_base ?? 0);
		const votos = votosPorFondo.get(f.id) ?? 0;
		const bono = totalVotos ? limitar(0.04 * (votos / totalVotos - 1 / fondos.length), -0.02, 0.02) : 0;
		const variacion = (azar() * 2 - 1) * Number(f.variacion ?? 0);
		const rendimiento = Math.round(limitar(base + bono + variacion, -0.2, 0.2) * 10000) / 10000;
		resultados.push({ fondo_id: f.id, fondo: f.nombre, votos, base, bono, variacion, rendimiento });
	}
	return resultados;
}

/** Lo que recibe el estudiante al cobrar: lo invertido más (o menos) el rendimiento, sin bajar de 0. */
export const pagoDeInversion = (monto, rendimiento) => Math.max(0, Math.floor(Number(monto) * (1 + Number(rendimiento))));

const leerJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

export function rutasWfunds(router, { ruta, db }) {
	const permitir = async (req, rol, edicionId) => {
		exigirRol(rol, ROLES.BANCO, ROLES.ADMIN_WG);
		await exigirEquipo(db, { edicionId, usuarioId: req.accountability.user, rol });
	};

	/**
	 * GET /wge/ediciones/:id/wfunds: la ronda abierta, las anteriores con sus resultados, las empresas,
	 * y por cada país que maneja el usuario: billetes del banco, estudiantes, inversiones de la ronda y pagos pendientes.
	 */
	router.get('/ediciones/:id/wfunds', ruta(async (req, rol) => {
		const edicion = await db('wge_ediciones').where('id', req.params.id).first('id', 'nombre', 'estado');
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		await permitir(req, rol, edicion.id);

		const rondas = (await db('wge_rondas').where('edicion_id', edicion.id).orderBy('apertura', 'desc')
			.select('id', 'nombre', 'estado', 'apertura', 'cierre', 'resultados')).map((r) => ({ ...r, resultados: leerJson(r.resultados) ?? [] }));
		const abierta = rondas.find((r) => r.estado === 'abierta') ?? null;
		const fondos = await db('wge_fondos').where('edicion_id', edicion.id).orderBy('orden')
			.select('id', 'nombre', 'riesgo', 'logo', 'a_que_se_dedica', 'por_que_invertir', 'activo');

		const consulta = db('wge_paises').where('edicion_id', edicion.id).orderBy('orden').select('id', 'nombre', 'codigo_moneda', 'color');
		if (rol !== ROLES.ADMIN && rol !== ROLES.ADMIN_WG) consulta.where('responsable_banco', req.accountability.user);
		const paises = await consulta;
		for (const p of paises) {
			const banco = await db('wge_billeteras').where({ edicion_id: edicion.id, pais_id: p.id, tipo_dueno: 'banco' }).first('saldo');
			p.saldo_banco = Number(banco?.saldo ?? 0);
			p.inventario = await inventarioBanco(db, edicion.id, p.id);
			p.estudiantes = await db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
				.leftJoin('wge_billeteras as b', function () { this.on('b.participante_id', 'pa.id').andOn('b.pais_id', 'pa.pais_id'); })
				.where({ 'pa.edicion_id': edicion.id, 'pa.pais_id': p.id }).whereRaw('coalesce(pa.retirado, false) = false')
				.select('pa.id', 'e.nombre', 'e.apellido', db.raw('coalesce(b.saldo, 0)::int as saldo'))
				.orderBy([{ column: 'e.nombre' }, { column: 'e.apellido' }]);
			const base = () => db('wge_inversiones as i').join('wge_participantes as pa', 'pa.id', 'i.participante_id')
				.join('estudiantes as e', 'e.id', 'pa.estudiante_id').join('wge_rondas as r', 'r.id', 'i.ronda_id')
				.where({ 'r.edicion_id': edicion.id, 'pa.pais_id': p.id });
			p.inversiones = abierta ? await base().where('i.ronda_id', abierta.id).orderBy('i.date_created', 'desc')
				.select('i.id', 'i.participante_id', 'i.fondo_id', 'i.monto', 'i.billetes', 'i.date_created', 'e.nombre', 'e.apellido') : [];
			p.por_cobrar = await base().where('i.estado', 'por_cobrar').orderBy([{ column: 'e.nombre' }, { column: 'e.apellido' }])
				.select('i.id', 'i.participante_id', 'i.fondo_id', 'i.monto', 'i.monto_pagado', 'i.rendimiento_final', 'r.nombre as ronda', 'e.nombre', 'e.apellido');
			p.cobradas = await base().where('i.estado', 'cobrada').orderBy('i.cobrado_en', 'desc').limit(20)
				.select('i.id', 'i.fondo_id', 'i.monto', 'i.monto_pagado', 'i.rendimiento_final', 'i.cobrado_en', 'r.nombre as ronda', 'e.nombre', 'e.apellido');
		}
		return { edicion, denominaciones: DENOMINACIONES, ronda: abierta, rondas, fondos, paises };
	}));

	/** POST /wge/ediciones/:id/rondas: abre una ronda nueva (solo una abierta a la vez). */
	router.post('/ediciones/:id/rondas', ruta(async (req, rol) => {
		const edicion = await db('wge_ediciones').where('id', req.params.id).first('id', 'estado');
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		await permitir(req, rol, edicion.id);
		if (edicion.estado !== 'abierta') throw new WgeError(409, 'EDICION_CERRADA', 'La edición no está abierta');
		return db.transaction(async (trx) => {
			await trx('wge_ediciones').where('id', edicion.id).forUpdate().first('id'); // una ronda a la vez, aunque toquen dos personas
			if (await trx('wge_rondas').where({ edicion_id: edicion.id, estado: 'abierta' }).first('id')) {
				throw new WgeError(409, 'RONDA_ABIERTA', 'Ya hay una ronda abierta; ciérrala antes de abrir otra');
			}
			const n = Number((await trx('wge_rondas').where('edicion_id', edicion.id).count({ n: '*' }).first())?.n ?? 0);
			const fila = {
				id: crypto.randomUUID(), edicion_id: edicion.id, nombre: `Ronda ${n + 1}`, apertura: new Date(), estado: 'abierta',
				date_created: new Date(), user_created: req.accountability.user,
			};
			await trx('wge_rondas').insert(fila);
			return fila;
		});
	}));
}
