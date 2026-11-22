import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarCalificacion, resumenCalificaciones } from '../src/rubrica.js';

test('rúbrica: cada criterio es Sí/No y el puntaje va de 0 a 4', () => {
	assert.deepEqual(armarCalificacion({ uso_lengua: 1, iniciativa: 0, nivel_reto: true, colaboracion: false, idioma: 'ingles' }),
		{ uso_lengua: 1, iniciativa: 0, nivel_reto: 1, colaboracion: 0, puntaje: 2, idioma: 'ingles' });
	assert.equal(armarCalificacion({ uso_lengua: 1, iniciativa: 1, nivel_reto: 1, colaboracion: 1 }).puntaje, 4);
	assert.throws(() => armarCalificacion({ uso_lengua: 2, iniciativa: 0, nivel_reto: 0, colaboracion: 0 }), /Sí o No/);
	assert.throws(() => armarCalificacion({ uso_lengua: 1, iniciativa: 0, nivel_reto: 0 }), /Sí o No/);
	assert.throws(() => armarCalificacion({ uso_lengua: 1, iniciativa: 0, nivel_reto: 0, colaboracion: 0, idioma: 'aleman' }), /idioma/);
});

test('rúbrica: resumen para el acudiente', () => {
	const r = resumenCalificaciones([
		{ uso_lengua: 1, iniciativa: 1, nivel_reto: 0, colaboracion: 1, date_created: '2026-11-28T14:00:00Z' },
		{ uso_lengua: 1, iniciativa: 0, nivel_reto: 0, colaboracion: 1, date_created: '2026-11-28T15:00:00Z' },
	]);
	assert.deepEqual(r, { total: 2, criterios: { uso_lengua: 100, iniciativa: 50, nivel_reto: 0, colaboracion: 100 }, ultima: '2026-11-28T15:00:00Z' });
	assert.deepEqual(resumenCalificaciones([]), { total: 0, criterios: { uso_lengua: 0, iniciativa: 0, nivel_reto: 0, colaboracion: 0 }, ultima: null });
});
