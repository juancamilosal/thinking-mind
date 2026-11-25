import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalDelConteo, montoOConteo, DENOMINACIONES } from '../src/arqueo.js';

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

test('montoOConteo: acepta un monto o el detalle de billetes', () => {
	assert.deepEqual(montoOConteo({ monto: 1500 }), { limpio: null, total: 1500 });
	assert.deepEqual(montoOConteo({ monto: '200' }), { limpio: null, total: 200 });
	assert.equal(montoOConteo({ monto: 0 }), null);
	assert.equal(montoOConteo({ monto: 2.5 }), null);
	assert.equal(montoOConteo({}), null);
	assert.deepEqual(montoOConteo({ billetes: { 1000: 2, 50: 1 } }), { limpio: { 1000: 2, 50: 1 }, total: 2050 });
	assert.equal(montoOConteo({ billetes: {} }), null);
});
