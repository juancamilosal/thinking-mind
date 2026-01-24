import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ProgramaAyoService } from '../../../../core/services/programa-ayo.service';
import { AccountReceivableService } from '../../../../core/services/account-receivable.service';
import { Course, ProgramaAyo } from '../../../../core/models/Course';
import { environment } from '../../../../../environments/environment';

export type TeacherStep = 'initial' | 'options';

@Component({
  selector: 'app-meet-teacher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './teacher.html',
  styleUrl: './teacher.css'
})

export class Teacher implements OnInit {
    courses: Course[] = [];
    isLoading: boolean = true;
    step: TeacherStep = 'initial';
    selectedLanguage: string | null = null;

    constructor(
      private router: Router,
      private route: ActivatedRoute
    ) { }

    ngOnInit(): void {
      this.route.queryParams.subscribe(params => {
        if (params['idioma']) {
          const lang = params['idioma'].toUpperCase();
          if (lang === 'INGLÉS' || lang === 'INGLES') {
            this.selectedLanguage = 'INGLES';
          } else if (lang === 'FRANCÉS' || lang === 'FRANCES') {
            this.selectedLanguage = 'FRANCES';
          } else {
            this.selectedLanguage = lang;
          }
          this.step = 'options';
        } else {
          this.step = 'initial';
          this.selectedLanguage = null;
        }
      });
    }

    selectLanguage(language: string): void {
      this.selectedLanguage = language;
      this.step = 'options';
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { idioma: language },
        queryParamsHandling: 'merge'
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    openMeetings(): void {
      if (this.selectedLanguage) {
        this.router.navigate(['/private/teacher/meetings'], { queryParams: { idioma: this.selectedLanguage } });
      } else {
        this.router.navigate(['/private/teacher/meetings']);
      }
    }

    goBack(): void {
      this.step = 'initial';
      this.selectedLanguage = null;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { idioma: null },
        queryParamsHandling: 'merge'
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
