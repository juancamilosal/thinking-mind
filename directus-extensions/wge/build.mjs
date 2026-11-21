// Arma dist/api.js sin dependencias (no hace falta npm install).
// Une lib.js, hook.js y endpoint.js en un solo módulo con el formato de "bundle" que lee Directus 11.
// Si tienes acceso a npm también sirve `npm run build` con @directus/extensions-sdk.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const leer = (archivo) => readFileSync(new URL(`./src/${archivo}`, import.meta.url), 'utf8');
const sinImports = (codigo) => codigo.replace(/^import[\s\S]*?from '\.\/[a-z]+\.js';\n/gm, '');

const lib = leer('lib.js').replace(/^export (?=(async )?function|class|const)/gm, '');
const funcionarios = sinImports(leer('funcionarios.js')).replace(/^export (?=(async )?function|const)/gm, '');
const hook = sinImports(leer('hook.js'))
	.replace(/^export default /m, 'const configHook = ')
	.replace(/^export (?=(async )?function|const)/gm, '');
const endpoint = sinImports(leer('endpoint.js')).replace(/^export default /m, 'const configEndpoint = ');

if (/^\s*(import|export)\b/m.test(lib + funcionarios + hook + endpoint)) throw new Error('Quedó un import/export sin convertir');

const api = `// Generado por build.mjs: no editar a mano.
${lib}
${funcionarios}
${hook}
${endpoint}
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
