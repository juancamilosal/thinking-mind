import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { ReunionGeneralService } from '../../../../../core/services/reunion-general.service';
import {ReunionGeneral} from '../../../../../core/models/Meeting';
import { environment } from '../../../../../../environments/environment';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { CourseService } from '../../../../../core/services/course.service';
import { AppButtonComponent } from '../../../../../components/app-button/app-button.component';
import { UserService } from '../../../../../core/services/user.service';
import { User } from '../../../../../core/models/User';

declare var gapi: any;
declare var google: any;

@Component({
  selector: 'app-general-meeting',
  standalone: true,
  imports: [CommonModule, AppButtonComponent, ReactiveFormsModule, FormsModule],
  templateUrl: './general-meeting.html'
})
export class GeneralMeetingComponent implements OnInit {
  reuniones: ReunionGeneral[] = [];
  isLoading = false;
  assetsUrl = environment.assets;
  selectedMeeting: any = null;
  showEditModal = false;
  editForm!: FormGroup;
  filteredTeachers: User[] = [];
  isLoadingTeachers = false;
  isTeacherSelected = false;
  private CLIENT_ID = '879608095413-95f61hvhukdqfba7app9fhmd5g32qho8.apps.googleusercontent.com';
  private DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  private SCOPES = 'https://www.googleapis.com/auth/calendar.events';
  tokenClient: any;
  gapiInited = false;
  gisInited = false;

  constructor(
    private reunionGeneralService: ReunionGeneralService,
    private router: Router,
    private route: ActivatedRoute,
    private confirmationService: ConfirmationService,
    private notificationService: NotificationService,
    private courseService: CourseService,
    private fb: FormBuilder,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.initEditForm();
    this.loadGoogleScripts();
    this.loadReuniones();
  }

  loadReuniones(): void {
    this.isLoading = true;
    const params: any = {
      fields: '*,id_reuniones_meet.*,id_reuniones_meet.id_docente.*'
    };
    this.reunionGeneralService.list(params).subscribe({
      next: (response) => {
        const data = response?.data || [];
        this.reuniones = Array.isArray(data) ? data : [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  initEditForm(): void {
    this.editForm = this.fb.group({
      fecha_inicio: [null, Validators.required],
      fecha_finalizacion: [null, Validators.required],
      id_docente: [null, Validators.required],
      teacherSearchTerm: ['']
    });
  }

  loadGoogleScripts(): void {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => this.gapiLoaded();
    document.body.appendChild(script);

    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.onload = () => this.gisLoaded();
    document.body.appendChild(gisScript);
  }

  gapiLoaded(): void {
    if (typeof gapi !== 'undefined') {
      gapi.load('client', async () => {
        await gapi.client.init({
          discoveryDocs: [this.DISCOVERY_DOC]
        });
        this.gapiInited = true;
      });
    }
  }

  gisLoaded(): void {
    if (typeof google !== 'undefined') {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.CLIENT_ID,
        scope: this.SCOPES,
        callback: ''
      });
      this.gisInited = true;
    }
  }

  getImageUrl(reunion: ReunionGeneral): string {
    if (reunion.img) {
      return `${this.assetsUrl}/${reunion.img}`;
    }
    return 'assets/icons/grupo.png';
  }

  getMeetingLink(raw: any): string | null {
    if (!raw || typeof raw !== 'string') {
      return null;
    }
    return raw.replace(/[`]/g, '').trim() || null;
  }

  editMeeting(meeting: any): void {
    if (!meeting || !meeting.id) {
      return;
    }
    this.selectedMeeting = meeting;
    const startDate = this.formatDateForInput(meeting.fecha_inicio);
    const endDate = this.formatDateForInput(meeting.fecha_finalizacion);
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

  deleteMeeting(meeting: any): void {
    if (!meeting || !meeting.id) {
      return;
    }

    this.confirmationService.showDeleteConfirmation(
      'esta reunión',
      'reunión',
      () => {
        this.courseService.deleteReunionMeet(meeting.id).subscribe({
          next: () => {
            this.notificationService.showSuccess(
              'Reunión eliminada',
              'La reunión ha sido eliminada correctamente.'
            );
            this.loadReuniones();
          },
          error: () => {
            this.notificationService.showError(
              'Error',
              'No se pudo eliminar la reunión.'
            );
          }
        });
      }
    );
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedMeeting = null;
    this.editForm.reset();
    this.filteredTeachers = [];
    this.isTeacherSelected = false;
  }

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
    const roleId = 'fe83d2f3-1b89-477d-984a-de3b56e12001';
    this.isLoadingTeachers = true;
    this.userService.getUsersByRole(roleId, searchTerm).subscribe({
      next: (response) => {
        this.filteredTeachers = response.data || [];
        this.isLoadingTeachers = false;
      },
      error: () => {
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

  async saveEditedMeeting(): Promise<void> {
    if (this.editForm.invalid || !this.selectedMeeting) {
      this.editForm.markAllAsTouched();
      return;
    }
    const formData = this.editForm.value;
    const updateData = {
      fecha_inicio: formData.fecha_inicio,
      fecha_finalizacion: formData.fecha_finalizacion,
      id_docente: formData.id_docente
    };
    if (this.selectedMeeting.id_reunion) {
      try {
        const startDate = new Date(formData.fecha_inicio);
        const endDate = new Date(formData.fecha_finalizacion);
        if (endDate <= startDate) {
          this.notificationService.showError('Error en fechas', 'La fecha de finalización debe ser posterior a la de inicio.');
          return;
        }
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
      } catch (error) {
        this.notificationService.showError('Error de Sincronización', 'No se pudo actualizar el evento en Google Calendar.');
        return;
      }
    }
    this.courseService.updateReunionMeet(this.selectedMeeting.id, updateData).subscribe({
      next: () => {
        this.notificationService.showSuccess('Reunión actualizada', 'La reunión se ha actualizado correctamente.');
        this.loadReuniones();
        this.closeEditModal();
      },
      error: () => {
        this.notificationService.showError('Error', 'No se pudo actualizar la reunión.');
      }
    });
  }

  ensureCalendarToken(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.tokenClient || typeof gapi === 'undefined' || !gapi.client) {
        resolve();
        return;
      }
      this.tokenClient.callback = (resp: any) => {
        if (resp.error) {
          reject(resp);
        } else {
          gapi.client.setToken(resp);
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

  private formatDateForInput(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const pad = (n: number) => n < 10 ? '0' + n : n;
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  editReunionGeneral(reunion: ReunionGeneral): void {
    this.router.navigate(['/private/ayo/create-general-meet'], {
      queryParams: { reunion_general_id: reunion.id }
    });
  }

  deleteReunionGeneral(reunion: ReunionGeneral): void {
    if (reunion.id_reuniones_meet && reunion.id_reuniones_meet.length > 0) {
      this.notificationService.showError(
        'Operación no permitida',
        'No se puede eliminar la reunión general porque tiene reuniones programadas en Meet y Google Calendar. Elimina primero esas reuniones.'
      );
      return;
    }

    this.confirmationService.showDeleteConfirmation(
      reunion.tematica || 'esta reunión general',
      'reunión general',
      () => {
        this.reunionGeneralService.delete(reunion.id).subscribe({
          next: () => {
            this.notificationService.showSuccess(
              'Reunión eliminada',
              'La reunión general se ha eliminado correctamente.'
            );
            this.loadReuniones();
          },
          error: () => {
            this.notificationService.showError(
              'Error',
              'No se pudo eliminar la reunión general.'
            );
          }
        });
      }
    );
  }

  createNewGeneralMeeting(): void {
    this.router.navigate(['/private/ayo/create-general-meet']);
  }

  goBack(): void {
    const idioma = this.route.snapshot.queryParamMap.get('idioma');
    if (idioma) {
      this.router.navigate(['/private/ayo'], { queryParams: { idioma } });
    } else {
      this.router.navigate(['/private/ayo']);
    }
  }
}
