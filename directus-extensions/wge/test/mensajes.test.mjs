import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { idiomaDe, traducirMensaje } from '../src/mensajes.js';
import { correoCodigoAcudiente } from '../src/acudientes.js';

const carpeta = new URL('../src/', import.meta.url);

/** Lee un literal '...' o una plantilla `...` que empieza en `i`; devuelve sus partes fijas y dónde termina. */
function leerLiteral(codigo, i) {
	const comilla = codigo[i];
	if (comilla === "'" || comilla === '"') {
		let texto = '';
		for (let j = i + 1; j < codigo.length; j++) {
			if (codigo[j] === '\\') { texto += codigo[++j]; continue; }
			if (codigo[j] === comilla) return { partes: [texto], fin: j + 1 };
			texto += codigo[j];
		}
	}
	if (comilla === '`') {
		const partes = [''];
		for (let j = i + 1; j < codigo.length; j++) {
			if (codigo[j] === '\\') { partes[partes.length - 1] += codigo[++j]; continue; }
			if (codigo[j] === '`') return { partes, fin: j + 1 };
			if (codigo[j] === '$' && codigo[j + 1] === '{') {
				j = saltarExpresion(codigo, j + 2) - 1; // queda sobre la } de cierre
				partes.push('');
				continue;
			}
			partes[partes.length - 1] += codigo[j];
		}
	}
	return null;
}

/** Desde dentro de un ${, avanza hasta después de su } (respeta llaves, cadenas y plantillas anidadas). */
function saltarExpresion(codigo, i) {
	let nivel = 1;
	for (let j = i; j < codigo.length; j++) {
		const c = codigo[j];
		if (c === "'" || c === '"' || c === '`') { j = leerLiteral(codigo, j).fin - 1; continue; }
		if (c === '{') nivel++;
		if (c === '}' && --nivel === 0) return j + 1;
	}
	throw new Error('Expresión sin cerrar');
}

/** Todos los mensajes de `new WgeError(status, 'CODIGO', mensaje)` en src/*.js, como listas de partes fijas. */
function mensajesDelCodigo() {
	const encontrados = [];
	for (const archivo of readdirSync(carpeta).filter((a) => a.endsWith('.js'))) {
		const codigo = readFileSync(new URL(archivo, carpeta), 'utf8');
		for (const m of codigo.matchAll(/new WgeError\(\s*\d+\s*,\s*'[A-Z_0-9]+'\s*,\s*/g)) {
			const literal = leerLiteral(codigo, m.index + m[0].length);
			assert.ok(literal, `${archivo}: mensaje de WgeError que no es un literal (posición ${m.index})`);
			encontrados.push({ archivo, partes: literal.partes });
		}
	}
	return encontrados;
}

test('mensajes: todos los mensajes de WgeError tienen traducción en inglés y francés', () => {
	const mensajes = mensajesDelCodigo();
	assert.ok(mensajes.length >= 150, `Solo se encontraron ${mensajes.length} mensajes`);
	const faltan = [];
	for (const { archivo, partes } of mensajes) {
		const valores = partes.slice(1).map((_, i) => `VALOR${i + 1}`);
		const es = partes.reduce((texto, parte, i) => texto + (i ? valores[i - 1] : '') + parte, '');
		for (const idioma of ['en', 'fr']) {
			const traducido = traducirMensaje(es, idioma);
			if (traducido === es) { faltan.push(`${archivo} [${idioma}]: ${es}`); continue; }
			assert.doesNotMatch(traducido, /\$\d/, `Quedó un $n sin reemplazar: ${traducido}`);
			for (const v of valores) assert.ok(traducido.includes(v), `Se perdió ${v} en «${traducido}» (de «${es}»)`);
		}
	}
	assert.deepEqual(faltan, [], 'Mensajes sin traducción');
});

test('mensajes: los genéricos de las rutas también se traducen', () => {
	assert.equal(traducirMensaje('Error interno en Will Go Economy', 'en'), 'Internal error in Will Go Economy');
	assert.equal(traducirMensaje('Debes iniciar sesión', 'fr'), 'Vous devez vous connecter');
});

test('mensajes: casos con valores en inglés y francés', () => {
	assert.equal(traducirMensaje('En el banco solo quedan 3 billetes de 10.000', 'en'), 'The bank only has 3 bills of 10.000 left');
	assert.equal(traducirMensaje('En el banco solo quedan 3 billetes de 10.000', 'fr'), 'Il ne reste que 3 billets de 10.000 à la banque');
	// La plantilla más larga gana sobre la más corta
	assert.equal(traducirMensaje('En la caja solo hay 2 billetes de 500 para el vuelto', 'en'), 'The checkout only has 2 bills of 500 for change');
	assert.equal(traducirMensaje('En la caja solo hay 2 billetes de 500', 'en'), 'The checkout only has 2 bills of 500');
	assert.equal(traducirMensaje('El vuelto debe ser 1.500 (marcaste 2.000)', 'fr'), 'La monnaie rendue doit être de 1.500 (vous avez indiqué 2.000)');
	assert.equal(traducirMensaje('Máximo 2 de Gorra W-Funds por estudiante', 'en'), 'Maximum 2 of Gorra W-Funds per student');
	assert.equal(traducirMensaje('El banco de Japón lo maneja Ana Pérez', 'en'), "Japón's bank is managed by Ana Pérez");
	assert.equal(traducirMensaje('Eres docente de Francia; no maneja dinero de este país', 'fr'), "Vous êtes enseignant pour Francia ; vous ne pouvez pas gérer l'argent de ce pays");
	assert.equal(traducirMensaje('El docente es docente de Francia; no maneja dinero de este país', 'en'), 'The teacher is assigned to Francia; they cannot handle money from this country');
	assert.equal(traducirMensaje('Tu usuario no hace parte del equipo de esta edición', 'en'), "You are not part of this edition's team");
	assert.equal(traducirMensaje('La ronda debe durar 10, 15, 20 minutos', 'en'), 'The round must last 10, 15, 20 minutes');
	assert.equal(traducirMensaje('Falta clave_idempotencia', 'fr'), 'Il manque clave_idempotencia');
	assert.equal(traducirMensaje('Falta el precio', 'en'), 'The price is missing');
	// Un valor con $ no se toma como referencia de grupo
	assert.equal(traducirMensaje('No hay suficientes unidades de $2 promo', 'en'), 'Not enough units of $2 promo');
});

test('mensajes: en español y con mensajes desconocidos vuelve igual', () => {
	assert.equal(traducirMensaje('En el banco solo quedan 3 billetes de 10.000', 'es'), 'En el banco solo quedan 3 billetes de 10.000');
	assert.equal(traducirMensaje('Algo que nadie escribió', 'en'), 'Algo que nadie escribió');
	assert.equal(traducirMensaje('Algo que nadie escribió', 'fr'), 'Algo que nadie escribió');
	assert.equal(traducirMensaje('La edición no existe', 'de'), 'La edición no existe');
});

test('mensajes: idioma desde Accept-Language', () => {
	const con = (valor) => ({ headers: valor === undefined ? {} : { 'accept-language': valor } });
	assert.equal(idiomaDe(con(undefined)), 'es');
	assert.equal(idiomaDe({}), 'es');
	assert.equal(idiomaDe(con('en')), 'en');
	assert.equal(idiomaDe(con('fr-FR,fr;q=0.9,en;q=0.8')), 'fr');
	assert.equal(idiomaDe(con('en-US,en;q=0.9,es;q=0.8')), 'en');
	assert.equal(idiomaDe(con('es-CO,es;q=0.9')), 'es');
	assert.equal(idiomaDe(con('de-DE,fr;q=0.7')), 'fr');
	assert.equal(idiomaDe(con('de-DE')), 'es');
	assert.equal(idiomaDe(con('es;q=0.5,en')), 'en');
});

test('mensajes: correo del código del acudiente en cada idioma', () => {
	const datos = { nombre: 'Ana <b>', codigo: '012345', minutos: 10 };
	const es = correoCodigoAcudiente({ ...datos, idioma: 'es' });
	assert.equal(es.subject, 'Tu código de Will-Go: 012345');
	assert.match(es.html, /Hola, Ana b/);
	assert.match(es.html, /Vence en 10 minutos/);
	const en = correoCodigoAcudiente({ ...datos, idioma: 'en' });
	assert.equal(en.subject, 'Your Will-Go code: 012345');
	assert.match(en.html, /expires in 10 minutes/);
	assert.match(en.html, /012345/);
	const fr = correoCodigoAcudiente({ ...datos, idioma: 'fr' });
	assert.equal(fr.subject, 'Votre code Will-Go : 012345');
	assert.match(fr.html, /expire dans 10 minutes/);
	assert.equal(correoCodigoAcudiente({ ...datos, idioma: 'xx' }).subject, es.subject);
});
