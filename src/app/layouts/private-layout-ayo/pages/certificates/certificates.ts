import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';
import { AppButtonComponent } from '../../../../components/app-button/app-button.component';
import { Certificate } from '../../../../core/models/Certificate';
import { StorageServices } from '../../../../core/services/storage.services';
import { environment } from '../../../../../environments/environment';
import {CertificacionService} from '../../../../core/services/certificacion.service';
import { CertificateFormatComponent } from '../../../../components/certificate-format/certificate-format.component';

import { LEVELS } from '../../../../core/const/Levels';

@Component({
  selector: 'app-certificates',
  standalone: true,
  imports: [CommonModule, AppButtonComponent, CertificateFormatComponent],
  templateUrl: './certificates.html',
  styleUrls: ['./certificates.css']
})
export class CertificatesComponent implements OnInit {
  certificates: Certificate[] = JSON.parse(JSON.stringify(LEVELS)).map((c: Certificate) => ({
    ...c,
    isUnlocked: false // Initialize all as locked
  }));

  // Properties for the certificate component
  selectedStudentName: string = '';
  selectedProgramName: string = '';
  selectedLevel: string = '';
  selectedDate: string = '';
  selectedCredits: number = 0;
  selectedTheme: string = '';
  selectedCategory: string = '';
  selectedSubcategory: string = '';
  selectedLanguage: 'es' | 'en' = 'es';

  @ViewChild(CertificateFormatComponent) certificateFormat!: CertificateFormatComponent;

  constructor(
    private certificacionService: CertificacionService
  ) {}

  ngOnInit(): void {
    this.loadCertificates();
  }

  loadCertificates() {
    const user = StorageServices.getCurrentUser();
    if (user && user.id) {
      this.certificacionService.getCertificatesByStudentId(user.id).subscribe({
        next: (response) => {
          if (response.data) {
            this.mergeCertificates(response.data);
          }
        },
        error: (error) => {
          console.error('Error loading certificates', error);
        }
      });
    }
  }

  mergeCertificates(earnedCertificates: any[]) {
    earnedCertificates.forEach(earned => {
      // Logic provided by user: check if subcategoria matches level
      // Example: subcategoria: "A1.1" matches level: "A1.1"
      
      const subcategoria = earned.nivel_id?.subcategoria || earned.subcategoria;
      
      const match = this.certificates.find(c => c.level === subcategoria);

      if (match) {
        match.file = earned.archivo;
        match.rating = earned.calificacion || match.rating;
        match.rank = earned.rango || match.rank;
        match.isUnlocked = true; // Mark as unlocked
        match.fullData = earned; // Store full data for PDF generation
      }
    });
  }

  getFlagPath(theme: string): string {
    if (!theme || theme === 'GENERAL') {
      return 'assets/images/Logo_Thinking_Mind.png';
    }
    const formattedTheme = theme.toLowerCase().replace(/ /g, '_');
    return `assets/images/flags/${formattedTheme}.png`;
  }

  downloadCertificate(cert: Certificate) {
    if (cert.isUnlocked && cert.fullData) {
      Swal.fire({
        title: 'Generar Certificado / Generate Certificate',
        text: 'Seleccione el idioma / Select language',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Español',
        cancelButtonText: 'English',
        confirmButtonColor: '#13486e',
        cancelButtonColor: '#13486e',
        reverseButtons: true
      }).then((result) => {
        if (!result.isConfirmed && result.dismiss !== Swal.DismissReason.cancel) {
          return;
        }

        const data = cert.fullData;
        const student = data.estudiante_id;
        const level = data.nivel_id;
        
        this.selectedStudentName = `${student.first_name} ${student.last_name}`;
        this.selectedLevel = level.nivel;
        this.selectedCategory = level.categoria;
        this.selectedSubcategory = level.subcategoria;
        this.selectedTheme = level.tematica;
        this.selectedCredits = data.creditos || 0;
        
        const dateObj = new Date();
        
        if (result.isConfirmed) {
          // Español
          this.selectedLanguage = 'es';
          this.selectedProgramName = `Programa de ${level.idioma || 'Idiomas'}`;
          this.selectedDate = dateObj.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        } else {
          // English
          this.selectedLanguage = 'en';
          
          // Map common languages
          let langName = level.idioma || 'Language';
          const upperLang = langName.toUpperCase();
          if (upperLang === 'INGLES' || upperLang === 'INGLÉS') langName = 'English';
          else if (upperLang === 'ESPAÑOL') langName = 'Spanish';
          else if (upperLang === 'FRANCES' || upperLang === 'FRANCÉS') langName = 'French';
          else if (upperLang === 'ALEMAN' || upperLang === 'ALEMÁN') langName = 'German';
          else if (upperLang === 'ITALIANO') langName = 'Italian';
          else if (upperLang === 'PORTUGUES' || upperLang === 'PORTUGUÉS') langName = 'Portuguese';
          
          this.selectedProgramName = `${langName} Program`;
          this.selectedDate = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }
        
        // Trigger PDF generation after a short delay to allow bindings to update
        setTimeout(() => {
          this.certificateFormat.generatePDF();
        }, 50);
      });
    } else if (cert.file) {
      // Fallback to existing file download if available
      const url = `${environment.assets}/${cert.file}?download`;
      window.open(url, '_blank');
    } else {
      console.warn('No data available to generate certificate');
    }
  }
}
