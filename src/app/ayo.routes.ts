import { Routes } from '@angular/router';
import { LoginAyo } from './layouts/public-layout/pages/login-ayo/login-ayo';
import { PaymentRecordAyoComponent } from './layouts/public-layout/pages/payment-record-ayo/payment-record-ayo';
import { PrivateLayoutAyo } from './layouts/private-layout-ayo/private-layout-ayo';
import { DashboardAyo } from './layouts/private-layout-ayo/pages/dashboard/dashboard-ayo';
import { LangTest } from './layouts/private-layout-ayo/pages/langTest/langTest';
import { MeetComponent } from './layouts/private-layout-ayo/pages/meet/meet';
import { Teacher } from './layouts/private-layout-ayo/pages/teacher/teacher';
import { TeacherMeetingsComponent } from './layouts/private-layout-ayo/pages/meet/meet-teacher/meet-teacher';
import { Advance } from './layouts/private-layout-ayo/pages/advance/advance';
import { AttendancePageComponent } from './layouts/private-layout-ayo/pages/attendance/attendance.component';
import { CertificatesComponent } from './layouts/private-layout-ayo/pages/certificates/certificates';
import { authGuard } from './core/guards/auth.guard';

export const ayoRoutes: Routes = [
  {
    path: 'login-ayo',
    title: 'Thinking Mind | Validación de Ingreso',
    component: LoginAyo
  },
  {
    path: 'payment-record-ayo',
    title: 'Thinking Mind | Registro de Pago AYO',
    component: PaymentRecordAyoComponent
  },
  {
    path: 'private-ayo',
    component: PrivateLayoutAyo,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard-ayo'
      },
      {
        path: 'dashboard-ayo',
        title: 'Thinking Mind | Dashboard',
        component: DashboardAyo
      },
      {
        path: 'langTest',
        title: 'Thinking Mind | Language Test',
        component: LangTest
      },
      {
        path: 'meetings',
        title: 'Thinking Mind | Reuniones Estudiante',
        component: MeetComponent
      },
      {
        path: 'teacher',
        title: 'Thinking Mind | Pantalla Profesor',
        component: Teacher
      },
      {
        path: 'teacher/meetings',
        title: 'Thinking Mind | Mis Reuniones',
        component: TeacherMeetingsComponent
      },
      {
        path: 'advance',
        title: 'Thinking Mind | Advance',
        component: Advance
      },
      {
        path: 'attendance',
        title: 'Thinking Mind | Asistencia',
        component: AttendancePageComponent
      },
      {
        path: 'certificates',
        title: 'Thinking Mind | Certificados',
        component: CertificatesComponent
      },
      {
        path: '**',
        redirectTo: 'dashboard-ayo'
      }
    ]
  }
];
