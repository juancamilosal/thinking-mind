import {Component, OnInit, ElementRef, HostListener, Inject} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ProgramaAyoService } from '../../../../../core/services/programa-ayo.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { UserService } from '../../../../../core/services/user.service';
import { CourseService } from '../../../../../core/services/course.service';
import { ProgramaAyo } from '../../../../../core/models/Course';
import { User } from '../../../../../core/models/User';
import { Meeting } from '../../../../../core/models/Meeting';
import {ConfirmationService} from '../../../../../core/services/confirmation.service';

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

  programas: ProgramaAyo[] = [];
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

  // Teacher Search Logic
  onTeacherSearch(event: any): void {
    const searchTerm = event.target.value;
    this.editForm.get('teacherSearchTerm')?.setValue(searchTerm);

    if (this.isTeacherSelected) {
      this.isTeacherSelected = false;
      this.editForm.get('id_docente')?.setValue(null);
    }

    this.searchTeachers(searchTerm);
  }

  onTeacherInputFocus(): void {
    const currentTerm = this.editForm.get('teacherSearchTerm')?.value || '';
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

  selectTeacher(teacher: User): void {
    this.editForm.get('id_docente')?.setValue(teacher.id);
    this.editForm.get('teacherSearchTerm')?.setValue(`${teacher.first_name} ${teacher.last_name}`);
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

  saveEditedMeeting(): void {
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
        this.isLoading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error', 'No se pudieron cargar los programas AYO.');
        this.isLoading = false;
      }
    });
  }

  goBack(): void {
    if (this.selectedLanguage) {
      this.router.navigate(['/private/ayo'], { queryParams: { idioma: this.selectedLanguage } });
    } else {
      this.router.navigate(['/private/ayo']);
    }
  }
}
