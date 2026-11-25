import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limpiar, validarHorario, SECCIONES, ejemploDeFondo, FONDOS_POR_DEFECTO } from '../src/admin.js';

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

test('fondos: texto de ejemplo y límites de los textos nuevos', () => {
	assert.ok(FONDOS_POR_DEFECTO.every((f) => f.a_que_se_dedica && f.por_que_invertir.split('\n').length === 3));
	assert.equal(ejemploDeFondo({ nombre: ' capi green ' }).a_que_se_dedica, FONDOS_POR_DEFECTO[0].a_que_se_dedica);
	assert.equal(ejemploDeFondo({ nombre: 'Otro', orden: 5 }).a_que_se_dedica, FONDOS_POR_DEFECTO[4].a_que_se_dedica);
	assert.equal(ejemploDeFondo({ nombre: 'Otro', orden: 9 }), null);
	const c = SECCIONES.fondos.campos;
	assert.deepEqual(limpiar({ logo: 'abc', a_que_se_dedica: 'x', por_que_invertir: 'a\nb', rendimiento_base: '0.03' }, c), { logo: 'abc', a_que_se_dedica: 'x', por_que_invertir: 'a\nb', rendimiento_base: 0.03 });
	assert.throws(() => limpiar({ a_que_se_dedica: 'x'.repeat(161) }, c), /160/);
});

test('tipo de cambio: cada cuántos minutos se calcula (configurable por edición)', () => {
	assert.equal(JSON.parse(limpiar({ parametros_fx: { intervalo_minutos: '15', referencia: 2 } }, ['parametros_fx']).parametros_fx).intervalo_minutos, 15);
	assert.throws(() => limpiar({ parametros_fx: { intervalo_minutos: 7 } }, ['parametros_fx']), /minutos/);
	assert.throws(() => limpiar({ parametros_fx: { intervalo_minutos: 45 } }, ['parametros_fx']), /minutos/);
});

test('sqlCursosDelPrograma: el programa elegido y sus variantes de hermanos', async () => {
	const { sqlCursosDelPrograma } = await import('../src/lib.js');
	const { sql, valores } = sqlCursosDelPrograma('cc.curso_id', 'K1');
	assert.match(sql, /^cc\.curso_id in \(select k\.id from "Cursos" k where k\.id = \? or k\.nombre ilike/);
	assert.match(sql, /\(%hermano%\)/);
	assert.deepEqual(valores, ['K1', 'K1']);
});

import { agruparOperaciones } from '../src/admin.js';
test('las transacciones de los colaboradores unen sus dos patas y separan efectivo de virtual', () => {
	const f = (id, tipo_dueno, monto, ref, extra = {}) => ({ id, tipo: 'transferencia_salida', monto, referencia_tipo: ref && 'transferencia', referencia_id: ref, date_created: `2026-11-25T10:0${id.length}:00Z`, user_created: 'u1', tipo_dueno, pais_id: 'p', actor: 'Ana', docente: 'Doc', estudiante: 'Sara', ...extra });
	const ops = agruparOperaciones([
		f('a', 'banco', -100, 't1'), f('b', 'docente', 100, 't1'),
		f('cc', 'banco_virtual', -50, 't2'), f('dd', 'cuenta', 50, 't2'),
		f('eee', 'banco_virtual', 300, null, { tipo: 'carga_virtual' }),
	]);
	assert.equal(ops.length, 3);
	const efectivo = ops.find((o) => o.origen?.tipo === 'banco');
	assert.deepEqual([efectivo.medio, efectivo.monto, efectivo.destino.nombre], ['efectivo', 100, 'Doc']);
	const virtual = ops.find((o) => o.origen?.tipo === 'banco_virtual');
	assert.deepEqual([virtual.medio, virtual.destino.tipo, virtual.destino.nombre], ['virtual', 'cuenta', 'Sara']);
	const carga = ops.find((o) => !o.origen);
	assert.deepEqual([carga.medio, carga.monto, carga.tipo], ['virtual', 300, 'carga_virtual']);
});
