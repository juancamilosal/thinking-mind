import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rendimientoAcumulado } from '../src/cierre.js';

test('rendimiento acumulado compone las rondas y ordena de mayor a menor', () => {
	const fondos = [{ id: 'a', nombre: 'NOVA AI' }, { id: 'b', nombre: 'LEGO FUTURE' }, { id: 'c', nombre: 'CAPE GREEN' }];
	const rondas = [
		{ resultados: JSON.stringify([{ fondo_id: 'a', rendimiento: 0.1 }, { fondo_id: 'b', rendimiento: -0.05 }]) },
		{ resultados: [{ fondo_id: 'a', rendimiento: 0.1 }, { fondo_id: 'b', rendimiento: 0.2 }] },
	];
	const r = rendimientoAcumulado(fondos, rondas);
	assert.deepEqual(r.map((f) => f.fondo_id), ['a', 'b', 'c']);
	assert.equal(r[0].acumulado, 0.21);
	assert.equal(r[1].acumulado, 0.14);
	assert.equal(r[1].mejor, 0.2);
	assert.equal(r[1].peor, -0.05);
	assert.equal(r[2].rondas, 0);
	assert.equal(r[2].acumulado, 0);
});
