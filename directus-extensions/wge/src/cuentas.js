// Cuentas electrónicas de los estudiantes: llave (como la llave Bre-B) y tarjeta débito con QR (sin clave).
// Los billetes que se consignan quedan guardados en el banco; la cuenta es lo que el estudiante tiene «en el banco».
import { WgeError, ROLES, exigirRol, exigirEquipo, exigirResponsableBanco, exigirTexto, billeteraBloqueada, moverSaldo } from './lib.js';
import { DENOMINACIONES, inventarioBanco, totalDelConteo } from './arqueo.js';

/** «Sofía Gómez» → «sofia.gomez» (solo letras a-z y un punto). */
export function baseDeLlave(nombre, apellido) {
	const limpio = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/)[0] ?? '';
	const base = [limpio(nombre), limpio(apellido)].filter(Boolean).join('.').slice(0, 24);
	return base || 'estudiante';
}

/** La primera llave libre: @sofia.gomez, @sofia.gomez2, @sofia.gomez3… */
export function llaveLibre(base, ocupadas) {
	if (!ocupadas.has(`@${base}`)) return `@${base}`;
	for (let i = 2; ; i++) if (!ocupadas.has(`@${base}${i}`)) return `@${base}${i}`;
}

/** Normaliza lo que se escribe o escanea: «Sofia.Gomez», «@sofia.gomez», «WG:@sofia.gomez» → «@sofia.gomez». */
export function normalizarLlave(texto) {
	const t = String(texto ?? '').trim().toLowerCase().replace(/^wg:/, '');
	if (!t) return '';
	return t.startsWith('@') ? t : `@${t}`;
}

/** Da llave a los estudiantes de la edición que todavía no tienen (únicas en toda la plataforma). */
export async function asegurarLlaves(db, edicionId) {
	const sinLlave = await db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
		.where('pa.edicion_id', edicionId).whereNull('pa.llave').select('pa.id', 'e.nombre', 'e.apellido').orderBy('pa.id');
	if (!sinLlave.length) return 0;
	const ocupadas = new Set(await db('wge_participantes').whereNotNull('llave').pluck('llave'));
	for (const p of sinLlave) {
		const llave = llaveLibre(baseDeLlave(p.nombre, p.apellido), ocupadas);
		ocupadas.add(llave);
		await db('wge_participantes').where({ id: p.id }).whereNull('llave').update({ llave });
	}
	return sinLlave.length;
}

/** Participante por su llave (o el texto del QR), con su país y estado de la tarjeta. */
export async function participantePorLlave(db, texto) {
	const llave = normalizarLlave(texto);
	if (!llave) throw new WgeError(400, 'VALOR_INVALIDO', 'Escribe o escanea la llave');
	const p = await db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id').leftJoin('wge_paises as ps', 'ps.id', 'pa.pais_id')
		.where('pa.llave', llave).first('pa.id', 'pa.edicion_id', 'pa.pais_id', 'pa.retirado', 'pa.llave', 'e.nombre', 'e.apellido', 'ps.nombre as pais', 'ps.codigo_moneda');
	if (!p) throw new WgeError(404, 'LLAVE_NO_EXISTE', `No hay ninguna cuenta con la llave ${llave}`);
	if (p.retirado) throw new WgeError(409, 'RETIRADO', 'El estudiante fue retirado de la edición');
	if (!p.pais_id) throw new WgeError(409, 'SIN_PAIS', 'El participante no tiene país asignado');
	return p;
}

const saldoDe = async (db, where) => Number((await db('wge_billeteras').where(where).first('saldo'))?.saldo ?? 0);

export function rutasCuentas(router, { ruta, db, unaSolaVez }) {
	/** El banco solo atiende las cuentas de los países que maneja. */
	const permitirBanco = async (trxODb, req, rol, participante) => {
		exigirRol(rol, ROLES.BANCO, ROLES.ADMIN_WG);
		await exigirEquipo(trxODb, { edicionId: participante.edicion_id, usuarioId: req.accountability.user, rol });
		await exigirResponsableBanco(trxODb, { paisId: participante.pais_id, usuarioId: req.accountability.user, rol });
	};
	const participanteActivo = async (trxODb, id) => {
		const p = await trxODb('wge_participantes').where('id', id).first();
		if (!p) throw new WgeError(404, 'NO_EXISTE', 'El participante no existe');
		if (p.retirado) throw new WgeError(409, 'RETIRADO', 'El estudiante fue retirado de la edición');
		if (!p.pais_id) throw new WgeError(409, 'SIN_PAIS', 'El participante no tiene país asignado');
		return p;
	};
	const edicionAbiertaCuentas = async (trx, id) => {
		const e = await trx('wge_ediciones').where('id', id).first('id', 'estado');
		if (e?.estado !== 'abierta') throw new WgeError(409, 'EDICION_CERRADA', 'La edición no está abierta');
	};

	/**
	 * GET /wge/ediciones/:id/cuentas: por cada país que maneja el banco, sus estudiantes con efectivo, cuenta,
	 * llave y estado de la tarjeta; sus docentes con billetes y cuenta; y los billetes del banco (para retiros).
	 */
	router.get('/ediciones/:id/cuentas', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.BANCO, ROLES.ADMIN_WG);
		const edicion = await db('wge_ediciones').where('id', req.params.id).first('id', 'nombre', 'estado');
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		await exigirEquipo(db, { edicionId: edicion.id, usuarioId: req.accountability.user, rol });
		await asegurarLlaves(db, edicion.id);
		const consulta = db('wge_paises').where('edicion_id', edicion.id).orderBy('orden').select('id', 'nombre', 'codigo_moneda', 'color');
		if (rol !== ROLES.ADMIN && rol !== ROLES.ADMIN_WG) consulta.where('responsable_banco', req.accountability.user);
		const paises = await consulta;
		for (const p of paises) {
			p.inventario = await inventarioBanco(db, edicion.id, p.id);
			p.estudiantes = await db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id')
				.leftJoin('wge_billeteras as b', function () { this.on('b.participante_id', 'pa.id').andOn('b.pais_id', 'pa.pais_id').andOnVal('b.tipo_dueno', 'estudiante'); })
				.leftJoin('wge_billeteras as c', function () { this.on('c.participante_id', 'pa.id').andOn('c.pais_id', 'pa.pais_id').andOnVal('c.tipo_dueno', 'cuenta'); })
				.where({ 'pa.edicion_id': edicion.id, 'pa.pais_id': p.id }).whereRaw('coalesce(pa.retirado, false) = false')
				.select('pa.id', 'e.nombre', 'e.apellido', 'pa.llave',
					db.raw('coalesce(b.saldo, 0)::int as efectivo'), db.raw('coalesce(c.saldo, 0)::int as cuenta'))
				.orderBy([{ column: 'e.nombre' }, { column: 'e.apellido' }]);
			p.en_cuentas = p.estudiantes.reduce((t, e) => t + e.cuenta, 0);
		}
		return { edicion, denominaciones: DENOMINACIONES, paises };
	}));

	/** GET /wge/ediciones/:id/tarjetas: tarjetas para imprimir (nombre, país, color y llave) de los países que maneja. */
	router.get('/ediciones/:id/tarjetas', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.BANCO, ROLES.ADMIN_WG);
		const edicion = await db('wge_ediciones').where('id', req.params.id).first('id', 'nombre');
		if (!edicion) throw new WgeError(404, 'NO_EXISTE', 'La edición no existe');
		await exigirEquipo(db, { edicionId: edicion.id, usuarioId: req.accountability.user, rol });
		await asegurarLlaves(db, edicion.id);
		const q = db('wge_participantes as pa').join('estudiantes as e', 'e.id', 'pa.estudiante_id').join('wge_paises as ps', 'ps.id', 'pa.pais_id')
			.where('pa.edicion_id', edicion.id).whereRaw('coalesce(pa.retirado, false) = false')
			.select('pa.id', 'e.nombre', 'e.apellido', 'pa.llave', 'ps.id as pais_id', 'ps.nombre as pais', 'ps.color', 'ps.codigo_moneda')
			.orderBy([{ column: 'ps.orden' }, { column: 'e.nombre' }, { column: 'e.apellido' }]);
		if (rol !== ROLES.ADMIN && rol !== ROLES.ADMIN_WG) q.where('ps.responsable_banco', req.accountability.user);
		return { edicion, tarjetas: await q };
	}));

	/**
	 * GET /wge/cuentas/llave/:llave: a quién pertenece una llave (para transferir o cobrar con tarjeta).
	 * Lo usan banco, docentes y caja de la misma edición.
	 */
	router.get('/cuentas/llave/:llave', ruta(async (req, rol) => {
		exigirRol(rol, ROLES.BANCO, ROLES.DOCENTE, ROLES.CAJERO, ROLES.ADMIN_WG);
		const p = await participantePorLlave(db, req.params.llave);
		await exigirEquipo(db, { edicionId: p.edicion_id, usuarioId: req.accountability.user, rol });
		return {
			participante_id: p.id, llave: p.llave, nombre: p.nombre, apellido: p.apellido, pais_id: p.pais_id, pais: p.pais,
			codigo_moneda: p.codigo_moneda, edicion_id: p.edicion_id,
		};
	}));

	/** POST /wge/cuentas/consignar { participante_id, billetes, clave_idempotencia }: billetes del estudiante → su cuenta. */
	router.post('/cuentas/consignar', ruta(async (req, rol) => {
		const { limpio, total } = totalDelConteo(req.body?.billetes);
		if (!total) throw new WgeError(400, 'VALOR_INVALIDO', 'Elige los billetes que consigna el estudiante');
		const clave = exigirTexto(req.body?.clave_idempotencia, 'clave_idempotencia');
		const actor = req.accountability.user;
		return unaSolaVez('wge_transferencias', clave, async (trx) => {
			const p = await participanteActivo(trx, exigirTexto(req.body?.participante_id, 'participante_id'));
			await permitirBanco(trx, req, rol, p);
			await edicionAbiertaCuentas(trx, p.edicion_id);
			const efectivo = await billeteraBloqueada(trx, { edicionId: p.edicion_id, paisId: p.pais_id, tipo: 'estudiante', participanteId: p.id });
			const cuenta = await billeteraBloqueada(trx, { edicionId: p.edicion_id, paisId: p.pais_id, tipo: 'cuenta', participanteId: p.id });
			const id = crypto.randomUUID();
			await moverSaldo(trx, efectivo, { tipo: 'consignacion', monto: -total, actor, referenciaTipo: 'transferencia', referenciaId: id });
			await moverSaldo(trx, cuenta, { tipo: 'consignacion', monto: total, actor, referenciaTipo: 'transferencia', referenciaId: id });
			const fila = {
				id, edicion_id: p.edicion_id, pais_id: p.pais_id, billetera_origen_id: efectivo.id, billetera_destino_id: cuenta.id,
				monto: total, estado: 'aplicada', clave_idempotencia: clave, billetes: JSON.stringify(limpio), date_created: new Date(), user_created: actor,
			};
			await trx('wge_transferencias').insert(fila);
			return { ...fila, efectivo: efectivo.saldo, cuenta: cuenta.saldo };
		});
	}));

	/** POST /wge/cuentas/retirar { participante_id, billetes, clave_idempotencia }: de la cuenta → billetes en mano. */
	router.post('/cuentas/retirar', ruta(async (req, rol) => {
		const { limpio, total } = totalDelConteo(req.body?.billetes);
		if (!total) throw new WgeError(400, 'VALOR_INVALIDO', 'Elige los billetes que le entregas al estudiante');
		const clave = exigirTexto(req.body?.clave_idempotencia, 'clave_idempotencia');
		const actor = req.accountability.user;
		const previo = await participanteActivo(db, exigirTexto(req.body?.participante_id, 'participante_id'));
		await permitirBanco(db, req, rol, previo);
		return unaSolaVez('wge_transferencias', clave, async (trx) => {
			const p = await participanteActivo(trx, previo.id);
			await edicionAbiertaCuentas(trx, p.edicion_id);
			const cuenta = await billeteraBloqueada(trx, { edicionId: p.edicion_id, paisId: p.pais_id, tipo: 'cuenta', participanteId: p.id });
			if (Number(cuenta.saldo) < total) throw new WgeError(409, 'SALDO_INSUFICIENTE', `En su cuenta solo hay ${cuenta.saldo}`);
			const quedan = await inventarioBanco(trx, p.edicion_id, p.pais_id);
			for (const [d, n] of Object.entries(limpio)) {
				if (n > quedan[d]) throw new WgeError(409, 'SIN_BILLETES', `En el banco solo quedan ${Math.max(quedan[d], 0)} billetes de ${Number(d).toLocaleString('es-CO')}`);
			}
			const efectivo = await billeteraBloqueada(trx, { edicionId: p.edicion_id, paisId: p.pais_id, tipo: 'estudiante', participanteId: p.id });
			const id = crypto.randomUUID();
			await moverSaldo(trx, cuenta, { tipo: 'retiro_cuenta', monto: -total, actor, referenciaTipo: 'transferencia', referenciaId: id });
			await moverSaldo(trx, efectivo, { tipo: 'retiro_cuenta', monto: total, actor, referenciaTipo: 'transferencia', referenciaId: id });
			const fila = {
				id, edicion_id: p.edicion_id, pais_id: p.pais_id, billetera_origen_id: cuenta.id, billetera_destino_id: efectivo.id,
				monto: total, estado: 'aplicada', clave_idempotencia: clave, billetes: JSON.stringify(limpio), date_created: new Date(), user_created: actor,
			};
			await trx('wge_transferencias').insert(fila);
			return { ...fila, efectivo: efectivo.saldo, cuenta: cuenta.saldo };
		});
	}));

	return { saldoDe };
}
