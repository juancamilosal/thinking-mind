import { Routes } from '@angular/router';
import { PublicLayout } from './layouts/public-layout/public-layout';
import { Login } from './layouts/public-layout/pages/login/login';
import { PrivateLayout } from './layouts/private-layout/private-layout';
import { Clients } from './layouts/private-layout/pages/clients/clients';
import { Students } from './layouts/private-layout/pages/students/students';
import { Schools } from './layouts/private-layout/pages/schools/schools';
import { Courses } from './layouts/private-layout/pages/courses/courses';
import { AccountsReceivable } from './layouts/private-layout/pages/accounts-receivable/accounts-receivable';

export const routes: Routes = [
  {
    pathMatch: 'full',
    path: '',
    redirectTo: 'public'
  },
  {
    path: 'public',
    component: PublicLayout,
    children: [
      {
        pathMatch: 'full',
        path: '',
        redirectTo: 'login'
      },
      {
        path: 'login',
        title: 'Thinking Mind | Login',
        component: Login
      },
    ]
  },
  {
    path: 'private',
    component: PrivateLayout,
    children: [
      {
        pathMatch: 'full',
        path: '',
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
        path: 'courses',
        title: 'Thinking Mind | Cursos',
        component: Courses
      },
      {
        path: 'accounts-receivable',
        title: 'Thinking Mind | Cuentas por Cobrar',
        component: AccountsReceivable
      }
    ]
  }
];
