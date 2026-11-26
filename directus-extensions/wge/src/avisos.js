// Avisos por correo a los colaboradores cuando quedan asignados a una edición (equipo, banco de un país o caja).
import { ROLES, rolesDe } from './lib.js';

/** Dónde entran los colaboradores. */
export const URL_APP_COLABORADORES = 'https://appthinkingmind.com/login-will-go';

const NOMBRE_ROL_AVISO = {
	es: { [ROLES.DOCENTE]: 'Docente', [ROLES.BANCO]: 'Banco', [ROLES.CAJERO]: 'Cajero', [ROLES.ADMIN_WG]: 'Administrativo' },
	en: { [ROLES.DOCENTE]: 'Teacher', [ROLES.BANCO]: 'Bank', [ROLES.CAJERO]: 'Cashier', [ROLES.ADMIN_WG]: 'Administrative staff' },
	fr: { [ROLES.DOCENTE]: 'Enseignant', [ROLES.BANCO]: 'Banque', [ROLES.CAJERO]: 'Caissier', [ROLES.ADMIN_WG]: 'Administratif' },
};

const DIAS_AVISO = {
	es: { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' },
	en: { lunes: 'Monday', martes: 'Tuesday', miercoles: 'Wednesday', jueves: 'Thursday', viernes: 'Friday', sabado: 'Saturday', domingo: 'Sunday' },
	fr: { lunes: 'Lundi', martes: 'Mardi', miercoles: 'Mercredi', jueves: 'Jeudi', viernes: 'Vendredi', sabado: 'Samedi', domingo: 'Dimanche' },
};

const LOCALE_AVISO = { es: 'es-CO', en: 'en-US', fr: 'fr-FR' };

const TEXTOS_AVISO = {
	es: {
		asunto: (ed) => `Quedaste en el equipo de ${ed} · Will-Go Economy`,
		hola: (n) => `Hola, ${n}`,
		intro: { equipo: 'Te agregaron como colaborador de esta edición de Will-Go Economy.', banco: (p) => `Quedaste como <b>responsable del banco de ${p}</b> en esta edición de Will-Go Economy.`, caja: 'Quedaste como <b>encargado de la caja de GO•STORE</b> en esta edición de Will-Go Economy.' },
		edicion: 'Edición', colegio: 'Colegio', programa: 'Programa', rol: 'Tu rol', pais: 'País', inicio: 'Inicio', fin: 'Fin', horario: 'Horario',
		numero: (n) => `Edición ${n}`, sinFecha: 'Por definir', sinHorario: 'Por definir', todosPaises: 'Todos los países',
		entrar: 'Entrar a Will-Go', usuario: (c) => `Tu usuario es <b>${c}</b>. Si es tu primera vez, usa la clave temporal que te entregó el administrativo.`,
		pie: 'Este correo se envió porque te asignaron en Will-Go Economy de Thinking Mind.',
	},
	en: {
		asunto: (ed) => `You're on the team for ${ed} · Will-Go Economy`,
		hola: (n) => `Hi ${n},`,
		intro: { equipo: 'You were added as a staff member of this Will-Go Economy edition.', banco: (p) => `You are now <b>in charge of the ${p} bank</b> in this Will-Go Economy edition.`, caja: 'You are now <b>in charge of the GO•STORE checkout</b> in this Will-Go Economy edition.' },
		edicion: 'Edition', colegio: 'School', programa: 'Program', rol: 'Your role', pais: 'Country', inicio: 'Starts', fin: 'Ends', horario: 'Schedule',
		numero: (n) => `Edition ${n}`, sinFecha: 'To be defined', sinHorario: 'To be defined', todosPaises: 'All countries',
		entrar: 'Go to Will-Go', usuario: (c) => `Your username is <b>${c}</b>. If this is your first time, use the temporary password the administrative staff gave you.`,
		pie: 'You received this email because you were assigned in Will-Go Economy by Thinking Mind.',
	},
	fr: {
		asunto: (ed) => `Vous faites partie de l'équipe de ${ed} · Will-Go Economy`,
		hola: (n) => `Bonjour ${n},`,
		intro: { equipo: 'Vous avez été ajouté comme collaborateur de cette édition de Will-Go Economy.', banco: (p) => `Vous êtes désormais <b>responsable de la banque de ${p}</b> dans cette édition de Will-Go Economy.`, caja: 'Vous êtes désormais <b>responsable de la caisse GO•STORE</b> dans cette édition de Will-Go Economy.' },
		edicion: 'Édition', colegio: 'École', programa: 'Programme', rol: 'Votre rôle', pais: 'Pays', inicio: 'Début', fin: 'Fin', horario: 'Horaire',
		numero: (n) => `Édition ${n}`, sinFecha: 'À définir', sinHorario: 'À définir', todosPaises: 'Tous les pays',
		entrar: 'Accéder à Will-Go', usuario: (c) => `Votre identifiant est <b>${c}</b>. Si c'est votre première connexion, utilisez le mot de passe temporaire remis par l'administration.`,
		pie: "Vous recevez cet e-mail car vous avez été affecté dans Will-Go Economy de Thinking Mind.",
	},
};

const limpiarHtml = (v) => String(v ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
const leerJsonAviso = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

function fechaAviso(valor, idioma) {
	if (!valor) return null;
	const d = new Date(valor);
	if (Number.isNaN(d.getTime())) return null;
	return d.toLocaleDateString(LOCALE_AVISO[idioma], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** «Sábado 08:00–18:00 · Domingo 08:00–18:00» (o fechas exactas). */
export function horarioAviso(horario, idioma = 'es') {
	const lista = leerJsonAviso(horario);
	if (!Array.isArray(lista) || !lista.length) return null;
	return lista.map((h) => {
		const cuando = h.fecha ? fechaAviso(h.fecha, idioma) : (DIAS_AVISO[idioma][String(h.dia ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()] ?? h.dia);
		return `${cuando} ${h.inicio}–${h.fin}`;
	}).join(' · ');
}

/**
 * Asunto y HTML del aviso. `encargo`: 'equipo' (lo agregaron al equipo), 'banco' (responsable del banco de `pais`)
 * o 'caja' (encargado de la caja).
 */
export function correoAsignacion({ nombre, correo, rol, roles = null, encargo = 'equipo', pais = null, edicion, idioma = 'es' }) {
	const l = TEXTOS_AVISO[idioma] ? idioma : 'es';
	const t = TEXTOS_AVISO[l];
	const intro = encargo === 'banco' ? t.intro.banco(limpiarHtml(pais)) : encargo === 'caja' ? t.intro.caja : t.intro.equipo;
	const filas = [
		[t.edicion, `${limpiarHtml(edicion.nombre)}${edicion.edicion_programa ? ` · ${t.numero(limpiarHtml(edicion.edicion_programa))}` : ''}`],
		[t.colegio, limpiarHtml(edicion.colegio) || '—'],
		[t.programa, limpiarHtml(edicion.programa) || '—'],
		// Todos sus roles (quien tiene varios los ve juntos: «Docente · Cajero»)
		[t.rol, (roles?.length ? roles : [rol]).map((r) => NOMBRE_ROL_AVISO[l][r] ?? limpiarHtml(r)).join(' · ')],
		...(encargo === 'banco' || (roles?.length ? roles : [rol]).includes(ROLES.DOCENTE) ? [[t.pais, limpiarHtml(pais) || t.todosPaises]] : []),
		[t.inicio, fechaAviso(edicion.fecha_inicio, l) ?? t.sinFecha],
		[t.fin, fechaAviso(edicion.fecha_fin, l) ?? t.sinFecha],
		[t.horario, horarioAviso(edicion.horario, l) ?? t.sinHorario],
	];
	const tabla = filas.map(([k, v]) => `<tr><td style="padding:8px 12px;color:#6b7280;font-size:14px;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:8px 12px;font-size:14px;color:#111827;font-weight:600">${v}</td></tr>`).join('');
	return {
		subject: t.asunto(String(edicion.nombre ?? '')),
		html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#1f2937">
			<p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:3px;color:#ff6b1a">WILL-GO ECONOMY</p>
			<h2 style="margin:0 0 12px">${t.hola(limpiarHtml(nombre))}</h2>
			<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${intro}</p>
			<table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px">${tabla}</table>
			<p style="margin:24px 0"><a href="${URL_APP_COLABORADORES}" style="background:#ff6b1a;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:10px;display:inline-block">${t.entrar}</a></p>
			<p style="font-size:14px;color:#374151;line-height:1.5">${t.usuario(limpiarHtml(correo))}</p>
			<p style="font-size:12px;color:#9ca3af;margin-top:24px">${t.pie}</p></div>`,
	};
}

/**
 * Envía el aviso a cada colaborador. Nunca hace fallar la operación que lo dispara: si el correo falla, queda en el log.
 * avisos: [{ usuarioId, encargo, paisId }]
 */
export async function enviarAvisos({ db, services, getSchema, env, logger }, edicionId, avisos, idioma = 'es') {
	if (!avisos.length || !services?.MailService) return 0;
	try {
		const edicion = await db('wge_ediciones as e').leftJoin('colegios as c', 'c.id', 'e.colegio_id').leftJoin('Cursos as k', 'k.id', 'e.curso_id')
			.where('e.id', edicionId).first('e.nombre', 'e.edicion_programa', 'e.fecha_inicio', 'e.fecha_fin', 'e.horario', 'c.nombre as colegio', 'k.nombre as programa');
		if (!edicion) return 0;
		const mail = new services.MailService({ schema: await getSchema(), knex: db });
		let enviados = 0;
		for (const a of avisos) {
			try {
				const u = await db('directus_users as u').join('directus_roles as r', 'r.id', 'u.role').where('u.id', a.usuarioId)
					.first('u.email', 'u.first_name', 'u.status', 'r.name as rol', 'u.wge_roles_extra');
				if (!u?.email || u.status !== 'active') continue;
				// País: el del encargo (banco) o el que tenga en el equipo (docente)
				let paisId = a.paisId ?? null;
				if (!paisId && a.encargo !== 'banco') paisId = (await db('wge_equipo').where({ edicion_id: edicionId, usuario_id: a.usuarioId }).first('pais_id'))?.pais_id ?? null;
				const pais = paisId ? (await db('wge_paises').where('id', paisId).first('nombre'))?.nombre : null;
				const contenido = correoAsignacion({ nombre: u.first_name, correo: u.email, rol: u.rol, roles: rolesDe(u.rol, u.wge_roles_extra), encargo: a.encargo, pais, edicion, idioma });
				await mail.send({ to: u.email, ...(env?.EMAIL_FROM ? { from: { name: 'Thinking Mind', address: env.EMAIL_FROM } } : {}), ...contenido });
				enviados++;
			} catch (error) {
				logger?.warn?.(`wge: no se pudo enviar el aviso a ${a.usuarioId}: ${error?.message ?? error}`);
			}
		}
		return enviados;
	} catch (error) {
		logger?.warn?.(`wge: avisos de la edición ${edicionId} no enviados: ${error?.message ?? error}`);
		return 0;
	}
}
