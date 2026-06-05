import { Component, OnInit } from '@angular/core';

import { Router } from '@angular/router';
import { SchoolService } from '../../../../core/services/school.service';
import { AccountReceivableService } from '../../../../core/services/account-receivable.service';
import { SchoolWithPaymentsService } from '../../../../core/services/school-with-payments.service';
import { School } from '../../../../core/models/School';
import { AccountReceivable } from '../../../../core/models/AccountReceivable';
import { Student } from '../../../../core/models/Student';
import { NotificationService } from '../../../../core/services/notification.service';
import { StudentDetail } from '../students/student-detail/student-detail';
import { Client } from '../../../../core/models/Clients';
import { Roles } from '../../../../core/const/Roles';
import {
  SchoolWithAccounts,
  StudentWithAccount,
  CourseWithStudentsAlternative,
  SchoolWithCourses,
  CourseWithSchools,
  SchoolInCourse
} from '../../../../core/models/SchoolModels';
import {AppButtonComponent} from '../../../../components/app-button/app-button.component';

@Component({
  selector: 'app-list-schools',
  standalone: true,
  imports: [StudentDetail, AppButtonComponent],
  templateUrl: './list.school.html'
})


export class ListSchool implements OnInit {
  schoolsWithAccounts: SchoolWithAccounts[] = [];
  schoolsWithCourses: SchoolWithCourses[] = [];
  coursesWithSchools: CourseWithSchools[] = [];
  isLoading = false;
  showDetail = false;
  selectedStudent: Student | null = null;
  selectedClient: Client | null = null;
  searchTerm = '';
  schoolSuggestions: School[] = [];
  showSchoolSuggestions = false;
  isLoadingSchoolSuggestions = false;
  selectedSchoolId: string | null = null;
  yearFilter = '';
  sortByInscriptionDate = false; // Nueva propiedad para el filtro de ordenamiento por fecha de inscripción
  currentDate = new Date();
  isRector = false;
  isSales = false;
  private searchTimeout: any;
  private blurTimeout: any;

  // Modo de vista: 'table' para listado completo, 'courses' para vista por cursos
  viewMode: 'table' | 'courses' = 'table';

  // Paginación
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;
  itemsPerPageOptions = [10, 15, 25, 50];

  // Para usar Math en el template
  Math = Math;

  constructor(
    private schoolService: SchoolService,
    private accountReceivableService: AccountReceivableService,
    private schoolWithPaymentsService: SchoolWithPaymentsService,
    private notificationService: NotificationService,
    private router: Router
  ) { }

  // Método público para usar en el template
  isWillGoCourse(courseName: string): boolean {
    if (!courseName) return false;

    const willGoVariants = [
      'will-go(estándar)',
      'will-go(segundo hermano)',
      'will-go(tercer hermano)',
      'will - go(estándar)',
      'will - go(segundo hermano)',
      'will - go(tercer hermano)',
      'will-go (estándar)',
      'will-go (segundo hermano)',
      'will-go (tercer hermano)',
      'will go',
      'will-go'
    ];

    const normalizedName = courseName.toLowerCase().trim();
    return willGoVariants.some(variant =>
      normalizedName.includes(variant) ||
      normalizedName === variant
    );
  }

  isIndependentProgramSchool(school: School): boolean {
    const name = (school?.nombre || '').toLowerCase().trim();
    return name === 'programa independiente' || name.includes('programa independiente');
  }

  ngOnInit(): void {
    const userData = sessionStorage.getItem('current_user');
    const user = JSON.parse(userData);
    if (user.role === Roles.RECTOR && user.colegio_id) {
      this.loadSchools();
    }
  }

  loadSchools(): void {
    this.isLoading = true;

    // Verificar si el usuario es rector o ventas
    const userData = sessionStorage.getItem('current_user');
    if (userData) {
      const user = JSON.parse(userData);

      // Si es rector, filtrar por su colegio_id
      if (user.role === Roles.RECTOR && user.colegio_id) {
        this.isRector = true;
        this.loadAccountsForSchool(user.colegio_id);
        return;
      }

      // Si es ventas, establecer la bandera
      if (user.role === Roles.SALES) {
        this.isSales = true;
      }
    }

    // Para ventas/admin: solo cargar información cuando se seleccione un colegio
    this.clearResults();
    this.isLoading = false;
  }

  private loadAllAccountsReceivable(): void {
    // Usar el nuevo servicio que solo trae cuentas con pagos
    const term = this.searchTerm?.trim();
    const request$ = term
      ? this.schoolWithPaymentsService.getAccountsWithPaymentsAll(term, this.yearFilter, this.sortByInscriptionDate, false)
      : this.schoolWithPaymentsService.getAccountsWithPayments(1, 1000, undefined, this.yearFilter, this.sortByInscriptionDate, false);

    request$.subscribe({
      next: (response) => {
        this.processAccountsReceivable(response.data);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar cuentas:', error);
        this.notificationService.showError(
          'Error',
          'Error al cargar las cuentas por cobrar'
        );
        this.isLoading = false;
      }
    });
  }

  private loadAccountsForSchool(schoolId: string): void {
    // Usar el nuevo servicio que solo trae cuentas con pagos para el colegio específico
    const term = this.searchTerm?.trim();
    const request$ = term
      ? this.schoolWithPaymentsService.getAccountsWithPaymentsBySchoolAll(schoolId, term, this.yearFilter, this.sortByInscriptionDate, false)
      : this.schoolWithPaymentsService.getAccountsWithPaymentsBySchool(schoolId, 1, 1000, this.yearFilter, this.sortByInscriptionDate, false);

    request$.subscribe({
      next: (response) => {
        this.processAccountsReceivable(response.data);
        this.isLoading = false;
      },
      error: (error) => {
        this.notificationService.showError(
          'Error',
          'Error al cargar las cuentas del colegio'
        );
        this.isLoading = false;
      }
    });
  }

  private loadAccountsForSelectedSchool(schoolId: string): void {
    this.isLoading = true;
    this.schoolWithPaymentsService
      .getAccountsWithPaymentsBySchoolAll(schoolId, undefined, this.yearFilter, this.sortByInscriptionDate, false)
      .subscribe({
        next: (response) => {
          this.processAccountsReceivable(response.data);
          this.isLoading = false;
        },
        error: () => {
          this.notificationService.showError('Error', 'Error al cargar las cuentas del colegio');
          this.isLoading = false;
        }
      });
  }

  private processAccountsReceivable(accounts: AccountReceivable[]): void {
    const targetYear = this.getTargetInscriptionYear();
    const saldoFilteredAccounts = (accounts || []).filter(account => this.hasPositiveSaldo(account));
    const filteredAccounts =
      targetYear === null
        ? saldoFilteredAccounts
        : saldoFilteredAccounts.filter(account => this.isAccountInInscriptionYear(account, targetYear));

    // Agrupar por colegio
    const schoolsMap = new Map<string, SchoolWithAccounts>();
    filteredAccounts.forEach((account, index) => {
      // Verificar que el account tenga la estructura esperada
      const studentSource: any =
        (account as any)?.estudiante_id && typeof (account as any).estudiante_id === 'object'
          ? (account as any).estudiante_id
          : ((account as any)?.id_inscripcion?.estudiante_id && typeof (account as any).id_inscripcion.estudiante_id === 'object'
              ? (account as any).id_inscripcion.estudiante_id
              : null);

      if (studentSource) {
        {
          const student = studentSource;
          // Verificar que el estudiante tenga colegio_id
          if (student.colegio_id) {
            if (typeof student.colegio_id === 'object') {
              const school = student.colegio_id;
              const schoolId = school.id;
              if (!schoolsMap.has(schoolId)) {
                schoolsMap.set(schoolId, {
                  school: school,
                  accountsCount: 0,
                  studentsCount: 0,
                  totalAmount: 0,
                  accounts: []
                });
              }

              const schoolData = schoolsMap.get(schoolId)!;
              schoolData.accounts.push(account);
              schoolData.accountsCount++;
              schoolData.totalAmount += account.monto;
            } else {
              console.warn('⚠️ colegio_id no es un objeto:', student.colegio_id);
            }
          } else {
            console.warn('⚠️ Estudiante sin colegio_id:', student);
          }
        }
      } else {
        console.warn('⚠️ Cuenta sin estudiante expandido:', account);
      }
    });
    // Calcular total de estudiantes incluyendo duplicados (por cada cuenta/curso)
    schoolsMap.forEach((schoolData, schoolId) => {
      // Contar todas las cuentas que tienen estudiante (incluyendo duplicados)
      let studentsCount = 0;
      schoolData.accounts.forEach(account => {
        const studentSource: any =
          (account as any)?.estudiante_id && typeof (account as any).estudiante_id === 'object'
            ? (account as any).estudiante_id
            : ((account as any)?.id_inscripcion?.estudiante_id && typeof (account as any).id_inscripcion.estudiante_id === 'object'
                ? (account as any).id_inscripcion.estudiante_id
                : null);
        if (studentSource) {
          studentsCount++;
        }
      });
      schoolData.studentsCount = studentsCount;
    });

    this.schoolsWithAccounts = Array.from(schoolsMap.values());
    // Procesar datos para vista por cursos con las cuentas filtradas
    this.processCoursesData(filteredAccounts);

    this.totalItems = this.schoolsWithAccounts.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
  }

  private getTargetInscriptionYear(): number | null {
    const trimmed = (this.yearFilter || '').toString().trim();
    if (!trimmed) return null;

    const parsed = parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private isAccountInInscriptionYear(account: AccountReceivable, targetYear: number): boolean {
    const dateValue = account?.fecha_inscripcion || (account as any)?.id_inscripcion?.fecha_inscripcion;
    if (!dateValue) return false;

    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) return false;

    return parsedDate.getFullYear() === targetYear;
  }

  getEffectiveSaldo(account: AccountReceivable): number {
    const saldoCuenta = this.toNumber((account as any)?.saldo);
    const saldoInscripcion = this.toNumber((account as any)?.id_inscripcion?.saldo);
    return Math.max(saldoCuenta, saldoInscripcion);
  }

  private hasPositiveSaldo(account: AccountReceivable): boolean {
    return this.getEffectiveSaldo(account) > 0;
  }

  onSearchInputChange(event: any): void {
    this.searchTerm = event.target.value;
    this.currentPage = 1; // Resetear a la primera página al cambiar búsqueda
    this.selectedSchoolId = null;
    this.clearResults();

    // Limpiar el timeout anterior si existe
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    const trimmed = (this.searchTerm || '').trim();
    if (!trimmed) {
      this.schoolSuggestions = [];
      this.showSchoolSuggestions = false;
      this.isLoadingSchoolSuggestions = false;
      return;
    }

    this.searchTimeout = setTimeout(() => {
      this.fetchSchoolSuggestions(trimmed);
    }, 300);
  }

  onYearFilterChange(event: any): void {
    this.yearFilter = event.target.value;
    this.currentPage = 1; // Resetear a la primera página al cambiar filtro

    // Limpiar el timeout anterior si existe
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Establecer un nuevo timeout para la búsqueda
    this.searchTimeout = setTimeout(() => {
      if (this.isRector || this.selectedSchoolId) {
        this.searchSchools();
      }
    }, 500); // Esperar 500ms después de que el usuario deje de escribir
  }

  onSortByInscriptionChange(): void {
    this.sortByInscriptionDate = !this.sortByInscriptionDate;
    if (this.isRector || this.selectedSchoolId) {
      this.searchSchools();
    }
  }

  searchSchools(): void {
    this.isLoading = true;

    if (this.isRector) {
      const userData = sessionStorage.getItem('current_user');
      if (userData) {
        const user = JSON.parse(userData);
        this.loadAccountsForSchool(user.colegio_id);
        return;
      }
      this.isLoading = false;
      return;
    }

    if (this.selectedSchoolId) {
      this.loadAccountsForSelectedSchool(this.selectedSchoolId);
      return;
    }

    this.clearResults();
    this.isLoading = false;
  }

  onSearch(): void {
    this.currentPage = 1; // Resetear a la primera página al buscar
    if (this.isRector || this.selectedSchoolId) {
      this.searchSchools();
    }
  }

  onSearchFocus(): void {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
    }
    if (this.schoolSuggestions.length > 0) {
      this.showSchoolSuggestions = true;
    }
  }

  onSearchBlur(): void {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
    }
    this.blurTimeout = setTimeout(() => {
      this.showSchoolSuggestions = false;
    }, 150);
  }

  selectSchoolSuggestion(school: School): void {
    if (!school?.id) return;
    this.selectedSchoolId = school.id;
    this.searchTerm = school.nombre || '';
    this.schoolSuggestions = [];
    this.showSchoolSuggestions = false;
    this.searchSchools();
  }

  private clearResults(): void {
    this.schoolsWithAccounts = [];
    this.schoolsWithCourses = [];
    this.coursesWithSchools = [];
    this.totalItems = 0;
    this.totalPages = 0;
  }

  private fetchSchoolSuggestions(term: string): void {
    const safeTerm = (term || '').trim();
    if (safeTerm.length < 2) {
      this.schoolSuggestions = [];
      this.showSchoolSuggestions = false;
      this.isLoadingSchoolSuggestions = false;
      return;
    }

    this.isLoadingSchoolSuggestions = true;
    this.schoolService.searchSchool(safeTerm, 1, 10).subscribe({
      next: (resp) => {
        this.schoolSuggestions = Array.isArray(resp?.data) ? resp.data : [];
        this.showSchoolSuggestions = this.schoolSuggestions.length > 0;
        this.isLoadingSchoolSuggestions = false;
      },
      error: () => {
        this.schoolSuggestions = [];
        this.showSchoolSuggestions = false;
        this.isLoadingSchoolSuggestions = false;
      }
    });
  }

  // Métodos de paginación
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      if (this.searchTerm) {
        this.searchSchools();
      } else {
        this.loadSchools();
      }
    }
  }

  goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);

    // Ajustar el inicio si estamos cerca del final
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  onItemsPerPageChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.itemsPerPage = parseInt(target.value);
    this.currentPage = 1;
    if (this.searchTerm) {
      this.searchSchools();
    } else {
      this.loadSchools();
    }
  }

  navigateToStudents(schoolId: string): void {
    this.router.navigate(['/private/students-school', schoolId]);
  }

  toggleSchoolStudents(schoolData: SchoolWithAccounts): void {
    schoolData.showStudents = !schoolData.showStudents;

    if (schoolData.showStudents) {
      this.loadSchoolStudents(schoolData);
    }
  }

  loadSchoolStudents(schoolData: SchoolWithAccounts): void {
    schoolData.isLoadingStudents = true;

    // Crear un array de estudiantes con sus cuentas (permitir duplicados)
    const studentsWithAccounts: StudentWithAccount[] = [];

    schoolData.accounts.forEach(account => {
      if (!this.hasPositiveSaldo(account)) return;
      const studentSource: any =
        (account as any)?.estudiante_id && typeof (account as any).estudiante_id === 'object'
          ? (account as any).estudiante_id
          : ((account as any)?.id_inscripcion?.estudiante_id && typeof (account as any).id_inscripcion.estudiante_id === 'object'
              ? (account as any).id_inscripcion.estudiante_id
              : null);

      if (studentSource) {
        studentsWithAccounts.push({
          student: studentSource,
          account: account
        });
      }
    });

    schoolData.students = studentsWithAccounts;
    schoolData.isLoadingStudents = false;
  }

  isStudentNewToday(student: Student): boolean {
    // Lógica para determinar si el estudiante es nuevo hoy
    // Como el modelo Student no tiene created_at, usaremos otra lógica
    // Por ejemplo, basándose en accountInfo o simplemente retornar false por ahora

    if (student.accountInfo && student.accountInfo.created_at) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const createdDate = new Date(student.accountInfo.created_at);
      createdDate.setHours(0, 0, 0, 0);
      return createdDate.getTime() === today.getTime();
    }

    return false;
  }

  isSchoolNewToday(school: School): boolean {
    // Como el modelo School no tiene created_at, retornamos false por defecto
    // Esta funcionalidad se puede implementar cuando se agregue la propiedad al modelo
    return false;
  }

  navigateToShirts(): void {
    this.router.navigate(['/private/shirt-colors']);
  }

  navigateToShirtsForSchool(schoolId: string): void {
    const school = this.schoolsWithAccounts.find(s => s.school.id === schoolId) ||
      this.schoolsWithCourses.find(s => s.school.id === schoolId);

    this.router.navigate(['/private/shirt-colors'], {
      queryParams: {
        schoolId: schoolId,
        schoolName: school?.school.nombre || ''
      }
    });
  }

  updatePinEntregado(account: AccountReceivable, event: any): void {
    const isChecked = event.target.checked;
    const pinValue = isChecked ? 'SI' : 'NO';

    // Verificar si el saldo es mayor a 0 (nueva validación)
    if (this.getEffectiveSaldo(account) <= 0) {
      event.target.checked = !isChecked; // Revertir el checkbox
      return;
    }

    // Actualizar localmente primero
    account.pin_entregado = pinValue;

    // Preparar los datos para la actualización
    const updateData = {
      pin_entregado: pinValue
    };

    // Llamar al servicio para actualizar en Directus
    this.accountReceivableService.updateAccountReceivable(account.id, updateData).subscribe({
      next: (response) => {
        // Eliminar el modal/notificación de éxito
      },
      error: (error) => {
        // Revertir el cambio local si hay error
        account.pin_entregado = isChecked ? 'NO' : 'SI';
        event.target.checked = !isChecked;

        this.notificationService.showError(
          'Error al actualizar PIN',
          'No se pudo actualizar el estado del PIN. Intente nuevamente.'
        );
        console.error('Error updating pin_entregado:', error);
      }
    });
  }

  isPinEntregado(account: AccountReceivable): boolean {
    return account.pin_entregado === 'SI';
  }

  getPinEntregadoText(account: AccountReceivable): string {
    return account.pin_entregado === 'SI' ? 'Entregado' : 'Pendiente';
  }

  viewStudent(student: Student, account: AccountReceivable): void {
    this.selectedStudent = student;

    const clientSource: any =
      (account as any)?.cliente_id && typeof (account as any).cliente_id === 'object'
        ? (account as any).cliente_id
        : ((account as any)?.id_inscripcion?.cliente_id && typeof (account as any).id_inscripcion.cliente_id === 'object'
            ? (account as any).id_inscripcion.cliente_id
            : null);
    this.selectedClient = clientSource || null;

    this.showDetail = true;
  }

  closeDetail() {
    this.showDetail = false;
    this.selectedStudent = null;
    this.selectedClient = null;
  }

  editStudent(student: Student) {
    // Implementar lógica de edición si es necesario
    this.closeDetail();
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'table' ? 'courses' : 'table';
  }

  private processCoursesData(accounts: AccountReceivable[]): void {
    // Agrupar por colegio y luego por curso
    const schoolsMap = new Map<string, any>();

    accounts.forEach(account => {
      if (!this.hasPositiveSaldo(account)) return;

      const studentSource: any =
        (account as any)?.estudiante_id && typeof (account as any).estudiante_id === 'object'
          ? (account as any).estudiante_id
          : ((account as any)?.id_inscripcion?.estudiante_id && typeof (account as any).id_inscripcion.estudiante_id === 'object'
              ? (account as any).id_inscripcion.estudiante_id
              : null);
      const courseSource: any =
        (account as any)?.curso_id && typeof (account as any).curso_id === 'object'
          ? (account as any).curso_id
          : ((account as any)?.id_inscripcion?.curso_id && typeof (account as any).id_inscripcion.curso_id === 'object'
              ? (account as any).id_inscripcion.curso_id
              : null);

      if (studentSource && courseSource) {
        const student = studentSource;
        const course = courseSource;

        if (student.colegio_id && typeof student.colegio_id === 'object') {
          const school = student.colegio_id;
          const schoolId = school.id;

          // Crear entrada del colegio si no existe
          if (!schoolsMap.has(schoolId)) {
            schoolsMap.set(schoolId, {
              school: school,
              courses: new Map<string, any>(),
              totalStudents: 0,
              totalAmount: 0
            });
          }

          const schoolData = schoolsMap.get(schoolId)!;

          // Determinar si es un curso Will-Go y usar ID unificado
          const isWillGoCourse = this.isWillGoCourse(course.nombre);
          const courseId = isWillGoCourse ? 'will-go-unified' : course.id;

          // Crear entrada del curso dentro del colegio si no existe
          if (!schoolData.courses.has(courseId)) {
            const courseData = {
              course: isWillGoCourse ? {
                ...course,
                id: 'will-go-unified',
                nombre: 'WILL - GO'
              } : course,
              students: [],
              isExpanded: false
            };
            schoolData.courses.set(courseId, courseData);
          }

          const courseData = schoolData.courses.get(courseId)!;

          // Agregar estudiante al curso
          courseData.students.push({
            student: student,
            account: account
          });

          // Actualizar contadores
          schoolData.totalStudents++;
          schoolData.totalAmount += account.monto;
        }
      }
    });

    // Convertir Map a Array y ordenar
    this.schoolsWithCourses = Array.from(schoolsMap.values()).map(schoolData => ({
      ...schoolData,
      courses: Array.from(schoolData.courses.values())
    }));
  }

  toggleSchool(schoolIndex: number): void {
    if (this.schoolsWithCourses[schoolIndex]) {
      this.schoolsWithCourses[schoolIndex].isExpanded = !this.schoolsWithCourses[schoolIndex].isExpanded;
    }
  }

  toggleCourse(schoolIndex: number, courseIndex: number): void {
    if (this.schoolsWithCourses[schoolIndex] && this.schoolsWithCourses[schoolIndex].courses[courseIndex]) {
      this.schoolsWithCourses[schoolIndex].courses[courseIndex].isExpanded = !this.schoolsWithCourses[schoolIndex].courses[courseIndex].isExpanded;
    }
  }

  // Método para formatear fecha de inscripción
  formatInscriptionDate(account: AccountReceivable): string {
    if (account.fecha_inscripcion) {
      try {
        const date = new Date(account.fecha_inscripcion);
        return date.toLocaleDateString('es-CO', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
      } catch (error) {
        return 'Fecha no válida';
      }
    }
    return 'No disponible';
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  // Descargar Excel por colegio (vista de listado completo)
  async downloadSchoolExcel(schoolData: SchoolWithAccounts): Promise<void> {
    try {
      // Importación robusta de ExcelJS
      let ExcelJS: any;
      let Workbook: any;

      try {
        ExcelJS = await import('exceljs');
        if (ExcelJS.default && ExcelJS.default.Workbook) {
          Workbook = ExcelJS.default.Workbook;
        } else if (ExcelJS.Workbook) {
          Workbook = ExcelJS.Workbook;
        } else {
          throw new Error('No se pudo encontrar la clase Workbook');
        }
      } catch (importError) {
        console.error('Error al importar ExcelJS:', importError);
        throw new Error('No se pudo cargar la librería ExcelJS');
      }

      const workbook = new Workbook();
      const sheetName = this.sanitizeFileName(schoolData.school.nombre || 'Colegio');
      const worksheet = workbook.addWorksheet(sheetName.substring(0, 31)); // Límite de nombre de hoja en Excel

      // Encabezados - Incluye información de pagos
      worksheet.columns = [
        { header: 'Estudiante', key: 'estudiante', width: 28 },
        { header: 'Tipo Documento', key: 'tipo_documento', width: 16 },
        { header: 'Número Documento', key: 'numero_documento', width: 18 },
        { header: 'Grado', key: 'grado', width: 12 },
        { header: 'Curso', key: 'curso', width: 24 },
        { header: 'Estado de la Cuenta', key: 'estado', width: 18 },
        { header: 'Fecha de Inscripción', key: 'fecha_inscripcion', width: 20 },
        { header: 'Pin Entregado', key: 'pin_entregado', width: 16 },
        { header: 'Acudiente', key: 'acudiente', width: 28 },
        { header: 'Tipo Documento Acudiente', key: 'tipo_documento_acudiente', width: 20 },
        { header: 'Número Documento Acudiente', key: 'numero_documento_acudiente', width: 22 },
        { header: 'Celular Acudiente', key: 'celular_acudiente', width: 18 },
        { header: 'Email Acudiente', key: 'email_acudiente', width: 28 },
        { header: 'Valor Cuenta', key: 'valor_cuenta', width: 15 },
        { header: 'Monto Descuento', key: 'monto_descuento', width: 16 },
        { header: 'Valor Pago', key: 'valor_pago', width: 15 },
        { header: 'Fecha Pago', key: 'fecha_pago', width: 20 },
        { header: 'Método Pago', key: 'metodo_pago', width: 15 },
        { header: 'Total Pagos', key: 'total_pagos', width: 15 },
        { header: 'Saldo Pendiente', key: 'saldo_pendiente', width: 18 },
      ];

      // Datos por cuenta/estudiante con pagos
      for (const account of schoolData.accounts) {
        const student = (account.estudiante_id && typeof account.estudiante_id === 'object') ? account.estudiante_id : null;
        const course = (account.curso_id && typeof account.curso_id === 'object') ? account.curso_id : null;
        const client = (account.cliente_id && typeof account.cliente_id === 'object') ? account.cliente_id : null;
        const pagosPagados = (account.pagos || []).filter(pago => pago.estado === 'PAGADO');
        const totalPagos = pagosPagados.reduce((acc, p) => acc + this.toNumber((p as any)?.valor), 0);
        const valorCuenta = this.toNumber((account as any)?.monto);
        const montoDescuento = this.toNumber((account as any)?.monto_descuento);
        const baseParaResta = montoDescuento > 0 ? montoDescuento : valorCuenta;
        const saldoPendiente = baseParaResta - totalPagos;

        // Primero agregar la fila de la cuenta (sin datos de pagos)
        const accountRow = worksheet.addRow({
          estudiante: student ? `${student.nombre || ''} ${student.apellido || ''}` : 'Sin estudiante',
          tipo_documento: student?.tipo_documento || '',
          numero_documento: student?.numero_documento || '',
          grado: student?.grado || '',
          curso: course ? (this.isWillGoCourse(course.nombre) ? 'WILL - GO' : (course.nombre || '')) : 'Sin curso',
          estado: account.estado || '',
          fecha_inscripcion: account.fecha_inscripcion ? new Date(account.fecha_inscripcion).toLocaleDateString('es-CO') : '',
          pin_entregado: account.pin_entregado || 'NO',
          acudiente: client ? `${client.nombre || ''} ${client.apellido || ''}`.trim() : '',
          tipo_documento_acudiente: client?.tipo_documento || '',
          numero_documento_acudiente: client?.numero_documento || '',
          celular_acudiente: client?.celular || '',
          email_acudiente: client?.email || '',
          valor_cuenta: valorCuenta,
          monto_descuento: montoDescuento > 0 ? montoDescuento : '',
          valor_pago: '',
          fecha_pago: '',
          metodo_pago: '',
          total_pagos: totalPagos,
          saldo_pendiente: saldoPendiente,
        });

        // Aplicar estilo a la fila de la cuenta (fondo gris claro)
        accountRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
          };
        });

        if (pagosPagados.length > 0) {
          pagosPagados.forEach((pago, index) => {
            const paymentRow = worksheet.addRow({
              estudiante: '',
              tipo_documento: '',
              numero_documento: '',
              grado: '',
              curso: '',
              estado: '',
              fecha_inscripcion: '',
              pin_entregado: '',
              acudiente: '',
              tipo_documento_acudiente: '',
              numero_documento_acudiente: '',
              celular_acudiente: '',
              email_acudiente: '',
              valor_cuenta: '',
              monto_descuento: '',
              valor_pago: (pago as any)?.valor || 0,
              fecha_pago: (pago as any)?.fecha_pago ? new Date((pago as any).fecha_pago).toLocaleDateString('es-CO') : '',
              metodo_pago: (pago as any)?.metodo_pago || '',
              total_pagos: index === pagosPagados.length - 1 ? totalPagos : '',
              saldo_pendiente: index === pagosPagados.length - 1 ? saldoPendiente : '',
            });
          });
        }
      }

      // Estilo simple para encabezados
      worksheet.getRow(1).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      const schoolName = this.sanitizeFileName(schoolData.school.nombre || 'Colegio');
      const datePart = this.getColombiaDateStamp();
      const fileName = `Inscripciones ${schoolName} - ${datePart}.xlsx`;
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err: any) {
      this.notificationService.showError('Error al descargar', err?.message || 'No se pudo generar el Excel');
    }
  }

  // Descargar Excel por colegio desde la vista por cursos (por ID)
  async downloadSchoolExcelById(schoolId: string): Promise<void> {
    const schoolAccData = this.schoolsWithAccounts.find(s => s.school.id === schoolId);
    if (!schoolAccData) {
      this.notificationService.showError('No disponible', 'No se encontró información de cuentas para este colegio');
      return;
    }
    await this.downloadSchoolExcelByCourseTabs(schoolAccData);
  }

  private async downloadSchoolExcelByCourseTabs(schoolData: SchoolWithAccounts): Promise<void> {
    try {
      let ExcelJS: any;
      let Workbook: any;

      try {
        ExcelJS = await import('exceljs');
        if (ExcelJS.default && ExcelJS.default.Workbook) {
          Workbook = ExcelJS.default.Workbook;
        } else if (ExcelJS.Workbook) {
          Workbook = ExcelJS.Workbook;
        } else {
          throw new Error('No se pudo encontrar la clase Workbook');
        }
      } catch (importError) {
        console.error('Error al importar ExcelJS:', importError);
        throw new Error('No se pudo cargar la librería ExcelJS');
      }

      const workbook = new Workbook();

      const courseGroups = new Map<string, AccountReceivable[]>();

      for (const account of schoolData.accounts) {
        const course = (account.curso_id && typeof account.curso_id === 'object') ? account.curso_id : null;
        const courseName = course ? (this.isWillGoCourse(course.nombre) ? 'WILL - GO' : (course.nombre || 'Sin curso')) : 'Sin curso';
        const key = courseName.trim() || 'Sin curso';

        if (!courseGroups.has(key)) {
          courseGroups.set(key, []);
        }
        courseGroups.get(key)!.push(account);
      }

      if (courseGroups.size === 0) {
        const sheetName = this.getUniqueWorksheetName(workbook, this.sanitizeFileName(schoolData.school.nombre || 'Colegio'));
        const worksheet = workbook.addWorksheet(sheetName);
        this.setSchoolExcelColumns(worksheet);
        worksheet.getRow(1).font = { bold: true };
      } else {
        for (const [courseName, accounts] of courseGroups.entries()) {
          const sheetBaseName = this.sanitizeFileName(courseName || 'Curso');
          const sheetName = this.getUniqueWorksheetName(workbook, sheetBaseName);
          const worksheet = workbook.addWorksheet(sheetName);
          this.setSchoolExcelColumns(worksheet);

          for (const account of accounts) {
            this.appendAccountAndPaymentsRows(worksheet, account);
          }

          worksheet.getRow(1).font = { bold: true };
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      const schoolName = this.sanitizeFileName(schoolData.school.nombre || 'Colegio');
      const datePart = this.getColombiaDateStamp();
      const fileName = `Inscripciones ${schoolName} - ${datePart}.xlsx`;
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err: any) {
      this.notificationService.showError('Error al descargar', err?.message || 'No se pudo generar el Excel');
    }
  }

  private setSchoolExcelColumns(worksheet: any): void {
    worksheet.columns = [
      { header: 'Estudiante', key: 'estudiante', width: 28 },
      { header: 'Tipo Documento', key: 'tipo_documento', width: 16 },
      { header: 'Número Documento', key: 'numero_documento', width: 18 },
      { header: 'Grado', key: 'grado', width: 12 },
      { header: 'Curso', key: 'curso', width: 24 },
      { header: 'Estado de la Cuenta', key: 'estado', width: 18 },
      { header: 'Fecha de Inscripción', key: 'fecha_inscripcion', width: 20 },
      { header: 'Pin Entregado', key: 'pin_entregado', width: 16 },
      { header: 'Acudiente', key: 'acudiente', width: 28 },
      { header: 'Tipo Documento Acudiente', key: 'tipo_documento_acudiente', width: 20 },
      { header: 'Número Documento Acudiente', key: 'numero_documento_acudiente', width: 22 },
      { header: 'Celular Acudiente', key: 'celular_acudiente', width: 18 },
      { header: 'Email Acudiente', key: 'email_acudiente', width: 28 },
      { header: 'Valor Cuenta', key: 'valor_cuenta', width: 15 },
      { header: 'Monto Descuento', key: 'monto_descuento', width: 16 },
      { header: 'Valor Pago', key: 'valor_pago', width: 15 },
      { header: 'Fecha Pago', key: 'fecha_pago', width: 20 },
      { header: 'Método Pago', key: 'metodo_pago', width: 15 },
      { header: 'Total Pagos', key: 'total_pagos', width: 15 },
      { header: 'Saldo Pendiente', key: 'saldo_pendiente', width: 18 },
    ];
  }

  private appendAccountAndPaymentsRows(worksheet: any, account: AccountReceivable): void {
    const student = (account.estudiante_id && typeof account.estudiante_id === 'object') ? account.estudiante_id : null;
    const course = (account.curso_id && typeof account.curso_id === 'object') ? account.curso_id : null;
    const client = (account.cliente_id && typeof account.cliente_id === 'object') ? account.cliente_id : null;
    const pagosPagados = (account.pagos || []).filter(pago => pago.estado === 'PAGADO');
    const totalPagos = pagosPagados.reduce((acc, p) => acc + this.toNumber((p as any)?.valor), 0);
    const valorCuenta = this.toNumber((account as any)?.monto);
    const montoDescuento = this.toNumber((account as any)?.monto_descuento);
    const baseParaResta = montoDescuento > 0 ? montoDescuento : valorCuenta;
    const saldoPendiente = baseParaResta - totalPagos;

    const accountRow = worksheet.addRow({
      estudiante: student ? `${student.nombre || ''} ${student.apellido || ''}` : 'Sin estudiante',
      tipo_documento: student?.tipo_documento || '',
      numero_documento: student?.numero_documento || '',
      grado: student?.grado || '',
      curso: course ? (this.isWillGoCourse(course.nombre) ? 'WILL - GO' : (course.nombre || '')) : 'Sin curso',
      estado: account.estado || '',
      fecha_inscripcion: account.fecha_inscripcion ? new Date(account.fecha_inscripcion).toLocaleDateString('es-CO') : '',
      pin_entregado: account.pin_entregado || 'NO',
      acudiente: client ? `${client.nombre || ''} ${client.apellido || ''}`.trim() : '',
      tipo_documento_acudiente: client?.tipo_documento || '',
      numero_documento_acudiente: client?.numero_documento || '',
      celular_acudiente: client?.celular || '',
      email_acudiente: client?.email || '',
      valor_cuenta: valorCuenta,
      monto_descuento: montoDescuento > 0 ? montoDescuento : '',
      valor_pago: '',
      fecha_pago: '',
      metodo_pago: '',
      total_pagos: totalPagos,
      saldo_pendiente: saldoPendiente,
    });

    accountRow.eachCell((cell: any) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    });

    if (pagosPagados.length > 0) {
      pagosPagados.forEach((pago, index) => {
        const paymentRow = worksheet.addRow({
          estudiante: '',
          tipo_documento: '',
          numero_documento: '',
          grado: '',
          curso: '',
          estado: '',
          fecha_inscripcion: '',
          pin_entregado: '',
          acudiente: '',
          tipo_documento_acudiente: '',
          numero_documento_acudiente: '',
          celular_acudiente: '',
          email_acudiente: '',
          valor_cuenta: '',
          monto_descuento: '',
          valor_pago: (pago as any)?.valor || 0,
          fecha_pago: (pago as any)?.fecha_pago ? new Date((pago as any).fecha_pago).toLocaleDateString('es-CO') : '',
          metodo_pago: (pago as any)?.metodo_pago || '',
          total_pagos: index === pagosPagados.length - 1 ? totalPagos : '',
          saldo_pendiente: index === pagosPagados.length - 1 ? saldoPendiente : '',
        });
      });
    }
  }

  private toNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const cleaned = value.toString().replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private getUniqueWorksheetName(workbook: any, baseName: string): string {
    const safeBase = (baseName || 'Hoja').trim() || 'Hoja';
    const trimmedBase = safeBase.substring(0, 31);
    let name = trimmedBase;
    let i = 2;

    while (workbook.getWorksheet(name)) {
      const suffix = ` (${i})`;
      name = `${trimmedBase.substring(0, Math.max(1, 31 - suffix.length))}${suffix}`;
      i++;
    }

    return name;
  }

  private sanitizeFileName(name: string): string {
    // Permite espacios, elimina paréntesis y caracteres no válidos para nombres de archivo
    return (name || '')
      .replace(/[()]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .trim()
      .substring(0, 100);
  }

  private getColombiaDateStamp(): string {
    const formatter = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const map: Record<string, string> = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }
    // Formato seguro para nombre de archivo
    return `${map['year']}-${map['month']}-${map['day']}`;
  }

  private formatRectores(school: School): string {
    if (!school.rector_id || school.rector_id.length === 0) return '';
    return school.rector_id.map(r => `${(r as any).first_name || ''} ${(r as any).last_name || ''}`.trim()).join(', ');
  }

}
