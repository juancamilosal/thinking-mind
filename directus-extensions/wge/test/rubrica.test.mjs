import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarCalificacion, resumenCalificaciones, recompensaSugerida, puntosDeInmersion } from '../src/rubrica.js';

test('rúbrica: cada criterio de 0 a 3 (los 4 obligatorios) y puntaje de 0 a 12', () => {
	assert.deepEqual(armarCalificacion({ uso_lengua: 3, iniciativa: 2, nivel_reto: 0, colaboracion: 1, idioma: 'frances', evidencia: '  Presentó su producto  ' }),
		{ uso_lengua: 3, iniciativa: 2, nivel_reto: 0, colaboracion: 1, puntaje: 6, idioma: 'frances', evidencia: 'Presentó su producto' });
	assert.equal(armarCalificacion({ uso_lengua: 3, iniciativa: 3, nivel_reto: 3, colaboracion: 3 }).puntaje, 12);
	assert.equal(armarCalificacion({ uso_lengua: 0, iniciativa: 0, nivel_reto: 0, colaboracion: 0, evidencia: '   ' }).evidencia, null);
	assert.throws(() => armarCalificacion({ uso_lengua: 4, iniciativa: 0, nivel_reto: 0, colaboracion: 0 }), /0 a 3/);
	assert.throws(() => armarCalificacion({ uso_lengua: 1, iniciativa: 0, nivel_reto: 0 }), /0 a 3/);
	assert.throws(() => armarCalificacion({ uso_lengua: true, iniciativa: 0, nivel_reto: 0, colaboracion: 0 }), /0 a 3/);
	assert.throws(() => armarCalificacion({ uso_lengua: 1, iniciativa: 0, nivel_reto: 0, colaboracion: 0, idioma: 'aleman' }), /idioma/);
});

test('rúbrica: recompensa recomendada y puntos para el tipo de cambio (Especificación Maestra)', () => {
	assert.deepEqual([0, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(recompensaSugerida), [0, 0, 2, 2, 5, 5, 10, 10, 20, 20]);
	assert.equal(puntosDeInmersion(6), 2); // nivel promedio 1,5 = la meta (B = 2): la tasa no se mueve
	assert.equal(puntosDeInmersion(12), 4);
});

test('rúbrica: resumen para el acudiente con el nivel promedio de cada criterio', () => {
	const r = resumenCalificaciones([
		{ uso_lengua: 3, iniciativa: 2, nivel_reto: 1, colaboracion: 2, date_created: '2026-11-28T14:00:00Z' },
		{ uso_lengua: 2, iniciativa: 1, nivel_reto: 1, colaboracion: 3, date_created: '2026-11-28T15:00:00Z' },
	]);
	assert.deepEqual(r, { total: 2, criterios: { uso_lengua: 2.5, iniciativa: 1.5, nivel_reto: 1, colaboracion: 2.5 }, ultima: '2026-11-28T15:00:00Z', maximo: 3 });
	assert.equal(resumenCalificaciones([]).total, 0);
});
