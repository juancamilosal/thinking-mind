import { Routes } from '@angular/router';
import { PublicLayout } from './layouts/public-layout/public-layout';
import { Login } from './layouts/public-layout/pages/login/login';
import { PrivateLayout } from './layouts/private-layout/private-layout';
import { Clients } from './layouts/private-layout/pages/clients/clients';
import { Students } from './layouts/private-layout/pages/students/students';
import { Schools } from './layouts/private-layout/pages/schools/schools';
import { Rectores } from './layouts/private-layout/pages/rectores/rectores';
import { Courses } from './layouts/private-layout/pages/courses/courses';
import { AccountsReceivable } from './layouts/private-layout/pages/accounts-receivable/accounts-receivable';
import { Payments } from './layouts/private-layout/pages/payments/payments';
import {PaymentRecord} from './layouts/public-layout/pages/payment-record/payment-record';
import { Reports } from './layouts/private-layout/pages/reports/reports';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login'
  },
  {
    path: 'login',
    title: 'Thinking Mind | Login',
    component: Login
  },
  {
    path: 'payment-record',
    title: 'Thinking Mind | Payment Registro de Pago',
    component: PaymentRecord
  },
  {
    path: 'private',
    component: PrivateLayout,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'clients'
      },
      {
        path: 'clients',
        title: 'Thinking Mind | Clientes',
        component: Clients
      },
      {
        path: 'students',
        title: 'Thinking Mind | Estudiantes',
        component: Students
      },
      {
        path: 'schools',
        title: 'Thinking Mind | Colegios',
        component: Schools
      },
      {
        path: 'rectores',
        title: 'Thinking Mind | Rectores',
        component: Rectores
      },
      {
        path: 'courses',
        title: 'Thinking Mind | Cursos',
        component: Courses
      },
      {
        path: 'accounts-receivable',
        title: 'Thinking Mind | Cuentas por Cobrar',
        component: AccountsReceivable
      },
      {
        path: 'payments',
        title: 'Thinking Mind | Pagos',
        component: Payments
      },
      {
        path: 'reports',
        title: 'Thinking Mind | Reportes',
        component: Reports
      },
      // Ruta wildcard para rutas no encontradas dentro de private
      {
        path: '**',
        redirectTo: '/login'
      }
    ]
  },
  // Ruta wildcard global para cualquier ruta no encontrada
  {
    path: '**',
    redirectTo: '/login'
  }
];
