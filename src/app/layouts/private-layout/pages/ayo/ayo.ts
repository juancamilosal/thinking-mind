import {Component, Input, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CourseService } from '../../../../core/services/course.service';
import { ProgramaAyoService } from '../../../../core/services/programa-ayo.service';
import { Course, PrecioProgramaAyo } from '../../../../core/models/Course';

export type AyoStep = 'initial' | 'options' | 'meetings';

@Component({
  selector: 'app-ayo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ayo.html',
  styleUrls: ['./ayo.css']
})
export class AyoComponent implements OnInit {
  courses: Course[] = [];
  isLoading: boolean = true;
  step: AyoStep = 'initial';
  selectedLanguage: string | null = null;
  
  // Precio Programa AYO
  precioData: PrecioProgramaAyo | null = null;
  isEditingPrice: boolean = false;
  tempPrice: number = 0;
  isSavingPrice: boolean = false;

  constructor(
    private courseService: CourseService,
    private programaAyoService: ProgramaAyoService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.loadPrecio();

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

        // Si ya estamos en 'meetings', no forzamos 'options' para evitar reseteo
        if (this.step !== 'meetings') {
          this.step = 'options';
        }
      } else {
        // Only reset if we are not navigating away (which shouldn't happen here but safe to check)
        this.step = 'initial';
        this.selectedLanguage = null;
      }
    });
  }

  loadPrecio(): void {
    this.programaAyoService.getPrecioProgramaAyo().subscribe({
      next: (response) => {
        if (response.data && response.data.length > 0) {
          this.precioData = response.data[0];
        }
      },
      error: (error) => {
        console.error('Error loading price:', error);
      }
    });
  }

  startEditingPrice(): void {
    if (this.precioData) {
      this.tempPrice = this.precioData.precio;
      this.isEditingPrice = true;
    }
  }

  cancelEditingPrice(): void {
    this.isEditingPrice = false;
    this.tempPrice = 0;
  }

  savePrice(): void {
    if (this.precioData && this.precioData.id) {
      this.isSavingPrice = true;
      this.programaAyoService.updatePrecioProgramaAyo(this.precioData.id, this.tempPrice).subscribe({
        next: (response) => {
          if (response.data) {
            this.precioData = response.data;
            this.isEditingPrice = false;
          }
          this.isSavingPrice = false;
        },
        error: (error) => {
          console.error('Error updating price:', error);
          this.isSavingPrice = false;
        }
      });
    }
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

  openCreateForm(): void {
    if (this.selectedLanguage) {
        this.router.navigate(['/private/ayo/create'], { queryParams: { idioma: this.selectedLanguage } });
    } else {
        console.error('No language selected');
    }
  }

  openMeetings(): void {
    if (this.selectedLanguage) {
      this.router.navigate(['/private/ayo/list-meet'], { queryParams: { idioma: this.selectedLanguage } });
    } else {
      this.router.navigate(['/private/ayo/list-meet']);
    }
  }

  goBack(): void {
    if (this.step === 'meetings') {
      this.step = 'options';
    } else if (this.step === 'options') {
      this.step = 'initial';
      this.selectedLanguage = null;
      // Limpiamos los parámetros de la URL usando navegación relativa para mantener el contexto
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { idioma: null },
        queryParamsHandling: 'merge'
      });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
