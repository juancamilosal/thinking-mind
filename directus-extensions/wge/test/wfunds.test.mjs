import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularResultados, pagoDeInversion } from '../src/wfunds.js';
import { aleatorioConSemilla } from '../src/lib.js';

const fondos = [
	{ id: 'a', nombre: 'CAPI GREEN', riesgo: 'bajo', rendimiento_base: '0.03', rendimiento_alterno: null, variacion: '0.02' },
	{ id: 'b', nombre: 'NOVA AI', riesgo: 'alto', rendimiento_base: '0.10', rendimiento_alterno: '-0.08', variacion: '0.12' },
];

test('W-Funds: el resultado se repite con la misma semilla y respeta el ±20 %', () => {
	const r1 = calcularResultados(fondos, new Map(), aleatorioConSemilla('ronda-1'));
	const r2 = calcularResultados(fondos, new Map(), aleatorioConSemilla('ronda-1'));
	assert.deepEqual(r1, r2);
	for (let i = 0; i < 200; i++) {
		for (const r of calcularResultados(fondos, new Map([['a', 3], ['b', 1]]), aleatorioConSemilla(`s${i}`))) {
			assert.ok(r.rendimiento >= -0.2 && r.rendimiento <= 0.2);
		}
	}
	// Riesgo bajo sin votos: base 3 % ± 2 %
	for (let i = 0; i < 50; i++) {
		const bajo = calcularResultados(fondos, new Map(), aleatorioConSemilla(`b${i}`))[0].rendimiento;
		assert.ok(bajo >= 0.01 - 1e-9 && bajo <= 0.05 + 1e-9);
	}
});

test('W-Funds: los votos dan un bono de máximo ±2 %', () => {
	const sin = calcularResultados([fondos[0]], new Map(), () => 0.5)[0];
	const con = calcularResultados([fondos[0], { ...fondos[0], id: 'c' }], new Map([['a', 10]]), () => 0.5)[0];
	assert.equal(sin.bono, 0);
	assert.equal(con.bono, 0.02);
});

test('W-Funds: el pago nunca es negativo y se redondea hacia abajo', () => {
	assert.equal(pagoDeInversion(100, 0.05), 105);
	assert.equal(pagoDeInversion(150, -0.08), 138);
	assert.equal(pagoDeInversion(7, 0.1), 7);
	assert.equal(pagoDeInversion(10, -2), 0);
});
