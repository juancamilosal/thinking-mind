import { Routes } from '@angular/router';
import {PublicLayout} from './layouts/public-layout/public-layout';
import {Login} from './layouts/public-layout/pages/login/login';

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
  }
];
