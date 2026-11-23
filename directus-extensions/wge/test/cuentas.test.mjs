import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseDeLlave, llaveLibre, normalizarLlave } from '../src/cuentas.js';

test('llave: nombre y primer apellido, sin tildes ni espacios', () => {
	assert.equal(baseDeLlave('Sofía', 'Gómez Restrepo'), 'sofia.gomez');
	assert.equal(baseDeLlave('María José', 'Peña'), 'maria.pena');
	assert.equal(baseDeLlave('', ''), 'estudiante');
});

test('llave: única, con número si ya existe', () => {
	assert.equal(llaveLibre('sofia.gomez', new Set()), '@sofia.gomez');
	assert.equal(llaveLibre('sofia.gomez', new Set(['@sofia.gomez'])), '@sofia.gomez2');
	assert.equal(llaveLibre('sofia.gomez', new Set(['@sofia.gomez', '@sofia.gomez2'])), '@sofia.gomez3');
});

test('llave: lo que se escribe o escanea se normaliza', () => {
	assert.equal(normalizarLlave(' Sofia.Gomez '), '@sofia.gomez');
	assert.equal(normalizarLlave('@sofia.gomez2'), '@sofia.gomez2');
	assert.equal(normalizarLlave('WG:@sofia.gomez'), '@sofia.gomez');
	assert.equal(normalizarLlave(''), '');
});
