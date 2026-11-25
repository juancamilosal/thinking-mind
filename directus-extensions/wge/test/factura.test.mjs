import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pdfFactura, correoFactura } from '../src/factura.js';

const datos = { recibo: 'GS-20261125-AB12CD34', fecha: '25 nov 2026, 3:10 p. m.', estudiante: 'Sara Salazar Rojas', acudiente: 'Juan Pérez', colegio: 'The English School', edicion: 'Will Go Economy', pais: 'Wonderland', moneda: 'WON', metodo: 'efectivo', cajero: 'Ana (caja)', items: [{ nombre: 'Galletas (paquete)', cantidad: 2, precio: 15 }], total: 30, recibido: 50, vuelto: 20 };

test('la factura es un PDF válido con tildes, paréntesis escapados y su tabla de xref', () => {
	const pdf = pdfFactura(datos).toString('latin1');
	assert.ok(pdf.startsWith('%PDF-1.4'));
	assert.ok(pdf.trimEnd().endsWith('%%EOF'));
	assert.ok(pdf.includes('(Galletas \\(paquete\\))'));
	assert.ok(pdf.includes('P\xE9rez'));
	// Cada desplazamiento de la tabla xref apunta al inicio de su objeto
	const xref = Number(pdf.match(/startxref\n(\d+)/)[1]);
	const filas = pdf.slice(xref).split('\n').slice(2).filter((l) => / 00000 n $/.test(l));
	filas.forEach((l, i) => assert.ok(pdf.slice(Number(l.slice(0, 10))).startsWith(`${i + 1} 0 obj`)));
});
test('muchos productos siguen en otra página', () => {
	const muchos = { ...datos, items: Array.from({ length: 40 }, (_, i) => ({ nombre: `Producto ${i}`, cantidad: 1, precio: 1 })) };
	assert.ok(Number(pdfFactura(muchos).toString("latin1").match(/\/Count (\d+)/)[1]) > 1);
});
test('el correo de la factura escapa el HTML', () => {
	const c = correoFactura({ acudiente: 'Juan', estudiante: '<b>x</b>', recibo: 'GS-1', total: 30, moneda: 'WON' });
	assert.ok(!c.html.includes('<b>x</b>'));
	assert.match(c.subject, /GS-1/);
});
