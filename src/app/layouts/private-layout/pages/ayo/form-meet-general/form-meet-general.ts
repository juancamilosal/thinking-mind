import { Component, OnInit, Input, Output, EventEmitter, ElementRef, HostListener, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CourseService } from '../../../../../core/services/course.service';
import { Course } from '../../../../../core/models/Course';
import { NotificationService } from '../../../../../core/services/notification.service';
import { UserService } from '../../../../../core/services/user.service';
import { ProgramaAyoService } from '../../../../../core/services/programa-ayo.service';
import { User } from '../../../../../core/models/User';
import { FileService, DirectusFile } from '../../../../../core/services/file.service';
import { environment } from '../../../../../../environments/environment';


declare var gapi: any;
declare var google: any;

@Component({
  selector: 'app-form-meet-general',
  standalone: true,
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './form-meet-general.html',
  styleUrl: './form-meet-general.css'
})
export class FormMeetGeneralComponent implements OnInit {
  @Input() selectedCourse: Course | null = null;
  @Output() goBack = new EventEmitter<void>();

  fechaFinalizacionForm!: FormGroup;
  filteredTeachers: User[] = [];
  isLoadingTeachers: boolean = false;
  isTeacherSelected: boolean = false;
  selectedTeacherId: string | null = null;
  isSubmitting: boolean = false;
  previewImage: string | null = null;
  selectedFile: File | null = null;
  isDragging: boolean = false;

  // File Selection Modal
  showFileModal = false;
  directusFiles: DirectusFile[] = [];
  isLoadingFiles = false;
  selectedDirectusFileId: string | null = null;
  assetsUrl = environment.assets;

  // Google Calendar Integration
  private CLIENT_ID = '879608095413-95f61hvhukdqfba7app9fhmd5g32qho8.apps.googleusercontent.com';
  private DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  private SCOPES = 'https://www.googleapis.com/auth/calendar.events';
  tokenClient: any;
  gapiInited = false;
  gisInited = false;

  constructor(
    private fb: FormBuilder,
    private courseService: CourseService,
    private programaAyoService: ProgramaAyoService,
    private fileService: FileService,
    private notificationService: NotificationService,
    private userService: UserService,
    private elementRef: ElementRef,
    private ngZone: NgZone,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.loadGoogleScripts();
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
      tematica: ['', Validators.required],
      programa_independiente: [true], // Always true
      img: [null],
      // Google Calendar Fields (Start true for AYO)
      agendar_google_calendar: [true],
      evento_titulo: ['', Validators.required],
      evento_descripcion: [''],
      evento_docente: ['', Validators.required],
      teacherSearchTerm: [''],
      evento_inicio: [null, Validators.required],
      evento_fin: [null, Validators.required],
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

    // Teacher dropdown
    const inputTeacher = document.getElementById('teacherSearchTerm');
    const dropdownTeacher = this.elementRef.nativeElement.querySelector('#teacher-dropdown');

    if (inputTeacher && inputTeacher.contains(target)) {
      // Clicked on input
    } else if (dropdownTeacher && dropdownTeacher.contains(target)) {
      // Clicked on dropdown
    } else {
      this.filteredTeachers = [];
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

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.handleFile(file);
    }
  }

  handleFile(file: File) {
    if (file.type.match(/image\/*/) == null) {
      this.notificationService.showError('Error', 'Solo se permiten imágenes.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      this.notificationService.showError('Error', 'El archivo no debe superar los 5MB.');
      return;
    }

    this.selectedFile = file;
    this.selectedDirectusFileId = null; // Reset directus selection

    const reader = new FileReader();
    reader.onload = (e) => {
      this.previewImage = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  removeImage() {
    this.selectedFile = null;
    this.previewImage = null;
    this.selectedDirectusFileId = null;
  }

  // File Modal Methods
  openFileModal() {
    this.showFileModal = true;
    this.loadFiles();
  }

  closeFileModal() {
    this.showFileModal = false;
  }

  async loadFiles() {
    this.isLoadingFiles = true;
    try {
      const filter = {
        tematica: {
          _eq: true
        }
      };

      const res = await firstValueFrom(this.fileService.getFiles({
        sort: '-uploaded_on',
        type: 'image/jpeg,image/png,image/webp',
        filter: JSON.stringify(filter)
      }));
      this.directusFiles = res.data;
    } catch (error) {
      console.error('Error loading files', error);
      this.notificationService.showError('Error', 'No se pudieron cargar los archivos.');
    } finally {
      this.isLoadingFiles = false;
    }
  }

  selectDirectusFile(file: DirectusFile) {
    this.selectedDirectusFileId = file.id;
    this.selectedFile = null;
    this.previewImage = `${this.assetsUrl}/${file.id}`;
    this.closeFileModal();
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

  onDateInput(event: any, controlName: string, dayOfWeek: number = 2): void {
    const input = event.target as HTMLInputElement;
    if (!input.value) return;

    const dateValue = new Date(input.value);

    // Check if valid date
    if (isNaN(dateValue.getTime())) return;

    // Removed restriction on specific days as per "General Meeting" flexibility, 
    // or if user wants strict days, we can re-enable. 
    // User said "Un día no mas", implying just one meeting.
    // The previous code enforced Tuesday (2).
    // If it's general, maybe any day is fine? 
    // "Agendar en Google Calendar Sesión"
    // I'll leave the day check commented out or remove it to allow any day, 
    // unless strictly required. The user didn't specify a day for this new "General" form.
    // But previously it was "Martes".
    // I'll remove the day restriction for now to be "General".
  }

  goBackAction() {
    if (this.goBack.observed) {
      this.goBack.emit();
    } else {
      this.router.navigate(['/private/ayo']);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.fechaFinalizacionForm.valid) {
      this.isSubmitting = true;

      try {
        const agendar = this.fechaFinalizacionForm.get('agendar_google_calendar')?.value;
        const meetingIds: string[] = [];

        // 1. Create Calendar Events and Meetings
        if (agendar) {
          await this.ensureCalendarToken();
          
          const calendarEventData = await this.createCalendarEvent();
          if (calendarEventData) {
            const meetingData = {
              fecha_inicio: this.formatDateForDirectus(calendarEventData.start.dateTime),
              fecha_finalizacion: this.formatDateForDirectus(calendarEventData.end.dateTime),
              id_reunion: calendarEventData.id,
              link_reunion: calendarEventData.hangoutLink,
              id_docente: this.selectedTeacherId,
              id_nivel: null, // Removed as per request
              id_colegios_cursos: []
            };
            const res = await firstValueFrom(this.courseService.createReunionMeet(meetingData));
            if (res?.data?.id) meetingIds.push(res.data.id);
          }
        }

        // 2. Upload Image if exists
        let imageId = this.selectedDirectusFileId;

        if (this.selectedFile) {
          try {
            // First upload the file
            const uploadRes = await firstValueFrom(this.fileService.uploadFile(this.selectedFile));
            if (uploadRes?.data?.id) {
              imageId = uploadRes.data.id;
              await firstValueFrom(this.fileService.updateFile(imageId, { tematica: true }));
            }
          } catch (error) {
            console.error('Error uploading file', error);
            this.notificationService.showError('Error', 'No se pudo subir la imagen.');
            this.isSubmitting = false;
            return;
          }
        }

        // 3. Create Reunion General
        const reunionGeneralData = {
          tematica: this.fechaFinalizacionForm.get('tematica')?.value,
          img: imageId,
          id_reuniones_meet: meetingIds
        };

        await firstValueFrom(this.programaAyoService.createReunionGeneral(reunionGeneralData));

        this.ngZone.run(() => {
            this.notificationService.showSuccess(
              'Reunión General Creada',
              `La reunión se ha creado correctamente.`,
              0,
              () => {
                 this.goBackAction();
              }
            );
            this.isSubmitting = false;
        });

      } catch (error: any) {
        this.ngZone.run(() => {
          this.notificationService.showError('Error', `No se pudo completar el proceso. Detalles: ${error.message || error}`);
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

  async createCalendarEvent() {
    const startDate = new Date(this.fechaFinalizacionForm.get('evento_inicio')?.value);
    const endDate = new Date(this.fechaFinalizacionForm.get('evento_fin')?.value);

    if (endDate <= startDate) {
      this.notificationService.showError('Error en fechas', 'La fecha de finalización del evento debe ser posterior a la fecha de inicio.');
      throw new Error('Invalid date range');
    }

    // Configuración inicial del evento
    const event: any = {
      summary: this.fechaFinalizacionForm.get('evento_titulo')?.value,
      description: this.fechaFinalizacionForm.get('evento_descripcion')?.value,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: false,
      guestsCanInviteOthers: false,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      // Recurrence removed as per request for single meeting
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
