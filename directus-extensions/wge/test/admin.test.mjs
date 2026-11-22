import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limpiar, validarHorario, SECCIONES } from '../src/admin.js';

test('solo pasan los campos permitidos (nunca saldos, tasas vigentes ni provisión suelta)', () => {
	// La provisión del banco solo se define por billetes (provision_billetes), nunca como número suelto
	const f = limpiar({ nombre: 'Wonderland', tasa_actual: 5, saldo: 99, provision_inicial: '10000' }, SECCIONES.paises.campos);
	assert.deepEqual(f, { nombre: 'Wonderland' });
});
test('números inválidos se rechazan', () => {
	assert.throws(() => limpiar({ precio_cop: -1 }, SECCIONES.productos.campos));
	assert.throws(() => limpiar({ stock: 2.5 }, SECCIONES.productos.campos));
	assert.throws(() => limpiar({ riesgo: 'extremo' }, SECCIONES.fondos.campos));
	assert.throws(() => limpiar({ nombre: '  ' }, SECCIONES.fondos.campos));
});
test('vacío se guarda como null', () => {
	assert.deepEqual(limpiar({ maximo_por_estudiante: '' }, SECCIONES.productos.campos), { maximo_por_estudiante: null });
});
test('horario: por día o por fecha, inicio antes que fin', () => {
	assert.deepEqual(validarHorario([{ dia: 'sabado', inicio: '08:00', fin: '18:00', extra: 1 }]), [{ dia: 'sabado', inicio: '08:00', fin: '18:00' }]);
	assert.deepEqual(validarHorario([{ fecha: '2026-11-28', inicio: '09:00', fin: '12:00' }]), [{ fecha: '2026-11-28', inicio: '09:00', fin: '12:00' }]);
	assert.throws(() => validarHorario([{ dia: 'sabado', inicio: '18:00', fin: '08:00' }]));
	assert.throws(() => validarHorario([{ dia: 'feriado', inicio: '08:00', fin: '09:00' }]));
	assert.throws(() => validarHorario([{ dia: 'sabado', inicio: '8:00', fin: '09:00' }]));
});
