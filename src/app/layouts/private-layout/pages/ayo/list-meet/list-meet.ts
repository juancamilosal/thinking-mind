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
            () => {
                this.courseService.deleteReunionMeet(meeting.id).subscribe({
                    next: () => {
                        this.notificationService.showSuccess('Reunión eliminada', 'La reunión ha sido eliminada correctamente.');
                        this.loadProgramas();
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
        );
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
