import { test } from 'node:test';
import assert from 'node:assert/strict';
import { precioEnBilletesCaja } from '../src/caja.js';

test('caja: precio en billetes con la tasa del país, siempre hacia arriba', () => {
	assert.equal(precioEnBilletesCaja(15000, 1000), 15);
	assert.equal(precioEnBilletesCaja(15000, 908), 17); // 16,5 → 17
	assert.equal(precioEnBilletesCaja(2500, 1054), 3); // 2,37 → 3
	assert.equal(precioEnBilletesCaja(5000, 0), 5000); // tasa inválida no divide por cero
});
