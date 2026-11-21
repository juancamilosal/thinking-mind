import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaTasa, dentroDelHorario } from '../src/hook.js';
import { aleatorioConSemilla, ahoraColombia, enteroPositivo } from '../src/lib.js';

const base = { tasa: 1000, tasaInicial: 1000, topeMinimo: 0.7, topeMaximo: 1.8 };

test('índice igual a la referencia B: la tasa no se mueve', () => {
	assert.equal(nuevaTasa({ ...base, puntos: 20, presentes: 10 }).nueva, 1000);
});
test('índice alto sube la tasa con el límite de +2,4 %', () => {
	const r = nuevaTasa({ ...base, puntos: 600, presentes: 10 }); // I=60 → se limita a 6
	assert.equal(r.indice, 6);
	assert.equal(r.nueva, 1024);
});
test('sin puntos baja con el límite de −1,2 %', () => {
	assert.equal(nuevaTasa({ ...base, puntos: 0, presentes: 10 }).nueva, 988);
});
test('sin presentes no divide por cero', () => {
	assert.equal(nuevaTasa({ ...base, puntos: 0, presentes: 0 }).nueva, 988);
});
test('topes: nunca pasa de 1,80·R0 ni baja de 0,70·R0', () => {
	assert.equal(nuevaTasa({ ...base, tasa: 1795, puntos: 600, presentes: 10 }).nueva, 1800);
	assert.equal(nuevaTasa({ ...base, tasa: 701, puntos: 0, presentes: 10 }).nueva, 700);
});
test('parámetros por edición reemplazan los del documento', () => {
	assert.equal(nuevaTasa({ ...base, puntos: 30, presentes: 10, parametros: { referencia: 3 } }).nueva, 1000);
});
test('horario por día de la semana y por fecha', () => {
	const h = [{ dia: 'sábado', inicio: '08:00', fin: '20:00' }, { fecha: '2026-11-29', inicio: '09:00', fin: '12:00' }];
	assert.ok(dentroDelHorario(h, '2026-11-28', '08:00')); // sábado
	assert.ok(!dentroDelHorario(h, '2026-11-28', '20:00'));
	assert.ok(dentroDelHorario(h, '2026-11-29', '11:59'));
	assert.ok(!dentroDelHorario(h, '2026-11-30', '10:00'));
	assert.ok(!dentroDelHorario(null, '2026-11-28', '10:00'));
});
test('hora de Colombia', () => {
	assert.deepEqual(ahoraColombia(new Date('2026-11-28T13:30:00Z')), { fecha: '2026-11-28', hora: '08:30' });
});
test('la semilla repite el mismo resultado (auditable)', () => {
	const a = aleatorioConSemilla('ronda-1'), b = aleatorioConSemilla('ronda-1');
	assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});
test('montos: solo enteros positivos', () => {
	assert.equal(enteroPositivo('5', 'monto'), 5);
	for (const v of [0, -1, 1.5, 'x', null]) assert.throws(() => enteroPositivo(v, 'monto'));
});
