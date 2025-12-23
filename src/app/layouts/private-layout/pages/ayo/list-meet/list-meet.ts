import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ProgramaAyoService } from '../../../../../core/services/programa-ayo.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import {ProgramaAyo} from '../../../../../core/models/Course';

@Component({
    selector: 'app-list-meet',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './list-meet.html',
    styleUrl: './list-meet.css'
})
export class ListMeet implements OnInit {

    programas: ProgramaAyo[] = [];
    isLoading = false;
    selectedLanguage: string | null = null;

    constructor(
        private programaAyoService: ProgramaAyoService,
        private notificationService: NotificationService,
        private router: Router,
        private route: ActivatedRoute
    ) { }

    ngOnInit(): void {
        this.route.queryParams.subscribe(params => {
            if (params['idioma']) {
                this.selectedLanguage = params['idioma'];
            }
        });
        this.loadProgramas();
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
