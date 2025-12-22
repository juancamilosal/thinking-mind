import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges, ElementRef, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

import { CourseService } from '../../../../../core/services/course.service';
import { Course } from '../../../../../core/models/Course';
import { SchoolService } from '../../../../../core/services/school.service';
import { School } from '../../../../../core/models/School';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ColegioCursosService } from '../../../../../core/services/colegio-cursos.service';
import { UserService } from '../../../../../core/services/user.service';
import { User } from '../../../../../core/models/User';


declare var gapi: any;
declare var google: any;

@Component({
  selector: 'app-form-colegio-cursos',
  standalone: true,
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './form-colegio-cursos.html',
  styleUrl: './form-colegio-cursos.css'
})
export class ColegioCursosComponent implements OnInit, OnChanges {
  @Input() selectedCourse: Course | null = null;
  @Input() formTitle: string = 'Agregar Colegio y Fecha de Finalización';
  @Input() initialLanguage: string | null = null;
  @Output() goBack = new EventEmitter<void>();
  @Output() colegioAdded = new EventEmitter<void>();

  fechaFinalizacionForm!: FormGroup;
  filteredSchools: School[] = [];
  filteredCourses: Course[] = [];
  filteredTeachers: User[] = [];
  courses: Course[] = [];
  isLoadingSchools: boolean = false;
  isLoadingCourses: boolean = false;
  isLoadingTeachers: boolean = false;
  isSchoolSelected: boolean = false;
  isCourseSelected: boolean = false;
  isTeacherSelected: boolean = false;
  selectedTeacherId: string | null = null;

  // Google Calendar Integration
  showGoogleCalendarOption = false;
  private CLIENT_ID = '996133721948-6rim847cd71sknq58u3tcov5drtag7vv.apps.googleusercontent.com';
  private DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  private SCOPES = 'https://www.googleapis.com/auth/calendar.events';
  tokenClient: any;
  gapiInited = false;
  gisInited = false;

  constructor(
    private fb: FormBuilder,
    private courseService: CourseService,
    private schoolService: SchoolService,
    private notificationService: NotificationService,
    private colegioCursosService: ColegioCursosService,
    private userService: UserService,
    private elementRef: ElementRef
  ) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialLanguage'] && this.fechaFinalizacionForm) {
      if (this.initialLanguage) {
        setTimeout(() => {
          this.fechaFinalizacionForm.get('idioma')?.setValue(this.initialLanguage);
        });
      }
    }
  }

  ngOnInit(): void {
    this.initForm();
    this.loadCourses();

    // Check for specific course ID
    if (this.selectedCourse?.id === '28070b14-f3c1-48ec-9e2f-95263f19eec3') {
      this.showGoogleCalendarOption = true;
      this.loadGoogleScripts();
    }

    // Si hay un curso seleccionado, pre-llenarlo
    if (this.selectedCourse) {
      this.fechaFinalizacionForm.get('curso_id')?.setValue(this.selectedCourse.id);
      this.fechaFinalizacionForm.get('courseSearchTerm')?.setValue(this.selectedCourse.nombre);
      this.isCourseSelected = true;
    }

    const specialLaunchCtrl = this.fechaFinalizacionForm.get('precio_especial_lanzamiento');
    const specialPriceCtrl = this.fechaFinalizacionForm.get('precio_especial');
    specialLaunchCtrl?.valueChanges.subscribe((checked: boolean) => {
      if (checked) {
        specialPriceCtrl?.addValidators(Validators.required);
      } else {
        specialPriceCtrl?.clearValidators();
        specialPriceCtrl?.setValue('');
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

  initForm(): void {
    this.fechaFinalizacionForm = this.fb.group({
      fecha_finalizacion: [null, Validators.required],
      curso_id: [null, Validators.required],
      colegio_id: [null, Validators.required],
      precio_curso: [null, Validators.required],
      programa_con_inscripcion: [false],
      precio_inscripcion: [null],
      moneda: [''],
      precio_especial_lanzamiento: [false],
      precio_especial: [null],
      fecha_finalizacion_precio_especial: [null],
      programa_independiente: [false],
      courseSearchTerm: [null],
      schoolSearchTerm: [null],
      // Google Calendar Fields
      agendar_google_calendar: [false],
      evento_titulo: [''],
      evento_descripcion: [''],
      evento_docente: [''],
      teacherSearchTerm: [''],
      evento_inicio: [null],
      evento_fin: [null],
      idioma: [null]
    });

    // Listen for Google Calendar checkbox changes
    this.fechaFinalizacionForm.get('agendar_google_calendar')?.valueChanges.subscribe(value => {
      const controls = ['evento_titulo', 'evento_inicio', 'evento_fin', 'evento_docente'];
      if (value) {
        controls.forEach(c => this.fechaFinalizacionForm.get(c)?.setValidators([Validators.required]));
      } else {
        controls.forEach(c => {
          this.fechaFinalizacionForm.get(c)?.clearValidators();
          this.fechaFinalizacionForm.get(c)?.setValue(null);
        });
      }
      controls.forEach(c => this.fechaFinalizacionForm.get(c)?.updateValueAndValidity());
    });

    this.fechaFinalizacionForm.get('programa_independiente')?.valueChanges.subscribe(value => {
      const colegioControl = this.fechaFinalizacionForm.get('colegio_id');

      if (value) {
        colegioControl?.setValue('dfdc71c9-20ab-4981-865f-f5e93fa3efc7');
        colegioControl?.clearValidators();
        this.fechaFinalizacionForm.get('schoolSearchTerm')?.setValue('');
        this.isSchoolSelected = false;
        this.filteredSchools = [];
      } else {
        colegioControl?.setValue(null);
        colegioControl?.setValidators([Validators.required]);
        this.fechaFinalizacionForm.get('schoolSearchTerm')?.setValue('');
        this.isSchoolSelected = false;
        this.filteredSchools = [];
      }

      colegioControl?.updateValueAndValidity();
    });

    if (this.formTitle === 'Agregar Programa AYO') {
      this.fechaFinalizacionForm.get('idioma')?.setValidators([Validators.required]);
      this.fechaFinalizacionForm.get('programa_independiente')?.setValue(true);
      this.fechaFinalizacionForm.get('agendar_google_calendar')?.setValue(true);
      
      if (this.initialLanguage) {
        setTimeout(() => {
          this.fechaFinalizacionForm.get('idioma')?.setValue(this.initialLanguage);
        });
      }
    }
  }

  loadCourses(): void {
    this.isLoadingCourses = true;
    this.courseService.searchCourse().subscribe({
      next: (response) => {
        if (response.data) {
          this.courses = response.data.sort((a, b) =>
            a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase())
          );
          this.filteredCourses = [...this.courses];
        }
        this.isLoadingCourses = false;
      },
      error: (error) => {
        console.error('Error loading courses:', error);
        this.isLoadingCourses = false;
      }
    });
  }

  onCourseSearch(event: any): void {
    const searchTerm = event.target.value;
    this.fechaFinalizacionForm.get('courseSearchTerm')?.setValue(searchTerm);

    if (!this.isCourseSelected) {
      this.searchCourses(searchTerm);
    }
  }

  searchCourses(searchTerm: string): void {
    if (!searchTerm || searchTerm.length < 2) {
      this.filteredCourses = [];
      return;
    }

    this.filteredCourses = this.courses.filter(course =>
      course.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  selectCourse(course: Course): void {
    this.fechaFinalizacionForm.get('curso_id')?.setValue(course.id);
    this.fechaFinalizacionForm.get('courseSearchTerm')?.setValue(course.nombre);
    this.filteredCourses = [];
    this.isCourseSelected = true;

    // Check ID again in case selection changes
    if (course.id === '28070b14-f3c1-48ec-9e2f-95263f19eec3') {
      this.showGoogleCalendarOption = true;
      if (!this.gapiInited) this.loadGoogleScripts();
    } else {
      this.showGoogleCalendarOption = false;
      this.fechaFinalizacionForm.get('agendar_google_calendar')?.setValue(false);
    }
  }

  clearCourseSearch(): void {
    this.fechaFinalizacionForm.get('courseSearchTerm')?.setValue('');
    this.filteredCourses = [];
    this.isCourseSelected = false;
    this.fechaFinalizacionForm.get('curso_id')?.setValue('');
    this.showGoogleCalendarOption = false;
    this.fechaFinalizacionForm.get('agendar_google_calendar')?.setValue(false);
  }

  onSchoolSearch(event: any): void {
    const searchTerm = event.target.value;
    this.fechaFinalizacionForm.get('schoolSearchTerm')?.setValue(searchTerm);

    if (!this.isSchoolSelected) {
      this.searchSchools(searchTerm);
    }
  }

  searchSchools(searchTerm: string): void {
    if (!searchTerm || searchTerm.length < 2) {
      this.filteredSchools = [];
      return;
    }

    this.isLoadingSchools = true;
    this.schoolService.searchSchool(searchTerm, 1, 10).subscribe({
      next: (response) => {
        this.filteredSchools = response.data;
        this.isLoadingSchools = false;
      },
      error: (error) => {
        console.error('Error searching schools:', error);
        this.filteredSchools = [];
        this.isLoadingSchools = false;
      }
    });
  }

  selectSchool(school: School): void {
    this.fechaFinalizacionForm.get('colegio_id')?.setValue(school.id);
    this.fechaFinalizacionForm.get('schoolSearchTerm')?.setValue(school.nombre);
    this.filteredSchools = [];
    this.isSchoolSelected = true;
  }

  clearSchoolSearch(): void {
    this.fechaFinalizacionForm.get('schoolSearchTerm')?.setValue('');
    this.filteredSchools = [];
    this.isSchoolSelected = false;
    this.fechaFinalizacionForm.get('colegio_id')?.setValue('');
  }

  onTeacherSearch(event: any): void {
    const searchTerm = event.target.value;
    this.fechaFinalizacionForm.get('teacherSearchTerm')?.setValue(searchTerm);

    if (this.isTeacherSelected) {
      this.isTeacherSelected = false;
      this.fechaFinalizacionForm.get('evento_docente')?.setValue('');
      this.selectedTeacherId = null;
    }

    this.searchTeachers(searchTerm);
  }

  onTeacherInputFocus(): void {
    const currentTerm = this.fechaFinalizacionForm.get('teacherSearchTerm')?.value || '';
    this.searchTeachers(currentTerm);
  }

  hideTeacherList(): void {
    setTimeout(() => {
      // this.filteredTeachers = []; // Logic moved to HostListener
    }, 200);
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    const input = document.getElementById('teacherSearchTerm');
    const dropdown = this.elementRef.nativeElement.querySelector('ul.absolute.z-10.w-full.mt-1');

    if (input && input.contains(target)) {
      return; // Clicked on input
    }
    if (dropdown && dropdown.contains(target)) {
      return; // Clicked on dropdown
    }
    
    // Clicked outside both
    this.filteredTeachers = [];
  }

  searchTeachers(searchTerm: string): void {
    this.isLoadingTeachers = true;
    const roleId = 'fe83d2f3-1b89-477d-984a-de3b56e12001';
    this.userService.getUsersByRole(roleId, searchTerm).subscribe({
      next: (response) => {
        this.filteredTeachers = response.data || [];
        this.isLoadingTeachers = false;
      },
      error: (error) => {
        console.error('Error searching teachers:', error);
        this.filteredTeachers = [];
        this.isLoadingTeachers = false;
      }
    });
  }

  selectTeacher(teacher: User): void {
    this.fechaFinalizacionForm.get('evento_docente')?.setValue(teacher.email);
    this.fechaFinalizacionForm.get('teacherSearchTerm')?.setValue(`${teacher.first_name} ${teacher.last_name}`);
    this.filteredTeachers = [];
    this.isTeacherSelected = true;
    this.selectedTeacherId = teacher.id;
  }

  async onSubmit(): Promise<void> {
    if (this.fechaFinalizacionForm.valid) {

      let calendarEventData: any = null;

      // Handle Google Calendar Event Creation
      if (this.fechaFinalizacionForm.get('agendar_google_calendar')?.value) {
        try {
          calendarEventData = await this.handleCalendarAuthAndCreation();
        } catch (error) {
          console.error('Error creating calendar event:', error);
          this.notificationService.showError('Error', 'No se pudo crear el evento en Google Calendar');
          return; // Stop submission if calendar fails
        }
      }

      const precioEspecialLanzamiento = !!this.fechaFinalizacionForm.get('precio_especial_lanzamiento')?.value;
      const precioEspecialValor = precioEspecialLanzamiento
        ? this.unformatPrice(this.fechaFinalizacionForm.get('precio_especial')?.value)
        : null;

      const fechaCreacion = new Date();
      fechaCreacion.setHours(0, 0, 0, 0);
      const fechaCreacionISO = fechaCreacion.toISOString().split('T')[0];

      const rawFechaFinalizacion = this.fechaFinalizacionForm.get('fecha_finalizacion')?.value;
      const fechaFinalizacion = rawFechaFinalizacion ? String(rawFechaFinalizacion).split('T')[0] : null;

      const formData: any = {
        fecha_finalizacion: fechaFinalizacion,
        curso_id: this.fechaFinalizacionForm.get('curso_id')?.value,
        colegio_id: this.fechaFinalizacionForm.get('colegio_id')?.value,
        precio_curso: this.unformatPrice(this.fechaFinalizacionForm.get('precio_curso')?.value),
        programa_con_inscripcion: this.fechaFinalizacionForm.get('programa_con_inscripcion')?.value || false,
        precio_inscripcion: this.fechaFinalizacionForm.get('programa_con_inscripcion')?.value && this.fechaFinalizacionForm.get('precio_inscripcion')?.value
          ? this.unformatPrice(this.fechaFinalizacionForm.get('precio_inscripcion')?.value)
          : null,
        moneda: this.fechaFinalizacionForm.get('programa_con_inscripcion')?.value && this.fechaFinalizacionForm.get('moneda')?.value
          ? this.fechaFinalizacionForm.get('moneda')?.value
          : null,
        tiene_precio_especial: precioEspecialLanzamiento ? 'TRUE' : 'FALSE',
        precio_especial: precioEspecialValor,
        fecha_finalizacion_precio_especial: this.fechaFinalizacionForm.get('fecha_finalizacion_precio_especial')?.value,
        fecha_creacion: fechaCreacionISO,
        programa_independiente: this.fechaFinalizacionForm.get('programa_independiente')?.value || false,
        idioma: this.fechaFinalizacionForm.get('idioma')?.value
      };

      // Add Google Calendar data if available
      if (calendarEventData) {
        formData.link_reunion = calendarEventData.hangoutLink;
        formData.id_reunion = calendarEventData.id;
      }

      this.colegioCursosService.createColegioCurso(formData).subscribe({
        next: (response) => {
          // Save meeting details to Directus if calendar event was created
          if (calendarEventData) {
            const tokenObj = gapi?.client?.getToken?.();
            const accessToken = tokenObj?.access_token;
            const meetingData = {
              fecha_inicio: this.formatDateForDirectus(calendarEventData.start.dateTime),
              fecha_finalizacion: this.formatDateForDirectus(calendarEventData.end.dateTime),
              id_reunion: calendarEventData.id,
              link_reunion: calendarEventData.hangoutLink,
              token: accessToken,
              docente_id: this.selectedTeacherId
            };

            this.courseService.createReunionMeet(meetingData).subscribe({
              next: (res) => console.log('Reunión guardada en Directus:', res),
              error: (err) => console.error('Error al guardar reunión en Directus:', err)
            });
          }

          const cursoNombre = this.fechaFinalizacionForm.get('courseSearchTerm')?.value;
          const colegioNombre = this.fechaFinalizacionForm.get('programa_independiente')?.value
            ? 'Programa Independiente'
            : this.fechaFinalizacionForm.get('schoolSearchTerm')?.value;

          this.notificationService.showSuccess(
            'Colegio y fecha de finalización guardados',
            `Se ha establecido la fecha de finalización para el curso ${cursoNombre} en ${colegioNombre}`
          );

          this.fechaFinalizacionForm.reset();
          this.isSchoolSelected = false;
          this.isCourseSelected = false;
          this.filteredSchools = [];
          this.filteredCourses = [];
          this.showGoogleCalendarOption = false; // Reset option

          this.colegioAdded.emit();
          this.goBack.emit();
        },
        error: (error) => {
          console.error('Error al crear colegio-curso:', error);
          this.notificationService.showError(
            'Error al guardar',
            'No se pudo guardar la información. Inténtalo nuevamente.'
          );
        }
      });
    } else {
      this.markFormGroupTouched();
    }
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
    const startDate = new Date(this.fechaFinalizacionForm.get('evento_inicio')?.value);
    const endDate = new Date(this.fechaFinalizacionForm.get('evento_fin')?.value);

    if (endDate <= startDate) {
      this.notificationService.showError('Error en fechas', 'La fecha de finalización del evento debe ser posterior a la fecha de inicio.');
      throw new Error('Invalid date range');
    }

    const attendees: any[] = [];
    const docenteEmail = this.fechaFinalizacionForm.get('evento_docente')?.value;

    // Agregar al docente como invitado
    if (docenteEmail) {
      attendees.push({ email: docenteEmail });
    }

    // Configuración inicial del evento
    const event = {
      summary: this.fechaFinalizacionForm.get('evento_titulo')?.value,
      description: this.fechaFinalizacionForm.get('evento_descripcion')?.value,
      guestsCanModify: false,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      attendees: attendees,
      conferenceData: {
        createRequest: {
          requestId: "req-" + Date.now(),
          conferenceSolutionKey: { type: "hangoutsMeet" }
        }
      }
    };

    try {
      // Crear el evento en el calendario principal
      const request = await gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        conferenceDataVersion: 1
      });

      return request.result;

    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  }

  onInscriptionPriceInput(event: any): void {
    const input = event.target;
    const value = input.value;
    const numericValue = value.replace(/\D/g, '');
    const formattedValue = this.formatPrice(numericValue);
    input.value = formattedValue;
    this.fechaFinalizacionForm.get('precio_inscripcion')?.setValue(formattedValue, { emitEvent: false });
  }

  onPriceInput(event: any): void {
    const inputEl = event.target as HTMLInputElement;
    const digitsOnly = (inputEl.value || '').replace(/\D/g, '');
    const formatted = this.formatPrice(digitsOnly);
    this.fechaFinalizacionForm.get('precio_curso')?.setValue(formatted, { emitEvent: false });
  }

  onSpecialPriceInput(event: any): void {
    const inputEl = event.target as HTMLInputElement;
    const digitsOnly = (inputEl.value || '').replace(/\D/g, '');
    const formatted = this.formatPrice(digitsOnly);
    this.fechaFinalizacionForm.get('precio_especial')?.setValue(formatted, { emitEvent: false });
  }

  private formatPrice(value: string): string {
    if (!value) return '';
    return value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  private unformatPrice(value: string | null | undefined): number {
    const numericStr = (value || '').replace(/\./g, '');
    return numericStr ? parseInt(numericStr, 10) : 0;
  }

  private formatDateForDirectus(dateStr: string): string {
    if (!dateStr) return '';
    // Formato simple para evitar errores de longitud en Directus: YYYY-MM-DDTHH:mm:ss
    // Eliminamos el offset de zona horaria (-05:00) si existe
    return dateStr.substring(0, 19);
  }

  private markFormGroupTouched(): void {
    Object.values(this.fechaFinalizacionForm.controls).forEach(control => {
      control.markAsTouched();
    });
  }

  getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

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
