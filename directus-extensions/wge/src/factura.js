// Factura de GO•STORE: cuando un estudiante compra, a su acudiente le llega un correo con la factura en PDF.
// El PDF se arma a mano (texto, líneas y rectángulos con Helvetica), sin dependencias.
import { REMITENTE_CORREOS } from './acudientes.js';

const TEXTOS_FACTURA = {
	es: {
		asunto: (n, recibo) => `Factura de compra en GO•STORE · ${n} · ${recibo}`,
		titulo: 'Factura de compra', tienda: 'GO•STORE · Will-Go Economy', numero: 'Factura N.º', fecha: 'Fecha',
		estudiante: 'Estudiante', acudiente: 'Acudiente', colegio: 'Colegio', edicion: 'Edición', pais: 'País',
		metodo: 'Forma de pago', efectivo: 'Efectivo', tarjeta: 'Tarjeta débito', atendio: 'Atendió',
		producto: 'Producto', cantidad: 'Cant.', unitario: 'Precio', subtotal: 'Subtotal', total: 'Total',
		recibido: 'Recibido', vuelto: 'Vuelto',
		nota: (m) => `Valores en ${m}, la moneda del país en Will-Go Economy (dinero del programa, sin valor comercial).`,
		hola: (n) => `Hola, ${n}`,
		cuerpo: (est) => `<b>${est}</b> hizo una compra en GO•STORE de Will-Go Economy. Te adjuntamos la factura en PDF.`,
		pie: 'Recibes este correo porque eres el acudiente registrado del estudiante en Thinking Mind.',
		archivo: 'factura',
	},
	en: {
		asunto: (n, recibo) => `GO•STORE purchase invoice · ${n} · ${recibo}`,
		titulo: 'Purchase invoice', tienda: 'GO•STORE · Will-Go Economy', numero: 'Invoice No.', fecha: 'Date',
		estudiante: 'Student', acudiente: 'Parent/guardian', colegio: 'School', edicion: 'Edition', pais: 'Country',
		metodo: 'Payment', efectivo: 'Cash', tarjeta: 'Debit card', atendio: 'Served by',
		producto: 'Product', cantidad: 'Qty', unitario: 'Price', subtotal: 'Subtotal', total: 'Total',
		recibido: 'Received', vuelto: 'Change',
		nota: (m) => `Amounts in ${m}, the country currency in Will-Go Economy (program money, no commercial value).`,
		hola: (n) => `Hi ${n},`,
		cuerpo: (est) => `<b>${est}</b> made a purchase at the Will-Go Economy GO•STORE. The PDF invoice is attached.`,
		pie: "You receive this email because you are the student's registered parent/guardian at Thinking Mind.",
		archivo: 'invoice',
	},
	fr: {
		asunto: (n, recibo) => `Facture d'achat GO•STORE · ${n} · ${recibo}`,
		titulo: "Facture d'achat", tienda: 'GO•STORE · Will-Go Economy', numero: 'Facture n°', fecha: 'Date',
		estudiante: 'Élève', acudiente: 'Responsable', colegio: 'École', edicion: 'Édition', pais: 'Pays',
		metodo: 'Paiement', efectivo: 'Espèces', tarjeta: 'Carte de débit', atendio: 'Servi par',
		producto: 'Produit', cantidad: 'Qté', unitario: 'Prix', subtotal: 'Sous-total', total: 'Total',
		recibido: 'Reçu', vuelto: 'Monnaie',
		nota: (m) => `Montants en ${m}, la monnaie du pays dans Will-Go Economy (argent du programme, sans valeur commerciale).`,
		hola: (n) => `Bonjour ${n},`,
		cuerpo: (est) => `<b>${est}</b> a fait un achat à la GO•STORE de Will-Go Economy. La facture PDF est jointe.`,
		pie: "Vous recevez cet e-mail car vous êtes le responsable enregistré de l'élève chez Thinking Mind.",
		archivo: 'facture',
	},
};
const LOCALE_FACTURA = { es: 'es-CO', en: 'en-US', fr: 'fr-FR' };

// Anchos de Helvetica (1/1000 del tamaño) para alinear a la derecha y recortar textos largos
const ANCHOS_HELVETICA = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
	278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
	667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722,
	500, 500, 500, 334, 260, 334, 584];
function anchoTexto(texto, tam, negrita = false) {
	let w = 0;
	for (const c of String(texto)) {
		const code = c.codePointAt(0);
		w += code >= 32 && code <= 126 ? ANCHOS_HELVETICA[code - 32] : 556;
	}
	return (w * tam * (negrita ? 1.05 : 1)) / 1000;
}
function recortar(texto, tam, max, negrita = false) {
	let t = String(texto ?? '');
	if (anchoTexto(t, tam, negrita) <= max) return t;
	while (t.length > 1 && anchoTexto(`${t}…`, tam, negrita) > max) t = t.slice(0, -1);
	return `${t.trimEnd()}…`;
}

// Texto a bytes WinAnsi (lo que entiende Helvetica estándar): tildes, ñ, ¿, •, €…
const WINANSI = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99 };
function textoPdf(texto) {
	let s = '';
	for (const c of String(texto ?? '')) {
		const code = c.codePointAt(0);
		const b = WINANSI[c] ?? (code < 256 ? code : 0x3f);
		s += b === 0x28 || b === 0x29 || b === 0x5c ? `\\${String.fromCharCode(b)}` : String.fromCharCode(b);
	}
	return `(${s})`;
}

const numero = (v, idioma) => Number(v ?? 0).toLocaleString(LOCALE_FACTURA[idioma] ?? 'es-CO');

/**
 * Arma el PDF de la factura (carta, una página; si hay muchos productos sigue en otra).
 * `datos`: { recibo, fecha, estudiante, acudiente, colegio, edicion, pais, moneda, metodo, cajero, items: [{ nombre, cantidad, precio }], total, recibido, vuelto }
 */
export function pdfFactura(datos, idioma = 'es') {
	const t = TEXTOS_FACTURA[idioma] ?? TEXTOS_FACTURA.es;
	const ANCHO = 612, ALTO = 792, M = 48;
	const paginas = [];
	let ops = [];
	let y = ALTO - M;
	const color = (r, g, b) => `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;
	const texto = (x, yy, s, { tam = 10, negrita = false, rgb = [31, 41, 55], derecha = false } = {}) => {
		const xx = derecha ? x - anchoTexto(s, tam, negrita) : x;
		ops.push(`BT /${negrita ? 'F2' : 'F1'} ${tam} Tf ${color(...rgb)} rg ${xx.toFixed(1)} ${yy.toFixed(1)} Td ${textoPdf(s)} Tj ET`);
	};
	const rect = (x, yy, w, h, rgb) => ops.push(`${color(...rgb)} rg ${x} ${yy} ${w} ${h} re f`);
	const linea = (x1, yy, x2, rgb = [229, 231, 235]) => ops.push(`${color(...rgb)} RG 0.8 w ${x1} ${yy} m ${x2} ${yy} l S`);
	const nuevaPagina = () => { paginas.push(ops.join('\n')); ops = []; y = ALTO - M; };

	// Encabezado
	rect(0, ALTO - 110, ANCHO, 110, [30, 41, 59]);
	texto(M, ALTO - 52, 'Thinking Mind', { tam: 20, negrita: true, rgb: [255, 255, 255] });
	texto(M, ALTO - 74, t.tienda, { tam: 11, rgb: [251, 146, 60] });
	texto(ANCHO - M, ALTO - 52, t.titulo, { tam: 16, negrita: true, rgb: [255, 255, 255], derecha: true });
	texto(ANCHO - M, ALTO - 74, `${t.numero} ${datos.recibo}`, { tam: 10, rgb: [203, 213, 225], derecha: true });
	texto(ANCHO - M, ALTO - 90, `${t.fecha}: ${datos.fecha}`, { tam: 10, rgb: [203, 213, 225], derecha: true });
	y = ALTO - 140;

	// Datos de la compra, en dos columnas
	const filas = [
		[t.estudiante, datos.estudiante], [t.acudiente, datos.acudiente],
		[t.colegio, datos.colegio], [t.edicion, datos.edicion],
		[t.pais, datos.pais], [t.metodo, datos.metodo === 'tarjeta' ? t.tarjeta : t.efectivo],
		[t.atendio, datos.cajero],
	].filter(([, v]) => v);
	const colW = (ANCHO - 2 * M) / 2;
	filas.forEach(([k, v], i) => {
		const x = M + (i % 2) * colW;
		const yy = y - Math.floor(i / 2) * 34;
		texto(x, yy, k.toUpperCase(), { tam: 8, negrita: true, rgb: [107, 114, 128] });
		texto(x, yy - 14, recortar(v, 11, colW - 12), { tam: 11 });
	});
	y -= Math.ceil(filas.length / 2) * 34 + 16;

	// Tabla de productos
	const cX = { producto: M + 10, cantidad: M + 320, precio: M + 410, subtotal: ANCHO - M - 10 };
	const encabezado = () => {
		rect(M, y - 8, ANCHO - 2 * M, 24, [243, 244, 246]);
		texto(cX.producto, y, t.producto, { tam: 9, negrita: true, rgb: [55, 65, 81] });
		texto(cX.cantidad, y, t.cantidad, { tam: 9, negrita: true, rgb: [55, 65, 81], derecha: true });
		texto(cX.precio, y, t.unitario, { tam: 9, negrita: true, rgb: [55, 65, 81], derecha: true });
		texto(cX.subtotal, y, t.subtotal, { tam: 9, negrita: true, rgb: [55, 65, 81], derecha: true });
		y -= 28;
	};
	encabezado();
	for (const it of datos.items) {
		if (y < M + 120) { nuevaPagina(); encabezado(); }
		texto(cX.producto, y, recortar(it.nombre, 10, cX.cantidad - cX.producto - 40), { tam: 10 });
		texto(cX.cantidad, y, numero(it.cantidad, idioma), { tam: 10, derecha: true });
		texto(cX.precio, y, numero(it.precio, idioma), { tam: 10, derecha: true });
		texto(cX.subtotal, y, numero(it.precio * it.cantidad, idioma), { tam: 10, derecha: true });
		linea(M, y - 9, ANCHO - M);
		y -= 24;
	}

	// Totales
	y -= 6;
	const moneda = datos.moneda ? ` ${datos.moneda}` : '';
	rect(ANCHO - M - 220, y - 12, 220, 30, [255, 237, 213]);
	texto(ANCHO - M - 210, y, t.total, { tam: 12, negrita: true, rgb: [154, 52, 18] });
	texto(cX.subtotal, y, `${numero(datos.total, idioma)}${moneda}`, { tam: 13, negrita: true, rgb: [154, 52, 18], derecha: true });
	y -= 30;
	if (datos.metodo !== 'tarjeta' && datos.recibido) {
		texto(ANCHO - M - 210, y, t.recibido, { tam: 10, rgb: [75, 85, 99] });
		texto(cX.subtotal, y, `${numero(datos.recibido, idioma)}${moneda}`, { tam: 10, rgb: [75, 85, 99], derecha: true });
		y -= 16;
		texto(ANCHO - M - 210, y, t.vuelto, { tam: 10, rgb: [75, 85, 99] });
		texto(cX.subtotal, y, `${numero(datos.vuelto, idioma)}${moneda}`, { tam: 10, rgb: [75, 85, 99], derecha: true });
		y -= 16;
	}

	// Nota al pie
	linea(M, M + 30, ANCHO - M);
	texto(M, M + 14, recortar(t.nota(datos.moneda || datos.pais || ''), 8, ANCHO - 2 * M), { tam: 8, rgb: [107, 114, 128] });
	paginas.push(ops.join('\n'));

	// Ensamblar el PDF: catálogo, páginas, fuentes y un contenido por página
	const objetos = [];
	const nPag = paginas.length;
	const idPagina = (i) => 5 + i * 2;
	objetos[1] = '<< /Type /Catalog /Pages 2 0 R >>';
	objetos[2] = `<< /Type /Pages /Kids [${paginas.map((_, i) => `${idPagina(i)} 0 R`).join(' ')}] /Count ${nPag} >>`;
	objetos[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
	objetos[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
	paginas.forEach((contenido, i) => {
		objetos[idPagina(i)] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${idPagina(i) + 1} 0 R >>`;
		objetos[idPagina(i) + 1] = `<< /Length ${Buffer.byteLength(contenido, 'latin1')} >>\nstream\n${contenido}\nendstream`;
	});
	let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
	const desplazamientos = [];
	for (let i = 1; i < objetos.length; i++) {
		desplazamientos[i] = Buffer.byteLength(pdf, 'latin1');
		pdf += `${i} 0 obj\n${objetos[i]}\nendobj\n`;
	}
	const xref = Buffer.byteLength(pdf, 'latin1');
	pdf += `xref\n0 ${objetos.length}\n0000000000 65535 f \n${desplazamientos.slice(1).map((d) => `${String(d).padStart(10, '0')} 00000 n \n`).join('')}`;
	pdf += `trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return Buffer.from(pdf, 'latin1');
}

const escaparHtml = (v) => String(v ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

/** Asunto y cuerpo del correo de la factura. */
export function correoFactura({ acudiente, estudiante, recibo, total, moneda, idioma = 'es' }) {
	const t = TEXTOS_FACTURA[idioma] ?? TEXTOS_FACTURA.es;
	return {
		subject: t.asunto(estudiante, recibo),
		html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f2937">
			<h2 style="color:#1e293b;margin-bottom:4px">${escaparHtml(t.hola(acudiente))}</h2>
			<p>${t.cuerpo(escaparHtml(estudiante))}</p>
			<p style="font-size:14px;color:#374151">${escaparHtml(t.numero)} <b>${escaparHtml(recibo)}</b> · ${escaparHtml(t.total)}: <b>${escaparHtml(numero(total, idioma))} ${escaparHtml(moneda ?? '')}</b></p>
			<p style="color:#6b7280;font-size:12px;margin-top:24px">${escaparHtml(t.pie)}</p></div>`,
	};
}

/**
 * Envía la factura de una venta al acudiente (o acudientes) del estudiante. Nunca hace fallar la venta:
 * si no hay correo o el envío falla, solo queda en el log.
 */
export async function enviarFactura({ db, services, getSchema, logger, env }, venta, idioma = 'es') {
	try {
		const datos = await db('wge_participantes as p').join('estudiantes as e', 'e.id', 'p.estudiante_id')
			.join('wge_ediciones as ed', 'ed.id', 'p.edicion_id').leftJoin('colegios as co', 'co.id', 'ed.colegio_id')
			.where('p.id', venta.participante_id)
			.first('e.id as estudiante_id', 'e.nombre', 'e.apellido', 'e.acudiente', 'ed.nombre as edicion', 'co.nombre as colegio');
		if (!datos) return;
		const pais = venta.pais_id ? await db('wge_paises').where('id', venta.pais_id).first('nombre', 'codigo_moneda') : null;
		Object.assign(datos, { pais: pais?.nombre ?? null, moneda: pais?.codigo_moneda ?? null });
		// Acudientes: el de la ficha del estudiante y quien lo inscribió y pagó
		const ids = new Set([datos.acudiente].filter(Boolean));
		for (const id of await db('cuentas_cobrar').where('estudiante_id', datos.estudiante_id).whereNotNull('cliente_id').distinct().pluck('cliente_id')) ids.add(id);
		if (!ids.size) return;
		const acudientes = (await db('clientes').whereIn('id', [...ids]).select('nombre', 'apellido', 'email'))
			.filter((c) => /\S+@\S+\.\S+/.test(c.email ?? ''));
		const porCorreo = new Map(acudientes.map((c) => [c.email.trim().toLowerCase(), c]));
		if (!porCorreo.size) return;
		const cajero = venta.user_created ? await db('directus_users').where('id', venta.user_created).first('first_name', 'last_name') : null;
		const estudiante = `${datos.nombre ?? ''} ${datos.apellido ?? ''}`.trim();
		const fecha = new Date(venta.date_created ?? Date.now()).toLocaleString(LOCALE_FACTURA[idioma] ?? 'es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });
		const correo = new services.MailService({ schema: await getSchema(), knex: db });
		for (const [email, c] of porCorreo) {
			const acudiente = `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim();
			const pdf = pdfFactura({
				recibo: venta.numero_recibo, fecha, estudiante, acudiente, colegio: datos.colegio, edicion: datos.edicion,
				pais: datos.pais, moneda: datos.moneda, metodo: venta.metodo_pago, cajero: cajero ? `${cajero.first_name ?? ''} ${cajero.last_name ?? ''}`.trim() : '',
				items: venta.items.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio_billetes })),
				total: venta.total_billetes, recibido: venta.recibido, vuelto: venta.vuelto,
			}, idioma);
			await correo.send({
				to: email,
				...(env?.EMAIL_FROM ? { from: { name: REMITENTE_CORREOS, address: env.EMAIL_FROM } } : {}),
				...correoFactura({ acudiente: c.nombre || acudiente, estudiante, recibo: venta.numero_recibo, total: venta.total_billetes, moneda: datos.moneda, idioma }),
				attachments: [{ filename: `${(TEXTOS_FACTURA[idioma] ?? TEXTOS_FACTURA.es).archivo}-${venta.numero_recibo}.pdf`, content: pdf, contentType: 'application/pdf' }],
			});
		}
	} catch (error) {
		logger?.warn?.(error, 'wge: no se pudo enviar la factura');
	}
}
