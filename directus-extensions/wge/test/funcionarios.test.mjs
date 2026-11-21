import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claveTemporal, validarClave } from '../src/funcionarios.js';

test('clave temporal: formato fácil de dictar y distinta cada vez', () => {
	const claves = new Set(Array.from({ length: 200 }, claveTemporal));
	assert.equal(claves.size, 200);
	for (const c of claves) assert.match(c, /^[A-HJ-NP-Za-hj-np-z]{4}-[2-9]{4}$/);
});
test('clave definitiva: mínimo 8, con letras y números', () => {
	assert.equal(validarClave('WillGo2026'), 'WillGo2026');
	for (const c of ['corta1', 'solotexto', '12345678', null]) assert.throws(() => validarClave(c));
});
