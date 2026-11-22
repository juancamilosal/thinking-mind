// Arma dist/api.js sin dependencias (no hace falta npm install).
// Une los archivos de src/ en un solo módulo con el formato de "bundle" que lee Directus 11.
// Si tienes acceso a npm también sirve `npm run build` con @directus/extensions-sdk.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const leer = (archivo) => readFileSync(new URL(`./src/${archivo}`, import.meta.url), 'utf8');
const externos = new Set();
const preparar = (codigo) => codigo
	// Los imports de Node (node:stream, ...) van una sola vez al inicio del archivo final
	.replace(/^import [^;]*? from 'node:[a-z/]+';\n/gm, (linea) => { externos.add(linea.trim()); return ''; })
	// Los imports entre archivos propios sobran: todo queda en el mismo módulo
	.replace(/^import[\s\S]*?from '\.\/[a-z]+\.js';\n/gm, '')
	.replace(/^export (?=(async )?function|class|const)/gm, '');

const lib = preparar(leer('lib.js'));
const mensajes = preparar(leer('mensajes.js'));
const funcionarios = preparar(leer('funcionarios.js'));
const admin = preparar(leer('admin.js'));
const arqueo = preparar(leer('arqueo.js'));
const wfunds = preparar(leer('wfunds.js'));
const acudientes = preparar(leer('acudientes.js'));
const rubrica = preparar(leer('rubrica.js'));
const tipocambio = preparar(leer('tipocambio.js'));
const caja = preparar(leer('caja.js'));
const cierre = preparar(leer('cierre.js'));
const hook = preparar(leer('hook.js')).replace(/^export default /m, 'const configHook = ');
const endpoint = preparar(leer('endpoint.js')).replace(/^export default /m, 'const configEndpoint = ');

const cuerpo = [lib, mensajes, funcionarios, admin, arqueo, wfunds, rubrica, hook, tipocambio, caja, cierre, acudientes, endpoint].join('\n');
if (/^\s*(import|export)\b/m.test(cuerpo)) throw new Error('Quedó un import/export sin convertir');

const api = `// Generado por build.mjs: no editar a mano.
${[...externos].join('\n')}
${cuerpo}
export default {
	hooks: [{ name: 'wge-fx', config: configHook }],
	endpoints: [{ name: 'wge', config: configEndpoint }],
	operations: [],
};
`;
const app = `export default { interfaces: [], displays: [], layouts: [], modules: [], panels: [], themes: [], operations: [] };\n`;

mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/api.js', import.meta.url), api);
writeFileSync(new URL('./dist/app.js', import.meta.url), app);
console.log('dist/api.js y dist/app.js listos');
