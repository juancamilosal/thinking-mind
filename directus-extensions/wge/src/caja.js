// Caja GO•STORE: un encargado por edición vende los productos de la tienda.
// El estudiante paga con billetes físicos de su país; la caja da el vuelto con los billetes que tiene.
// Los billetes se quedan en la caja (una billetera por país) hasta que el encargado los entrega al banco.
import { WgeError, ROLES, exigirRol, exigirEquipo, exigirTexto, billeteraBloqueada, moverSaldo } from './lib.js';
import { DENOMINACIONES, totalDelConteo, montoOConteo } from './arqueo.js';

const leerBilletesCaja = (b) => (typeof b === 'string' ? JSON.parse(b) : b) ?? {};

/** Billetes que hay hoy en la caja de un país: recibidos en ventas − vuelto dado − entregados al banco. */
export async function inventarioCaja(db, edicionId, paisId) {
	const quedan = Object.fromEntries(DENOMINACIONES.map((d) => [d, 0]));
	const sumar = (lista, signo) => {
		for (const b of lista) for (const [d, n] of Object.entries(leerBilletesCaja(b))) if (d in quedan) quedan[d] += signo * Number(n);
	};
	const ventas = await db('wge_ventas').where({ edicion_id: edicionId, pais_id: paisId, estado: 'pagada' }).select('billetes_recibidos', 'billetes_vuelto');
	sumar(ventas.map((v) => v.billetes_recibidos), 1);
	sumar(ventas.map((v) => v.billetes_vuelto), -1);
	const caja = await db('wge_billeteras').where({ edicion_id: edicionId, pais_id: paisId, tipo_dueno: 'caja' }).first('id');
	if (caja) sumar(await db('wge_transferencias').where({ billetera_origen_id: caja.id, estado: 'aplicada' }).whereNotNull('billetes').pluck('billetes'), -1);
	return quedan;
}

/** Solo el encargado de la caja de la edición (o un administrativo) vende y entrega al banco. */
export async function exigirResponsableCaja(db, { edicionId, usuarioId, rol }) {
	if (rol === ROLES.ADMIN || rol === ROLES.ADMIN_WG) return;
	const e = await db('wge_ediciones as e').leftJoin('directus_users as u', 'u.id', 'e.responsable_caja')
		.where('e.id', edicionId).first('e.responsable_caja', 'u.first_name', 'u.last_name');
	// Sin encargado asignado, cualquier cajero del equipo de la edición puede vender (el equipo se revisa antes)
	if (!e?.responsable_caja) return;
	if (e.responsable_caja !== usuarioId) throw new WgeError(403, 'OTRO_RESPONSABLE', `La caja la maneja ${`${e.first_name ?? ''} ${e.last_name ?? ''}`.trim()}`);
}

/** Precio en billetes de un producto con la tasa de un país (siempre hacia arriba). */
export const precioEnBilletesCaja = (precioCop, tasa) => Math.ceil(Number(precioCop) / Math.max(Number(tasa), 1));

export function rutasCaja(router, { ruta, db }) {
	const permitir = async (req, rol, edicionId) => {
		exigirRol(rol, ROLES.CAJERO, ROLES.ADMIN_WG);
		await exigirEquipo(db, { edicionId, usuarioId: req.accountability.user, rol });
	};

	/** GET /wge/ediciones/:id/caja: productos, estudiantes con su saldo, billetes de la caja por país, ventas y entregas. */
	router.get('/ediciones/:id/caja', ruta(async (req, rol) => {
		const edicion = await db('wge_ediciones as e').leftJoin('directus_users as u', 'u.id', 'e.responsable_caja').where('e.id', req.params.id)
			.first('e.id', 'e.nombre', 'e.estado', 'e.tasa_inicial', 'e.responsable_caja', db.raw("trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) as responsable"));
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		await permitir(req, rol, edicion.id);
		const esAdmin = rol === ROLES.ADMIN || rol === ROLES.ADMIN_WG;
		const paises = await db('wge_paises').where('edicion_id', edicion.id).orderBy('orden').select('id', 'nombre', 'codigo_moneda', 'color', 'tasa_actual');
		for (const p of paises) {
			p.tasa_actual = Number(p.tasa_actual ?? edicion.tasa_inicial);
			const caja = await db('wge_billeteras').where({ edicion_id: edicion.id, pais_id: p.id, tipo_dueno: 'caja' }).first('saldo');
			p.saldo_caja = Number(caja?.saldo ?? 0);
			p.inventario = await inventarioCaja(db, edicion.id, p.id);
		}
		const productos = await db('wge_productos').where({ edicion_id: edicion.id, activo: true }).orderBy('nombre')
			.select('id', 'nombre', 'foto', 'precio_cop', 'stock', 'maximo_por_estudiante');
		// Unidades vendidas de cada producto (ventas pagadas)
		const vendidos = await db('wge_venta_items as i').join('wge_ventas as v', 'v.id', 'i.venta_id')
			.where({ 'v.edicion_id': edicion.id, 'v.estado': 'pagada' }).groupBy('i.producto_id').select('i.producto_id').sum({ n: 'i.cantidad' });
		const porProducto = new Map(vendidos.map((v) => [v.producto_id, Number(v.n)]));
		for (const p of productos) p.vendidos = porProducto.get(p.id) ?? 0;
		const estudiantes = await db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
			.leftJoin('wge_billeteras as b', function () { this.on('b.participante_id', 'pa.id').andOn('b.pais_id', 'pa.pais_id').andOnVal('b.tipo_dueno', 'estudiante'); })
			.where('pa.edicion_id', edicion.id).whereNotNull('pa.pais_id').whereRaw('coalesce(pa.retirado, false) = false')
			.leftJoin('wge_billeteras as c', function () { this.on('c.participante_id', 'pa.id').andOn('c.pais_id', 'pa.pais_id').andOnVal('c.tipo_dueno', 'cuenta'); })
			.select('pa.id', 'pa.pais_id', 'pa.llave', 'e.nombre', 'e.apellido', db.raw('coalesce(b.saldo, 0)::int as saldo'), db.raw('coalesce(c.saldo, 0)::int as cuenta'))
			.orderBy([{ column: 'e.nombre' }, { column: 'e.apellido' }]);
		// Lo que cada estudiante ya compró de cada producto (para el máximo por estudiante)
		const compras = await db('wge_venta_items as i').join('wge_ventas as v', 'v.id', 'i.venta_id')
			.where({ 'v.edicion_id': edicion.id, 'v.estado': 'pagada' }).groupBy('v.participante_id', 'i.producto_id')
			.select('v.participante_id', 'i.producto_id').sum({ n: 'i.cantidad' });
		const comprado = {};
		for (const c of compras) (comprado[c.participante_id] ??= {})[c.producto_id] = Number(c.n);
		const ventas = await db('wge_ventas as v').join('wge_participantes as pa', 'pa.id', 'v.participante_id').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
			.where('v.edicion_id', edicion.id).orderBy('v.date_created', 'desc').limit(50)
			.select('v.id', 'v.numero_recibo', 'v.total_billetes', 'v.tasa_aplicada', 'v.pais_id', db.raw("coalesce(v.metodo_pago, 'efectivo') as metodo_pago"), 'v.billetes_recibidos', 'v.billetes_vuelto', 'v.date_created', 'e.nombre', 'e.apellido');
		const items = ventas.length ? await db('wge_venta_items as i').join('wge_productos as p', 'p.id', 'i.producto_id')
			.whereIn('i.venta_id', ventas.map((v) => v.id)).select('i.venta_id', 'p.nombre', 'i.cantidad', 'i.precio_billetes') : [];
		for (const v of ventas) {
			v.items = items.filter((i) => i.venta_id === v.id).map(({ venta_id, ...x }) => x);
			v.billetes_recibidos = leerBilletesCaja(v.billetes_recibidos);
			v.billetes_vuelto = leerBilletesCaja(v.billetes_vuelto);
		}
		const entregas = await db('wge_transferencias as t').join('wge_billeteras as bo', 'bo.id', 't.billetera_origen_id')
			.leftJoin('directus_users as u', 'u.id', 't.user_created')
			.where({ 'bo.edicion_id': edicion.id, 'bo.tipo_dueno': 'caja' }).orderBy('t.date_created', 'desc').limit(30)
			.select('t.id', 't.pais_id', 't.monto', 't.billetes', 't.date_created', db.raw("trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) as quien"));
		return {
			edicion, puede_vender: esAdmin || edicion.responsable_caja === req.accountability.user || (!edicion.responsable_caja && rol === ROLES.CAJERO),
			denominaciones: DENOMINACIONES, paises, productos, estudiantes, comprado, ventas, entregas,
		};
	}));

	/** POST /wge/ediciones/:id/caja/entregar { pais_id, billetes, clave_idempotencia }: la caja entrega billetes al banco del país. */
	router.post('/ediciones/:id/caja/entregar', ruta(async (req, rol) => {
		const edicionId = req.params.id;
		await permitir(req, rol, edicionId);
		await exigirResponsableCaja(db, { edicionId, usuarioId: req.accountability.user, rol });
		const { limpio, total } = montoOConteo(req.body, 'billetes') ?? (() => { throw new WgeError(400, 'VALOR_INVALIDO', 'Escribe el monto que entregas al banco'); })();
		const clave = exigirTexto(req.body?.clave_idempotencia, 'clave_idempotencia');
		const actor = req.accountability.user;
		const previa = await db('wge_transferencias').where('clave_idempotencia', clave).first();
		if (previa) return { ...previa, repetida: true };
		return db.transaction(async (trx) => {
			const pais = await trx('wge_paises').where({ id: String(req.body?.pais_id ?? ''), edicion_id: edicionId }).first('id', 'nombre');
			if (!pais) throw new WgeError(404, 'NO_EXISTE', 'El país no es de esta edición');
			const caja = await billeteraBloqueada(trx, { edicionId, paisId: pais.id, tipo: 'caja' });
			const quedan = await inventarioCaja(trx, edicionId, pais.id);
			for (const [d, n] of Object.entries(limpio ?? {})) {
				if (n > (quedan[d] ?? 0)) throw new WgeError(409, 'SIN_BILLETES', `En la caja solo hay ${Math.max(0, quedan[d] ?? 0)} billetes de ${d}`);
			}
			const banco = await billeteraBloqueada(trx, { edicionId, paisId: pais.id, tipo: 'banco' });
			const id = crypto.randomUUID();
			await moverSaldo(trx, caja, { tipo: 'transferencia_salida', monto: -total, actor, referenciaTipo: 'transferencia', referenciaId: id });
			await moverSaldo(trx, banco, { tipo: 'transferencia_entrada', monto: total, actor, referenciaTipo: 'transferencia', referenciaId: id });
			const fila = {
				id, edicion_id: edicionId, pais_id: pais.id, billetera_origen_id: caja.id, billetera_destino_id: banco.id, monto: total,
				estado: 'aplicada', clave_idempotencia: clave, billetes: limpio ? JSON.stringify(limpio) : null, date_created: new Date(), user_created: actor,
			};
			await trx('wge_transferencias').insert(fila);
			return { ...fila, billetes: limpio };
		});
	}));
}
