import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges, ElementRef, HostListener, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { CourseService } from '../../../../../core/services/course.service';
import { Course } from '../../../../../core/models/Course';
import { NotificationService } from '../../../../../core/services/notification.service';
import { UserService } from '../../../../../core/services/user.service';
import { User } from '../../../../../core/models/User';
import { NivelService } from '../../../../../core/services/nivel.service';
import { Nivel } from '../../../../../core/models/Meeting';
import { ProgramaAyoService } from '../../../../../core/services/programa-ayo.service';


declare var gapi: any;
declare var google: any;

@Component({
  selector: 'app-form-programa-ayo',
  standalone: true,
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './form-programa-ayo.html',
  styleUrl: './form-programa-ayo.css'
})
export class FormProgramaAyoComponent implements OnInit, OnChanges {
  @Input() idioma: string;
  @Input() selectedCourse: Course | null = null;
  @Input() initialLanguage: string | null = null;
  @Output() goBack = new EventEmitter<void>();
  @Output() colegioAdded = new EventEmitter<void>();

  fechaFinalizacionForm!: FormGroup;
  filteredCourses: Course[] = [];
  filteredTeachers: User[] = [];
  filteredTeachersJueves: User[] = [];
  niveles: Nivel[] = [];
  courses: Course[] = [];
  isLoadingCourses: boolean = false;
  isLoadingTeachers: boolean = false;
  isLoadingTeachersJueves: boolean = false;
  isLoadingNiveles: boolean = false;
  isCourseSelected: boolean = false;
  isTeacherSelected: boolean = false;
  isTeacherSelectedJueves: boolean = false;
  selectedTeacherId: string | null = null;
  selectedTeacherIdJueves: string | null = null;
  selectedLanguage: string | null = null;
  isSubmitting: boolean = false;
  previewImage: string | null = null;
  selectedFile: File | null = null;
  isDragging: boolean = false;


  // Google Calendar Integration
  showGoogleCalendarOption = true; // Always true for AYO
  private CLIENT_ID = '996133721948-6rim847cd71sknq58u3tcov5drtag7vv.apps.googleusercontent.com';
  private DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  private SCOPES = 'https://www.googleapis.com/auth/calendar.events';
  tokenClient: any;
  gapiInited = false;
  gisInited = false;

  constructor(
    private fb: FormBuilder,
    private courseService: CourseService,
    private notificationService: NotificationService,
    private programaAyoService: ProgramaAyoService,
    private userService: UserService,
    private nivelService: NivelService,
    private elementRef: ElementRef,
    private ngZone: NgZone,
    private router: Router,
    private route: ActivatedRoute
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

    // Check for query params if inputs are not provided (e.g. via routing)
    this.route.queryParams.subscribe(params => {
      if (params['idioma']) {
        this.idioma = params['idioma'];
        this.selectedLanguage = params['idioma'];
        this.initialLanguage = params['idioma'];
        if (this.fechaFinalizacionForm) {
          this.fechaFinalizacionForm.get('idioma')?.setValue(this.idioma);
        }
      }
    });

    this.showGoogleCalendarOption = true;
    this.loadGoogleScripts();

    // Si hay un curso seleccionado, pre-llenarlo
    if (this.selectedCourse) {
      this.fechaFinalizacionForm.get('curso_id')?.setValue(this.selectedCourse.id);
      this.fechaFinalizacionForm.get('courseSearchTerm')?.setValue(this.selectedCourse.nombre);
      this.isCourseSelected = true;
      this.filterNivelesByCourse(this.selectedCourse.nombre);
    } else {
      this.loadNiveles();
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

    // AYO Specific Init
    this.fechaFinalizacionForm.get('idioma')?.setValidators([Validators.required]);
    this.fechaFinalizacionForm.get('programa_independiente')?.setValue(true);

    if (this.initialLanguage) {
      setTimeout(() => {
        this.fechaFinalizacionForm.get('idioma')?.setValue(this.initialLanguage);
      });
    }
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
      precio_curso: [null, Validators.required],
      programa_con_inscripcion: [false],
      precio_inscripcion: [null],
      moneda: [''],
      precio_especial_lanzamiento: [false],
      precio_especial: [null],
      fecha_finalizacion_precio_especial: [null],
      programa_independiente: [true], // Always true
      courseSearchTerm: [null],
      schoolSearchTerm: [null],
      img: [null],
      // Google Calendar Fields (Start true for AYO)
      agendar_google_calendar: [true],
      evento_titulo: ['', Validators.required],
      evento_descripcion: [''],
      evento_docente: ['', Validators.required],
      teacherSearchTerm: [''],
      evento_nivel: ['', Validators.required],
      evento_inicio: [null, Validators.required],
      evento_fin: [null, Validators.required],
      // Google Calendar Fields Jueves (Start true for AYO)
      agendar_google_calendar_jueves: [true],
      evento_titulo_jueves: ['', Validators.required],
      evento_descripcion_jueves: [''],
      evento_docente_jueves: ['', Validators.required],
      teacherSearchTermJueves: [''],
      evento_inicio_jueves: [null, Validators.required],
      evento_fin_jueves: [null, Validators.required],
      idioma: [null]
    });

    // Listen for Google Calendar checkbox changes (Martes)
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

    // Listen for Google Calendar checkbox changes (Jueves)
    this.fechaFinalizacionForm.get('agendar_google_calendar_jueves')?.valueChanges.subscribe(value => {
      const controls = ['evento_titulo_jueves', 'evento_inicio_jueves', 'evento_fin_jueves', 'evento_docente_jueves'];
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
    }, 200);
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;

    // Teacher dropdown (Martes)
    const inputTeacher = document.getElementById('teacherSearchTerm');
    const dropdownTeacher = this.elementRef.nativeElement.querySelector('#teacher-dropdown');

    if (inputTeacher && inputTeacher.contains(target)) {
      // Clicked on input
    } else if (dropdownTeacher && dropdownTeacher.contains(target)) {
      // Clicked on dropdown
    } else {
      this.filteredTeachers = [];
    }

    // Teacher dropdown (Jueves)
    const inputTeacherJueves = document.getElementById('teacherSearchTermJueves');
    const dropdownTeacherJueves = this.elementRef.nativeElement.querySelector('#teacher-dropdown-jueves');

    if (inputTeacherJueves && inputTeacherJueves.contains(target)) {
      // Clicked on input
    } else if (dropdownTeacherJueves && dropdownTeacherJueves.contains(target)) {
      // Clicked on dropdown
    } else {
      this.filteredTeachersJueves = [];
    }
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

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.fechaFinalizacionForm.patchValue({ img: file });

      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        this.previewImage = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(): void {
    this.selectedFile = null;
    this.previewImage = null;
    this.fechaFinalizacionForm.patchValue({ img: null });
    // Reset file input if needed
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.notificationService.showError('Tipo de archivo inválido', 'Por favor, selecciona una imagen (PNG, JPG, GIF)');
        return;
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (file.size > maxSize) {
        this.notificationService.showError('Archivo muy grande', 'El tamaño máximo permitido es 5MB');
        return;
      }

      this.selectedFile = file;
      this.fechaFinalizacionForm.patchValue({ img: file });

      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        this.previewImage = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }


  selectTeacher(teacher: User): void {
    this.fechaFinalizacionForm.get('evento_docente')?.setValue(teacher.email);
    this.fechaFinalizacionForm.get('teacherSearchTerm')?.setValue(`${teacher.first_name} ${teacher.last_name}`);
    this.filteredTeachers = [];
    this.isTeacherSelected = true;
    this.selectedTeacherId = teacher.id;
  }

  // Jueves Methods
  onTeacherSearchJueves(event: any): void {
    const searchTerm = event.target.value;
    this.fechaFinalizacionForm.get('teacherSearchTermJueves')?.setValue(searchTerm);

    if (this.isTeacherSelectedJueves) {
      this.isTeacherSelectedJueves = false;
      this.fechaFinalizacionForm.get('evento_docente_jueves')?.setValue('');
      this.selectedTeacherIdJueves = null;
    }

    this.searchTeachersJueves(searchTerm);
  }

  onTeacherInputFocusJueves(): void {
    const currentTerm = this.fechaFinalizacionForm.get('teacherSearchTermJueves')?.value || '';
    this.searchTeachersJueves(currentTerm);
  }

  hideTeacherListJueves(): void {
    setTimeout(() => {
    }, 200);
  }

  searchTeachersJueves(searchTerm: string): void {
    this.isLoadingTeachersJueves = true;
    const roleId = 'fe83d2f3-1b89-477d-984a-de3b56e12001';
    this.userService.getUsersByRole(roleId, searchTerm).subscribe({
      next: (response) => {
        this.filteredTeachersJueves = response.data || [];
        this.isLoadingTeachersJueves = false;
      },
      error: (error) => {
        console.error('Error searching teachers Jueves:', error);
        this.filteredTeachersJueves = [];
        this.isLoadingTeachersJueves = false;
      }
    });
  }

  selectTeacherJueves(teacher: User): void {
    this.fechaFinalizacionForm.get('evento_docente_jueves')?.setValue(teacher.email);
    this.fechaFinalizacionForm.get('teacherSearchTermJueves')?.setValue(`${teacher.first_name} ${teacher.last_name}`);
    this.filteredTeachersJueves = [];
    this.isTeacherSelectedJueves = true;
    this.selectedTeacherIdJueves = teacher.id;
  }

  loadNiveles(idiomas?: string[]): void {
    this.isLoadingNiveles = true;
    const filter = idiomas || (this.idioma ? [this.idioma] : undefined);
    this.nivelService.getNiveles(filter).subscribe({
      next: (response) => {
        this.niveles = response.data || [];
        this.isLoadingNiveles = false;

        // Reset selected value if it's no longer in the filtered list
        const currentVal = this.fechaFinalizacionForm.get('evento_nivel')?.value;
        if (currentVal && !this.niveles.find(n => n.id === currentVal)) {
          this.fechaFinalizacionForm.get('evento_nivel')?.setValue('');
        }
      },
      error: (error) => {
        console.error('Error loading niveles:', error);
        this.niveles = [];
        this.isLoadingNiveles = false;
      }
    });
  }

  filterNivelesByCourse(courseName: string): void {
    if (!courseName) {
      this.selectedLanguage = null;
      this.loadNiveles();
      return;
    }

    const nameUpper = courseName.toUpperCase();
    this.selectedLanguage = null;

    // Check for English
    if (nameUpper.includes('INGLÉS') || nameUpper.includes('INGLES') || nameUpper.includes('ENGLISH')) {
      this.selectedLanguage = 'INGLÉS';
    }
    // Check for French
    else if (nameUpper.includes('FRANCÉS') || nameUpper.includes('FRANCES') || nameUpper.includes('FRENCH') || nameUpper.includes('FREANCÉS')) {
      this.selectedLanguage = 'FRANCÉS';
    }

    this.loadNiveles(this.selectedLanguage ? [this.selectedLanguage] : undefined);
  }

  onDateInput(event: any, controlName: string, dayOfWeek: number = 2): void {
    const input = event.target as HTMLInputElement;
    if (!input.value) return;

    const dateValue = new Date(input.value);

    // Check if valid date
    if (isNaN(dateValue.getTime())) return;

    if (dateValue.getDay() !== dayOfWeek) { // 0=Sun, 1=Mon, 2=Tue, 4=Thu
      const dayName = dayOfWeek === 2 ? 'martes' : 'jueves';
      this.notificationService.showError('Día no permitido', `Solo se permiten agendar eventos los días ${dayName}. Por favor selecciona un ${dayName}.`);
      this.fechaFinalizacionForm.get(controlName)?.setValue(null);
      input.value = '';
      input.blur(); // Close the picker
    }
  }

  goBackAction() {
    if (this.goBack.observed) {
      this.goBack.emit();
    } else {
      this.router.navigate(['/private/ayo'], { queryParams: { idioma: this.idioma } });
    }
  }

  async onSubmit(): Promise<void> {
    if (this.fechaFinalizacionForm.valid) {
      this.isSubmitting = true;

      try {
        const agendarMartes = this.fechaFinalizacionForm.get('agendar_google_calendar')?.value;
        const agendarJueves = this.fechaFinalizacionForm.get('agendar_google_calendar_jueves')?.value;
        const meetingIds: string[] = [];

        // 1. Create Calendar Events and Meetings FIRST
        if (agendarMartes || agendarJueves) {
          await this.ensureCalendarToken();
          const tokenObj = gapi?.client?.getToken?.();
          const accessToken = tokenObj?.access_token;

          if (agendarMartes) {
            const calendarEventDataMartes = await this.createCalendarEvent('');
            if (calendarEventDataMartes) {
              const meetingDataMartes = {
                fecha_inicio: this.formatDateForDirectus(calendarEventDataMartes.start.dateTime),
                fecha_finalizacion: this.formatDateForDirectus(calendarEventDataMartes.end.dateTime),
                id_reunion: calendarEventDataMartes.id,
                link_reunion: calendarEventDataMartes.hangoutLink,
                // token: accessToken, // Token is not needed and causes length errors. We use fresh tokens for deletion.
                id_docente: this.selectedTeacherId,
                id_nivel: this.fechaFinalizacionForm.get('evento_nivel')?.value,
                id_colegios_cursos: []
              };
              const res = await firstValueFrom(this.courseService.createReunionMeet(meetingDataMartes));
              if (res?.data?.id) meetingIds.push(res.data.id);
            }
          }

          if (agendarJueves) {
            const calendarEventDataJueves = await this.createCalendarEvent('_jueves');
            if (calendarEventDataJueves) {
              const meetingDataJueves = {
                fecha_inicio: this.formatDateForDirectus(calendarEventDataJueves.start.dateTime),
                fecha_finalizacion: this.formatDateForDirectus(calendarEventDataJueves.end.dateTime),
                id_reunion: calendarEventDataJueves.id,
                link_reunion: calendarEventDataJueves.hangoutLink,
                id_docente: this.selectedTeacherIdJueves,
                id_nivel: this.fechaFinalizacionForm.get('evento_nivel')?.value,
                id_colegios_cursos: []
              };
              const res = await firstValueFrom(this.courseService.createReunionMeet(meetingDataJueves));
              if (res?.data?.id) meetingIds.push(res.data.id);
            }
          }
        }

        // 2. Prepare Program Data with meetingIds
        const precioEspecialLanzamiento = !!this.fechaFinalizacionForm.get('precio_especial_lanzamiento')?.value;
        const precioEspecialValor = precioEspecialLanzamiento
          ? this.unformatPrice(this.fechaFinalizacionForm.get('precio_especial')?.value)
          : null;

        const fechaCreacion = new Date();
        fechaCreacion.setHours(0, 0, 0, 0);
        const fechaCreacionISO = fechaCreacion.toISOString().split('T')[0];

        const rawFechaFinalizacion = this.fechaFinalizacionForm.get('fecha_finalizacion')?.value;
        const fechaFinalizacion = rawFechaFinalizacion ? String(rawFechaFinalizacion).split('T')[0] : null;

        // Handle Image Upload
        let imageId = null;
        if (this.selectedFile) {
          try {
            const uploadRes = await firstValueFrom(this.courseService.uploadFile(this.selectedFile));
            if (uploadRes?.data?.id) {
              imageId = uploadRes.data.id;
            }
          } catch (error) {
            console.error('Error uploading image:', error);
            this.notificationService.showError('Error al subir imagen', 'No se pudo cargar la imagen del programa.');
            // Optionally stop submission here or continue without image
          }
        }

        const formData: any = {
          fecha_finalizacion: fechaFinalizacion,
          curso_id: this.fechaFinalizacionForm.get('curso_id')?.value,
          precio_curso: this.unformatPrice(this.fechaFinalizacionForm.get('precio_curso')?.value),
          programa_con_inscripcion: this.fechaFinalizacionForm.get('programa_con_inscripcion')?.value || false,
          precio_inscripcion: this.fechaFinalizacionForm.get('programa_con_inscripcion')?.value && this.fechaFinalizacionForm.get('precio_inscripcion')?.value
            ? this.unformatPrice(this.fechaFinalizacionForm.get('precio_inscripcion')?.value)
            : null,
          moneda: this.fechaFinalizacionForm.get('programa_con_inscripcion')?.value && this.fechaFinalizacionForm.get('moneda')?.value
            ? this.fechaFinalizacionForm.get('moneda')?.value
            : null,
          tiene_precio_especial: precioEspecialLanzamiento,
          precio_especial: precioEspecialValor,
          fecha_finalizacion_precio_especial: this.fechaFinalizacionForm.get('fecha_finalizacion_precio_especial')?.value,
          fecha_creacion: fechaCreacionISO,
          idioma: this.fechaFinalizacionForm.get('idioma')?.value,
          id_nivel: this.fechaFinalizacionForm.get('evento_nivel')?.value,
          id_reuniones_meet: meetingIds,
          img: imageId // Add image ID to payload
        };

        // 3. Create Program
        this.programaAyoService.createProgramaAyo(formData).subscribe({
          next: (response) => {
            this.ngZone.run(() => {
              const cursoNombre = this.fechaFinalizacionForm.get('courseSearchTerm')?.value;
              this.notificationService.showSuccess(
                'Programa AYO guardado',
                `Se ha establecido el programa y las reuniones de los Martes y Jueves`,
                0,
                () => {
                   this.goBackAction();
                }
              );

              this.isSubmitting = false;
            });
          },
          error: (error) => {
            this.ngZone.run(() => {
              console.error('Error al crear programa ayo:', error);
              this.notificationService.showError(
                'Error al guardar',
                'No se pudo guardar la información del programa. Sin embargo, las reuniones pueden haberse creado.'
              );
              this.isSubmitting = false;
            });
          }
        });

      } catch (error) {
        this.ngZone.run(() => {
          console.error('Error creating calendar events or meetings:', error);
          this.notificationService.showError('Error', 'No se pudo crear el evento en Google Calendar o guardar las reuniones.');
          this.isSubmitting = false;
        });
      }

    } else {
      this.markFormGroupTouched();
    }
  }

  ensureCalendarToken(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.tokenClient.callback = (resp: any) => {
        if (resp.error) {
          reject(resp);
        } else {
          resolve();
        }
      };

      if (gapi.client.getToken() === null) {
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        this.tokenClient.requestAccessToken({ prompt: '' });
      }
    });
  }

  async createCalendarEvent(suffix: string = '') {
    const startDate = new Date(this.fechaFinalizacionForm.get('evento_inicio' + suffix)?.value);
    const endDate = new Date(this.fechaFinalizacionForm.get('evento_fin' + suffix)?.value);

    if (endDate <= startDate) {
      this.notificationService.showError('Error en fechas', 'La fecha de finalización del evento debe ser posterior a la fecha de inicio.');
      throw new Error('Invalid date range');
    }

    const attendees: any[] = [];
    const docenteEmail = this.fechaFinalizacionForm.get('evento_docente' + suffix)?.value;

    // Agregar al docente como invitado
    if (docenteEmail) {
      attendees.push({ email: docenteEmail });
    }

    // Determine recurrence rule based on day and program end date
    let recurrenceRule = '';
    if (suffix === '') { // Martes
      recurrenceRule = 'RRULE:FREQ=WEEKLY;BYDAY=TU';
    } else if (suffix === '_jueves') { // Jueves
      recurrenceRule = 'RRULE:FREQ=WEEKLY;BYDAY=TH';
    }

    // Add UNTIL if fecha_finalizacion exists to limit recurrence
    const fechaFinPrograma = this.fechaFinalizacionForm.get('fecha_finalizacion')?.value;
    if (fechaFinPrograma && recurrenceRule) {
      // fechaFinPrograma is 'YYYY-MM-DD'
      const parts = String(fechaFinPrograma).split('-');
      if (parts.length === 3) {
        // Create date at end of that day (23:59:59)
        const untilDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 23, 59, 59);
        // Convert to UTC string for iCal (YYYYMMDDThhmmssZ)
        const untilStr = untilDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        recurrenceRule += `;UNTIL=${untilStr}`;
      }
    }

    // Configuración inicial del evento
    const event: any = {
      summary: this.fechaFinalizacionForm.get('evento_titulo' + suffix)?.value,
      description: this.fechaFinalizacionForm.get('evento_descripcion' + suffix)?.value,
      guestsCanModify: false,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      recurrence: recurrenceRule ? [recurrenceRule] : undefined,
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

  private formatDateForDirectus(dateStr: string, dateOnly: boolean = false): string {
    if (!dateStr) return '';
    // Formato simple para evitar errores de longitud en Directus: YYYY-MM-DDTHH:mm:ss
    // Eliminamos el offset de zona horaria (-05:00) si existe
    if (dateOnly) {
      return dateStr.substring(0, 10);
    }
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
}
