import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CourseService } from '../../../../core/services/course.service';
import { Meeting } from '../../../../core/models/Meeting';

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

    constructor(private courseService: CourseService) { }

    ngOnInit(): void {
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
}
