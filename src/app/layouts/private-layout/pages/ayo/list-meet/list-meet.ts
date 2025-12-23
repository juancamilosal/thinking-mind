import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { CourseService} from '../../../../../core/services/course.service';
import {Meeting} from '../../../../../core/models/Meeting';

@Component({
    selector: 'app-list-meet',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './list-meet.html',
    styleUrl: './list-meet.css'
})
export class ListMeet implements OnInit {
    meetings: Meeting[] = [];
    isLoading = false;
    selectedLanguage: string | null = null;

    constructor(
        private courseService: CourseService,
        private router: Router,
        private route: ActivatedRoute
    ) { }

    ngOnInit(): void {
        this.route.queryParams.subscribe(params => {
            if (params['idioma']) {
                this.selectedLanguage = params['idioma'];
            }
        });
        this.loadMeetings();
    }

    loadMeetings(): void {
        this.isLoading = true;
        this.courseService.getReunionesMeet().subscribe({
            next: (response) => {
                this.meetings = response.data || [];
                this.isLoading = false;
            },
            error: (error) => {
                console.error('Error loading meetings:', error);
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
