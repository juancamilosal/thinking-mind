const apiUrl = 'http://directus-s0so4ogscgwg8s0g8k4s0ooo.77.37.96.16.sslip.io/';

export const environment = {
  clients: apiUrl + 'items/clientes',
  students: apiUrl + 'items/estudiantes',
  schools: apiUrl + 'items/colegios',
  courses: apiUrl + 'items/Cursos',
  accountsReceivable: apiUrl + 'items/cuentas_cobrar',
  payment: apiUrl + 'items/pagos',
  files: apiUrl + 'files',

  //Flujos
  manual_payment: apiUrl + 'flows/trigger/2b02aa2e-58ca-48a0-a360-84861acd0692',
  total_accounts: apiUrl + 'flows/trigger/6dd2a98f-b283-46b5-9a36-5dd1d4f9adc9'
};

