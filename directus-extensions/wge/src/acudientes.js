// Portal del acudiente: entra con su documento y un código de 6 dígitos que le llega al correo.
// No usa usuarios de Directus: la sesión es un token propio (se guarda cifrado) que viaja en el cuerpo de cada petición.
// Nunca responde 401 (la plataforma lo toma como "sesión de colaborador vencida"); la sesión vencida es 403.
import { createHash as sha256Base, randomInt as enteroSeguro, randomBytes as bytesSeguros } from 'node:crypto';
import { WgeError } from './lib.js';
import { movimientosEstudiante } from './arqueo.js';
import { estadoRondas } from './wfunds.js';
import { CRITERIOS, resumenCalificaciones } from './rubrica.js';

const MINUTOS_CODIGO = 10;
const MAX_INTENTOS = 5;
const MAX_CODIGOS_15_MIN = 3;
const DIAS_SESION = 4;
/** Votos que tiene cada acudiente por ronda (en empresas distintas). */
export const VOTOS_POR_RONDA = 2;

const sha256 = (texto) => sha256Base('sha256').update(String(texto)).digest('hex');
const soloDigitos = (v) => String(v ?? '').replace(/\D/g, '');

/** "camilo@gmail.com" → "c****o@gmail.com" */
export function ocultarCorreo(correo) {
	const [usuario, dominio] = String(correo ?? '').split('@');
	if (!usuario || !dominio) return null;
	const visible = usuario.length <= 2 ? usuario[0] : `${usuario[0]}${'*'.repeat(Math.min(usuario.length - 2, 6))}${usuario.at(-1)}`;
	return `${visible}@${dominio}`;
}

const deJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

export function rutasAcudientes(router, { db, services, getSchema, logger }) {
	const publica = (fn) => async (req, res) => {
		try {
			res.json({ data: await fn(req) });
		} catch (error) {
			if (error instanceof WgeError) return res.status(error.status === 401 ? 403 : error.status).json({ errors: [{ message: error.message, extensions: { code: error.code } }] });
			logger.error(error, 'wge: portal acudiente');
			res.status(500).json({ errors: [{ message: 'Error interno en Will Go Economy', extensions: { code: 'ERROR_INTERNO' } }] });
		}
	};

	const documentoNormal = "regexp_replace(coalesce(numero_documento, ''), '[^0-9]', '', 'g')";

	/**
	 * Hijos (participantes activos) de un grupo de acudientes. Un estudiante es hijo si el acudiente aparece
	 * en su ficha (estudiantes.acudiente) o si fue quien lo inscribió y pagó (cuentas_cobrar.cliente_id).
	 */
	const participantesDe = (ids) => db('wge_participantes as p').join('estudiantes as e', 'e.id', 'p.estudiante_id')
		.join('wge_ediciones as ed', 'ed.id', 'p.edicion_id')
		.whereNot('ed.estado', 'cerrada').whereRaw('coalesce(p.retirado, false) = false')
		.where((w) => w.whereIn('e.acudiente', ids)
			.orWhereExists(db('cuentas_cobrar as cc').whereRaw('cc.estudiante_id = e.id').whereIn('cc.cliente_id', ids).select(db.raw('1'))));

	/** Todos los registros de clientes con el mismo documento (la plataforma a veces tiene al acudiente repetido). */
	const mismaPersona = async (acudienteId) => {
		const doc = await db('clientes').where('id', acudienteId).first(db.raw(`${documentoNormal} as doc`));
		if (!doc?.doc) return [acudienteId];
		const ids = await db('clientes').whereRaw(`${documentoNormal} = ?`, [doc.doc]).pluck('id');
		return ids.length ? ids : [acudienteId];
	};

	/** El acudiente con ese documento que tiene hijos en una edición activa (prefiere el registro que tiene correo). */
	const acudienteActivo = async (documento) => {
		const candidatos = await db('clientes').whereRaw(`${documentoNormal} = ?`, [documento])
			.orderByRaw('(email is null or email = \'\') asc').select('id', 'nombre', 'apellido', 'email');
		if (!candidatos.length) return null;
		const tieneHijos = await participantesDe(candidatos.map((c) => c.id)).first('p.id');
		return tieneHijos ? candidatos[0] : null;
	};

	const sesion = async (req) => {
		const token = String(req.body?.sesion ?? '');
		if (token.length < 32) throw new WgeError(403, 'SESION_VENCIDA', 'Tu sesión terminó; vuelve a entrar');
		const fila = await db('wge_sesiones_acudiente').where('token_hash', sha256(token)).where('expira', '>', new Date()).first('acudiente_id');
		if (!fila) throw new WgeError(403, 'SESION_VENCIDA', 'Tu sesión terminó; vuelve a entrar');
		return fila.acudiente_id;
	};

	/** POST /wge/acudiente/codigo { documento }: envía el código al correo registrado (sin decir si el documento existe). */
	router.post('/acudiente/codigo', publica(async (req) => {
		const documento = soloDigitos(req.body?.documento);
		if (documento.length < 5) throw new WgeError(400, 'VALOR_INVALIDO', 'Escribe tu número de documento');
		const acudiente = await acudienteActivo(documento);
		const respuesta = { enviado: true, correo: null };
		if (!acudiente?.email) return respuesta;

		const recientes = await db('wge_codigos_acudiente').where('acudiente_id', acudiente.id)
			.where('date_created', '>', new Date(Date.now() - 15 * 60000)).count({ n: '*' }).first();
		if (Number(recientes?.n ?? 0) >= MAX_CODIGOS_15_MIN) throw new WgeError(429, 'DEMASIADOS', 'Ya te enviamos varios códigos; espera unos minutos y revisa tu correo');

		const codigo = String(enteroSeguro(0, 1000000)).padStart(6, '0');
		await db('wge_codigos_acudiente').insert({
			id: crypto.randomUUID(), acudiente_id: acudiente.id, codigo_hash: sha256(`${acudiente.id}:${codigo}`),
			expira: new Date(Date.now() + MINUTOS_CODIGO * 60000), intentos: 0, usado: false, date_created: new Date(),
		});
		const correo = new services.MailService({ schema: await getSchema(), knex: db });
		await correo.send({
			to: acudiente.email,
			subject: `Tu código de Will-Go: ${codigo}`,
			html: `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#1f2937">
				<h2 style="margin:0 0 8px">Hola, ${String(acudiente.nombre ?? '').replace(/[<>&]/g, '')}</h2>
				<p>Este es tu código para entrar al portal de acudientes de Will-Go Economy:</p>
				<p style="font-size:36px;font-weight:800;letter-spacing:8px;margin:16px 0">${codigo}</p>
				<p style="color:#6b7280;font-size:14px">Vence en ${MINUTOS_CODIGO} minutos. Si no lo pediste, ignora este correo.</p></div>`,
		});
		return { ...respuesta, correo: ocultarCorreo(acudiente.email) };
	}));

	/** POST /wge/acudiente/entrar { documento, codigo }: valida el código y abre una sesión. */
	router.post('/acudiente/entrar', publica(async (req) => {
		const documento = soloDigitos(req.body?.documento);
		const codigo = soloDigitos(req.body?.codigo);
		const invalido = new WgeError(400, 'CODIGO_INVALIDO', 'El código no es correcto o ya venció');
		if (codigo.length !== 6) throw invalido;
		const acudiente = await acudienteActivo(documento);
		if (!acudiente) throw invalido;
		return db.transaction(async (trx) => {
			const fila = await trx('wge_codigos_acudiente').where({ acudiente_id: acudiente.id, usado: false })
				.where('expira', '>', new Date()).orderBy('date_created', 'desc').forUpdate().first();
			if (!fila || Number(fila.intentos) >= MAX_INTENTOS) throw invalido;
			if (fila.codigo_hash !== sha256(`${acudiente.id}:${codigo}`)) {
				await trx('wge_codigos_acudiente').where('id', fila.id).increment('intentos', 1);
				throw invalido;
			}
			await trx('wge_codigos_acudiente').where('id', fila.id).update({ usado: true });
			const token = bytesSeguros(32).toString('hex');
			await trx('wge_sesiones_acudiente').insert({
				id: crypto.randomUUID(), acudiente_id: acudiente.id, token_hash: sha256(token),
				expira: new Date(Date.now() + DIAS_SESION * 86400000), date_created: new Date(),
			});
			return { sesion: token, nombre: acudiente.nombre };
		});
	}));

	/** POST /wge/acudiente/salir { sesion } */
	router.post('/acudiente/salir', publica(async (req) => {
		const token = String(req.body?.sesion ?? '');
		if (token) await db('wge_sesiones_acudiente').where('token_hash', sha256(token)).delete();
		return { salio: true };
	}));

	/**
	 * POST /wge/acudiente/panel { sesion }: sus hijos con saldo e inversiones y, por cada edición,
	 * la ronda abierta (para el reloj), su voto, las empresas y el rendimiento de las rondas cerradas.
	 */
	router.post('/acudiente/panel', publica(async (req) => {
		const acudienteId = await sesion(req);
		const acudiente = await db('clientes').where('id', acudienteId).first('nombre', 'apellido');
		const familia = await mismaPersona(acudienteId);
		const hijos = await participantesDe(familia).leftJoin('wge_paises as pa', 'pa.id', 'p.pais_id')
			.leftJoin('wge_billeteras as b', function () { this.on('b.participante_id', 'p.id').andOn('b.pais_id', 'p.pais_id'); })
			.orderBy([{ column: 'e.nombre' }, { column: 'e.apellido' }])
			.select('p.id', 'p.edicion_id', 'p.pais_id', 'e.nombre', 'e.apellido', 'pa.nombre as pais', 'pa.color', 'pa.codigo_moneda', db.raw('coalesce(b.saldo, 0)::int as saldo'));
		for (const h of hijos) {
			Object.assign(h, h.pais_id ? await movimientosEstudiante(db, h.id, h.pais_id) : { movimientos: [], total_entro: 0, total_salio: 0 });
			delete h.pais_id;
			h.rubrica = resumenCalificaciones(await db('wge_evaluaciones').where('participante_id', h.id).select(...CRITERIOS, 'date_created'));
			h.inversiones = (await db('wge_inversiones as i').join('wge_fondos as f', 'f.id', 'i.fondo_id').join('wge_rondas as r', 'r.id', 'i.ronda_id')
				.where('i.participante_id', h.id).orderBy('i.date_created', 'desc').limit(30)
				.select('i.id', 'i.monto', 'i.estado', 'i.monto_pagado', 'i.valor_actual', 'i.historial', 'f.nombre as fondo', 'r.nombre as ronda'))
				.map((i) => ({ ...i, valor: i.estado === 'abierta' ? Number(i.valor_actual ?? i.monto) : Number(i.monto_pagado ?? i.monto), historial: deJson(i.historial) ?? [] }));
		}
		const ediciones = [];
		for (const edicionId of [...new Set(hijos.map((h) => h.edicion_id))]) {
			const edicion = await db('wge_ediciones').where('id', edicionId).first('id', 'nombre', 'estado');
			const ronda = await db('wge_rondas').where({ edicion_id: edicionId, estado: 'abierta' })
				.first('id', 'nombre', 'apertura', 'cierre_programado', 'duracion_minutos');
			const votos = ronda ? await db('wge_votos').where({ acudiente_id: acudienteId, ronda_id: ronda.id }).orderBy('date_created').pluck('fondo_id') : [];
			const fondos = await db('wge_fondos').where({ edicion_id: edicionId, activo: true }).orderBy('orden')
				.select('id', 'nombre', 'riesgo', 'logo', 'a_que_se_dedica', 'por_que_invertir');
			const cerradas = (await db('wge_rondas').where({ edicion_id: edicionId, estado: 'liquidada' }).orderBy('apertura')
				.select('id', 'nombre', 'resultados')).map((r) => ({ ...r, resultados: (deJson(r.resultados) ?? []).map((x) => ({ fondo_id: x.fondo_id, rendimiento: x.rendimiento })) }));
			const { proxima } = ronda ? { proxima: null } : await estadoRondas(db, edicionId);
			ediciones.push({ ...edicion, ronda: ronda ? { ...ronda, mis_votos: votos, votos_por_ronda: VOTOS_POR_RONDA } : null, proxima_ronda: proxima, fondos, rondas: cerradas });
		}
		return { acudiente, ahora: new Date(), hijos, ediciones };
	}));

	/**
	 * POST /wge/acudiente/votar { sesion, ronda_id, fondo_id, quitar }
	 * Cada acudiente tiene VOTOS_POR_RONDA votos por ronda, en empresas distintas. Con quitar=true retira el voto
	 * de esa empresa (para cambiarlo). Solo mientras la ronda esté abierta.
	 */
	router.post('/acudiente/votar', publica(async (req) => {
		const acudienteId = await sesion(req);
		return db.transaction(async (trx) => {
			const ronda = await trx('wge_rondas').where('id', String(req.body?.ronda_id ?? '')).forUpdate().first();
			if (!ronda || ronda.estado !== 'abierta' || (ronda.cierre_programado && new Date(ronda.cierre_programado) <= new Date())) {
				throw new WgeError(409, 'RONDA_CERRADA', 'Esta ronda ya cerró; podrás votar en la siguiente');
			}
			const tieneHijo = await participantesDe(await mismaPersona(acudienteId)).where('p.edicion_id', ronda.edicion_id).first('p.id');
			if (!tieneHijo) throw new WgeError(403, 'SIN_PERMISO', 'No tienes estudiantes en esta edición');
			const fondo = await trx('wge_fondos').where({ id: String(req.body?.fondo_id ?? ''), edicion_id: ronda.edicion_id, activo: true }).first('id', 'nombre');
			if (!fondo) throw new WgeError(404, 'NO_EXISTE', 'La empresa no está disponible');
			const mios = () => trx('wge_votos').where({ acudiente_id: acudienteId, ronda_id: ronda.id });
			const clave = `${acudienteId}:${ronda.id}:${fondo.id}`;
			if (req.body?.quitar === true) {
				await mios().where('fondo_id', fondo.id).delete();
			} else if (!(await mios().where('fondo_id', fondo.id).first('id'))) {
				const usados = Number((await mios().count({ n: '*' }).first())?.n ?? 0);
				if (usados >= VOTOS_POR_RONDA) throw new WgeError(409, 'SIN_VOTOS', `Ya usaste tus ${VOTOS_POR_RONDA} votos de esta ronda; quita uno para votar por otra empresa`);
				await trx('wge_votos').insert({ id: crypto.randomUUID(), acudiente_id: acudienteId, fondo_id: fondo.id, ronda_id: ronda.id, clave_unica: clave, date_created: new Date() });
			}
			const misVotos = await mios().orderBy('date_created').pluck('fondo_id');
			return { ronda_id: ronda.id, fondo: fondo.nombre, mis_votos: misVotos };
		});
	}));

	/** GET /wge/acudiente/logo/:id: logo de una empresa (son ficticias; no necesita sesión). */
	router.get('/acudiente/logo/:id', async (req, res) => {
		try {
			if (!(await db('wge_fondos').where('logo', req.params.id).first('id'))) return res.status(404).end();
			const activos = new services.AssetsService({ schema: await getSchema(), accountability: null });
			const { stream, file } = await activos.getAsset(req.params.id, { transformationParams: { width: 480, height: 480, fit: 'cover', quality: 80 } });
			res.setHeader('Content-Type', file.type ?? 'image/jpeg');
			res.setHeader('Cache-Control', 'public, max-age=86400');
			stream.pipe(res);
		} catch {
			res.status(404).end();
		}
	});
}
