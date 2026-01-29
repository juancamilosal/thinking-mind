import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppButtonComponent } from '../../../../components/app-button/app-button.component';
import { Certificate } from '../../../../core/models/Certificate';
import { LEVELS } from '../../../../core/const/Levels';

@Component({
  selector: 'app-certificates',
  standalone: true,
  imports: [CommonModule, AppButtonComponent],
  templateUrl: './certificates.html',
  styleUrls: ['./certificates.css']
})
export class CertificatesComponent {
  certificates: Certificate[] = LEVELS;

  getFlagPath(theme: string): string {
    if (theme === 'GENERAL') {
      return 'assets/images/Logo Thinking Mind.png'; // Fallback or specific logic for GENERAL
    }
    const formattedTheme = theme.toLowerCase().replace(/ /g, '_');
    return `assets/images/flags/${formattedTheme}.png`;
  }

  downloadCertificate(cert: Certificate) {
    console.log('Descargando certificado para:', cert.programName, cert.level);
    // Logic for download will go here
  }
}
