import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';

import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CourseService } from '../../../../core/services/course.service';
import { Course } from '../../../../core/models/Course';
import { CourseCardComponent } from '../../../../components/course-card/course-card';
import { CourseInfoComponent } from '../../../../components/course-info/course-info';
import { AppButtonComponent } from '../../../../components/app-button/app-button.component';
import { FormCourse } from './form-course/form-course';
import { ColegioCursosComponent } from './form-colegio-cursos/form-colegio-cursos';
import { NotificationService } from '../../../../core/services/notification.service';
import { ColegioCursosService } from '../../../../core/services/colegio-cursos.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';

declare var gapi: any;
declare var google: any;

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
    CourseCardComponent,
    CourseInfoComponent,
    AppButtonComponent,
    FormCourse,
    ColegioCursosComponent
  ],
  templateUrl: './courses.html'
})

export class Courses {
  courseForm!: FormGroup;
  showForm = false;
  showCourseInfo = false;
  showDetail = false;
  showColegioForm = false;
  editMode = false;
  selectedCourse: Course | null = null;
  courses: Course[] = [];
  isLoading = false;
  searchTerm = '';
  private searchTimeout: any;

  // Utility method for Math functions in template
  Math = Math;

  // Variables para el modal de edición de fecha
  showEditModal = false;
  selectedColegioCurso: any = null;
  editFechaForm!: FormGroup;

  // Google Calendar Integration
  showGoogleCalendarOption = false;
  existingMeeting: any = null;
  isEditingMeeting = false;
  private CLIENT_ID = '996133721948-6rim847cd71sknq58u3tcov5drtag7vv.apps.googleusercontent.com';
  private DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  private SCOPES = 'https://www.googleapis.com/auth/calendar.events';
  tokenClient: any;
  gapiInited = false;
  gisInited = false;

  constructor(
    private fb: FormBuilder,
    private courseServices: CourseService,
    private colegioCursosService: ColegioCursosService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService,
    private ngZone: NgZone
  ) {
    this.initEditForm();
  }

  ngOnInit(): void {
    this.initForm();
    this.getCourse();
  }

  initEditForm(): void {
    this.editFechaForm = this.fb.group({
      fecha_finalizacion: [null, Validators.required],
      precio_curso: [null, Validators.required],
      programa_con_inscripcion: [false],
      precio_inscripcion: [null],
      moneda: ['CLP'],
      precio_especial_lanzamiento: [false],
      precio_especial: [null],
      fecha_finalizacion_precio_especial: [null],
      programa_independiente: [false],
      // Google Calendar Fields
      agendar_google_calendar: [false],
      evento_titulo: [''],
      evento_descripcion: [''],
      evento_inicio: [null],
      evento_fin: [null]
    });

    // Listen for Google Calendar checkbox changes
    this.editFechaForm.get('agendar_google_calendar')?.valueChanges.subscribe(value => {
      const controls = ['evento_titulo', 'evento_descripcion', 'evento_inicio', 'evento_fin'];
      if (value) {
        controls.forEach(c => this.editFechaForm.get(c)?.setValidators([Validators.required]));
      } else {
        controls.forEach(c => {
          this.editFechaForm.get(c)?.clearValidators();
          this.editFechaForm.get(c)?.setValue(null);
        });
      }
      controls.forEach(c => this.editFechaForm.get(c)?.updateValueAndValidity());
    });

    // Validación dinámica del precio especial
    const specialFlagCtrl = this.editFechaForm.get('precio_especial_lanzamiento');
    const specialPriceCtrl = this.editFechaForm.get('precio_especial');
    specialFlagCtrl?.valueChanges.subscribe((flag: boolean) => {
      if (flag) {
        specialPriceCtrl?.addValidators([Validators.required]);
      } else {
        specialPriceCtrl?.clearValidators();
        specialPriceCtrl?.setValue('', { emitEvent: false });
      }
      specialPriceCtrl?.updateValueAndValidity();
    });
  }

  loadGoogleScripts() {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => this.gapiLoaded();
    document.body.appendChild(script);

    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.onload = () => this.gisLoaded();
    document.body.appendChild(gisScript);
  }

  gapiLoaded() {
    gapi.load('client', async () => {
      await gapi.client.init({
        discoveryDocs: [this.DISCOVERY_DOC],
      });
      this.gapiInited = true;
    });
  }

  gisLoaded() {
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.CLIENT_ID,
      scope: this.SCOPES,
      callback: '', // defined later
    });
    this.gisInited = true;
  }

  handleCalendarAuthAndCreation(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.tokenClient.callback = async (resp: any) => {
        if (resp.error) {
          reject(resp);
          return;
        }
        try {
          const event = await this.createCalendarEvent();
          resolve(event);
        } catch (err) {
          reject(err);
        }
      };

      if (gapi.client.getToken() === null) {
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        this.tokenClient.requestAccessToken({ prompt: '' });
      }
    });
  }

  async createCalendarEvent() {
    const startDate = new Date(this.editFechaForm.get('evento_inicio')?.value);
    const endDate = new Date(this.editFechaForm.get('evento_fin')?.value);

    if (endDate <= startDate) {
      alert('Error: La fecha de finalización del evento debe ser posterior a la fecha de inicio.');
      throw new Error('Invalid date range');
    }

    const event = {
      summary: this.editFechaForm.get('evento_titulo')?.value,
      description: this.editFechaForm.get('evento_descripcion')?.value,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      conferenceData: {
        createRequest: {
          requestId: "req-" + Date.now(),
          conferenceSolutionKey: { type: "hangoutsMeet" }
        }
      }
    };

    const request = await gapi.client.calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1
    });
    return request.result;
  }

  toggleForm() {
    this.showForm = !this.showForm;
    this.editMode = false;
    this.selectedCourse = null;
    // Scroll al inicio de la página cuando se abre el formulario
    if (this.showForm) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Consultar el servicio para actualizar la lista cuando se regresa del formulario
    if (!this.showForm) {
      this.getCourse();
    }
  }

  initForm() {
    this.courseForm = this.fb.group({
      nombre: ['', Validators.required],
      precio: ['', Validators.required],
      codigo: ['', Validators.required]
    });
  }

  getCourse(searchTerm?: string) {
    this.isLoading = true;
    this.courseServices.searchCourse(searchTerm).subscribe({
      next: (data) => {
        // Ordenar los cursos alfabéticamente por nombre
        this.courses = data.data.sort((a, b) =>
          a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase())
        );
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading courses:', error);
        this.isLoading = false;
      }
    });
  }

  onSearch() {
    this.getCourse(this.searchTerm.trim() || undefined);
  }

  onSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm = target.value;

    // Limpiar timeout anterior
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Si el campo está vacío, buscar inmediatamente
    if (this.searchTerm.trim() === '') {
      this.getCourse();
      return;
    }

    // Establecer nuevo timeout para búsqueda automática
    this.searchTimeout = setTimeout(() => {
      this.getCourse(this.searchTerm.trim() || undefined);
    }, 300); // Reducido a 300ms para mayor responsividad
  }

  // Método mejorado para limpiar búsqueda
  clearSearch() {
    this.searchTerm = '';
    this.getCourse();
  }

  closeCourseInfo() {
    this.selectedCourse = null;
    this.showCourseInfo = false;
  }

  onCourseUpdated() {
    this.getCourse();
    this.toggleForm();
  }

  editCourse(course: Course) {
    this.selectedCourse = course;
    this.editMode = true;
    this.showForm = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showColegioFormForCourse(course: Course) {
    this.selectedCourse = course;
    this.showColegioForm = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeColegioForm() {
    this.showColegioForm = false;
    this.selectedCourse = null;
  }

  onColegioAdded() {
    this.getCourse();
  }

  editColegioCurso(colegioCurso: any) {
    this.selectedColegioCurso = colegioCurso;
    this.existingMeeting = colegioCurso.id_reuniones_meet || null;

    this.editFechaForm.patchValue({
      fecha_finalizacion: this.formatDateForInput(colegioCurso.fecha_finalizacion),
      precio_curso: (colegioCurso.precio_curso !== null && colegioCurso.precio_curso !== undefined)
        ? this.formatPrice(colegioCurso.precio_curso)
        : '',
      programa_con_inscripcion: this.isTruthyFlag(colegioCurso.programa_con_inscripcion),
      precio_inscripcion: (colegioCurso.precio_inscripcion !== null && colegioCurso.precio_inscripcion !== undefined)
        ? this.formatPrice(colegioCurso.precio_inscripcion)
        : '',
      moneda: colegioCurso.moneda || '',
      precio_especial_lanzamiento: this.isTruthyFlag(colegioCurso.tiene_precio_especial),
      precio_especial: (colegioCurso.precio_especial !== null && colegioCurso.precio_especial !== undefined)
        ? this.formatPrice(colegioCurso.precio_especial)
        : '',
      fecha_finalizacion_precio_especial: colegioCurso.fecha_finalizacion_precio_especial || null,
      programa_independiente: colegioCurso.programa_independiente || false,
      agendar_google_calendar: false,
      evento_titulo: '',
      evento_descripcion: '',
      evento_inicio: null,
      evento_fin: null
    });

    // Check if course is AYO (ID: 28070b14-f3c1-48ec-9e2f-95263f19eec3)
    const ayoCourseId = '28070b14-f3c1-48ec-9e2f-95263f19eec3';
    // colegioCurso.curso_id might be an object or a string depending on how it was fetched
    const courseId = typeof colegioCurso.curso_id === 'object' ? colegioCurso.curso_id?.id : colegioCurso.curso_id;

    if (courseId === ayoCourseId) {
      this.showGoogleCalendarOption = true;
      if (!this.gapiInited) this.loadGoogleScripts();
    } else {
      this.showGoogleCalendarOption = false;
    }

    this.showEditModal = true;
  }

  deleteColegioCurso(colegioCurso: any) {
    this.confirmationService.showDeleteConfirmation(
      colegioCurso.colegio_id?.nombre || 'este colegio',
      'colegio del programa',
      async () => {
        // Verificar si existe id_reuniones_meet (ahora es un objeto expandido)
        if (colegioCurso.id_reuniones_meet) {
          const meetingData = colegioCurso.id_reuniones_meet;
          const googleEventId = meetingData.id_reunion;
          const directusMeetingId = meetingData.id;

          // 1. Eliminar de Google Calendar
          if (googleEventId) {
            try {
              if (typeof gapi !== 'undefined' && gapi.client && gapi.client.calendar) {
                await gapi.client.calendar.events.delete({
                  calendarId: 'primary',
                  eventId: googleEventId
                });
              }
            } catch (error) {
              this.notificationService.showSuccess(
                'Aviso',
                'No se pudo eliminar el evento de Google Calendar, pero se continuará con la eliminación local.'
              );
              console.error('Error Google Calendar:', error);
            }
          }

          // 2. Eliminar de la colección reuniones_meet en Directus
          if (directusMeetingId) {
            this.courseServices.deleteReunionMeet(directusMeetingId).subscribe({
              next: () => console.log('Reunión eliminada de Directus'),
              error: (err) => console.error('Error eliminando reunión de Directus:', err)
            });
          }
        }

        // 3. Eliminar el registro colegio_curso
        this.colegioCursosService.deleteColegioCurso(colegioCurso.id).subscribe({
          next: (response) => {
            this.ngZone.run(() => {
              this.notificationService.showSuccess(
                'Éxito',
                'Colegio eliminado del programa correctamente'
              );
              this.getCourse();
            });
          },
          error: (error) => {
            this.ngZone.run(() => {
              this.notificationService.showError(
                'Error',
                'Error al eliminar el colegio del programa'
              );
            });
          }
        });
      }
    );
  }

  async ensureCalendarAuth(): Promise<boolean> {
    if (!this.gapiInited || !this.gisInited) {
      await this.loadGoogleScripts();
      // Wait a bit for init? loadGoogleScripts is not async in previous implementation, let's check.
      // Actually loadGoogleScripts returns void but sets flags.
    }

    return new Promise((resolve) => {
      this.tokenClient.callback = async (resp: any) => {
        if (resp.error) {
          throw resp;
        }
        resolve(true);
      };

      if (gapi.client.getToken() === null) {
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        this.tokenClient.requestAccessToken({ prompt: '' });
      }
    });
  }

  async editMeeting() {
    this.isEditingMeeting = true;
    this.editFechaForm.patchValue({ agendar_google_calendar: true });

    if (this.existingMeeting && this.existingMeeting.id_reunion) {
      try {
        await this.ensureCalendarAuth();
        await this.fetchGoogleEvent(this.existingMeeting.id_reunion);
      } catch (error) {
        console.error('Error preparing meeting edit:', error);
        this.notificationService.showError('Error', 'No se pudo cargar la información de la reunión');
        this.cancelEditMeeting();
      }
    }
  }

  cancelEditMeeting() {
    this.isEditingMeeting = false;
    this.editFechaForm.patchValue({
      agendar_google_calendar: false,
      evento_titulo: '',
      evento_descripcion: '',
      evento_inicio: null,
      evento_fin: null
    });
  }

  async fetchGoogleEvent(eventId: string) {
    try {
      const response = await gapi.client.calendar.events.get({
        calendarId: 'primary',
        eventId: eventId
      });
      const event = response.result;

      // Format dates for datetime-local input (YYYY-MM-DDTHH:mm)
      const formatDateTime = (isoString: string) => {
        if (!isoString) return null;
        const date = new Date(isoString);
        const pad = (n: number) => n < 10 ? '0' + n : n;
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
      };

      this.editFechaForm.patchValue({
        evento_titulo: event.summary,
        evento_descripcion: event.description,
        evento_inicio: formatDateTime(event.start.dateTime),
        evento_fin: formatDateTime(event.end.dateTime)
      });
    } catch (e) {
      console.error("Error fetching event", e);
      throw e;
    }
  }

  async saveEditedFecha() {
    if (this.editFechaForm.valid && this.selectedColegioCurso) {

      // Handle Google Calendar Logic
      if (this.editFechaForm.get('agendar_google_calendar')?.value) {
        if (!this.existingMeeting) {
          // CREATE NEW
          try {
            const calendarEventData = await this.handleCalendarAuthAndCreation();

            if (calendarEventData) {
              const tokenObj = gapi?.client?.getToken?.();
              const accessToken = tokenObj?.access_token;
              const meetingData = {
                fecha_inicio: calendarEventData.start.dateTime,
                fecha_finalizacion: calendarEventData.end.dateTime,
                id_reunion: calendarEventData.id,
                link_reunion: calendarEventData.hangoutLink,
                id_colegios_cursos: [this.selectedColegioCurso.id],
                token: accessToken
              };

              this.courseServices.createReunionMeet(meetingData).subscribe({
                next: (res) => console.log('Reunión guardada en Directus:', res),
                error: (err) => console.error('Error al guardar reunión en Directus:', err)
              });
            }
          } catch (error) {
            console.error('Error creating calendar event:', error);
            this.notificationService.showError('Error', 'No se pudo crear el evento en Google Calendar');
            return;
          }
        } else if (this.isEditingMeeting && this.existingMeeting.id_reunion) {
          // UPDATE EXISTING
          try {
             // Ensure we have a valid token before making requests?
             // If fetch worked, token should be there.

             const event = {
                summary: this.editFechaForm.get('evento_titulo')?.value,
                description: this.editFechaForm.get('evento_descripcion')?.value,
                start: {
                    dateTime: new Date(this.editFechaForm.get('evento_inicio')?.value).toISOString(),
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                },
                end: {
                    dateTime: new Date(this.editFechaForm.get('evento_fin')?.value).toISOString(),
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                }
             };

             await gapi.client.calendar.events.patch({
                calendarId: 'primary',
                eventId: this.existingMeeting.id_reunion,
                resource: event
             });

             // Update Directus
             const meetingData = {
                fecha_inicio: event.start.dateTime,
                fecha_finalizacion: event.end.dateTime
             };

             this.courseServices.updateReunionMeet(this.existingMeeting.id, meetingData).subscribe({
                next: (res) => console.log('Reunión actualizada en Directus:', res),
                error: (err) => console.error('Error al actualizar reunión en Directus:', err)
             });

          } catch (error) {
             console.error('Error updating calendar event:', error);
             this.notificationService.showError('Error', 'No se pudo actualizar el evento en Google Calendar');
             return;
          }
        }
      }

      const updatedData: any = {
        // Convertimos a ISO compatible con el backend (YYYY-MM-DDT00:00:00)
        fecha_finalizacion: this.toIsoDateString(this.editFechaForm.get('fecha_finalizacion')?.value)
      };

      const rawPrice = this.editFechaForm.get('precio_curso')?.value;
      const unformattedPrice = this.unformatPrice(rawPrice);
      if (rawPrice !== null && rawPrice !== undefined && String(rawPrice).trim() !== '') {
        updatedData.precio_curso = unformattedPrice as number;
      }

      // Campo programa_con_inscripcion
      const programaConInscripcion = !!this.editFechaForm.get('programa_con_inscripcion')?.value;
      updatedData.programa_con_inscripcion = programaConInscripcion ? 'TRUE' : 'FALSE';

      // Nuevos campos: precio_inscripcion y moneda
      if (programaConInscripcion) {
        // Si el programa tiene inscripción, usar los valores del formulario
        const rawInscriptionPrice = this.editFechaForm.get('precio_inscripcion')?.value;
        const unformattedInscriptionPrice = this.unformatPrice(rawInscriptionPrice);
        if (rawInscriptionPrice !== null && rawInscriptionPrice !== undefined && String(rawInscriptionPrice).trim() !== '') {
          updatedData.precio_inscripcion = unformattedInscriptionPrice as number;
        } else {
          updatedData.precio_inscripcion = null;
        }

        const monedaValue = this.editFechaForm.get('moneda')?.value;
        if (monedaValue && monedaValue.trim() !== '') {
          updatedData.moneda = monedaValue;
        } else {
          updatedData.moneda = null;
        }
      } else {
        // Si el programa NO tiene inscripción, establecer valores por defecto
        updatedData.precio_inscripcion = 0;
        updatedData.moneda = null;
      }

      // Precio especial de lanzamiento
      const specialFlag = !!this.editFechaForm.get('precio_especial_lanzamiento')?.value;
      updatedData.tiene_precio_especial = specialFlag ? 'TRUE' : 'FALSE';
      if (specialFlag) {
        const rawSpecial = this.editFechaForm.get('precio_especial')?.value;
        const unformattedSpecial = this.unformatPrice(rawSpecial);
        if (rawSpecial !== null && rawSpecial !== undefined && String(rawSpecial).trim() !== '') {
          updatedData.precio_especial = unformattedSpecial as number;
        } else {
          updatedData.precio_especial = null;
        }
        // Agregar fecha de finalización del precio especial
        updatedData.fecha_finalizacion_precio_especial = this.editFechaForm.get('fecha_finalizacion_precio_especial')?.value;
      } else {
        updatedData.precio_especial = null;
        updatedData.fecha_finalizacion_precio_especial = null;
      }

      this.colegioCursosService.updateColegioCurso(this.selectedColegioCurso.id, updatedData).subscribe({
        next: (response) => {
          this.notificationService.showSuccess(
            'Éxito',
            'Fecha de finalización actualizada correctamente'
          );
          this.closeEditModal();
          this.getCourse(); // Recargar los cursos
        },
        error: (error) => {
          console.error('Error al actualizar fecha:', error);
          this.notificationService.showError(
            'Error',
            'Error al actualizar la fecha de finalización'
          );
        }
      });
    }
  }

  onEditInscriptionPriceInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    // Mantener solo dígitos, luego formatear con puntos cada 3
    const numericValue = inputEl.value.replace(/\D/g, '');
    const formattedValue = this.formatPrice(numericValue);
    inputEl.value = formattedValue;
    this.editFechaForm.get('precio_inscripcion')?.setValue(formattedValue, { emitEvent: false });
  }

  onEditPriceInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = this.formatPrice(input.value);
    this.editFechaForm.get('precio_curso')?.setValue(formatted, { emitEvent: false });
  }

  onEditSpecialPriceInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digitsOnly = String(input.value || '').replace(/\D/g, '');
    const formatted = this.formatPrice(digitsOnly);
    this.editFechaForm.get('precio_especial')?.setValue(formatted, { emitEvent: false });
  }

  private formatPrice(value: any): string {
    if (value === null || value === undefined) return '';
    const numericString = String(value).replace(/[^0-9]/g, '');
    if (!numericString) return '';
    return numericString.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  private unformatPrice(value: any): number | null {
    if (value === null || value === undefined) return null;
    const numericString = String(value).replace(/\./g, '').trim();
    if (!numericString) return null;
    const num = Number(numericString);
    return isNaN(num) ? null : num;
  }

  private isTruthyFlag(flag: any): boolean {
    return flag === true || flag === 'TRUE' || flag === 1 || flag === '1' || flag === 'true';
  }

  private formatDateForInput(value: any): string {
    if (!value) return '';
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.substring(0, 10);
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toIsoDateString(value: any): string | null {
    if (!value) return null;
    const str = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const d = new Date(value);
      if (isNaN(d.getTime())) return null;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}T00:00:00`;
    }
    return `${str}T00:00:00`;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.selectedColegioCurso = null;
    this.existingMeeting = null;
    this.isEditingMeeting = false;
    this.editFechaForm.reset();
  }

  deleteCourse(course: Course) {
    this.confirmationService.showDeleteConfirmation(
      course.nombre,
      'programa',
      () => {
        this.courseServices.deleteCourse(course.id).subscribe({
          next: (response) => {
            this.notificationService.showSuccess(
              'Programa eliminado',
              `${course.nombre} ha sido eliminado exitosamente.`
            );
            this.getCourse(); // Recargar la lista de cursos
          },
          error: (error) => {
            console.error('Error al eliminar el programa:', error);
            this.notificationService.showError(
              'Error al eliminar',
              'No se pudo eliminar el programa. Inténtalo nuevamente.'
            );
          }
        });
      }
    );
  }
  // Helpers de formato para historial
  formatCurrency(value: any): string {
    const num = typeof value === 'number' ? value : Number(value);
    if (!isFinite(num)) return '';
    try {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
    } catch (_) {
      return num.toLocaleString('es-CO');
    }
  }

  formatDatePretty(value: any): string {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: '2-digit' });
  }

  // Método para calcular días entre dos fechas
  calculateDaysBetweenDates(startDate: string, endDate: string): number {
    if (!startDate || !endDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

    const timeDifference = end.getTime() - start.getTime();
    const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));

    return daysDifference > 0 ? daysDifference : 0;
  }
}
