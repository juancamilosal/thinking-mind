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
import { AttendanceComponent } from '../../../../../components/attendance/attendance.component';
import {AttendanceItem} from '../../../../../core/models/Attendance';
import { NivelService } from '../../../../../core/services/nivel.service';
import { Nivel } from '../../../../../core/models/Nivel';
import { CertificacionService } from '../../../../../core/services/certificacion.service';
import { Subject, firstValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FileService, DirectusFile } from '../../../../../core/services/file.service';

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
  studentPanelMode: 'general' | 'noProgram' = 'general';
  isLoading = false;
  isLoadingStudents = false;
  selectedLanguage: string | null = null;
  searchTerm: string = '';
  filteredProgramGroups: ProgramGroup[] = [];
  private searchSubject = new Subject<string>();
  private studentSearchSubject = new Subject<string>();
  studentsWithoutProgramCount: number = 0;
  // Filters: General
  generalStudentSearchTerm: string = '';
  generalSelectedLevelFilter: string = '';
  generalSelectedSubcategoryFilter: string = '';
  // Filters: No Program
  noProgramStudentSearchTerm: string = '';
  noProgramSelectedLevelFilter: string = '';
  noProgramSelectedSubcategoryFilter: string = '';
  // Locate in Meeting
  showLocateModal: boolean = false;
  selectedStudentForLocate: AttendanceItem | null = null;
  locatePrograms: ProgramaAyo[] = [];
  locateProgramTeachers: { [programId: string]: { teacherId: string, teacherName: string, meetings: any[] }[] } = {};

  // Image Edit Properties
  showFileModal = false;
  directusFiles: DirectusFile[] = [];
  isLoadingFiles = false;
  selectedDirectusFileId: string | null = null;
  selectedProgramForImageEdit: ProgramaAyo | null = null;
  selectedFile: File | null = null;
  isDragging = false;
  previewImage: string | null = null;
  isUpdatingImage = false;

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
  originalAttendanceList: AttendanceItem[] = [];
  
  // Student Filters
  studentSearchTerm: string = '';
  selectedLevelFilter: string = '';
  selectedSubcategoryFilter: string = '';
  uniqueLevels: string[] = [];
  uniqueSubcategories: string[] = [];

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
  newPlanText: string = '';
  editingPlanId: string | number | null = null;
  editingPlanText: string = '';
  isProcessingPlan: boolean = false;

  // Novedad Modal Properties
  showNovedadModal = false;
  novedadText: string = '';
  selectedProgramForNovedad: any = null;

  // External navigation helpers
  private meetingIdToOpen: string | null = null;

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
    private fileService: FileService,
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
    this.newPlanText = '';
    this.editingPlanId = null;
    this.editingPlanText = '';
    this.isProcessingPlan = false;
  }

  addPlanItem(): void {
    if (!this.newPlanText.trim()) return;
    this.isProcessingPlan = true;

    const newPlanData = {
        plan: this.newPlanText,
        realizado: false
    };

    this.programaAyoService.createPlanEstudio(newPlanData).subscribe({
        next: (response) => {
            const newPlan = response.data;
            const currentPlans = this.selectedProgramForStudyPlan?.plan_estudio_id || [];
            const currentIds = Array.isArray(currentPlans) 
                ? currentPlans.map((p: any) => p.id) 
                : [];
            
            const newIds = [...currentIds, newPlan.id];
            
            if (this.selectedProgramForStudyPlan && this.selectedProgramForStudyPlan.id) {
                 this.programaAyoService.updateProgramaAyo(this.selectedProgramForStudyPlan.id, {
                    plan_estudio_id: newIds
                 }).subscribe({
                    next: () => {
                        this.ngZone.run(() => {
                             if (Array.isArray(this.selectedProgramForStudyPlan?.plan_estudio_id)) {
                                 (this.selectedProgramForStudyPlan!.plan_estudio_id as any[]).push(newPlan);
                             } else {
                                 this.selectedProgramForStudyPlan!.plan_estudio_id = [newPlan];
                             }
                             
                             this.openStudyPlanModal(this.selectedProgramForStudyPlan!);
                             
                             this.newPlanText = '';
                             this.isProcessingPlan = false;
                             this.cdr.detectChanges();
                        });
                    },
                    error: (err) => {
                        this.ngZone.run(() => {
                            console.error(err);
                            this.notificationService.showError('Error', 'No se pudo actualizar el programa.');
                            this.isProcessingPlan = false;
                            this.cdr.detectChanges();
                        });
                    }
                 });
            }
        },
        error: (err) => {
            this.ngZone.run(() => {
                console.error(err);
                this.notificationService.showError('Error', 'No se pudo crear el item.');
                this.isProcessingPlan = false;
                this.cdr.detectChanges();
            });
        }
    });
  }

  startEditingPlan(item: any): void {
      this.editingPlanId = item.original.id;
      this.editingPlanText = item.original.plan;
  }

  cancelEditingPlan(): void {
      this.editingPlanId = null;
      this.editingPlanText = '';
  }

  saveEditedPlan(item: any): void {
       if (!this.editingPlanText.trim()) return;
       this.isProcessingPlan = true;
       
       this.programaAyoService.updatePlanEstudio(item.original.id, {
           plan: this.editingPlanText
       }).subscribe({
           next: () => {
               this.ngZone.run(() => {
                   item.original.plan = this.editingPlanText;
                   this.openStudyPlanModal(this.selectedProgramForStudyPlan!);
                   
                   this.cancelEditingPlan();
                   this.isProcessingPlan = false;
                   this.cdr.detectChanges();
               });
            },
            error: (err) => {
               this.ngZone.run(() => {
                   this.notificationService.showError('Error', 'No se pudo actualizar el item.');
                   this.isProcessingPlan = false;
                   this.cdr.detectChanges();
               });
           }
       });
  }

  deletePlanItem(item: any): void {
    this.confirmationService.showDeleteConfirmation(
        'este item del plan de estudio',
        'Item del Plan',
        () => {
            this.isProcessingPlan = true;
            this.cdr.detectChanges();
            
            const currentPlans = this.selectedProgramForStudyPlan?.plan_estudio_id as any[];
            const newIds = currentPlans.filter(p => p.id !== item.original.id).map(p => p.id);
            
            if (this.selectedProgramForStudyPlan && this.selectedProgramForStudyPlan.id) {
                 // Primero desvincular del programa (opcional si Directus maneja cascada, pero seguro hacerlo)
                 // O simplemente eliminar directamente el item si la relación lo permite
                 
                 this.programaAyoService.deletePlanEstudio(item.original.id).subscribe({
                     next: () => {
                         this.ngZone.run(() => {
                             const index = (this.selectedProgramForStudyPlan!.plan_estudio_id as any[]).findIndex(p => p.id === item.original.id);
                             if (index !== -1) {
                                 (this.selectedProgramForStudyPlan!.plan_estudio_id as any[]).splice(index, 1);
                             }
                             this.openStudyPlanModal(this.selectedProgramForStudyPlan!);
                             this.isProcessingPlan = false;
                             this.cdr.detectChanges();
                         });
                     },
                     error: (err) => {
                         this.ngZone.run(() => {
                             console.error('Error eliminando item:', err);
                             this.notificationService.showError('Error', 'No se pudo eliminar el item.');
                             this.isProcessingPlan = false;
                             this.cdr.detectChanges();
                         });
                     }
                 });
             }
         }
     );
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
      if (params['meeting_id']) {
        this.meetingIdToOpen = params['meeting_id'];
      }
    });

    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.searchTerm = searchTerm;
      this.loadProgramas();
    });

    this.studentSearchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(term => {
      if (this.studentPanelMode === 'general') {
        this.verTodosEstudiantes(true);
      } else {
        this.verEstudiantesSinReunion();
      }
    });

    this.loadProgramas();
    this.loadStudentsWithoutProgramCount();
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
                // Success message removed per request

                // Update local state
                if (this.selectedStudentForPromotion) {
                    this.selectedStudentForPromotion.currentLevelId = nivel.id;
                    this.selectedStudentForPromotion.level = nivel.nivel || this.selectedStudentForPromotion.level;
                    this.selectedStudentForPromotion.subcategoria = nivel.subcategoria || this.selectedStudentForPromotion.subcategoria;
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
                        this.attendanceList[studentIndex].level = nivel.nivel || this.attendanceList[studentIndex].level;
                        this.attendanceList[studentIndex].subcategoria = nivel.subcategoria || this.attendanceList[studentIndex].subcategoria;
                    }
                }

                const studentForLocate = this.selectedStudentForPromotion;
                this.closePromotionModal();
                if (studentForLocate) {
                  this.openLocatePrograms(studentForLocate);
                }
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
                // Success message removed per request

                // Update local state
                if (this.selectedStudentForDegradation) {
                    this.selectedStudentForDegradation.currentLevelId = nivel.id;
                    this.selectedStudentForDegradation.level = nivel.nivel || this.selectedStudentForDegradation.level;
                    this.selectedStudentForDegradation.subcategoria = nivel.subcategoria || this.selectedStudentForDegradation.subcategoria;
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
                        this.attendanceList[studentIndex].level = nivel.nivel || this.attendanceList[studentIndex].level;
                        this.attendanceList[studentIndex].subcategoria = nivel.subcategoria || this.attendanceList[studentIndex].subcategoria;
                    }
                }

                const studentForLocate = this.selectedStudentForDegradation;
                this.closeDegradeModal();
                if (studentForLocate) {
                  this.openLocatePrograms(studentForLocate);
                }
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

        if (this.meetingIdToOpen) {
          const targetId = this.meetingIdToOpen;
          this.meetingIdToOpen = null;

          for (const programa of this.programas) {
            const meetings = (programa as any).id_reuniones_meet || [];
            const found = meetings.find((m: any) => m.id === targetId);
            if (found) {
              this.openEditModal(found);
              break;
            }
          }
        }

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
    const levels = new Set<string>();
    const subcategories = new Set<string>();

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

      if (p.id_nivel?.nivel) {
          levels.add(p.id_nivel.nivel);
      }
      if (p.id_nivel?.subcategoria) {
          subcategories.add(p.id_nivel.subcategoria);
      }
    });
    this.programGroups = Object.values(groups);
    // Since filtering is server-side, filteredProgramGroups is just the grouped result
    this.filteredProgramGroups = this.programGroups;

    this.uniqueLevels = Array.from(levels).sort();
    this.uniqueSubcategories = Array.from(subcategories).sort();

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

    // Use estudiantes_id del programa or id_nivel.estudiantes_id para listar estudiantes
    let studentsSource: any[] = [];
    if (prog.estudiantes_id && prog.estudiantes_id.length > 0) {
        studentsSource = prog.estudiantes_id;
    } else if (prog.id_nivel && prog.id_nivel.estudiantes_id && Array.isArray(prog.id_nivel.estudiantes_id)) {
        studentsSource = prog.id_nivel.estudiantes_id;
    }

    if (studentsSource.length > 0) {
        const documents: {tipo: string, numero: string}[] = [];
        const seenDocs = new Set<string>();
        const studentAttendanceMap = new Map<string, any[]>();

        studentsSource.forEach((student: any) => {
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
            // Populate attendance map
            if (student.id && student.asistencia_id && Array.isArray(student.asistencia_id)) {
                studentAttendanceMap.set(student.id, student.asistencia_id);
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

                        this.attendanceList = this.selectedStudents.map(student => {
                            let score: number = 0;
                            let attendancePercentage: number = 0;

                            const rawAttendance = studentAttendanceMap.get(student.id);
                            if (rawAttendance) {
                                const programAttendance = rawAttendance.filter((a: any) => a.programa_ayo_id === prog.id);

                                if (programAttendance.length > 0) {
                                    // Sum score
                                    score = programAttendance.reduce((acc: number, curr: any) => acc + (Number(curr.calificacion) || 0), 0);

                                    // Calculate percentage
                                    const attendedCount = programAttendance.filter((a: any) => a.asiste === true).length;
                                    attendancePercentage = (attendedCount / programAttendance.length) * 100;
                                }
                            }

                            // Use safe navigation for nested properties
                            const studentLevel = (student as any).nivel_id;
                            
                            return {
                                id: student.id,
                                studentName: `${student.first_name} ${student.last_name}`,
                                email: student.email,
                                fecha: new Date(),
                                attended: false,
                                score: score > 0 ? score : '',
                                attendancePercentage: attendancePercentage,
                                currentLevelId: studentLevel?.id || studentLevel, // Handle object or ID
                                levelName: studentLevel?.nivel || '',
                                level: studentLevel?.nivel || '',
                                subcategoria: prog.id_nivel?.subcategoria || '',
                                creditos: (student as any).creditos
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
    // Reset filters of other section when switching
    this.noProgramStudentSearchTerm = '';
    this.noProgramSelectedLevelFilter = '';
    this.noProgramSelectedSubcategoryFilter = '';

    this.isLoadingStudents = true;
    this.showStudentPanel = true;
    this.studentPanelMode = 'general';

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

    // Create maps for calculating stats and subcategory
    const levelProgramMap = new Map<string, Set<string>>();
    const levelSubcategoryMap = new Map<string, string>();

    this.programas.forEach((prog: any) => {
        if (prog.id_nivel && prog.id_nivel.id) {
            if (!levelProgramMap.has(prog.id_nivel.id)) {
                levelProgramMap.set(prog.id_nivel.id, new Set<string>());
            }
            levelProgramMap.get(prog.id_nivel.id)?.add(prog.id);

            if (prog.id_nivel.subcategoria) {
                levelSubcategoryMap.set(prog.id_nivel.id, prog.id_nivel.subcategoria);
            }
        }
    });





    const filters = {
        search: this.generalStudentSearchTerm,
        level: this.generalSelectedLevelFilter,
        subcategory: this.generalSelectedSubcategoryFilter
    };

    this.userService.getStudentsWithAttendance(filters).subscribe({
        next: (response) => {
            this.isLoadingStudents = false;
            if (response.data && response.data.length > 0) {
                this.selectedStudents = response.data;
                const tempAttendanceList = this.selectedStudents.map(student => {
                    const rawNivel = (student as any).nivel_id;
                    const studentLevelId = rawNivel && typeof rawNivel === 'object' ? rawNivel.id : (rawNivel || (student as any).nivel);
                    const studentLevelName = rawNivel && typeof rawNivel === 'object' ? rawNivel.nivel : '';
                    const studentSubcategory = rawNivel && typeof rawNivel === 'object' ? rawNivel.subcategoria : (studentLevelId ? (levelSubcategoryMap.get(studentLevelId) || '') : '');
                    
                    // Combine Level and Subcategory for display
                    const displayLevelName = studentLevelName ? `${studentLevelName}${studentSubcategory ? ' - ' + studentSubcategory : ''}` : '';

                    let score: number = 0;
                    let attendancePercentage: number = 0;

                    // Only calculate if student has a level and we have programs for that level
                    if (studentLevelId && levelProgramMap.has(studentLevelId)) {
                        const validProgramIds = levelProgramMap.get(studentLevelId);
                        
                        if ((student as any).asistencia_id && Array.isArray((student as any).asistencia_id)) {
                             const validAttendance = (student as any).asistencia_id.filter((a: any) => 
                                a.programa_ayo_id && validProgramIds?.has(a.programa_ayo_id)
                            );

                            if (validAttendance.length > 0) {
                                score = validAttendance.reduce((acc: number, curr: any) => acc + (Number(curr.calificacion) || 0), 0);
                                const attendedCount = validAttendance.filter((a: any) => a.asiste === true).length;
                                attendancePercentage = (attendedCount / validAttendance.length) * 100;
                            }
                        }
                    }

                    return {
                        id: student.id,
                        studentName: `${student.first_name} ${student.last_name}`,
                        email: student.email,
                        fecha: new Date(),
                        attended: false,
                        score: score > 0 ? score : '',
                        attendancePercentage: attendancePercentage,
                        currentLevelId: studentLevelId,
                        levelName: displayLevelName, // Use combined name
                        level: studentLevelName, // Raw level name for filtering
                        subcategoria: studentSubcategory,
                        creditos: (student as any).creditos
                    };
                });
                
                this.originalAttendanceList = [...tempAttendanceList];
                this.attendanceList = [...tempAttendanceList];

                this.cdr.detectChanges();
            } else {
                if (!suppressWarnings) this.notificationService.showWarning('Información', 'No se encontraron estudiantes.');
                this.selectedStudents = [];
                this.attendanceList = [];
                this.originalAttendanceList = [];
                this.cdr.detectChanges();
            }
        },
        error: (error) => {
            this.isLoadingStudents = false;
            console.error('Error fetching students:', error);
            if (!suppressWarnings) this.notificationService.showError('Error', 'Error al consultar el listado de estudiantes.');
            this.cdr.detectChanges();
        }
    });
  }

  onStudentSearch(event: any): void {
      const term = event.target.value;
      if (this.studentPanelMode === 'general') {
        this.generalStudentSearchTerm = term;
      } else {
        this.noProgramStudentSearchTerm = term;
      }
      this.studentSearchSubject.next(term);
  }

  openLocatePrograms(student: AttendanceItem): void {
    this.selectedStudentForLocate = student;
    const studentSubcat = (student.subcategoria || '').trim();
    const levelId = student.currentLevelId || '';
    // Filter programas by matching same subcategoria (preferred), fallback to level id if no subcategoria
    this.locatePrograms = (this.programas || []).filter(p => {
      const n = p.id_nivel as any;
      if (!n) return false;
      const matchBySubcat = studentSubcat ? ((n.subcategoria || '').trim() === studentSubcat) : false;
      const matchById = !studentSubcat && levelId ? (n.id === levelId) : false;
      return matchBySubcat || matchById;
    });
    this.buildTeachersForPrograms();
    this.showLocateModal = true;
    this.cdr.detectChanges();
  }

  closeLocateModal(): void {
    this.showLocateModal = false;
    this.selectedStudentForLocate = null;
    this.locatePrograms = [];
    this.locateProgramTeachers = {};
    this.cdr.detectChanges();
  }

  assignStudentToProgram(programa: ProgramaAyo): void {
    if (!this.selectedStudentForLocate?.id || !programa?.id) return;
    const studentId = this.selectedStudentForLocate.id;
    const programId = programa.id!;
    this.isLoadingStudents = true;
    this.userService.updateUser(studentId, { programa_ayo_id: programId }).subscribe({
      next: () => {
        this.notificationService.showSuccess('Éxito', 'Estudiante asignado al programa AYO correctamente.');
        this.isLoadingStudents = false;
        // Remove from "sin programa" list if applicable
        if (this.studentPanelMode === 'noProgram') {
          this.attendanceList = this.attendanceList.filter(s => s.id !== studentId);
          this.selectedStudents = (this.selectedStudents || []).filter((s: any) => s.id !== studentId);
          this.studentsWithoutProgramCount = Math.max(0, (this.studentsWithoutProgramCount || 0) - 1);
        }
        this.closeLocateModal();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error assigning student to program:', error);
        this.isLoadingStudents = false;
        this.notificationService.showError('Error', 'No se pudo asignar el estudiante al programa AYO.');
        this.cdr.detectChanges();
      }
    });
  }

  private buildTeachersForPrograms(): void {
    this.locateProgramTeachers = {};
    (this.locatePrograms || []).forEach((p: any) => {
      const programId = String(p.id);
      const meetings = Array.isArray(p.id_reuniones_meet) ? p.id_reuniones_meet : [];
      const teacherMap = new Map<string, { teacherId: string, teacherName: string, meetings: any[] }>();
      meetings.forEach((m: any) => {
        const teacher = m.id_docente || {};
        const tId = String(teacher.id || '');
        const tName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim();
        if (!tId) return;
        if (!teacherMap.has(tId)) {
          teacherMap.set(tId, { teacherId: tId, teacherName: tName, meetings: [] });
        }
        teacherMap.get(tId)!.meetings.push(m);
      });
      this.locateProgramTeachers[programId] = Array.from(teacherMap.values()).map(group => {
        group.meetings.sort((a: any, b: any) => {
          const aDate = new Date(a.fecha_inicio || a.fecha_finalizacion || '').getTime();
          const bDate = new Date(b.fecha_inicio || b.fecha_finalizacion || '').getTime();
          return aDate - bDate;
        });
        return group;
      });
    });
  }

  filterStudents() {
    // Deprecated in favor of API filtering
  }

  closeStudentPanel() {
    this.showStudentPanel = false;
    this.selectedProgramForFocus = null;
    this.selectedStudents = [];
    this.attendanceList = [];
  }

  loadStudentsWithoutProgramCount(): void {
    this.userService.getStudentsWithoutProgramaAyo().subscribe({
      next: (response) => {
        const students = response.data || [];
        this.studentsWithoutProgramCount = students.length;
        this.cdr.detectChanges();
      },
      error: () => {
        this.studentsWithoutProgramCount = 0;
        this.cdr.detectChanges();
      }
    });
  }

  verEstudiantesSinReunion(): void {
    // Reset filters of other section when switching
    this.generalStudentSearchTerm = '';
    this.generalSelectedLevelFilter = '';
    this.generalSelectedSubcategoryFilter = '';

    this.isLoadingStudents = true;
    this.showStudentPanel = true;
    this.studentPanelMode = 'noProgram';
    this.selectedProgramForFocus = {
      id_nivel: {
        tematica: 'Estudiantes sin Programa AYO',
        nivel: 'N/A',
        subcategoria: 'Sin asignación',
        categoria: '',
        id: '',
        idioma: ''
      },
      fecha_finalizacion: '',
      curso_id: ''
    };

    this.userService.getStudentsWithoutProgramaAyo().subscribe({
      next: (response) => {
        this.isLoadingStudents = false;
        let students = response.data || [];
        // Apply local filters for noProgram view
        const search = (this.noProgramStudentSearchTerm || '').trim().toLowerCase();
        const levelFilter = this.noProgramSelectedLevelFilter || '';
        const subcatFilter = this.noProgramSelectedSubcategoryFilter || '';

        if (search) {
          students = students.filter((s: any) => {
            const name = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
            return name.includes(search);
          });
        }

        if (levelFilter) {
          students = students.filter((s: any) => {
            const rawNivel = s.nivel_id;
            const nivelName = rawNivel && typeof rawNivel === 'object' ? (rawNivel.nivel || '') : '';
            return nivelName === levelFilter;
          });
        }

        if (subcatFilter) {
          students = students.filter((s: any) => {
            const rawNivel = s.nivel_id;
            const subcat = rawNivel && typeof rawNivel === 'object' ? (rawNivel.subcategoria || '') : '';
            return subcat === subcatFilter;
          });
        }
        this.selectedStudents = students;
        this.studentsWithoutProgramCount = students.length;

        const tempAttendanceList = students.map((student: any) => {
          const rawNivel = student.nivel_id;
          const studentLevelId = rawNivel && typeof rawNivel === 'object' ? rawNivel.id : (rawNivel || '');
          const studentLevelName = rawNivel && typeof rawNivel === 'object' ? rawNivel.nivel : '';
          const studentSubcategory = rawNivel && typeof rawNivel === 'object' ? rawNivel.subcategoria : '';

          const displayLevelName = studentLevelName ? `${studentLevelName}${studentSubcategory ? ' - ' + studentSubcategory : ''}` : '';

          return {
            id: student.id,
            studentName: `${student.first_name} ${student.last_name}`,
            email: student.email,
            fecha: new Date(),
            attended: false,
            score: '',
            attendancePercentage: 0,
            currentLevelId: studentLevelId,
            levelName: displayLevelName,
            level: studentLevelName,
            subcategoria: studentSubcategory,
            creditos: (student as any).creditos
          };
        });

        this.originalAttendanceList = [...tempAttendanceList];
        this.attendanceList = [...tempAttendanceList];
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.isLoadingStudents = false;
        console.error('Error fetching students without program:', error);
        this.notificationService.showError('Error', 'No se pudo cargar el listado de estudiantes sin programa.');
        this.cdr.detectChanges();
      }
    });
  }

  // Image Edit Methods
  openImageEditModal(programa: ProgramaAyo, event: Event): void {
    event.stopPropagation(); // Prevent card click
    this.selectedProgramForImageEdit = programa;
    this.previewImage = programa.img && programa.img.id ? `${this.assetsUrl}/${programa.img.id}` : null;
    this.selectedFile = null;
    this.selectedDirectusFileId = null;
    this.showFileModal = true;
    this.loadDirectusFiles();
  }

  closeFileModal(): void {
    this.showFileModal = false;
    this.selectedProgramForImageEdit = null;
    this.previewImage = null;
    this.selectedFile = null;
    this.selectedDirectusFileId = null;
  }

  async loadDirectusFiles() {
    this.isLoadingFiles = true;
    try {
      const filter = {
        _and: [
          { type: { _starts_with: 'image/' } },
          { tematica: { _eq: true } }
        ]
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
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.handleFile(file);
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
      this.handleFile(files[0]);
    }
  }

  handleFile(file: File): void {
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
    this.selectedDirectusFileId = null;

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      this.previewImage = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  async saveProgramImage() {
    if (!this.selectedProgramForImageEdit) return;
    
    if (!this.selectedFile && !this.selectedDirectusFileId) {
        // If nothing new selected, close
        this.closeFileModal();
        return;
    }

    this.isUpdatingImage = true;

    try {
      let imageId = this.selectedDirectusFileId;

      // If it's a new file, upload it first
      if (this.selectedFile) {
        const uploadRes = await firstValueFrom(this.fileService.uploadFile(this.selectedFile));
        imageId = uploadRes.data.id;
        
        // Update file metadata explicitly to ensure tematica is saved
        if (imageId) {
            await firstValueFrom(this.fileService.updateFile(imageId, { tematica: true }));
        }
      }

      if (imageId) {
        // Update program with new image ID
        await firstValueFrom(this.programaAyoService.updateProgramaAyo(this.selectedProgramForImageEdit.id, {
          img: imageId
        }));


        
        // Update local data
        if (this.selectedProgramForImageEdit.img) {
             this.selectedProgramForImageEdit.img.id = imageId;
        } else {
             this.selectedProgramForImageEdit.img = { id: imageId } as any;
        }
        
        // Also update in programGroups if applicable
        this.programGroups.forEach(group => {
            group.programs.forEach(p => {
                if (p.id === this.selectedProgramForImageEdit!.id) {
                     if (!p.img) p.img = { id: imageId } as any;
                     else p.img.id = imageId;
                }
            });
        });

        this.closeFileModal();
      }
    } catch (error) {
      console.error('Error updating image', error);
      this.notificationService.showError('Error', 'No se pudo actualizar la imagen.');
    } finally {
      this.isUpdatingImage = false;
      this.cdr.detectChanges();
    }
  }
}
