import { Routes } from '@angular/router';
import { PublicLayout } from './layouts/public-layout/public-layout';
import { Login } from './layouts/public-layout/pages/login/login';
import { PrivateLayout } from './layouts/private-layout/private-layout';
import { Clients } from './layouts/private-layout/pages/clients/clients';
import { Students } from './layouts/private-layout/pages/students/students';
import { Schools } from './layouts/private-layout/pages/schools/schools';
import { Courses } from './layouts/private-layout/pages/courses/courses';
import { AccountsReceivable } from './layouts/private-layout/pages/accounts-receivable/accounts-receivable';
import { Payments } from './layouts/private-layout/pages/payments/payments';
import {PaymentRecord} from './layouts/public-layout/pages/payment-record/payment-record';
import { PaymentStatusComponent } from './layouts/public-layout/pages/payment-record/payment-status/payment-status.component';
import { Reports } from './layouts/private-layout/pages/reports/reports';
import { Presupuesto } from './layouts/private-layout/pages/reports/presupuesto/presupuesto';
import { BudgetReport } from './layouts/private-layout/pages/reports/budget-report/budget-report';
import { ListSchool } from './layouts/private-layout/pages/list-schools/list.school';
import { StudentsSchool } from './layouts/private-layout/pages/students-school/students-school';
import { Dashboard } from './layouts/private-layout/pages/dashboard/dashboard';
import { Users } from './layouts/private-layout/pages/users/users';
import { authGuard } from './core/guards/auth.guard';
import { ShirtColor } from './layouts/private-layout/pages/list-schools/shirt-colors/shirt.color';


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
    path: 'payment-status',
    title: 'Thinking Mind | Estado de Pago',
    component: PaymentStatusComponent
  },
  {
    path: 'private',
    component: PrivateLayout,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      },
      {
        path: 'dashboard',
        title: 'Thinking Mind | Dashboard',
        component: Dashboard
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
        path: 'users',
        title: 'Thinking Mind | Users',
        component: Users
      },
      {
        path: 'courses',
        title: 'Thinking Mind | Programas',
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
      {
        path: 'presupuesto',
        title: 'Thinking Mind | Gestión de Presupuesto',
        component: Presupuesto
      },
      {
        path: 'budget-report',
        title: 'Thinking Mind | Informe de Presupuesto',
        component: BudgetReport
      },
      {
        path: 'list-schools',
        title: 'Thinking Mind | Listado del Colegio',
        component: ListSchool
      },
      {
        path: 'students-school/:schoolId',
        title: 'Thinking Mind | Estudiantes del Colegio',
        component: StudentsSchool
      },
      {
        path: 'shirt-colors',
        title: 'Thinking Mind | Colores de Camisetas',
        component: ShirtColor
      },
      {
        path: '**',
        redirectTo: '/login'
      }
    ]
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];
