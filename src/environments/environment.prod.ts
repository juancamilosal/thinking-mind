const apiUrl = 'https://api.appthinkingmind.com/';

export const environment = {
  production: true,
  clients: apiUrl + 'items/clientes',
  students: apiUrl + 'items/estudiantes',
  schools: apiUrl + 'items/colegios',
  rectores: apiUrl + 'items/rectores',
  courses: apiUrl + 'items/Cursos',
  accountsReceivable: apiUrl + 'items/cuentas_cobrar',
  payment: apiUrl + 'items/pagos',
  roles: apiUrl + 'roles',
  budget: apiUrl + 'items/presupuesto',
  // Language test collections
  langTest: {
    questions: apiUrl + 'items/test',
    answers: apiUrl + 'items/respuestas',
  },
  files: apiUrl + 'files',
  users: apiUrl + 'users',
  assets: apiUrl + 'assets',
  colegio_cursos: apiUrl + 'items/colegios_cursos',
  historial_programas: apiUrl + 'items/historial_programas',
  reuniones_meet: apiUrl + 'items/reuniones_meet',
  programa_ayo: apiUrl + 'items/programas_ayo',
  tarifa_wompi: apiUrl + 'items/tarifa_wompi',
  security: {
    login: apiUrl + 'auth/login',
    logout: apiUrl + 'auth/logout',
    refresh: apiUrl + 'auth/refresh',
    me: apiUrl + 'users/me',
    menu: {
      list: apiUrl + 'items/menu?sort=orden'
    },
  },

  //Flujos
  manual_payment: apiUrl + 'flows/trigger/2b02aa2e-58ca-48a0-a360-84861acd0692',
  total_accounts: apiUrl + 'flows/trigger/6dd2a98f-b283-46b5-9a36-5dd1d4f9adc9',
  payment_record: apiUrl + 'flows/trigger/7e95991a-52b2-4208-a423-ae5cdb52b163',
  payment_record_ayo: apiUrl + 'flows/trigger/73a149d3-8a5f-418f-bc03-361bc03f2dab',
  search_cliente: apiUrl + 'flows/trigger/f88c7b92-e1b2-4a50-851d-9afb8c971c19',
  search_student: apiUrl + 'flows/trigger/08fe708c-06b9-4da1-95f2-448cf5015b10',
  list_student_school: apiUrl + 'flows/trigger/b843f482-7a50-4a5a-8d93-f78a04fc2b80',
  getBudget: apiUrl + 'flows/trigger/7a82a287-639b-42e3-a382-8f5e01d754ad',
  payment_wompi: apiUrl + 'flows/trigger/0ba476c9-3c23-486f-8b79-f3f7fceab4e4',
  return: apiUrl + 'flows/trigger/bcb42dd5-5119-4c09-96c6-cbed0e6e106f',
  listaGrupo: apiUrl + 'flows/trigger/cc098cc1-5ab6-46c4-8d83-59e76dfdd7a0',
  dashboardRector: apiUrl + 'flows/trigger/7e0cc8b7-7d75-47db-804a-03f0d9a4205c',
  dashboardSale: apiUrl + 'flows/trigger/e2287aa0-115a-4dac-b484-49363945b9b3',
  dashboard: apiUrl + 'flows/trigger/8b5137ca-cfe2-4e7a-acb2-73e97663e529',
  dashboardStudent: apiUrl + 'flows/trigger/49bce56c-1953-4ff0-ad70-3ff8a81252bd',
  total_payment: apiUrl + 'flows/trigger/dcceb5b9-c6ae-4cda-afb0-55922c337d4e',
  resultado_test: apiUrl + 'flows/trigger/d6d785d3-aed1-4b2e-8d43-ec5c91d2f0b1',
  submit_lang_test: apiUrl + 'flows/trigger/d6d785d3-aed1-4b2e-8d43-ec5c91d2f0b1',
  register_student: apiUrl + 'flows/trigger/c27fe837-9095-43f2-bd18-c89dc4fbfdca',
  precio_programa_ayo: apiUrl + 'items/precio_programa_ayo',
  nivel: apiUrl + 'items/nivel',
  grado: apiUrl + 'items/grado',

  // Configuración de tasas de cambio
  exchangeRates: {
    // Proveedor de tasas: 'exchangerate_host' (gratis), 'alphavantage' (requiere API key), 'erapi' (anterior)
    provider: 'erapi',
    alphavantageApiKey: '',
    currencylayerApiKey: ''
  },

  // Configuración de Wompi
  wompi: {
    publicKey: 'pub_prod_aDinMfCvarfkhNiAQKzdm7cFDy6Szeuy',
    integrityKey: 'prod_integrity_Uma95tilbzOeU81QAycPinIM4Vtova3V',
    redirectUrl: 'https://appthinkingmind.com/payment-status'
  }
};
