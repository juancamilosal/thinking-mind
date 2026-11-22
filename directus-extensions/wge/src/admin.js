// Administración de ediciones de WILL-GO ECONOMY (pantalla "Edición y participantes").
// Todo pasa por aquí con una lista de campos permitidos: los roles de Will Go no tocan /items de Directus,
// y ningún campo de dinero (saldos, tasas vigentes, movimientos) se puede escribir desde esta pantalla.
import { Readable } from 'node:stream';
import { totalDelConteo } from './arqueo.js';
import { WgeError, ROLES, exigirRol, exigirTexto, traerInscritos, darBienvenida, billeteraBloqueada, moverSaldo, sqlCorresponde } from './lib.js';

const CAMPOS_JSON = ['horario', 'parametros_fx'];

/** Qué se puede leer y escribir de cada parte de una edición. */
export const SECCIONES = {
	paises: { tabla: 'wge_paises', campos: ['nombre', 'codigo_moneda', 'color', 'orden', 'responsable_banco'], orden: 'orden' },
	productos: { tabla: 'wge_productos', campos: ['nombre', 'foto', 'precio_cop', 'stock', 'maximo_por_estudiante', 'activo'], orden: 'nombre' },
	fondos: { tabla: 'wge_fondos', campos: ['nombre', 'historia', 'logo', 'a_que_se_dedica', 'por_que_invertir', 'riesgo', 'rendimiento_base', 'rendimiento_alterno', 'variacion', 'activo', 'orden'], orden: 'orden' },
};
const CAMPOS_EDICION = ['nombre', 'colegio_id', 'curso_id', 'edicion_programa', 'fecha_inicio', 'fecha_fin', 'horario', 'tasa_inicial', 'tope_minimo', 'tope_maximo', 'parametros_fx', 'investment_bill'];

/** Lo que trae toda edición nueva (se puede cambiar después). */
export const PAISES_POR_DEFECTO = [
	{ nombre: 'Wonderland', codigo_moneda: 'WON', color: '#E0457B', orden: 1 },
	{ nombre: 'Neverland', codigo_moneda: 'NEV', color: '#C9A227', orden: 2 },
	{ nombre: 'Dreamland', codigo_moneda: 'DRE', color: '#4F7A3A', orden: 3 },
];
export const FONDOS_POR_DEFECTO = [
	{ nombre: 'CAPI GREEN', riesgo: 'bajo', rendimiento_base: 0.03, rendimiento_alterno: null, variacion: 0.02,
		a_que_se_dedica: 'Sembramos bosques y producimos energía con el sol y el viento.',
		por_que_invertir: 'Todo el mundo necesita energía limpia\nCrece despacio, pero seguro\nCuidas el planeta mientras ganas' },
	{ nombre: 'OCEAN GUARDIANS', riesgo: 'bajo', rendimiento_base: 0.02, rendimiento_alterno: null, variacion: 0.02,
		a_que_se_dedica: 'Limpiamos los océanos y reciclamos el plástico que sacamos del mar.',
		por_que_invertir: 'Cada vez más empresas pagan por reciclar\nEs la inversión más tranquila\nAyudas a salvar a los animales del mar' },
	{ nombre: 'LEGO FUTURE', riesgo: 'medio', rendimiento_base: 0.06, rendimiento_alterno: null, variacion: 0.05,
		a_que_se_dedica: 'Diseñamos juguetes y robots para aprender construyendo.',
		por_que_invertir: 'Niños de todo el mundo quieren nuestros productos\nInventamos algo nuevo cada temporada\nPuede ganar más que un fondo tranquilo' },
	{ nombre: 'LES ARTISTES', riesgo: 'medio', rendimiento_base: 0.05, rendimiento_alterno: null, variacion: 0.05,
		a_que_se_dedica: 'Producimos música, películas y arte de nuevos talentos.',
		por_que_invertir: 'Un solo éxito puede hacernos ganar mucho\nTrabajamos con artistas de todos los países\nEl público siempre busca algo nuevo' },
	{ nombre: 'DREAM EXPLORERS', riesgo: 'alto', rendimiento_base: 0.1, rendimiento_alterno: -0.08, variacion: 0.12,
		a_que_se_dedica: 'Construimos naves para explorar el espacio y otros planetas.',
		por_que_invertir: 'Si la misión sale bien, es el fondo que más gana\nEs el negocio del futuro\nOjo: si la misión falla, puedes perder billetes' },
];

/** Texto de ejemplo para un fondo (por su nombre o, si no, por su posición). */
export function ejemploDeFondo(fondo) {
	const n = String(fondo?.nombre ?? '').trim().toUpperCase();
	const f = FONDOS_POR_DEFECTO.find((x) => x.nombre === n) ?? FONDOS_POR_DEFECTO[(Number(fondo?.orden) || 0) - 1];
	return f ? { a_que_se_dedica: f.a_que_se_dedica, por_que_invertir: f.por_que_invertir } : null;
}

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
		if (v !== null && campo === 'a_que_se_dedica' && String(v).length > 160) throw new WgeError(400, 'VALOR_INVALIDO', 'A qué se dedica: máximo 160 letras');
		if (v !== null && campo === 'por_que_invertir' && String(v).length > 600) throw new WgeError(400, 'VALOR_INVALIDO', 'Por qué invertir: máximo 600 letras');
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

	/** Una sola edición de Will-Go por oferta (colegio + programa + número de edición). */
	const validarOferta = async (fila, idActual = null) => {
		if (!fila.curso_id || !fila.edicion_programa) throw new WgeError(400, 'VALOR_INVALIDO', 'Elige el programa habilitado en el colegio (con su número de edición)');
		const repetida = await db('wge_ediciones').where({ curso_id: fila.curso_id, edicion_programa: String(fila.edicion_programa) })
			.where((q) => (fila.colegio_id ? q.where('colegio_id', fila.colegio_id) : q.whereNull('colegio_id')))
			.modify((q) => { if (idActual) q.whereNot('id', idActual); }).first('nombre');
		if (repetida) throw new WgeError(409, 'OFERTA_REPETIDA', `Ya existe la edición «${repetida.nombre}» para ese colegio, programa y número de edición`);
	};

	const resumenEdicion = async (e) => {
		const activos = () => db('wge_participantes').where('edicion_id', e.id).whereRaw('coalesce(retirado, false) = false');
		const [{ total }] = await activos().count({ total: '*' });
		const [{ sinPais }] = await activos().whereNull('pais_id').count({ sinPais: '*' });
		const [{ retirados }] = await db('wge_participantes').where({ edicion_id: e.id, retirado: true }).count({ retirados: '*' });
		const [{ equipo }] = await db('wge_equipo').where('edicion_id', e.id).count({ equipo: '*' });
		const colegio = e.colegio_id ? await db('colegios').where('id', e.colegio_id).first('nombre') : null;
		const programa = e.curso_id ? await db('Cursos').where('id', e.curso_id).first('nombre') : null;
		return {
			...e, colegio_nombre: colegio?.nombre ?? null, programa_nombre: programa?.nombre ?? null,
			participantes: Number(total), sin_pais: Number(sinPais), retirados: Number(retirados), equipo: Number(equipo),
		};
	};

	/** Listas para los selectores del formulario. */
	router.get('/admin/catalogos', ruta(async (req, rol) => {
		soloAdmin(rol);
		const [colegios, programas, ofertas] = await Promise.all([
			db('colegios').select('id', 'nombre').orderBy('nombre'),
			db('Cursos').select('id', 'nombre').orderBy('nombre'),
			// Cada programa habilitado en un colegio con su número de edición (lo que se elige al crear la edición)
			db('colegios_cursos as cc').join('Cursos as k', 'k.id', 'cc.curso_id').leftJoin('colegios as c', 'c.id', 'cc.colegio_id')
				.whereNotNull('cc.edicion')
				.select('cc.id', 'cc.colegio_id', 'c.nombre as colegio', 'cc.curso_id', 'k.nombre as programa', 'cc.edicion', 'cc.fecha_finalizacion',
					db.raw(`(select we.nombre from wge_ediciones we where we.colegio_id is not distinct from cc.colegio_id
						and we.curso_id = cc.curso_id and we.edicion_programa = cc.edicion::text limit 1) as edicion_will_go`))
				.orderBy([{ column: 'k.nombre' }, { column: 'c.nombre' }]),
		]);
		return { colegios, programas, ofertas };
	}));

	router.get('/admin/ediciones', ruta(async (req, rol) => {
		soloAdmin(rol);
		const ediciones = await db('wge_ediciones').orderBy('date_created', 'desc');
		for (const e of ediciones) await traerInscritos(db, e, req.accountability.user);
		return Promise.all(ediciones.map(resumenEdicion));
	}));

	/** Crea la edición con sus 3 países y los 5 fondos de siempre. */
	router.post('/admin/ediciones', ruta(async (req, rol) => {
		soloAdmin(rol);
		const actor = req.accountability.user;
		const fila = limpiar(req.body, CAMPOS_EDICION);
		exigirTexto(fila.nombre, 'nombre');
		await validarOferta(fila);
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
		const e = await edicionExistente(req.params.id);
		const { nuevos, quitados } = await traerInscritos(db, e, req.accountability.user);
		return { ...(await resumenEdicion(e)), nuevos, quitados };
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
		if (['colegio_id', 'curso_id', 'edicion_programa'].some((k) => k in fila)) {
			await validarOferta({ colegio_id: e.colegio_id, curso_id: e.curso_id, edicion_programa: e.edicion_programa, ...fila }, e.id);
		}
		if (Object.keys(fila).length) await db('wge_ediciones').where('id', e.id).update(fila);
		const actualizada = await edicionExistente(e.id);
		const { nuevos, quitados } = await traerInscritos(db, actualizada, req.accountability.user);
		return { ...(await resumenEdicion(actualizada)), nuevos, quitados };
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
			await trx('wge_equipo').where('edicion_id', e.id).delete();
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
			const filas = await db(s.tabla).where('edicion_id', req.params.id).orderBy(s.orden);
			if (nombre === 'paises') {
				// Cuánto hay en el banco y cuánto circula (provisión que ya salió del banco)
				for (const p of filas) {
					const banco = await db('wge_billeteras').where({ edicion_id: req.params.id, pais_id: p.id, tipo_dueno: 'banco' }).first('saldo');
					const provisto = await db('wge_movimientos as m').join('wge_billeteras as b', 'b.id', 'm.billetera_id')
						.where({ 'b.edicion_id': req.params.id, 'b.pais_id': p.id, 'b.tipo_dueno': 'banco', 'm.tipo': 'provision' }).sum({ t: 'm.monto' }).first();
					p.saldo_banco = Number(banco?.saldo ?? 0);
					p.en_circulacion = Number(provisto?.t ?? 0) - p.saldo_banco;
				}
			}
			if (nombre === 'fondos') for (const f of filas) f.ejemplo = ejemploDeFondo(f);
			return filas;
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
			if (nombre === 'paises' && req.body && 'provision_billetes' in req.body) {
				// La provisión se define por billetes impresos: el total sale del conteo
				const { limpio, total } = totalDelConteo(req.body.provision_billetes ?? {});
				fila.provision_billetes = JSON.stringify(limpio);
				fila.provision_inicial = total;
			}
			if (nombre === 'paises' && e.estado !== 'borrador' && 'provision_inicial' in fila && fila.provision_inicial !== actual.provision_inicial) {
				throw new WgeError(409, 'EDICION_ABIERTA', 'La provisión del banco se define antes de abrir la edición');
			}
			if (nombre === 'paises' && fila.responsable_banco) {
				const esBanco = await db('directus_users as u').join('directus_roles as r', 'r.id', 'u.role')
					.where({ 'u.id': fila.responsable_banco, 'r.name': ROLES.BANCO }).first('u.id');
				if (!esBanco) throw new WgeError(400, 'VALOR_INVALIDO', 'El responsable del banco debe ser un colaborador con rol Banco');
				// Queda en el equipo de la edición
				await db('wge_equipo').insert(nueva(req.accountability.user, {
					edicion_id: actual.edicion_id, usuario_id: fila.responsable_banco, clave_unica: `${actual.edicion_id}:${fila.responsable_banco}`,
				})).onConflict('clave_unica').ignore();
			}
			if (nombre === 'paises' && 'provision_inicial' in fila && e.estado === 'borrador') {
				// El banco recibe los billetes apenas se registran (y se ajusta si se corrigen), para poder contarlos antes de abrir
				await db.transaction(async (trx) => {
					await trx(s.tabla).where('id', actual.id).update(fila);
					const banco = await billeteraBloqueada(trx, { edicionId: e.id, paisId: actual.id, tipo: 'banco' });
					const diferencia = Number(fila.provision_inicial) - Number(banco.saldo);
					if (diferencia !== 0) {
						await moverSaldo(trx, banco, {
							tipo: diferencia > 0 ? 'provision' : 'reverso', monto: diferencia, actor: req.accountability.user,
							referenciaTipo: 'provision', referenciaId: actual.id,
						});
					}
				});
				return db(s.tabla).where('id', actual.id).first();
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
		const e = await edicionExistente(req.params.id);
		await traerInscritos(db, e, req.accountability.user);
		return db('wge_participantes as p')
			.join('estudiantes as e', 'e.id', 'p.estudiante_id')
			.leftJoin('colegios as c', 'c.id', 'e.colegio_id')
			.leftJoin('wge_billeteras as b', function () { this.on('b.participante_id', 'p.id').andOn('b.pais_id', 'p.pais_id'); })
			.where('p.edicion_id', req.params.id)
			.select('p.id', 'p.codigo', 'p.pais_id', 'p.presente', 'p.retirado', 'p.motivo_retiro', 'p.fecha_retiro',
				'e.nombre', 'e.apellido', 'e.grado', 'e.colegio_id', 'c.nombre as colegio', db.raw('coalesce(b.saldo, 0)::int as saldo'),
				// Pidió reembolso: todas sus cuentas del programa están devueltas o trasladadas
				db.raw(`${sqlCorresponde(e).sql} as corresponde`, sqlCorresponde(e).valores),
				db.raw(`not exists (select 1 from cuentas_cobrar cc where cc.estudiante_id = e.id and cc.curso_id = ?
					and cc.estado not in ('DEVOLUCION', 'FONDOS TRASLADADOS')) as pidio_reembolso`, [e.curso_id]))
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
		if (lista.some((p) => p.retirado)) throw new WgeError(409, 'RETIRADO', 'Hay estudiantes retirados en la selección; reintégralos primero');
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
		const edicion = await edicionExistente([...ediciones][0]);
		// Con la edición abierta, quien recibe país recibe también su bienvenida, en la misma operación
		return db.transaction(async (trx) => {
			await trx('wge_participantes').whereIn('id', ids).update(cambios);
			let bienvenidas = 0;
			if (cambios.pais_id && edicion.estado === 'abierta') {
				bienvenidas = await darBienvenida(trx, edicion, await trx('wge_participantes').whereIn('id', ids), req.accountability.user);
			}
			return { actualizados: ids.length, bienvenidas };
		});
	}));

	/**
	 * POST /wge/admin/paises/:id/provisionar { billetes: { "1": 100, ... }, nota }
	 * Con la edición abierta, agrega billetes impresos al banco de un país (solo suma: lo que ya salió puede estar
	 * circulando). Queda un movimiento de provisión y se actualiza el detalle de billetes del país.
	 */
	router.post('/admin/paises/:id/provisionar', ruta(async (req, rol) => {
		soloAdmin(rol);
		const actor = req.accountability.user;
		const { limpio, total } = totalDelConteo(req.body?.billetes ?? {});
		if (total <= 0) throw new WgeError(400, 'VALOR_INVALIDO', 'Escribe cuántos billetes entran al banco');
		return db.transaction(async (trx) => {
			const pais = await trx('wge_paises').where('id', req.params.id).forUpdate().first();
			if (!pais) throw new WgeError(404, 'NO_EXISTE', 'El país no existe');
			const e = await trx('wge_ediciones').where('id', pais.edicion_id).first();
			if (e.estado === 'cerrada') throw new WgeError(409, 'EDICION_CERRADA', 'La edición ya fue cerrada');
			if (e.estado === 'borrador') throw new WgeError(409, 'EDICION_EN_PREPARACION', 'Con la edición en preparación, edita los billetes impresos directamente');
			const banco = await billeteraBloqueada(trx, { edicionId: e.id, paisId: pais.id, tipo: 'banco' });
			await moverSaldo(trx, banco, { tipo: 'provision', monto: total, actor, referenciaTipo: 'provision_adicional', referenciaId: pais.id });
			const previos = (typeof pais.provision_billetes === 'string' ? JSON.parse(pais.provision_billetes) : pais.provision_billetes) ?? {};
			const suma = { ...previos };
			for (const [d, n] of Object.entries(limpio)) suma[d] = Number(suma[d] ?? 0) + n;
			await trx('wge_paises').where('id', pais.id).update({
				provision_billetes: JSON.stringify(suma), provision_inicial: Number(pais.provision_inicial ?? 0) + total,
			});
			return { agregado: total, saldo_banco: banco.saldo, provision_total: Number(pais.provision_inicial ?? 0) + total };
		});
	}));

	/**
	 * POST /wge/admin/participantes/retirar { ids, motivo }
	 * El estudiante queda fuera de la edición (no vuelve con la carga automática de inscritos).
	 * Si tiene billetes, vuelven al banco de su país; si tiene una inversión abierta, no se puede retirar todavía.
	 */
	router.post('/admin/participantes/retirar', ruta(async (req, rol) => {
		soloAdmin(rol);
		const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === 'string') : [];
		if (!ids.length) throw new WgeError(400, 'VALOR_INVALIDO', 'No hay estudiantes seleccionados');
		const motivo = exigirTexto(req.body?.motivo, 'motivo').slice(0, 200);
		const actor = req.accountability.user;
		return db.transaction(async (trx) => {
			const lista = await trx('wge_participantes as p').join('estudiantes as e', 'e.id', 'p.estudiante_id')
				.whereIn('p.id', ids).orderBy('p.id').select('p.*', 'e.nombre', 'e.apellido');
			if (lista.length !== ids.length) throw new WgeError(404, 'NO_EXISTE', 'Algún estudiante no existe');
			if (new Set(lista.map((p) => p.edicion_id)).size !== 1) throw new WgeError(400, 'VALOR_INVALIDO', 'Los estudiantes deben ser de la misma edición');
			const conInversion = await trx('wge_inversiones as i').join('wge_participantes as p', 'p.id', 'i.participante_id')
				.join('estudiantes as e', 'e.id', 'p.estudiante_id').whereIn('i.participante_id', ids).where('i.estado', 'abierta')
				.first('e.nombre', 'e.apellido');
			if (conInversion) throw new WgeError(409, 'INVERSION_ABIERTA', `${conInversion.nombre} ${conInversion.apellido} tiene billetes invertidos en una ronda abierta; retíralo cuando la ronda se cierre`);
			let devueltos = 0;
			for (const p of lista) {
				if (p.retirado) continue;
				const billeteras = await trx('wge_billeteras').where('participante_id', p.id).where('saldo', '>', 0).orderBy('id');
				for (const b of billeteras) {
					const est = await billeteraBloqueada(trx, { edicionId: b.edicion_id, paisId: b.pais_id, tipo: 'estudiante', participanteId: p.id });
					const banco = await billeteraBloqueada(trx, { edicionId: b.edicion_id, paisId: b.pais_id, tipo: 'banco' });
					const saldo = Number(est.saldo);
					if (saldo <= 0) continue;
					await moverSaldo(trx, est, { tipo: 'reverso', monto: -saldo, actor, referenciaTipo: 'retiro', referenciaId: p.id });
					await moverSaldo(trx, banco, { tipo: 'reverso', monto: saldo, actor, referenciaTipo: 'retiro', referenciaId: p.id });
					devueltos += saldo;
				}
			}
			await trx('wge_participantes').whereIn('id', ids).update({ retirado: true, motivo_retiro: motivo, fecha_retiro: new Date(), presente: false });
			return { retirados: ids.length, billetes_devueltos: devueltos };
		});
	}));

	/** POST /wge/admin/participantes/reintegrar { ids }: vuelve a la edición (sin billetes; la bienvenida no se repite). */
	router.post('/admin/participantes/reintegrar', ruta(async (req, rol) => {
		soloAdmin(rol);
		const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === 'string') : [];
		if (!ids.length) throw new WgeError(400, 'VALOR_INVALIDO', 'No hay estudiantes seleccionados');
		const n = await db('wge_participantes').whereIn('id', ids).update({ retirado: false, motivo_retiro: null, fecha_retiro: null });
		return { reintegrados: n };
	}));

	// ---------- Equipo de la edición ----------
	const ROLES_EQUIPO = { [ROLES.DOCENTE]: 'docente', [ROLES.BANCO]: 'banco', [ROLES.CAJERO]: 'cajero', [ROLES.ADMIN_WG]: 'administrativo' };

	/** GET /wge/admin/ediciones/:id/equipo: colaboradores de la edición con su rol, país y billetes en mano. */
	router.get('/admin/ediciones/:id/equipo', ruta(async (req, rol) => {
		soloAdmin(rol);
		const e = await edicionExistente(req.params.id);
		const filas = await db('wge_equipo as q').join('directus_users as u', 'u.id', 'q.usuario_id')
			.leftJoin('directus_roles as r', 'r.id', 'u.role').leftJoin('wge_paises as pa', 'pa.id', 'q.pais_id')
			.where('q.edicion_id', e.id)
			.select('q.id', 'q.usuario_id', 'q.pais_id', 'pa.nombre as pais', 'u.first_name as nombre', 'u.last_name as apellido', 'u.email',
				'u.status as estado', 'r.name as rol_nombre',
				db.raw(`coalesce((select sum(b.saldo) from wge_billeteras b where b.edicion_id = q.edicion_id
					and b.tipo_dueno = 'docente' and b.docente_id = q.usuario_id), 0)::int as billetes`))
			.orderBy([{ column: 'u.first_name' }, { column: 'u.last_name' }]);
		return filas.map((f) => ({ ...f, rol: ROLES_EQUIPO[f.rol_nombre] ?? null }));
	}));

	/** POST /wge/admin/ediciones/:id/equipo { usuario_ids }: agrega colaboradores (solo usuarios con rol de Will Go). */
	router.post('/admin/ediciones/:id/equipo', ruta(async (req, rol) => {
		soloAdmin(rol);
		const e = await edicionExistente(req.params.id);
		const ids = Array.isArray(req.body?.usuario_ids) ? req.body.usuario_ids.filter((x) => typeof x === 'string') : [];
		if (!ids.length) throw new WgeError(400, 'VALOR_INVALIDO', 'No hay colaboradores seleccionados');
		const validos = await db('directus_users as u').join('directus_roles as r', 'r.id', 'u.role')
			.whereIn('u.id', ids).whereIn('r.name', Object.keys(ROLES_EQUIPO)).pluck('u.id');
		if (validos.length !== ids.length) throw new WgeError(400, 'VALOR_INVALIDO', 'Algún usuario no es colaborador de Will Go');
		const r = await db('wge_equipo').insert(validos.map((usuario_id) => nueva(req.accountability.user, {
			edicion_id: e.id, usuario_id, clave_unica: `${e.id}:${usuario_id}`,
		}))).onConflict('clave_unica').ignore().returning('id');
		return { agregados: r.length };
	}));

	/** PATCH /wge/admin/equipo/:id { pais_id }: país del docente (o null para que maneje todos). */
	router.patch('/admin/equipo/:id', ruta(async (req, rol) => {
		soloAdmin(rol);
		const fila = await db('wge_equipo').where('id', req.params.id).first();
		if (!fila) throw new WgeError(404, 'NO_EXISTE', 'No hace parte del equipo');
		const paisId = req.body?.pais_id || null;
		if (paisId && !(await db('wge_paises').where({ id: paisId, edicion_id: fila.edicion_id }).first('id'))) {
			throw new WgeError(400, 'VALOR_INVALIDO', 'El país no es de esta edición');
		}
		const conBilletes = await db('wge_billeteras').where({ edicion_id: fila.edicion_id, tipo_dueno: 'docente', docente_id: fila.usuario_id })
			.where('saldo', '>', 0).modify((q) => { if (paisId) q.whereNot('pais_id', paisId); }).first('id');
		if (conBilletes) throw new WgeError(409, 'TIENE_BILLETES', 'El docente tiene billetes de otro país; primero debe entregarlos o devolverlos');
		await db('wge_equipo').where('id', fila.id).update({ pais_id: paisId });
		return { ok: true };
	}));

	/** DELETE /wge/admin/equipo/:id: lo saca del equipo (si no tiene billetes en mano en esta edición). */
	router.delete('/admin/equipo/:id', ruta(async (req, rol) => {
		soloAdmin(rol);
		const fila = await db('wge_equipo').where('id', req.params.id).first();
		if (!fila) throw new WgeError(404, 'NO_EXISTE', 'No hace parte del equipo');
		const [{ suma }] = await db('wge_billeteras').where({ edicion_id: fila.edicion_id, tipo_dueno: 'docente', docente_id: fila.usuario_id }).sum({ suma: 'saldo' });
		if (Number(suma) > 0) throw new WgeError(409, 'TIENE_BILLETES', `Tiene ${Number(suma)} billetes sin entregar en esta edición; primero debe entregarlos`);
		await db('wge_equipo').where('id', fila.id).delete();
		return { quitado: true };
	}));

	/** POST /wge/admin/fotos { nombre, tipo, base64 }: foto de un producto o logo de un fondo (la pantalla la reduce antes de enviarla). */
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

	/** GET /wge/foto/:id: muestra la foto de un producto o el logo de un fondo a cualquier colaborador (sin abrir directus_files). */
	router.get('/foto/:id', async (req, res) => {
		try {
			if (!req.accountability?.user) return res.status(401).end();
			const esFoto = (await db('wge_productos').where('foto', req.params.id).first('id')) || (await db('wge_fondos').where('logo', req.params.id).first('id'));
			if (!esFoto) return res.status(404).end();
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
