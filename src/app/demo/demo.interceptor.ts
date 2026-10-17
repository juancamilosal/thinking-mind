// MODO DEMOSTRACIÓN (solo rama de pruebas): responde las llamadas al backend con datos simulados.
import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  DEMO_COURSES, DEMO_GRADOS, DEMO_GRUPOS, DEMO_RATES, DEMO_SCHOOLS,
  findCourse, loadDb, nextId, saveDb, toApiAccount, toApiClient, toApiStudent,
} from './demo-data';

const API_HOST = 'api.appthinkingmind.com';

// Identificadores de los flujos (flows/trigger) que usa el portal de pagos
const FLOW_SEARCH_CLIENT = 'f88c7b92-e1b2-4a50-851d-9afb8c971c19';
const FLOW_SEARCH_STUDENT = '08fe708c-06b9-4da1-95f2-448cf5015b10';
const FLOW_GROUPS = 'cc098cc1-5ab6-46c4-8d83-59e76dfdd7a0';
const FLOW_CREATE_ACCOUNT = '7e95991a-52b2-4208-a423-ae5cdb52b163';

function reply(body: any, ms = 350): Observable<HttpEvent<any>> {
  return of(new HttpResponse({ status: 200, body })).pipe(delay(ms));
}

function param(req: HttpRequest<any>, name: string): string {
  const fromParams = req.params.get(name);
  if (fromParams !== null) return fromParams;
  try {
    return new URL(req.urlWithParams).searchParams.get(name) || '';
  } catch {
    return '';
  }
}

export const demoInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const url = req.url;

  // Tasas de cambio
  if (url.includes('open.er-api.com')) {
    const base = url.split('/').pop() || 'USD';
    return reply({ result: 'success', rates: { COP: DEMO_RATES[base] || 0 } }, 150);
  }

  if (!url.includes(API_HOST)) {
    return next(req);
  }

  const db = loadDb();

  // Búsqueda de acudiente con sus cuentas por cobrar y pagos
  if (url.includes(FLOW_SEARCH_CLIENT)) {
    const doc = param(req, 'numero_documento').trim();
    const client = db.clientes.find(c => c.numero_documento === doc);
    return reply({ data: client ? [toApiClient(db, client)] : [] }, 600);
  }

  // Búsqueda de estudiante
  if (url.includes(FLOW_SEARCH_STUDENT)) {
    const doc = param(req, 'numero_documento').trim();
    const student = db.estudiantes.find(e => e.numero_documento === doc);
    return reply({ data: { estudiante: student ? [toApiStudent(student)] : [] } });
  }

  if (url.includes(FLOW_GROUPS)) {
    return reply({ data: DEMO_GRUPOS });
  }

  // Registro de inscripción (crea acudiente, estudiante y cuentas por cobrar)
  if (url.includes(FLOW_CREATE_ACCOUNT) && req.method === 'POST') {
    const body = req.body || {};
    const cli = body.cliente || {};
    const est = body.estudiante || {};

    let client = db.clientes.find(c => c.numero_documento === cli.numero_documento);
    if (!client) {
      client = { id: nextId(db, 'demo-cli') };
      db.clientes.push(client);
    }
    Object.assign(client, {
      tipo_documento: cli.tipo_documento, numero_documento: cli.numero_documento, nombre: cli.nombre,
      apellido: cli.apellido, celular: cli.celular, email: cli.email, direccion: cli.direccion,
    });

    let student = db.estudiantes.find(e => e.numero_documento === est.numero_documento);
    if (!student) {
      student = { id: nextId(db, 'demo-est') };
      db.estudiantes.push(student);
    }
    Object.assign(student, {
      acudienteId: client.id, tipo_documento: est.tipo_documento, numero_documento: est.numero_documento,
      nombre: est.nombre, apellido: est.apellido, grado: est.grado, colegioId: est.colegio,
    });

    const cc = Array.isArray(body.colegios_cursos) ? body.colegios_cursos[0] : null;
    const price = Number(body.precio) || 0;
    const regular = Number(cc?.precio_curso) || price;
    const createdAt = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).replace(' ', 'T');

    const inscription = Number(body.precio_inscripcion) || 0;
    if (inscription > 0) {
      db.cuentas.push({
        id: nextId(db, 'demo-cta'), clienteId: client.id, estudianteId: student.id, cursoId: body.curso_id,
        monto: inscription, es_inscripcion: 'TRUE', pagos: [], created_at: createdAt,
      });
    }
    db.cuentas.push({
      id: nextId(db, 'demo-cta'), clienteId: client.id, estudianteId: student.id, cursoId: body.curso_id,
      monto: price, monto_original: regular > price ? regular : undefined, es_inscripcion: 'FALSE', pagos: [], created_at: createdAt,
    });
    saveDb(db);
    return reply({ status: 'OK', data: { message: 'Inscripción registrada (demo)' } }, 900);
  }

  // Programas
  if (url.includes('items/Cursos')) {
    return reply({ data: DEMO_COURSES.map(c => ({ ...c })) });
  }

  // Colegio por id
  const schoolById = url.match(/items\/colegios\/([^/?]+)/);
  if (schoolById) {
    return reply({ data: DEMO_SCHOOLS.find(s => s.id === schoolById[1]) || null });
  }

  // Búsqueda de colegios
  if (url.includes('items/colegios')) {
    const term = (param(req, 'filter[_or][0][nombre][_icontains]') || '').toLowerCase();
    const normalize = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const data = DEMO_SCHOOLS.filter(s => !term || normalize(s.nombre).includes(normalize(term)) || normalize(s.ciudad).includes(normalize(term)));
    return reply({ data });
  }

  if (url.includes('items/grado')) {
    return reply({ data: DEMO_GRADOS });
  }

  // Pago por número de transacción (pantalla de estado del pago)
  if (url.includes('items/pagos')) {
    const tx = param(req, 'filter[numero_transaccion][_eq]');
    for (const account of db.cuentas) {
      const pago = account.pagos.find(p => p.numero_transaccion === tx);
      if (pago) {
        // La pantalla de estado suma 5 horas (asume hora UTC), se envía en UTC para que se vea bien
        const utc = new Date(new Date(pago.fecha_pago).getTime() - 5 * 3600 * 1000);
        const fecha = utc.toLocaleString('sv-SE').replace(' ', 'T');
        const course = findCourse(account.cursoId);
        return reply({
          data: [{ ...pago, fecha_pago: fecha, cuenta_cobrar_id: { ...toApiAccount(db, account), curso_id: { nombre: course?.nombre } } }],
        });
      }
    }
    return reply({ data: [] });
  }

  // Cualquier otra llamada al backend: respuesta vacía para no depender del servidor real
  return reply(req.method === 'GET' ? { data: [] } : { status: 'OK', data: {} }, 200);
};
