import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correoAsignacion, horarioAviso, URL_APP_COLABORADORES } from '../src/avisos.js';
import { ROLES } from '../src/lib.js';

const edicion = { nombre: 'Will-Go Howard Gardner', edicion_programa: '2', colegio: 'Colegio Bilingüe Howard Gardner', programa: 'Will Go Economy',
	fecha_inicio: '2026-11-28', fecha_fin: '2026-11-29', horario: JSON.stringify([{ dia: 'sabado', inicio: '08:00', fin: '12:00' }, { dia: 'domingo', inicio: '08:00', fin: '12:00' }]) };

test('aviso de equipo en español con rol, fechas, horario y enlace', () => {
	const c = correoAsignacion({ nombre: 'Laura', correo: 'laura@x.co', rol: ROLES.DOCENTE, pais: 'Wonderland', edicion, idioma: 'es' });
	assert.match(c.subject, /Will-Go Howard Gardner/);
	for (const t of ['Hola, Laura', 'Docente', 'Wonderland', '28 de noviembre de 2026', '29 de noviembre de 2026', 'Sábado 08:00–12:00', 'Edición 2', 'laura@x.co', URL_APP_COLABORADORES]) assert.ok(c.html.includes(t), t);
});

test('aviso de banco y de caja en inglés y francés', () => {
	const b = correoAsignacion({ nombre: 'Felipe', correo: 'f@x.co', rol: ROLES.BANCO, encargo: 'banco', pais: 'Neverland', edicion, idioma: 'en' });
	assert.ok(b.html.includes('in charge of the Neverland bank'));
	assert.ok(b.html.includes('November 28, 2026'));
	const c = correoAsignacion({ nombre: 'Ana', correo: 'a@x.co', rol: ROLES.CAJERO, encargo: 'caja', edicion, idioma: 'fr' });
	assert.ok(c.html.includes('caisse GO•STORE'));
	assert.ok(c.html.includes('Caissier'));
	assert.ok(c.html.includes('28 novembre 2026'));
});

test('escapa HTML y tolera datos faltantes', () => {
	const c = correoAsignacion({ nombre: '<script>', correo: 'x@x.co', rol: ROLES.CAJERO, edicion: { nombre: 'E' }, idioma: 'es' });
	assert.ok(!c.html.includes('<script>'));
	assert.ok(c.html.includes('Por definir'));
	assert.equal(horarioAviso(null), null);
	assert.equal(horarioAviso([{ fecha: '2026-12-05', inicio: '09:00', fin: '11:00' }], 'en'), 'December 5, 2026 09:00–11:00');
});
