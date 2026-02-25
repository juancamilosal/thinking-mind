import { Routes, UrlSegment } from '@angular/router';
import { PublicLayout } from './layouts/public-layout/public-layout';
import { Login } from './layouts/public-layout/pages/login/login';
import { PrivateLayout } from './layouts/private-layout/private-layout';
import { Clients } from './layouts/private-layout/pages/clients/clients';
import { Students } from './layouts/private-layout/pages/students/students';
import { Schools } from './layouts/private-layout/pages/schools/schools';
import { Courses } from './layouts/private-layout/pages/courses/courses';
import { AccountsReceivable } from './layouts/private-layout/pages/accounts-receivable/accounts-receivable';
import { Payments } from './layouts/private-layout/pages/payments/payments';
import { PaymentRecord } from './layouts/public-layout/pages/payment-record/payment-record';
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
import { ColegioCursosComponent } from './layouts/private-layout/pages/courses/form-colegio-cursos/form-colegio-cursos';
import { ListMeet } from './layouts/private-layout/pages/ayo/list-meet/list-meet';
import { AyoComponent } from './layouts/private-layout/pages/ayo/ayo';
import { FormProgramaAyoComponent } from './layouts/private-layout/pages/ayo/form-programa-ayo/form-programa-ayo';
import { FormMeetGeneralComponent } from './layouts/private-layout/pages/ayo/general-meeting/form-meet-general/form-meet-general';
import { GeneralMeetingComponent } from './layouts/private-layout/pages/ayo/general-meeting/general-meeting';
import { SessionExpiredComponent } from './layouts/public-layout/pages/session-expired/session-expired';
import { ayoRoutes } from './ayo.routes';
import { PayrollAdmin } from './layouts/private-layout/pages/payroll-admin/payroll-admin';
import { TeacherEvaluationAyoComponent } from './layouts/private-layout/pages/ayo/teacher-evaluation-ayo/teacher-evaluation-ayo';
import { StudentEvaluationAyoComponent } from './layouts/private-layout/pages/ayo/student-evaluation-ayo/student-evaluation-ayo';
import { Advertising } from './layouts/private-layout/pages/advertising/advertising';
import {
  AccountReceivableDetailComponent
} from './layouts/private-layout/pages/accounts-receivable/accout-receivable-detail/account-receivable-detail';
import { AccountsReceivableAyo } from './layouts/private-layout/pages/accounts-receivable-ayo/accounts-receivable-ayo';


export const routes: Routes = [
  ...ayoRoutes,
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
    path: 'session-expired',
    title: 'Thinking Mind | Sesión Expirada',
    component: SessionExpiredComponent
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
        path: 'accounts-receivable/:id',
        title: 'Thinking Mind | Detalle de Cuenta por Cobrar',
        component: AccountReceivableDetailComponent
      },
      {
        path: 'accounts-receivable-ayo',
        title: 'Thinking Mind | Cuentas por Cobrar AYO',
        component: AccountsReceivableAyo
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
        path: 'advertising',
        title: 'Thinking Mind | Publicidad',
        component: Advertising
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
        path: 'form-colegio-cursos',
        title: 'Thinking Mind | Colegio Cursos',
        component: ColegioCursosComponent
      },
      {
        path: 'ayo',
        pathMatch: 'full',
        title: 'Thinking Mind | AYO',
        component: AyoComponent
      },
      {
        path: 'ayo/create',
        title: 'Thinking Mind | Crear Programa AYO',
        component: FormProgramaAyoComponent
      },
      {
        path: 'ayo/create-general-meet',
        title: 'Thinking Mind | Crear Reunión General',
        component: FormMeetGeneralComponent
      },
      {
        path: 'ayo/general-meeting',
        title: 'Thinking Mind | Reuniones Generales',
        component: GeneralMeetingComponent
      },
      {
        path: 'ayo/list-meet',
        title: 'Thinking Mind | Reuniones AYO',
        component: ListMeet
      },
      {
        path: 'ayo/teacher-evaluation',
        title: 'Thinking Mind | Evaluación Docente AYO',
        component: TeacherEvaluationAyoComponent
      },
      {
        path: 'ayo/student-evaluation',
        title: 'Thinking Mind | Evaluación Estudiante AYO',
        component: StudentEvaluationAyoComponent
      },
      {
        path: 'payroll-admin',
        title: 'Thinking Mind | Administración de Nómina',
        component: PayrollAdmin
      },
      {
        path: '**',
        redirectTo: '/session-expired'
      }
    ]
  }
];
