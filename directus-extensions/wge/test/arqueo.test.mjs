import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalDelConteo, DENOMINACIONES } from '../src/arqueo.js';

test('suma el conteo por denominación', () => {
	const { limpio, total } = totalDelConteo({ 1: 40, 5: '20', 50000: 1, 100: 0 });
	assert.equal(total, 40 + 100 + 50000);
	assert.deepEqual(limpio, { 1: 40, 5: 20, 50000: 1 });
});
test('rechaza denominaciones que no existen y cantidades malas', () => {
	assert.throws(() => totalDelConteo({ 20: 1 }));
	assert.throws(() => totalDelConteo({ 5: -1 }));
	assert.throws(() => totalDelConteo({ 5: 1.5 }));
	assert.throws(() => totalDelConteo(null));
});
test('las 10 denominaciones de los billetes', () => {
	assert.deepEqual(DENOMINACIONES, [1, 2, 5, 10, 50, 100, 200, 1000, 5000, 50000]);
});
