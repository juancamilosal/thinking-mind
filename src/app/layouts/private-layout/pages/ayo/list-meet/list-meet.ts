import {Component, OnInit, ElementRef, HostListener, Inject} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ProgramaAyoService } from '../../../../../core/services/programa-ayo.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { UserService } from '../../../../../core/services/user.service';
import { CourseService } from '../../../../../core/services/course.service';
import { ProgramaAyo, ProgramGroup } from '../../../../../core/models/Course';
import { User } from '../../../../../core/models/User';
import {ConfirmationService} from '../../../../../core/services/confirmation.service';
import {environment} from '../../../../../../environments/environment';

declare var gapi: any;
declare var google: any;

@Component({
  selector: 'app-list-meet',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './list-meet.html',
  styleUrl: './list-meet.css'
})
export class ListMeet implements OnInit {

  assetsUrl = environment.assets;
  programas: ProgramaAyo[] = [];
  programGroups: ProgramGroup[] = [];
  selectedGroup: ProgramGroup | null = null;
  viewMode: 'groups' | 'details' = 'groups';
  isLoading = false;
  selectedLanguage: string | null = null;

  // Edit Modal Properties
  showEditModal = false;
  editForm!: FormGroup;
  selectedMeeting: any | null = null;
  filteredTeachers: User[] = [];
  isLoadingTeachers = false;
  isTeacherSelected = false;

  // Google Calendar Integration
  private CLIENT_ID = '996133721948-6rim847cd71sknq58u3tcov5drtag7vv.apps.googleusercontent.com';
  private DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  private SCOPES = 'https://www.googleapis.com/auth/calendar.events';
  tokenClient: any;
  gapiInited = false;
  gisInited = false;

  // Add Meeting Modal Properties
  showAddMeetingModal = false;
  addMeetingForm!: FormGroup;
  selectedProgramId: string | null = null;

  // Student Modal Properties
  showStudentModal = false;
  selectedStudents: User[] = [];

  constructor(
    private programaAyoService: ProgramaAyoService,
    private notificationService: NotificationService,
    @Inject(ConfirmationService) private confirmationService: ConfirmationService,
    private userService: UserService,
    private courseService: CourseService,
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private elementRef: ElementRef
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.initAddMeetingForm();
    this.loadGoogleScripts();
    this.route.queryParams.subscribe(params => {
      if (params['idioma']) {
        this.selectedLanguage = params['idioma'];
      }
    });
    this.loadProgramas();
  }

  initForm(): void {
    this.editForm = this.fb.group({
      fecha_inicio: [null, Validators.required],
      fecha_finalizacion: [null, Validators.required],
      id_docente: [null, Validators.required],
      teacherSearchTerm: ['']
    });
  }

  initAddMeetingForm(): void {
    this.addMeetingForm = this.fb.group({
      titulo: ['', Validators.required],
      descripcion: [''],
      fecha_inicio: [null, Validators.required],
      fecha_finalizacion: [null, Validators.required],
      id_docente: [null, Validators.required],
      teacherSearchTerm: ['']
    });
  }

  // Teacher Search Logic
  onTeacherSearch(event: any, isAddMode: boolean = false): void {
    const searchTerm = event.target.value;
    const form = isAddMode ? this.addMeetingForm : this.editForm;

    form.get('teacherSearchTerm')?.setValue(searchTerm);

    if (this.isTeacherSelected) {
      this.isTeacherSelected = false;
      form.get('id_docente')?.setValue(null);
    }

    this.searchTeachers(searchTerm);
  }

  onTeacherInputFocus(isAddMode: boolean = false): void {
    const form = isAddMode ? this.addMeetingForm : this.editForm;
    const currentTerm = form.get('teacherSearchTerm')?.value || '';
    this.searchTeachers(currentTerm);
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

  selectTeacher(teacher: User, isAddMode: boolean = false): void {
    const form = isAddMode ? this.addMeetingForm : this.editForm;
    form.get('id_docente')?.setValue(teacher.id);
    form.get('teacherSearchTerm')?.setValue(`${teacher.first_name} ${teacher.last_name}`);
    this.filteredTeachers = [];
    this.isTeacherSelected = true;
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;
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

  openAddMeetingModal(program: any): void {
      this.selectedProgramId = program.id;
      this.showAddMeetingModal = true;
      this.addMeetingForm.reset();
      this.filteredTeachers = [];
      this.isTeacherSelected = false;
  }

  closeAddMeetingModal(): void {
      this.showAddMeetingModal = false;
      this.selectedProgramId = null;
      this.addMeetingForm.reset();
      this.filteredTeachers = [];
      this.isTeacherSelected = false;
  }

  deleteProgram(program: any): void {
    if (program.id_reuniones_meet && program.id_reuniones_meet.length > 0) {
      this.notificationService.showError('Operación no permitida', 'No se puede eliminar el programa AYO si ya tiene reuniones programadas en Google Calendar.');
      return;
    }

    this.confirmationService.showConfirmation(
      {
        title: 'Confirmar Eliminación',
        message: '¿Estás seguro de que deseas eliminar este programa AYO?',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
      },
      () => {
        this.programaAyoService.deleteProgramaAyo(program.id).subscribe({
          next: () => {
            this.notificationService.showSuccess('Programa eliminado', 'El programa AYO ha sido eliminado correctamente.');
            this.loadProgramas();
          },
          error: (error) => {
            console.error('Error deleting program:', error);
            this.notificationService.showError('Error', 'No se pudo eliminar el programa.');
          }
        });
      }
    );
  }

  async createNewMeeting(): Promise<void> {
      if (this.addMeetingForm.invalid) {
          this.addMeetingForm.markAllAsTouched();
          return;
      }

      if (!this.selectedProgramId) {
          this.notificationService.showError('Error', 'No se ha seleccionado un programa.');
          return;
      }

      const formData = this.addMeetingForm.value;
      const startDate = new Date(formData.fecha_inicio);
      const endDate = new Date(formData.fecha_finalizacion);

      if (endDate <= startDate) {
          this.notificationService.showError('Error en fechas', 'La fecha de finalización debe ser posterior a la de inicio.');
          return;
      }

      try {
          // Ensure valid token
          await this.ensureCalendarToken();

          const event = {
              summary: formData.titulo,
              description: formData.descripcion,
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
              conferenceData: {
                  createRequest: {
                      requestId: "req-" + Date.now(),
                      conferenceSolutionKey: { type: "hangoutsMeet" }
                  }
              }
          };

          const calendarResponse: any = await gapi.client.calendar.events.insert({
              calendarId: 'primary',
              resource: event,
              conferenceDataVersion: 1
          });

          console.log('Google Calendar event created:', calendarResponse);

          const meetingData = {
              id_reunion: calendarResponse.result.id,
              link_reunion: calendarResponse.result.hangoutLink,
              fecha_inicio: formData.fecha_inicio,
              fecha_finalizacion: formData.fecha_finalizacion,
              id_docente: formData.id_docente,
              id_programa_ayo: this.selectedProgramId
          };

          this.courseService.createReunionMeet(meetingData).subscribe({
              next: () => {
                  this.notificationService.showSuccess('Reunión creada', 'La reunión se ha creado correctamente.');
                  this.loadProgramas();
                  this.closeAddMeetingModal();
              },
              error: (error) => {
                  console.error('Error creating meeting in backend:', error);
                  this.notificationService.showError('Error', 'No se pudo guardar la reunión en el sistema.');
                  // Optionally delete from Google Calendar if backend fails?
                  // For now, let's keep it simple.
              }
          });

      } catch (error) {
          console.error('Error creating Google Calendar event:', error);
          this.notificationService.showError('Error de Sincronización', 'No se pudo crear el evento en Google Calendar.');
      }
  }

  // Modal Logic
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

  ensureCalendarToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.tokenClient.callback = (resp: any) => {
        if (resp.error) {
          reject(resp);
        } else {
          // Update gapi client with new token
          if (gapi.client) {
            gapi.client.setToken(resp);
          }
          resolve(resp.access_token);
        }
      };

      // If we don't have a token yet, prompt for consent to ensure we get a valid one
      if (gapi.client.getToken() === null) {
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        this.tokenClient.requestAccessToken({ prompt: '' });
      }
    });
  }

  openEditModal(meeting: any): void {
    this.selectedMeeting = meeting;

    // Format dates for datetime-local input (YYYY-MM-DDTHH:mm)
    const startDate = this.formatDateForInput(meeting.fecha_inicio);
    const endDate = this.formatDateForInput(meeting.fecha_finalizacion);

    // Setup teacher data
    let teacherName = '';
    let teacherId = null;

    if (meeting.id_docente) {
      teacherName = `${meeting.id_docente.first_name} ${meeting.id_docente.last_name}`;
      teacherId = meeting.id_docente.id;
      this.isTeacherSelected = true;
    } else {
      this.isTeacherSelected = false;
    }

    this.editForm.patchValue({
      fecha_inicio: startDate,
      fecha_finalizacion: endDate,
      id_docente: teacherId,
      teacherSearchTerm: teacherName
    });

    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedMeeting = null;
    this.editForm.reset();
    this.filteredTeachers = [];
    this.isTeacherSelected = false;
  }

  async saveEditedMeeting(): Promise<void> {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    if (!this.selectedMeeting) return;

    const formData = this.editForm.value;
    const updateData = {
      fecha_inicio: formData.fecha_inicio,
      fecha_finalizacion: formData.fecha_finalizacion,
      id_docente: formData.id_docente
    };

    // Update Google Calendar if event ID exists
    if (this.selectedMeeting.id_reunion) {
      try {
        const startDate = new Date(formData.fecha_inicio);
        const endDate = new Date(formData.fecha_finalizacion);

        if (endDate <= startDate) {
           this.notificationService.showError('Error en fechas', 'La fecha de finalización debe ser posterior a la de inicio.');
           return;
        }

        // Ensure valid token
        await this.ensureCalendarToken();

        const eventPatch = {
          start: {
            dateTime: startDate.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          end: {
            dateTime: endDate.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        };

        await gapi.client.calendar.events.patch({
          calendarId: 'primary',
          eventId: this.selectedMeeting.id_reunion,
          resource: eventPatch
        });

        console.log('Google Calendar event updated');

      } catch (error) {
        console.error('Error updating Google Calendar event:', error);
        this.notificationService.showError('Error de Sincronización', 'No se pudo actualizar el evento en Google Calendar.');
        return; // Stop execution if Google Calendar sync fails
      }
    }

    this.courseService.updateReunionMeet(this.selectedMeeting.id, updateData).subscribe({
      next: () => {
        this.notificationService.showSuccess('Reunión actualizada', 'La reunión se ha actualizado correctamente.');
        this.loadProgramas(); // Refresh list
        this.closeEditModal();
      },
      error: (error) => {
        console.error('Error updating meeting:', error);
        this.notificationService.showError('Error', 'No se pudo actualizar la reunión.');
      }
    });
  }

  deleteMeeting(meeting: any): void {
        this.confirmationService.showDeleteConfirmation(
            'esta reunión',
            'reunión',
            async () => {
                // If meeting has Google Calendar info
                if (meeting.id_reunion) {
                    try {
                        // Ensure we have a valid token (refreshed if needed)
                        await this.ensureCalendarToken();

                        // Use gapi directly for deletion as it handles the session better
                        await gapi.client.calendar.events.delete({
                            calendarId: 'primary',
                            eventId: meeting.id_reunion
                        });

                        console.log('Meeting deleted from Google Calendar');
                        this.deleteMeetingFromBackend(meeting);
                    } catch (err) {
                        console.error('Error deleting from Google Calendar:', err);
                        // If error, still try to delete from backend to keep data consistent
                        this.deleteMeetingFromBackend(meeting);
                    }
                } else {
                    this.deleteMeetingFromBackend(meeting);
                }
            }
        );
    }

  private deleteMeetingFromBackend(meeting: any): void {
    this.courseService.deleteReunionMeet(meeting.id).subscribe({
      next: () => {
        this.notificationService.showSuccess(
          'Reunión eliminada',
          'La reunión ha sido eliminada correctamente.',
          0,
          () => {
            this.loadProgramas();
          }
        );

        if (this.showEditModal) {
          this.closeEditModal();
        }
      },
      error: (error) => {
        console.error('Error deleting meeting:', error);
        this.notificationService.showError('Error', 'No se pudo eliminar la reunión.');
      }
    });
  }

  private formatDateForInput(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Adjust for local timezone offset manually or use simple ISO slice if backend expects UTC but UI shows local
    // Assuming the input needs local time format YYYY-MM-DDTHH:mm
    const pad = (n: number) => n < 10 ? '0' + n : n;
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }


  loadProgramas(): void {
    this.isLoading = true;
    this.programaAyoService.getProgramaAyo(this.selectedLanguage || undefined).subscribe({
      next: (response) => {
        this.programas = response.data || [];
        this.groupPrograms();
        this.isLoading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error', 'No se pudieron cargar los programas AYO.');
        this.isLoading = false;
      }
    });
  }

  groupPrograms(): void {
    const groups: {[key: string]: ProgramGroup} = {};
    this.programas.forEach(p => {
      const key = p.id_nivel?.tematica || 'Sin Temática';
      if (!groups[key]) {
        groups[key] = {
          tematica: key,
          nivel: p.id_nivel?.nivel,
          subcategoria: p.id_nivel?.subcategoria,
          img: p.img,
          programs: [],
          id_nivel: p.id_nivel
        };
      }
      groups[key].programs.push(p);
    });
    this.programGroups = Object.values(groups);

    // If a group was selected, update it with new data
    if (this.selectedGroup) {
      const updatedGroup = this.programGroups.find((g: ProgramGroup) => {
        const groupTematica = g.tematica || 'Sin Temática';
        const selectedTematica = this.selectedGroup?.tematica || 'Sin Temática';
        return groupTematica === selectedTematica;
      });
      if (updatedGroup) {
        this.selectedGroup = updatedGroup;
      } else {
        this.viewMode = 'groups';
        this.selectedGroup = null;
      }
    }
  }

  selectGroup(group: ProgramGroup): void {
    this.selectedGroup = group;
    this.viewMode = 'details';
  }

  goBack(): void {
    if (this.viewMode === 'details') {
      this.viewMode = 'groups';
      this.selectedGroup = null;
      return;
    }

    if (this.selectedLanguage) {
      this.router.navigate(['/private/ayo'], { queryParams: { idioma: this.selectedLanguage } });
    } else {
      this.router.navigate(['/private/ayo']);
    }
  }

  verEstudiante(programa: ProgramaAyo) {
    const prog = programa as any;
    
    if (prog.cuentas_cobrar_id && prog.cuentas_cobrar_id.length > 0) {
      const documents: {tipo: string, numero: string}[] = [];
      
      // Filter unique documents to avoid duplicate requests
      const seenDocs = new Set<string>();

      prog.cuentas_cobrar_id.forEach((cuenta: any) => {
        const est = cuenta.estudiante_id;
        if (est && est.tipo_documento && est.numero_documento) {
          const key = `${est.tipo_documento}-${est.numero_documento}`;
          if (!seenDocs.has(key)) {
            seenDocs.add(key);
            documents.push({
              tipo: est.tipo_documento,
              numero: est.numero_documento
            });
          }
        }
      });
      
      if (documents.length > 0) {
        this.isLoading = true;
        this.userService.getUsersByMultipleDocuments(documents)
          .subscribe({
            next: (response) => {
              this.isLoading = false;
              if (response.data && response.data.length > 0) {
                this.selectedStudents = response.data;
                this.showStudentModal = true;
              } else {
                this.notificationService.showWarning('Información', 'No se encontraron usuarios registrados con esos documentos.');
              }
            },
            error: (error) => {
              this.isLoading = false;
              console.error('Error fetching students:', error);
              this.notificationService.showError('Error', 'Error al consultar la información de los estudiantes.');
            }
          });
      } else {
        this.notificationService.showWarning('Información', 'Los estudiantes asociados no tienen documento registrado.');
      }
    } else {
        this.notificationService.showWarning('Información', 'No hay estudiantes asociados a este programa.');
    }
  }

  closeStudentModal() {
    this.showStudentModal = false;
    this.selectedStudents = [];
  }
}
