import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ocultarCorreo } from '../src/acudientes.js';

test('acudientes: el correo se muestra oculto', () => {
	assert.equal(ocultarCorreo('camilo@gmail.com'), 'c****o@gmail.com');
	assert.equal(ocultarCorreo('ab@x.co'), 'a@x.co');
	assert.equal(ocultarCorreo('juanitoperezgomez@correo.com'), 'j******z@correo.com');
	assert.equal(ocultarCorreo(''), null);
	assert.equal(ocultarCorreo(null), null);
});
