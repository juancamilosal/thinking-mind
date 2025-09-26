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
  budget: apiUrl + 'items/presupuesto',
  files: apiUrl + 'files',
  users: apiUrl + 'users',
  assets: apiUrl + 'assets',
  colegio_cursos: apiUrl + 'items/colegios_cursos',
  security: {
    login: apiUrl + 'auth/login',
    logout: apiUrl + 'auth/logout',
    refresh: apiUrl + 'auth/refresh',
    me: apiUrl + 'users/me',
  },

  //Flujos
  manual_payment: apiUrl + 'flows/trigger/2b02aa2e-58ca-48a0-a360-84861acd0692',
  total_accounts: apiUrl + 'flows/trigger/6dd2a98f-b283-46b5-9a36-5dd1d4f9adc9',
  payment_record: apiUrl + 'flows/trigger/7e95991a-52b2-4208-a423-ae5cdb52b163',
  search_cliente: apiUrl + 'flows/trigger/f88c7b92-e1b2-4a50-851d-9afb8c971c19',
  search_student: apiUrl + 'flows/trigger/08fe708c-06b9-4da1-95f2-448cf5015b10',
  list_student_school: apiUrl + 'flows/trigger/b843f482-7a50-4a5a-8d93-f78a04fc2b80',
  getBudget: apiUrl + 'flows/trigger/7a82a287-639b-42e3-a382-8f5e01d754ad',
  payment_wompi: apiUrl + 'flows/trigger/0ba476c9-3c23-486f-8b79-f3f7fceab4e4',
  return: apiUrl + 'flows/trigger/bcb42dd5-5119-4c09-96c6-cbed0e6e106f',
  tarifa_wompi: apiUrl + 'items/tarifa_wompi',

  // Configuración de Wompi
  wompi: {
    // ⚠️ IMPORTANTE: Cambiar testMode a false SOLO cuando tengas las claves de producción REALES
    testMode: false, // ✅ MODO PRUEBA - Pagos simulados (seguro para testing en producción)

    // URLs base de Wompi según el ambiente
    sandboxUrl: 'https://sandbox.wompi.co/v1',
    productionUrl: 'https://production.wompi.co/v1',

    // Llaves de prueba (FUNCIONAN CORRECTAMENTE)
    test: {
      publicKey: 'pub_test_HDn6WhxEGVzryUl66FkUiPbXI2GsuDUB',
      integrityKey: 'test_integrity_7pRzKXXTFoawku4E8lAMTQmMg3iEhCOY'
    },

    // Llaves de producción
    prod: {
      publicKey: 'pub_prod_aDinMfCvarfkhNiAQKzdm7cFDy6Szeuy',
      integrityKey: 'prod_integrity_Uma95tilbzOeU81QAycPinIM4Vtova3V'
    },

    redirectUrl: 'http://appthinkingmind.com/payment-status'
  }
};
