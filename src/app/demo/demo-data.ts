// MODO DEMOSTRACIÓN (solo rama de pruebas): datos simulados del portal de pagos.
// Se guardan en localStorage para que inscripciones y pagos persistan durante la prueba.

const STORAGE_KEY = 'tm_demo_db_v1';

export interface DemoPayment {
  id: string;
  valor: number;
  fecha_pago: string; // hora local de Bogotá (YYYY-MM-DDTHH:mm:ss)
  metodo_pago: string;
  pagador: string;
  numero_transaccion: string;
  estado: 'PAGADO' | 'RECHAZADO';
}

export interface DemoAccount {
  id: string;
  clienteId: string;
  estudianteId: string;
  cursoId: string;
  monto: number;
  monto_original?: number;
  descuento?: string;
  es_inscripcion: 'TRUE' | 'FALSE';
  pagos: DemoPayment[];
  created_at: string;
}

export interface DemoDb {
  clientes: any[];
  estudiantes: any[];
  cuentas: DemoAccount[];
  seq: number;
}

export const DEMO_SCHOOLS = [
  { id: 'demo-col-1', nombre: 'Colegio San José', ciudad: 'Bogotá' },
  { id: 'demo-col-2', nombre: 'Gimnasio Los Andes', ciudad: 'Medellín' },
  { id: 'demo-col-3', nombre: 'Colegio Santa María', ciudad: 'Cali' },
];

export const DEMO_GRADOS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'].map(g => ({ grado: g }));
export const DEMO_GRUPOS = ['A', 'B', 'C'].map((g, i) => ({ id: `demo-grupo-${i + 1}`, grupo: g }));

export const DEMO_RATES: Record<string, number> = { USD: 3900, EUR: 4250 };

// Programas con su precio por colegio (colegios_cursos) y ediciones
export const DEMO_COURSES = [
  {
    id: 'demo-curso-willgo', nombre: 'Will-Go', img: 'will-go.svg', moneda: 'USD', precio: 1200000,
    colegios_cursos: [
      { id: 'demo-cc-1', colegio_id: 'demo-col-1', precio_curso: 1200000, precio_inscripcion: 40, moneda: 'USD', edicion: '2026-I · Febrero a junio' },
      { id: 'demo-cc-2', colegio_id: 'demo-col-1', precio_curso: 1350000, precio_inscripcion: 40, moneda: 'USD', edicion: '2026-II · Agosto a noviembre' },
      { id: 'demo-cc-3', colegio_id: 'demo-col-2', precio_curso: 1250000, precio_inscripcion: 40, moneda: 'USD', edicion: '2026-I · Febrero a junio' },
      { id: 'demo-cc-4', colegio_id: 'demo-col-3', precio_curso: 1300000, tiene_precio_especial: 'TRUE', precio_especial: 1100000, precio_inscripcion: 40, moneda: 'USD', edicion: '2026-I · Febrero a junio' },
    ],
  },
  {
    id: 'demo-curso-winter', nombre: 'Winter Camp', img: 'winter-camp.svg', moneda: 'EUR', precio: 2800000,
    colegios_cursos: [
      { id: 'demo-cc-5', colegio_id: 'demo-col-1', precio_curso: 2800000, precio_inscripcion: 50, moneda: 'EUR', edicion: 'Diciembre 2026' },
      { id: 'demo-cc-6', colegio_id: 'demo-col-2', precio_curso: 2800000, precio_inscripcion: 50, moneda: 'EUR', edicion: 'Diciembre 2026' },
    ],
  },
  {
    id: 'demo-curso-summer', nombre: 'Summer Camp', img: 'summer-camp.svg', moneda: 'USD', precio: 3200000,
    colegios_cursos: [
      { id: 'demo-cc-7', colegio_id: 'demo-col-1', precio_curso: 3200000, precio_inscripcion: 60, moneda: 'USD', edicion: 'Julio 2026' },
      { id: 'demo-cc-8', colegio_id: 'demo-col-3', precio_curso: 3200000, precio_inscripcion: 60, moneda: 'USD', edicion: 'Julio 2026' },
    ],
  },
  {
    id: 'demo-curso-sabe', nombre: 'SABE Francés · Inmersión', img: 'sabe.svg', moneda: 'COP', precio: 690000,
    colegios_cursos: [
      { id: 'demo-cc-9', colegio_id: 'demo-col-1', precio_curso: 690000, precio_inscripcion: 0, moneda: 'COP', edicion: '' },
      { id: 'demo-cc-10', colegio_id: 'demo-col-2', precio_curso: 690000, precio_inscripcion: 0, moneda: 'COP', edicion: '' },
      { id: 'demo-cc-11', colegio_id: 'demo-col-3', precio_curso: 690000, precio_inscripcion: 0, moneda: 'COP', edicion: '' },
    ],
  },
];

// Documentos de prueba que se muestran en el panel del modo demostración
export const DEMO_HINTS = [
  { label: 'Acudiente con programas y pagos', value: 'CC 1020456789' },
  { label: 'Acudiente con inscripción pendiente', value: 'CC 79888777' },
  { label: 'Estudiante ya registrado', value: 'TI 1098765432' },
];

function seed(): DemoDb {
  return {
    seq: 100,
    clientes: [
      { id: 'demo-cli-1', tipo_documento: 'CC', numero_documento: '1020456789', nombre: 'Carolina', apellido: 'Rodríguez', celular: '3001234567', email: 'carolina@correo.com', direccion: 'Calle 123 # 45-67, Bogotá' },
      { id: 'demo-cli-2', tipo_documento: 'CC', numero_documento: '79888777', nombre: 'Andrés', apellido: 'Gómez', celular: '3109876543', email: 'andres.gomez@correo.com', direccion: 'Carrera 45 # 10-20, Medellín' },
    ],
    estudiantes: [
      { id: 'demo-est-1', acudienteId: 'demo-cli-1', tipo_documento: 'TI', numero_documento: '1098765432', nombre: 'Mateo', apellido: 'Rodríguez', grado: '7 B', colegioId: 'demo-col-1' },
      { id: 'demo-est-2', acudienteId: 'demo-cli-1', tipo_documento: 'TI', numero_documento: '1098765433', nombre: 'Sofía', apellido: 'Rodríguez', grado: '4 A', colegioId: 'demo-col-1' },
      { id: 'demo-est-3', acudienteId: 'demo-cli-2', tipo_documento: 'TI', numero_documento: '1012345678', nombre: 'Martín', apellido: 'Gómez', grado: '9 A', colegioId: 'demo-col-2' },
    ],
    cuentas: [
      {
        id: 'demo-cta-1', clienteId: 'demo-cli-1', estudianteId: 'demo-est-1', cursoId: 'demo-curso-willgo', monto: 156000, es_inscripcion: 'TRUE', created_at: '2026-02-01T09:00:00',
        pagos: [{ id: 'demo-pago-1', valor: 156000, fecha_pago: '2026-02-01T09:30:00', metodo_pago: 'CARD', pagador: 'Carolina Rodríguez', numero_transaccion: '11872-1', estado: 'PAGADO' }],
      },
      {
        id: 'demo-cta-2', clienteId: 'demo-cli-1', estudianteId: 'demo-est-1', cursoId: 'demo-curso-willgo', monto: 1200000, monto_original: 1500000, descuento: '20', es_inscripcion: 'FALSE', created_at: '2026-02-01T09:00:00',
        pagos: [
          { id: 'demo-pago-2', valor: 240000, fecha_pago: '2026-02-09T11:05:00', metodo_pago: 'CARD', pagador: 'Carolina Rodríguez', numero_transaccion: '12388-7', estado: 'RECHAZADO' },
          { id: 'demo-pago-3', valor: 240000, fecha_pago: '2026-02-10T16:20:00', metodo_pago: 'CARD', pagador: 'Carolina Rodríguez', numero_transaccion: '12410-2', estado: 'PAGADO' },
          { id: 'demo-pago-4', valor: 240000, fecha_pago: '2026-03-12T10:00:00', metodo_pago: 'PSE', pagador: 'Carolina Rodríguez', numero_transaccion: '12931-5', estado: 'PAGADO' },
        ],
      },
      {
        id: 'demo-cta-3', clienteId: 'demo-cli-1', estudianteId: 'demo-est-2', cursoId: 'demo-curso-sabe', monto: 690000, es_inscripcion: 'FALSE', created_at: '2026-03-01T08:00:00',
        pagos: [{ id: 'demo-pago-5', valor: 690000, fecha_pago: '2026-03-02T15:45:00', metodo_pago: 'NEQUI', pagador: 'Carolina Rodríguez', numero_transaccion: '13002-9', estado: 'PAGADO' }],
      },
      { id: 'demo-cta-4', clienteId: 'demo-cli-2', estudianteId: 'demo-est-3', cursoId: 'demo-curso-winter', monto: 212500, es_inscripcion: 'TRUE', created_at: '2026-04-05T10:00:00', pagos: [] },
      { id: 'demo-cta-5', clienteId: 'demo-cli-2', estudianteId: 'demo-est-3', cursoId: 'demo-curso-winter', monto: 2800000, es_inscripcion: 'FALSE', created_at: '2026-04-05T10:00:00', pagos: [] },
    ],
  };
}

let memoryDb: DemoDb | null = null;

function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function loadDb(): DemoDb {
  if (hasStorage()) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // datos corruptos: se reinicia con la semilla
    }
  }
  if (!memoryDb) memoryDb = seed();
  return memoryDb;
}

export function saveDb(db: DemoDb): void {
  memoryDb = db;
  if (hasStorage()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // sin almacenamiento disponible: queda solo en memoria
    }
  }
}

export function resetDb(): void {
  memoryDb = null;
  if (hasStorage()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignorar
    }
  }
}

export function nextId(db: DemoDb, prefix: string): string {
  db.seq += 1;
  return `${prefix}-${db.seq}`;
}

export function nowBogota(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).replace(' ', 'T');
}

export function paidTotal(account: DemoAccount): number {
  return account.pagos.filter(p => p.estado === 'PAGADO').reduce((sum, p) => sum + p.valor, 0);
}

function courseById(id: string): any {
  return DEMO_COURSES.find(c => c.id === id);
}

function studentRef(db: DemoDb, id: string): any {
  const s = db.estudiantes.find(e => e.id === id);
  return s ? { id: s.id, nombre: s.nombre, apellido: s.apellido, tipo_documento: s.tipo_documento, numero_documento: s.numero_documento } : { id };
}

// Cuenta por cobrar con la forma que devuelve el flujo real de búsqueda de acudiente
export function toApiAccount(db: DemoDb, account: DemoAccount): any {
  const course = courseById(account.cursoId);
  const saldo = paidTotal(account);
  return {
    id: account.id,
    estudiante_id: studentRef(db, account.estudianteId),
    curso_id: course ? { id: course.id, nombre: course.nombre, img: course.img, moneda: course.moneda } : { id: account.cursoId, nombre: 'Programa' },
    monto: account.monto,
    monto_original: account.monto_original ?? account.monto,
    descuento: account.descuento ?? '0',
    saldo,
    estado: saldo >= account.monto ? 'PAGADA' : 'PENDIENTE',
    es_inscripcion: account.es_inscripcion,
    pagos: account.pagos,
    created_at: account.created_at,
  };
}

export function toApiClient(db: DemoDb, client: any): any {
  return {
    ...client,
    estudiantes: db.estudiantes.filter(e => e.acudienteId === client.id).map(e => studentRef(db, e.id)),
    cuentas_cobrar: db.cuentas.filter(c => c.clienteId === client.id).map(c => toApiAccount(db, c)),
  };
}

export function toApiStudent(student: any): any {
  const school = DEMO_SCHOOLS.find(s => s.id === student.colegioId);
  return {
    id: student.id,
    tipo_documento: student.tipo_documento,
    numero_documento: student.numero_documento,
    nombre: student.nombre,
    apellido: student.apellido,
    grado: student.grado,
    colegio_id: school ? { id: school.id, nombre: school.nombre } : null,
  };
}

export function findCourse(id: string): any {
  return courseById(id);
}
