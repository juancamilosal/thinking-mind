// Endpoints de WILL-GO ECONOMY: /wge/...
// Cada operación con billetes corre dentro de una transacción; si algo falla, no queda nada a medias.
import {
	WgeError, ROLES, rolDelUsuario, exigirRol, enteroPositivo, exigirTexto,
	billeteraBloqueada, moverSaldo, aleatorioConSemilla, limitar, traerInscritos, darBienvenida, exigirEquipo, exigirResponsableBanco,
} from './lib.js';
import { rutasFuncionarios } from './funcionarios.js';
import { rutasAdmin } from './admin.js';
import { rutasArqueo, totalDelConteo, inventarioBanco, inventarioDocente } from './arqueo.js';
import { rutasWfunds, cerrarYSeguir } from './wfunds.js';
import { rutasAcudientes } from './acudientes.js';
import { rutasRubrica } from './rubrica.js';
import { rutasTipoCambio } from './tipocambio.js';
import { rutasCierre } from './cierre.js';
import { idiomaDe, traducirMensaje } from './mensajes.js';
import { rutasCaja, inventarioCaja, exigirResponsableCaja, precioEnBilletesCaja } from './caja.js';

const CLAVE_DUPLICADA = '23505'; // unique_violation de PostgreSQL

export default {
	id: 'wge',
	handler: (router, { database: db, logger, services, getSchema }) => {
		rutasAcudientes(router, { db, services, getSchema, logger });
		const ruta = (fn) => async (req, res) => {
			try {
				if (!req.accountability?.user) throw new WgeError(401, 'SIN_SESION', 'Debes iniciar sesión');
				const rol = await rolDelUsuario(db, req.accountability);
				res.json({ data: await fn(req, rol) });
			} catch (error) {
				const idioma = idiomaDe(req);
				if (error instanceof WgeError) return res.status(error.status).json({ errors: [{ message: traducirMensaje(error.message, idioma), extensions: { code: error.code } }] });
				logger.error(error, 'wge');
				res.status(500).json({ errors: [{ message: traducirMensaje('Error interno en Will Go Economy', idioma), extensions: { code: 'ERROR_INTERNO' } }] });
			}
		};

		// Si la misma petición llega dos veces (doble toque, reintento), devuelve el resultado ya guardado.
		const unaSolaVez = async (tabla, clave, operacion) => {
			const previo = await db(tabla).where('clave_idempotencia', clave).first();
			if (previo) return { ...previo, repetida: true };
			try {
				return await db.transaction(operacion);
			} catch (error) {
				if (error?.code === CLAVE_DUPLICADA) {
					const ya = await db(tabla).where('clave_idempotencia', clave).first();
					if (ya) return { ...ya, repetida: true };
				}
				throw error;
			}
		};

		const edicionAbierta = async (trx, edicionId) => {
			const edicion = await trx('wge_ediciones').where('id', edicionId).first();
			if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
			if (edicion.estado !== 'abierta') throw new WgeError(409, 'EDICION_CERRADA', 'La edición no está abierta');
			return edicion;
		};

		const participanteConPais = async (trx, participanteId) => {
			const p = await trx('wge_participantes').where('id', participanteId).first();
			if (!p) throw new WgeError(404, 'NO_EXISTE', 'El participante no existe');
			if (p.retirado) throw new WgeError(409, 'RETIRADO', 'El estudiante fue retirado de la edición');
			if (!p.pais_id) throw new WgeError(409, 'SIN_PAIS', 'El participante no tiene país asignado');
			return p;
		};

		/**
		 * POST /wge/transferencias
		 * Banco → docente: { tipo: "banco_docente", pais_id, docente_id, monto, clave_idempotencia }
		 * Docente → estudiante: { tipo: "docente_estudiante", participante_id, monto, clave_idempotencia }
		 */
		router.post('/transferencias', ruta(async (req, rol) => {
			const { tipo } = req.body ?? {};
			// Si llegan los billetes entregados, el monto es su total
			const detalle = req.body?.billetes ? totalDelConteo(req.body.billetes) : null;
			const monto = detalle ? enteroPositivo(detalle.total, 'monto') : enteroPositivo(req.body?.monto, 'monto');
			const clave = exigirTexto(req.body?.clave_idempotencia, 'clave_idempotencia');
			const actor = req.accountability.user;

			return unaSolaVez('wge_transferencias', clave, async (trx) => {
				let paisId, origen, destino;
				if (tipo === 'banco_docente') {
					exigirRol(rol, ROLES.BANCO);
					paisId = exigirTexto(req.body.pais_id, 'pais_id');
					const docenteId = exigirTexto(req.body.docente_id, 'docente_id');
					if ((await rolDelUsuario(trx, { user: docenteId })) !== ROLES.DOCENTE) throw new WgeError(409, 'NO_ES_DOCENTE', 'El destinatario no es docente de Will Go');
					const pais = await trx('wge_paises').where('id', paisId).first();
					if (!pais) throw new WgeError(404, 'NO_EXISTE', 'El país no existe');
					await edicionAbierta(trx, pais.edicion_id);
					await exigirEquipo(trx, { edicionId: pais.edicion_id, usuarioId: actor, rol });
					await exigirResponsableBanco(trx, { paisId, usuarioId: actor, rol });
					await exigirEquipo(trx, { edicionId: pais.edicion_id, usuarioId: docenteId, rol: ROLES.DOCENTE, paisId, quien: 'El docente' });
					// Bloqueo en orden fijo (banco antes que docente) para evitar bloqueos cruzados
					origen = await billeteraBloqueada(trx, { edicionId: pais.edicion_id, paisId, tipo: 'banco' });
					if (detalle) {
						const quedan = await inventarioBanco(trx, pais.edicion_id, paisId);
						for (const [d, n] of Object.entries(detalle.limpio)) {
							if (n > quedan[d]) throw new WgeError(409, 'SIN_BILLETES', `En el banco solo quedan ${Math.max(quedan[d], 0)} billetes de ${Number(d).toLocaleString('es-CO')}`);
						}
					}
					destino = await billeteraBloqueada(trx, { edicionId: pais.edicion_id, paisId, tipo: 'docente', docenteId });
				} else if (tipo === 'docente_estudiante') {
					exigirRol(rol, ROLES.DOCENTE);
					const participante = await participanteConPais(trx, exigirTexto(req.body.participante_id, 'participante_id'));
					await edicionAbierta(trx, participante.edicion_id);
					paisId = participante.pais_id;
					const docenteId = rol === ROLES.ADMIN && req.body.docente_id ? req.body.docente_id : actor;
					await exigirEquipo(trx, { edicionId: participante.edicion_id, usuarioId: docenteId, rol: docenteId === actor ? rol : ROLES.DOCENTE, paisId, quien: docenteId === actor ? 'Tu usuario' : 'El docente' });
					origen = await billeteraBloqueada(trx, { edicionId: participante.edicion_id, paisId, tipo: 'docente', docenteId });
					if (detalle) {
						const tiene = await inventarioDocente(trx, participante.edicion_id, paisId, docenteId);
						for (const [d, n] of Object.entries(detalle.limpio)) {
							if (n > tiene[d]) throw new WgeError(409, 'SIN_BILLETES', `Solo tienes ${Math.max(tiene[d], 0)} billetes de ${Number(d).toLocaleString('es-CO')}`);
						}
					}
					destino = await billeteraBloqueada(trx, { edicionId: participante.edicion_id, paisId, tipo: 'estudiante', participanteId: participante.id });
				} else {
					throw new WgeError(400, 'VALOR_INVALIDO', 'tipo debe ser banco_docente o docente_estudiante');
				}

				const id = crypto.randomUUID();
				await moverSaldo(trx, origen, { tipo: 'transferencia_salida', monto: -monto, actor, referenciaTipo: 'transferencia', referenciaId: id });
				await moverSaldo(trx, destino, { tipo: 'transferencia_entrada', monto, actor, referenciaTipo: 'transferencia', referenciaId: id });
				const fila = {
					id, edicion_id: origen.edicion_id, pais_id: paisId,
					billetera_origen_id: origen.id, billetera_destino_id: destino.id,
					monto, estado: 'aplicada', clave_idempotencia: clave, billetes: detalle ? JSON.stringify(detalle.limpio) : null,
					date_created: new Date(), user_created: actor,
				};
				await trx('wge_transferencias').insert(fila);
				return { ...fila, saldo_origen: origen.saldo, saldo_destino: destino.saldo };
			});
		}));

		/**
		 * POST /wge/ventas
		 * { participante_id, items: [{ producto_id, cantidad }], clave_idempotencia }
		 * Precio en billetes = techo(precio en COP educativo / tasa vigente del país del estudiante).
		 */
		/**
		 * POST /wge/ventas { participante_id, items: [{ producto_id, cantidad }], billetes_recibidos, billetes_vuelto, clave_idempotencia }
		 * El estudiante paga con billetes de su país; la caja recibe lo que entregó y da el vuelto (recibido − total).
		 */
		router.post('/ventas', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.CAJERO, ROLES.ADMIN_WG);
			const recibidos = totalDelConteo(req.body?.billetes_recibidos ?? {});
			const vuelto = totalDelConteo(req.body?.billetes_vuelto ?? {});
			const clave = exigirTexto(req.body?.clave_idempotencia, 'clave_idempotencia');
			const items = Array.isArray(req.body?.items) ? req.body.items : [];
			if (!items.length) throw new WgeError(400, 'VALOR_INVALIDO', 'La venta no tiene productos');
			const pedido = new Map();
			for (const it of items) {
				const productoId = exigirTexto(it?.producto_id, 'producto_id');
				pedido.set(productoId, (pedido.get(productoId) ?? 0) + enteroPositivo(it?.cantidad, 'cantidad'));
			}
			const actor = req.accountability.user;

			return unaSolaVez('wge_ventas', clave, async (trx) => {
				const participante = await participanteConPais(trx, exigirTexto(req.body.participante_id, 'participante_id'));
				const edicion = await edicionAbierta(trx, participante.edicion_id);
				await exigirEquipo(trx, { edicionId: edicion.id, usuarioId: actor, rol });
				await exigirResponsableCaja(trx, { edicionId: edicion.id, usuarioId: actor, rol });
				const pais = await trx('wge_paises').where('id', participante.pais_id).first(); // la tasa vigente al momento de la compra
				const tasa = Number(pais.tasa_actual || edicion.tasa_inicial);
				const billetera = await billeteraBloqueada(trx, { edicionId: edicion.id, paisId: pais.id, tipo: 'estudiante', participanteId: participante.id });

				const productos = await trx('wge_productos').whereIn('id', [...pedido.keys()]).orderBy('id').forUpdate();
				if (productos.length !== pedido.size) throw new WgeError(404, 'NO_EXISTE', 'Algún producto no existe');

				let total = 0;
				const lineas = [];
				for (const p of productos) {
					const cantidad = pedido.get(p.id);
					if (p.edicion_id !== edicion.id || !p.activo) throw new WgeError(409, 'PRODUCTO_NO_DISPONIBLE', `${p.nombre} no está disponible en esta edición`);
					if (Number(p.stock) < cantidad) throw new WgeError(409, 'SIN_STOCK', `No hay suficientes unidades de ${p.nombre}`);
					if (p.maximo_por_estudiante) {
						const ya = await trx('wge_venta_items as i').join('wge_ventas as v', 'v.id', 'i.venta_id')
							.where({ 'v.participante_id': participante.id, 'i.producto_id': p.id, 'v.estado': 'pagada' })
							.sum({ total: 'i.cantidad' }).first();
						if (Number(ya?.total ?? 0) + cantidad > p.maximo_por_estudiante) throw new WgeError(409, 'MAXIMO_POR_ESTUDIANTE', `Máximo ${p.maximo_por_estudiante} de ${p.nombre} por estudiante`);
					}
					const precio = precioEnBilletesCaja(p.precio_cop, tasa);
					total += precio * cantidad;
					lineas.push({ p, cantidad, precio });
				}

				// Billetes: lo recibido debe alcanzar y el vuelto debe ser exacto, con billetes que la caja tenga (o que acaba de recibir)
				if (recibidos.total < total) throw new WgeError(409, 'PAGO_INSUFICIENTE', `El total es ${total}; el estudiante entregó ${recibidos.total}`);
				if (recibidos.total - vuelto.total !== total) throw new WgeError(400, 'VUELTO_INCORRECTO', `El vuelto debe ser ${recibidos.total - total} (marcaste ${vuelto.total})`);
				if (vuelto.total) {
					const hay = await inventarioCaja(trx, edicion.id, pais.id);
					for (const [d, n] of Object.entries(vuelto.limpio)) {
						const disponibles = (hay[d] ?? 0) + (recibidos.limpio[d] ?? 0);
						if (n > disponibles) throw new WgeError(409, 'SIN_BILLETES', `En la caja solo hay ${Math.max(0, disponibles)} billetes de ${d} para el vuelto`);
					}
				}
				if (Number(billetera.saldo) < total) throw new WgeError(409, 'SALDO_INSUFICIENTE', `El estudiante solo tiene ${billetera.saldo} billetes`);

				const ventaId = crypto.randomUUID();
				const movimientoId = await moverSaldo(trx, billetera, { tipo: 'compra', monto: -total, actor, referenciaTipo: 'venta', referenciaId: ventaId });
				const caja = await billeteraBloqueada(trx, { edicionId: edicion.id, paisId: pais.id, tipo: 'caja' });
				await moverSaldo(trx, caja, { tipo: 'compra', monto: total, actor, referenciaTipo: 'venta', referenciaId: ventaId });
				for (const { p, cantidad } of lineas) await trx('wge_productos').where('id', p.id).update({ stock: Number(p.stock) - cantidad });

				const recibo = `GS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${ventaId.slice(0, 8).toUpperCase()}`;
				const venta = {
					id: ventaId, edicion_id: edicion.id, participante_id: participante.id,
					tasa_aplicada: tasa, total_billetes: total, numero_recibo: recibo, movimiento_id: movimientoId,
					estado: 'pagada', clave_idempotencia: clave, date_created: new Date(), user_created: actor,
					pais_id: pais.id, billetes_recibidos: JSON.stringify(recibidos.limpio), billetes_vuelto: JSON.stringify(vuelto.limpio),
				};
				await trx('wge_ventas').insert(venta);
				await trx('wge_venta_items').insert(lineas.map(({ p, cantidad, precio }) => ({
					id: crypto.randomUUID(), venta_id: ventaId, producto_id: p.id, cantidad, precio_billetes: precio,
					date_created: new Date(), user_created: actor,
				})));
				return {
					...venta, saldo: billetera.saldo, billetes_recibidos: recibidos.limpio, billetes_vuelto: vuelto.limpio,
					items: lineas.map(({ p, cantidad, precio }) => ({ producto_id: p.id, nombre: p.nombre, cantidad, precio_billetes: precio })),
				};
			});
		}));

		/**
		 * POST /wge/inversiones  { participante_id, fondo_id, ronda_id, billetes, clave_idempotencia }
		 * El estudiante entrega billetes al banco de su país: salen de su saldo y entran al banco.
		 */
		router.post('/inversiones', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.BANCO, ROLES.ADMIN_WG);
			const { limpio, total: monto } = totalDelConteo(req.body?.billetes);
			if (!monto) throw new WgeError(400, 'VALOR_INVALIDO', 'Elige los billetes que entrega el estudiante');
			const clave = exigirTexto(req.body?.clave_idempotencia, 'clave_idempotencia');
			const actor = req.accountability.user;

			return unaSolaVez('wge_inversiones', clave, async (trx) => {
				const participante = await participanteConPais(trx, exigirTexto(req.body.participante_id, 'participante_id'));
				const edicion = await edicionAbierta(trx, participante.edicion_id);
				await exigirEquipo(trx, { edicionId: edicion.id, usuarioId: actor, rol });
				await exigirResponsableBanco(trx, { paisId: participante.pais_id, usuarioId: actor, rol });
				const ronda = await trx('wge_rondas').where('id', exigirTexto(req.body.ronda_id, 'ronda_id')).forUpdate().first();
				if (!ronda || ronda.edicion_id !== edicion.id) throw new WgeError(404, 'NO_EXISTE', 'La ronda no existe en esta edición');
				if (ronda.estado !== 'abierta' || (ronda.cierre_programado && new Date(ronda.cierre_programado) <= new Date())) {
					throw new WgeError(409, 'RONDA_CERRADA', 'La ronda ya cerró; espera la siguiente');
				}
				const fondo = await trx('wge_fondos').where('id', exigirTexto(req.body.fondo_id, 'fondo_id')).first();
				if (!fondo || fondo.edicion_id !== edicion.id || !fondo.activo) throw new WgeError(404, 'NO_EXISTE', 'La empresa no está disponible');

				const estudiante = await billeteraBloqueada(trx, { edicionId: edicion.id, paisId: participante.pais_id, tipo: 'estudiante', participanteId: participante.id });
				if (Number(estudiante.saldo) < monto) throw new WgeError(409, 'SALDO_INSUFICIENTE', `El estudiante solo tiene ${estudiante.saldo} billetes`);
				const banco = await billeteraBloqueada(trx, { edicionId: edicion.id, paisId: participante.pais_id, tipo: 'banco' });
				const id = crypto.randomUUID();
				await moverSaldo(trx, estudiante, { tipo: 'inversion', monto: -monto, actor, referenciaTipo: 'inversion', referenciaId: id });
				await moverSaldo(trx, banco, { tipo: 'inversion', monto, actor, referenciaTipo: 'inversion', referenciaId: id });
				const fila = {
					id, participante_id: participante.id, fondo_id: fondo.id, ronda_id: ronda.id, monto, billetes: JSON.stringify(limpio),
					estado: 'abierta', clave_idempotencia: clave, date_created: new Date(), user_created: actor,
				};
				await trx('wge_inversiones').insert(fila);
				return { ...fila, billetes: limpio, saldo: estudiante.saldo };
			});
		}));

		/**
		 * POST /wge/rondas/:id/cerrar { continuar }
		 * Cierra la ronda ya (sin esperar su hora). Con continuar=true abre la siguiente con la misma duración.
		 */
		router.post('/rondas/:id/cerrar', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.BANCO, ROLES.ADMIN_WG);
			const actor = req.accountability.user;
			const ronda = await db('wge_rondas').where('id', req.params.id).first('id', 'edicion_id', 'estado');
			if (!ronda) throw new WgeError(404, 'NO_EXISTE', 'La ronda no existe');
			await exigirEquipo(db, { edicionId: ronda.edicion_id, usuarioId: actor, rol });
			const r = await cerrarYSeguir(db, ronda.id, { actor, continuar: req.body?.continuar === true });
			if (!r) throw new WgeError(409, 'YA_LIQUIDADA', 'La ronda ya fue cerrada');
			return r;
		}));

		/** POST /wge/ediciones/:id/sincronizar-participantes: trae a los inscritos (también se hace solo al consultar). */
		router.post('/ediciones/:id/sincronizar-participantes', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.ADMIN_WG);
			const edicion = await db('wge_ediciones').where('id', req.params.id).first();
			if (!edicion?.curso_id) throw new WgeError(409, 'SIN_PROGRAMA', 'La edición no tiene programa asignado');
			return traerInscritos(db, edicion, req.accountability.user);
		}));

		/**
		 * POST /wge/ediciones/:id/abrir
		 * Carga la provisión del banco en cada moneda y entrega el Investment Bill a quien tenga país.
		 * Se puede llamar varias veces: lo ya entregado no se repite.
		 */
		router.post('/ediciones/:id/abrir', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.ADMIN_WG);
			const actor = req.accountability.user;
			return db.transaction(async (trx) => {
				const edicion = await trx('wge_ediciones').where('id', req.params.id).forUpdate().first();
				if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
				if (edicion.estado === 'cerrada') throw new WgeError(409, 'EDICION_CERRADA', 'La edición ya fue cerrada');
				const paises = await trx('wge_paises').where('edicion_id', edicion.id).orderBy('id');
				if (!paises.length) throw new WgeError(409, 'SIN_PAISES', 'La edición no tiene países');
				const resumen = { provisiones: 0, bienvenidas: 0 };

				for (const pais of paises) {
					if (!pais.tasa_actual) await trx('wge_paises').where('id', pais.id).update({ tasa_actual: edicion.tasa_inicial });
					const banco = await billeteraBloqueada(trx, { edicionId: edicion.id, paisId: pais.id, tipo: 'banco' });
					// Normalmente el banco ya recibió sus billetes al registrarlos; esto cubre ediciones viejas sin ese movimiento
					const yaProvisionado = await trx('wge_movimientos').where({ billetera_id: banco.id }).whereIn('tipo', ['provision', 'reverso']).first();
					if (!yaProvisionado && Number(pais.provision_inicial) > 0) {
						await moverSaldo(trx, banco, { tipo: 'provision', monto: Number(pais.provision_inicial), actor, referenciaTipo: 'edicion', referenciaId: edicion.id });
						resumen.provisiones++;
					}
					const participantes = await trx('wge_participantes').where({ edicion_id: edicion.id, pais_id: pais.id });
					resumen.bienvenidas += await darBienvenida(trx, edicion, participantes, actor);
				}
				await trx('wge_ediciones').where('id', edicion.id).update({ estado: 'abierta' });
				return resumen;
			});
		}));

		rutasFuncionarios(router, { ruta, db, services, getSchema });
		rutasAdmin(router, { ruta, db, services, getSchema });
		rutasArqueo(router, { ruta, db });
		rutasWfunds(router, { ruta, db });
		rutasRubrica(router, { ruta, db });
		rutasCierre(router, { ruta, db });
		rutasTipoCambio(router, { ruta, db });
		rutasCaja(router, { ruta, db });

		/** GET /wge/billetera/:codigo: saldo y últimos movimientos de un estudiante por su código (QR). */
		router.get('/billetera/:codigo', ruta(async (req, rol) => {
			exigirRol(rol, ROLES.BANCO, ROLES.DOCENTE, ROLES.CAJERO);
			const p = await db('wge_participantes as p').join('estudiantes as e', 'e.id', 'p.estudiante_id')
				.leftJoin('wge_paises as pa', 'pa.id', 'p.pais_id')
				.where('p.codigo', String(req.params.codigo).toUpperCase())
				.first('p.id', 'p.edicion_id', 'p.pais_id', 'e.nombre', 'e.apellido', 'pa.nombre as pais', 'pa.codigo_moneda', 'pa.tasa_actual');
			if (!p) throw new WgeError(404, 'NO_EXISTE', 'No hay ningún estudiante con ese código');
			const billetera = p.pais_id ? await db('wge_billeteras').where({ participante_id: p.id, pais_id: p.pais_id }).first() : null;
			const movimientos = billetera
				? await db('wge_movimientos').where('billetera_id', billetera.id).orderBy('consecutivo', 'desc').limit(20)
					.select('tipo', 'monto', 'saldo_despues', 'date_created')
				: [];
			return { participante: p, saldo: billetera ? Number(billetera.saldo) : 0, movimientos };
		}));
	},
};
