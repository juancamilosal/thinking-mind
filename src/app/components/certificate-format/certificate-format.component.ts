import { Component, Input, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-certificate-format',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './certificate-format.component.html',
  styleUrls: ['./certificate-format.component.css']
})
export class CertificateFormatComponent {
  @Input() studentName: string = '';
  @Input() programName: string = '';
  @Input() level: string = '';
  @Input() date: string = '';
  @Input() credits: number = 0;
  @Input() theme: string = '';
  @Input() category: string = '';
  @Input() subcategory: string = '';
  @Input() language: 'es' | 'en' = 'es';
  
  @ViewChild('certificateContent') certificateContent!: ElementRef;

  constructor() {}

  public generatePDF() {
    // Wait for view to update
    setTimeout(() => {
      const data = this.certificateContent.nativeElement;
      
      // Temporarily make it visible for capture if hidden
      // The CSS handles positioning it off-screen but visible to the DOM renderer
      
      html2canvas(data, { 
        scale: 3, 
        useCORS: true, 
        logging: false, 
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0
      }).then(canvas => {
        const imgWidth = 297; // A4 landscape width in mm
        const pageHeight = 210; // A4 landscape height in mm
        const imgHeight = canvas.height * imgWidth / canvas.width;
        
        const contentDataURL = canvas.toDataURL('image/png');
        const pdf = new jsPDF('l', 'mm', 'a4'); // 'l' for landscape
        
        pdf.addImage(contentDataURL, 'PNG', 0, 0, imgWidth, imgHeight);
        
        const prefix = this.language === 'en' ? 'Certificate' : 'Certificado';
        pdf.save(`${prefix}_${this.studentName.replace(/\s+/g, '_')}_${this.programName}.pdf`);
      });
    }, 100);
  }
}
