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

test('W-Funds: el pago se redondea siempre hacia arriba y nunca es negativo', () => {
	assert.equal(pagoDeInversion(100, 0.05), 105); // exacto (sin el error binario 105,0000000001)
	assert.equal(pagoDeInversion(100, 0.0578), 106); // 105,78 → 106
	assert.equal(pagoDeInversion(100, 0.052), 106); // 105,2 → 106
	assert.equal(pagoDeInversion(10, 0.05), 11); // 10,5 → 11
	assert.equal(pagoDeInversion(100, -0.0578), 95); // pérdida: 94,22 → 95
	assert.equal(pagoDeInversion(150, -0.08), 138); // exacto
	assert.equal(pagoDeInversion(7, 0.1), 8); // 7,7 → 8
	assert.equal(pagoDeInversion(10, -2), 0);
});

import { cierreDeRonda } from '../src/wfunds.js';
import { finDeFranja } from '../src/lib.js';

// Sábado 28 de noviembre de 2026; Colombia = UTC-5
const horario = [{ dia: 'sabado', inicio: '08:00', fin: '12:00' }, { fecha: '2026-11-29', inicio: '09:00', fin: '10:00' }];
const hora = (fecha, hhmm) => new Date(`${fecha}T${hhmm}:00-05:00`);

test('horario: fin de la franja según la hora de Colombia', () => {
	assert.equal(finDeFranja(horario, hora('2026-11-28', '10:15')).toISOString(), hora('2026-11-28', '12:00').toISOString());
	assert.equal(finDeFranja(horario, hora('2026-11-28', '12:00')), null); // el fin no está incluido
	assert.equal(finDeFranja(horario, hora('2026-11-28', '07:59')), null);
	assert.equal(finDeFranja(horario, hora('2026-11-29', '09:30')).toISOString(), hora('2026-11-29', '10:00').toISOString()); // por fecha
	assert.equal(finDeFranja(horario, hora('2026-11-30', '09:30')), null); // lunes
	assert.equal(finDeFranja(null, new Date()), null);
});

test('W-Funds: la ronda dura lo elegido, pero se recorta al final del horario', () => {
	assert.equal(cierreDeRonda(horario, hora('2026-11-28', '10:00'), 30).toISOString(), hora('2026-11-28', '10:30').toISOString());
	assert.equal(cierreDeRonda(horario, hora('2026-11-28', '11:45'), 30).toISOString(), hora('2026-11-28', '12:00').toISOString());
	assert.equal(cierreDeRonda(horario, hora('2026-11-28', '11:57'), 30), null); // quedan menos de 5 min
	assert.equal(cierreDeRonda(horario, hora('2026-11-28', '13:00'), 30), null); // fuera del horario
});
