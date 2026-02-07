import { Component, OnInit, ElementRef, HostListener, Inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ProgramaAyoService } from '../../../../../core/services/programa-ayo.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { UserService } from '../../../../../core/services/user.service';
import { CourseService } from '../../../../../core/services/course.service';
import { ProgramaAyo, ProgramGroup } from '../../../../../core/models/Course';
import { User } from '../../../../../core/models/User';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';
import { environment } from '../../../../../../environments/environment';
import { AttendanceComponent, AttendanceItem } from '../../../../../components/attendance/attendance.component';
import { NivelService } from '../../../../../core/services/nivel.service';
import { Nivel } from '../../../../../core/models/Nivel';
import { CertificacionService } from '../../../../../core/services/certificacion.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

declare var gapi: any;
declare var google: any;

@Component({
  selector: 'app-list-meet',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AttendanceComponent, FormsModule],
  templateUrl: './list-meet.html',
  styleUrl: './list-meet.css'
})
export class ListMeet implements OnInit {

  assetsUrl = environment.assets;
  programas: ProgramaAyo[] = [];
  programGroups: ProgramGroup[] = [];
  selectedGroup: ProgramGroup | null = null;
  viewMode: 'groups' | 'details' | 'students' = 'groups';
  isLoading = false;
  isLoadingStudents = false;
  selectedLanguage: string | null = null;
  searchTerm: string = '';
  filteredProgramGroups: ProgramGroup[] = [];
  private searchSubject = new Subject<string>();

  // Edit Modal Properties
  showEditModal = false;
  editForm!: FormGroup;
  selectedMeeting: any | null = null;
  filteredTeachers: User[] = [];
  isLoadingTeachers = false;
  isTeacherSelected = false;

  // Google Calendar Integration
  private CLIENT_ID = '879608095413-95f61hvhukdqfba7app9fhmd5g32qho8.apps.googleusercontent.com';
  private DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  private SCOPES = 'https://www.googleapis.com/auth/calendar.events';
  tokenClient: any;
  gapiInited = false;
  gisInited = false;

  // Add Meeting Modal Properties
  showAddMeetingModal = false;
  addMeetingForm!: FormGroup;
  selectedProgramId: string | null = null;
  selectedProgramForFocus: ProgramaAyo | null = null;

  // Student Panel Properties
  showStudentPanel = false;
  selectedStudents: User[] = [];
  attendanceList: AttendanceItem[] = [];

  // Promotion Modal Properties
  niveles: Nivel[] = [];
  filteredLevels: Nivel[] = [];
  showLevelModal = false;
  selectedStudentForPromotion: AttendanceItem | null = null;
  isLoadingLevels = false;

  // Study Plan Modal Properties
  showStudyPlanModal = false;
  selectedStudyPlan: any[] = [];
  selectedProgramForStudyPlan: ProgramaAyo | null = null;

  // Novedad Modal Properties
  showNovedadModal = false;
  novedadText: string = '';
  selectedProgramForNovedad: any = null;

  constructor(
    private programaAyoService: ProgramaAyoService,
    private notificationService: NotificationService,
    @Inject(ConfirmationService) private confirmationService: ConfirmationService,
    private userService: UserService,
    private courseService: CourseService,
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private elementRef: ElementRef,
    private cdr: ChangeDetectorRef,
    private nivelService: NivelService,
    private certificacionService: CertificacionService,
    private ngZone: NgZone
  ) { }

  openStudyPlanModal(programa: ProgramaAyo): void {
    this.selectedProgramForStudyPlan = programa;
    if (Array.isArray(programa.plan_estudio_id)) {
      const rawPlan = programa.plan_estudio_id as any[];
      this.selectedStudyPlan = rawPlan.map(item => {
        const text = item.plan || '';
        const match = text.match(/^(\d+)[.\)\-]?\s*(.*)$/);
        if (match) {
          return {
            number: parseInt(match[1], 10),
            displayNumber: match[1],
            text: match[2],
            original: item
          };
        } else {
          return {
            number: 999999,
            displayNumber: '',
            text: text,
            original: item
          };
        }
      }).sort((a, b) => a.number - b.number);
    } else {
      this.selectedStudyPlan = [];
    }
    this.showStudyPlanModal = true;
  }

  closeStudyPlanModal(): void {
    this.showStudyPlanModal = false;
    this.selectedStudyPlan = [];
    this.selectedProgramForStudyPlan = null;
  }

  openNovedadModalGlobal(): void {
    this.selectedProgramForNovedad = null;
    this.showNovedadModal = true;
    this.novedadText = '';
  }

  openNovedadModal(program: any): void {
    this.selectedProgramForNovedad = program;
    this.showNovedadModal = true;
    this.novedadText = '';
  }

  closeNovedadModal(): void {
    this.showNovedadModal = false;
    this.novedadText = '';
    this.selectedProgramForNovedad = null;
  }

  sendNovedad(program?: any): void {
    // If program is not passed as argument, use the stored one
    const targetProgram = program || this.selectedProgramForNovedad;

    if (!this.novedadText.trim()) {
      this.notificationService.showError('Error', 'La novedad no puede estar vacía.');
      return;
    }

    let emails: string[] = [];

    if (targetProgram) {
         if (targetProgram.id_nivel && Array.isArray(targetProgram.id_nivel.estudiantes_id)) {
             for (const estudiante of targetProgram.id_nivel.estudiantes_id) {
                 if (estudiante.email_acudiente) {
                     emails.push(estudiante.email_acudiente);
                 }
             }
         }

         if (emails.length === 0) {
             this.notificationService.showError('Error', 'No se encontraron correos de acudientes para este programa.');
             return;
         }
    } else {
        // Global send - collect from all programs
        if (this.programas && this.programas.length > 0) {
             for (const prog of this.programas) {
                 if (prog.id_nivel && Array.isArray(prog.id_nivel.estudiantes_id)) {
                     for (const estudiante of prog.id_nivel.estudiantes_id) {
                         if (estudiante.email_acudiente) {
                             emails.push(estudiante.email_acudiente);
                         }
                     }
                 }
             }
        }

        if (emails.length === 0) {
            this.notificationService.showError('Error', 'No se encontraron correos de acudientes en ningún programa.');
            return;
        }
    }

    // Deduplicate emails
    emails = [...new Set(emails)];

    this.isLoading = true;
    this.programaAyoService.sendNovedad(this.novedadText, emails).subscribe({
      next: () => {
        this.notificationService.showSuccess('Éxito', 'Novedad enviada correctamente.');
        this.closeNovedadModal();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error enviando novedad:', error);
        this.notificationService.showError('Error', 'No se pudo enviar la novedad.');
        this.isLoading = false;
      }
    });
  }

  ngOnInit(): void {
    this.initForm();
    this.initAddMeetingForm();
    this.loadGoogleScripts();
    this.route.queryParams.subscribe(params => {
      if (params['idioma']) {
        this.selectedLanguage = params['idioma'];
      }
    });

    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.searchTerm = searchTerm;
      this.loadProgramas();
    });

    this.loadProgramas();
  }

  loadNiveles(): void {
    this.isLoadingLevels = true;
    const languages = this.selectedLanguage ? [this.selectedLanguage] : undefined;
    this.nivelService.getNiveles(languages).subscribe({
      next: (response) => {
        const allLevels = response.data || [];
        // Filter levels that have associated AYO programs
        this.niveles = allLevels.filter(nivel =>
            nivel.id_programas_ayo && nivel.id_programas_ayo.length > 0
        );

        if (this.showLevelModal) {
            this.filterLevelsForPromotion();
        }
        if (this.showDegradeModal) {
            this.filterLevelsForDegradation();
        }

        this.isLoadingLevels = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading levels:', error);
        this.isLoadingLevels = false;
        this.cdr.detectChanges();
      }
    });
  }

  filterLevelsForPromotion(): void {
      if (!this.selectedStudentForPromotion) return;

      const currentLevelId = this.selectedStudentForPromotion.currentLevelId;

      if (!currentLevelId) {
          // If no level, show all sorted by order
          this.filteredLevels = [...this.niveles].sort((a, b) => parseInt(a.orden || '0') - parseInt(b.orden || '0'));
          return;
      }

      const currentLevel = this.niveles.find(n => n.id === currentLevelId);
      if (!currentLevel) {
           this.filteredLevels = [...this.niveles].sort((a, b) => parseInt(a.orden || '0') - parseInt(b.orden || '0'));
           return;
      }

      const currentOrden = parseInt(currentLevel.orden || '0');
      this.filteredLevels = this.niveles
          .filter(n => parseInt(n.orden || '0') > currentOrden)
          .sort((a, b) => parseInt(a.orden || '0') - parseInt(b.orden || '0'));
  }

  filterLevelsForDegradation(): void {
      if (!this.selectedStudentForDegradation) return;

      const currentLevelId = this.selectedStudentForDegradation.currentLevelId;

      if (!currentLevelId) {
          this.filteredLevels = [];
          return;
      }

      const currentLevel = this.niveles.find(n => n.id === currentLevelId);
      if (!currentLevel) {
           this.filteredLevels = [];
           return;
      }

      const currentOrden = parseInt(currentLevel.orden || '0');
      this.filteredLevels = this.niveles
          .filter(n => parseInt(n.orden || '0') < currentOrden)
          .sort((a, b) => parseInt(b.orden || '0') - parseInt(a.orden || '0'));
  }

  openPromotionModal(student: AttendanceItem): void {
    this.selectedStudentForPromotion = student;
    this.showLevelModal = true;
    if (this.niveles.length === 0) {
      this.loadNiveles();
    } else {
      this.filterLevelsForPromotion();
    }
  }

  closePromotionModal(): void {
    this.showLevelModal = false;
    this.selectedStudentForPromotion = null;
  }

  promoteStudent(nivel: Nivel): void {
    if (!this.selectedStudentForPromotion || !this.selectedStudentForPromotion.id) {
      this.notificationService.showError('Error', 'No se ha seleccionado un estudiante válido.');
      return;
    }

    this.isLoadingLevels = true;
    const userId = this.selectedStudentForPromotion.id;
    const studentName = this.selectedStudentForPromotion.studentName;
    const currentLevelId = this.selectedStudentForPromotion.currentLevelId;

    // Prepare names for message
    const newLevelName = `${nivel.nivel} ${nivel.subcategoria || ''}`.trim();
    let oldLevelName = 'Sin nivel';

    if (currentLevelId) {
        const oldLevel = this.niveles.find(n => n.id === currentLevelId);
        if (oldLevel) {
            oldLevelName = `${oldLevel.nivel} ${oldLevel.subcategoria || ''}`.trim();
        } else {
            oldLevelName = 'Nivel anterior';
        }
    }

    this.nivelService.changeLevel({
        estudiante_id: userId,
        nivel_id: nivel.id,
        accion: 'promocionar'
    }).subscribe({
      next: () => {
        this.ngZone.run(() => {
            try {
                const message = `El estudiante ${studentName} ha pasado de ${oldLevelName} a ${newLevelName}.`;
                this.notificationService.showSuccess('Éxito', message);

                // Update local state
                if (this.selectedStudentForPromotion) {
                    this.selectedStudentForPromotion.currentLevelId = nivel.id;
                }

                // Update student in the main list
                const studentIndex = this.attendanceList.findIndex(s => s.id === userId);
                if (studentIndex !== -1) {
                    // If viewing a specific level (not "All Students"), remove the student if the new level doesn't match
                    if (this.selectedProgramForFocus &&
                        this.selectedProgramForFocus.id_nivel &&
                        this.selectedProgramForFocus.id_nivel.id &&
                        this.selectedProgramForFocus.id_nivel.id !== nivel.id) {

                        this.attendanceList.splice(studentIndex, 1);

                        // Also remove from selectedStudents source array
                        const selectedIndex = this.selectedStudents.findIndex(s => s.id === userId);
                        if (selectedIndex !== -1) {
                            this.selectedStudents.splice(selectedIndex, 1);
                        }
                    } else {
                        // Otherwise just update the level ID (e.g. in General List)
                        this.attendanceList[studentIndex].currentLevelId = nivel.id;
                    }
                }

                this.closePromotionModal();
                this.loadProgramas(); // Refresh program list
            } catch (e) {
                console.error('Error processing promotion success:', e);
                this.closePromotionModal();
                this.loadProgramas();
            } finally {
                this.isLoadingLevels = false;
                this.cdr.detectChanges();
            }
        });
      },
      error: (error) => {
        this.ngZone.run(() => {
            console.error('Error updating student level:', error);
            this.notificationService.showError('Error', 'No se pudo actualizar el nivel del estudiante.');
            this.isLoadingLevels = false;
            this.cdr.detectChanges();
        });
      }
    });
  }

  // Degrade Modal Properties
  showDegradeModal = false;
  selectedStudentForDegradation: AttendanceItem | null = null;

  openDegradeModal(student: AttendanceItem): void {
    this.selectedStudentForDegradation = student;
    this.showDegradeModal = true;
    if (this.niveles.length === 0) {
      this.loadNiveles();
    } else {
      this.filterLevelsForDegradation();
    }
  }

  closeDegradeModal(): void {
    this.showDegradeModal = false;
    this.selectedStudentForDegradation = null;
  }

  degradeStudent(nivel: Nivel): void {
    if (!this.selectedStudentForDegradation || !this.selectedStudentForDegradation.id) {
      this.notificationService.showError('Error', 'No se ha seleccionado un estudiante válido.');
      return;
    }

    this.isLoadingLevels = true;
    const userId = this.selectedStudentForDegradation.id;
    const studentName = this.selectedStudentForDegradation.studentName;
    const currentLevelId = this.selectedStudentForDegradation.currentLevelId;

    // Prepare names for message
    const newLevelName = `${nivel.nivel} ${nivel.subcategoria || ''}`.trim();
    let oldLevelName = 'Sin nivel';

    if (currentLevelId) {
        const oldLevel = this.niveles.find(n => n.id === currentLevelId);
        if (oldLevel) {
            oldLevelName = `${oldLevel.nivel} ${oldLevel.subcategoria || ''}`.trim();
        } else {
            oldLevelName = 'Nivel anterior';
        }
    }

    this.nivelService.changeLevel({
        estudiante_id: userId,
        nivel_id: nivel.id,
        accion: 'degradar'
    }).subscribe({
      next: () => {
        this.ngZone.run(() => {
            try {
                const message = `El estudiante ${studentName} ha sido degradado de ${oldLevelName} a ${newLevelName}.`;
                this.notificationService.showSuccess('Éxito', message);

                // Update local state
                if (this.selectedStudentForDegradation) {
                    this.selectedStudentForDegradation.currentLevelId = nivel.id;
                }

                // Update student in the main list
                const studentIndex = this.attendanceList.findIndex(s => s.id === userId);
                if (studentIndex !== -1) {
                    // If viewing a specific level (not "All Students"), remove the student if the new level doesn't match
                    if (this.selectedProgramForFocus &&
                        this.selectedProgramForFocus.id_nivel &&
                        this.selectedProgramForFocus.id_nivel.id &&
                        this.selectedProgramForFocus.id_nivel.id !== nivel.id) {

                        this.attendanceList.splice(studentIndex, 1);

                        // Also remove from selectedStudents source array
                        const selectedIndex = this.selectedStudents.findIndex(s => s.id === userId);
                        if (selectedIndex !== -1) {
                            this.selectedStudents.splice(selectedIndex, 1);
                        }
                    } else {
                        // Otherwise just update the level ID (e.g. in General List)
                        this.attendanceList[studentIndex].currentLevelId = nivel.id;
                    }
                }

                this.closeDegradeModal();
                this.loadProgramas(); // Refresh program list
            } catch (e) {
                console.error('Error processing degradation success:', e);
                this.closeDegradeModal();
                this.loadProgramas();
            } finally {
                this.isLoadingLevels = false;
                this.cdr.detectChanges();
            }
        });
      },
      error: (error) => {
        this.ngZone.run(() => {
            console.error('Error updating student level:', error);
            this.notificationService.showError('Error', 'No se pudo actualizar el nivel del estudiante.');
            this.isLoadingLevels = false;
            this.cdr.detectChanges();
        });
      }
    });
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
    this.programaAyoService.getProgramaAyo(this.selectedLanguage || undefined, this.searchTerm).subscribe({
      next: (response) => {
        this.programas = response.data || [];
        this.groupPrograms();
        this.isLoading = false;

        // Refresh student panel if open
        if (this.showStudentPanel && this.selectedProgramForFocus) {
            // Check if it's "Ver Todos" view
            if (this.selectedProgramForFocus.id_nivel?.tematica === 'Listado General') {
                this.verTodosEstudiantes(true);
            } else {
                // Find the updated program in the new list
                const updatedProgram = this.programas.find(p => p.id === this.selectedProgramForFocus?.id);
                if (updatedProgram) {
                    this.verEstudiante(updatedProgram, true);
                } else {
                     // Program might have been deleted or filtered out, but we might want to keep the panel open
                     // or close it. For now, let's leave it as is if not found,
                     // or we could close it. But safer to just not update if not found.
                }
            }
        }
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
    // Since filtering is server-side, filteredProgramGroups is just the grouped result
    this.filteredProgramGroups = this.programGroups;

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

  onSearchInput(term: string): void {
    this.searchTerm = term;
    this.searchSubject.next(term);
  }

  selectGroup(group: ProgramGroup): void {
    this.selectedGroup = group;
    this.viewMode = 'details';
  }

  goBack(): void {
    if (this.showStudentPanel) {
      this.closeStudentPanel();
      return;
    }

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

  verEstudiante(programa: ProgramaAyo, suppressWarnings: boolean = false) {
    const prog = programa as any;

    // New Logic: Use estudiantes_id from id_nivel to get documents and fetch users
    if (prog.id_nivel && prog.id_nivel.estudiantes_id && prog.id_nivel.estudiantes_id.length > 0) {
        const documents: {tipo: string, numero: string}[] = [];
        const seenDocs = new Set<string>();

        prog.id_nivel.estudiantes_id.forEach((student: any) => {
            if (student.tipo_documento && student.numero_documento) {
                const docKey = `${student.tipo_documento}-${student.numero_documento}`;
                if (!seenDocs.has(docKey)) {
                    seenDocs.add(docKey);
                    documents.push({
                        tipo: student.tipo_documento,
                        numero: student.numero_documento
                    });
                }
            }
        });

        if (documents.length > 0) {
            this.isLoadingStudents = true;
            this.showStudentPanel = true;
            this.selectedProgramForFocus = programa;

            this.userService.getUsersByMultipleDocuments(documents).subscribe({
                next: (response) => {
                    this.isLoadingStudents = false;
                    if (response.data && response.data.length > 0) {
                        this.selectedStudents = response.data;

                        // Filter students to ensure they belong to the current level
                        if (prog.id_nivel && prog.id_nivel.id) {
                            this.selectedStudents = this.selectedStudents.filter(s => (s as any).nivel_id === prog.id_nivel.id);
                        }

                        this.attendanceList = this.selectedStudents.map(student => ({
                            id: student.id,
                            studentName: `${student.first_name} ${student.last_name}`,
                            email: student.email,
                            fecha: new Date(),
                            attended: false,
                            score: student.calificacion || '',
                            currentLevelId: (student as any).nivel_id,
                            subcategoria: prog.id_nivel?.subcategoria || ''
                        }));
                        this.cdr.detectChanges();
                    } else {
                        if (!suppressWarnings) this.notificationService.showWarning('Información', 'No se encontraron usuarios registrados con esos documentos.');
                        this.cdr.detectChanges();
                    }
                },
                error: (error) => {
                    this.isLoadingStudents = false;
                    console.error('Error fetching students:', error);
                    if (!suppressWarnings) this.notificationService.showError('Error', 'Error al consultar la información de los estudiantes.');
                    this.cdr.detectChanges();
                }
            });
            return;
        } else {
             if (!suppressWarnings) this.notificationService.showWarning('Información', 'No hay estudiantes inscritos a este programa.');
             // Reset list if no students found
             this.selectedStudents = [];
             this.attendanceList = [];
             return;
        }
    }

    // Fallback: Old Logic using cuentas_cobrar_id
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
        // Use isLoadingStudents instead of global isLoading to avoid main skeleton
        this.isLoadingStudents = true;
        this.showStudentPanel = true;
        this.selectedProgramForFocus = programa;

        this.userService.getUsersByMultipleDocuments(documents)
          .subscribe({
            next: (response) => {
              this.isLoadingStudents = false;
              if (response.data && response.data.length > 0) {
                this.selectedStudents = response.data;

                // Filter students to ensure they belong to the current level
                if (prog.id_nivel && prog.id_nivel.id) {
                    this.selectedStudents = this.selectedStudents.filter(s => (s as any).nivel_id === prog.id_nivel.id);
                }

                this.attendanceList = this.selectedStudents.map(student => ({
                  id: student.id,
                  studentName: `${student.first_name} ${student.last_name}`,
                  email: student.email,
                  fecha: new Date(),
                  attended: false,
                  score: student.calificacion || '',
                  currentLevelId: (student as any).nivel_id,
                  subcategoria: prog.id_nivel?.subcategoria || ''
                }));
                this.cdr.detectChanges();
              } else {
                if (!suppressWarnings) this.notificationService.showWarning('Información', 'No se encontraron usuarios registrados con esos documentos.');
                this.cdr.detectChanges();
              }
            },
            error: (error) => {
              this.isLoadingStudents = false;
              console.error('Error fetching students:', error);
              if (!suppressWarnings) this.notificationService.showError('Error', 'Error al consultar la información de los estudiantes.');
              this.cdr.detectChanges();
            }
          });
      } else {
        if (!suppressWarnings) this.notificationService.showWarning('Información', 'No hay estudiantes inscritos a este programa.');
      }
    } else {
        if (!suppressWarnings) this.notificationService.showWarning('Información', 'No hay estudiantes asociados a este programa.');
        // Reset list if no students found/linked
        this.selectedStudents = [];
        this.attendanceList = [];
    }
  }

  verTodosEstudiantes(suppressWarnings: boolean = false) {
    const documents: { tipo: string; numero: string }[] = [];
    const seenDocs = new Set<string>();
    const studentSubcategoryMap = new Map<string, string>();

    // 1. Collect from id_nivel.estudiantes_id
    this.programas.forEach((prog: any) => {
        if (prog.id_nivel && prog.id_nivel.estudiantes_id && Array.isArray(prog.id_nivel.estudiantes_id)) {
            prog.id_nivel.estudiantes_id.forEach((student: any) => {
                if (student.tipo_documento && student.numero_documento) {
                    const docKey = `${student.tipo_documento}-${student.numero_documento}`;
                    if (!seenDocs.has(docKey)) {
                        seenDocs.add(docKey);
                        documents.push({
                            tipo: student.tipo_documento,
                            numero: student.numero_documento
                        });
                        studentSubcategoryMap.set(docKey, prog.id_nivel.subcategoria || '');
                    }
                }
            });
        }
    });

    // 2. Fallback to cuentas_cobrar_id if no documents found yet
    if (documents.length === 0) {
        this.programas.forEach((programa: any) => {
          if (programa.cuentas_cobrar_id) {
            programa.cuentas_cobrar_id.forEach((cuenta: any) => {
              const est = cuenta.estudiante_id;
              if (est && est.tipo_documento && est.numero_documento) {
                const key = `${est.tipo_documento}-${est.numero_documento}`;
                if (!seenDocs.has(key)) {
                  seenDocs.add(key);
                  documents.push({
                    tipo: est.tipo_documento,
                    numero: est.numero_documento
                  });
                  studentSubcategoryMap.set(key, programa.id_nivel?.subcategoria || '');
                }
              }
            });
          }
        });
    }

    if (documents.length > 0) {
      this.isLoadingStudents = true;
      this.showStudentPanel = true;

      // Dummy object for view
      this.selectedProgramForFocus = {
        id_nivel: {
            tematica: 'Listado General',
            nivel: 'Todos los Niveles',
            subcategoria: 'Todos los Estudiantes',
            categoria: '',
            id: '',
            idioma: ''
        },
        fecha_finalizacion: '',
        curso_id: ''
      };

      this.userService.getUsersByMultipleDocuments(documents)
        .subscribe({
          next: (response) => {
            this.isLoadingStudents = false;
            if (response.data && response.data.length > 0) {
              this.selectedStudents = response.data;
              this.attendanceList = this.selectedStudents.map(student => {
                const docKey = `${student.tipo_documento}-${student.numero_documento}`;
                return {
                    id: student.id,
                    studentName: `${student.first_name} ${student.last_name}`,
                    email: student.email,
                    fecha: new Date(),
                    attended: false,
                    score: '',
                    currentLevelId: (student as any).nivel_id,
                    subcategoria: studentSubcategoryMap.get(docKey) || ''
                };
              });
              this.cdr.detectChanges();
            } else {
              if (!suppressWarnings) this.notificationService.showWarning('Información', 'No se encontraron usuarios registrados con esos documentos.');
              this.cdr.detectChanges();
            }
          },
          error: (error) => {
            this.isLoadingStudents = false;
            console.error('Error fetching students:', error);
            if (!suppressWarnings) this.notificationService.showError('Error', 'Error al consultar la información de los estudiantes.');
            this.cdr.detectChanges();
          }
        });
    } else {
        if (!suppressWarnings) this.notificationService.showWarning('Información', 'No hay estudiantes registrados en ningún programa.');
    }
  }

  closeStudentPanel() {
    this.showStudentPanel = false;
    this.selectedProgramForFocus = null;
    this.selectedStudents = [];
    this.attendanceList = [];
  }
}
