import { InstalarAppComponent } from '../../../private-layout-will-go/instalar-app.component';
import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SelectorIdiomaComponent } from '../../../private-layout-will-go/selector-idioma.component';
import { AcudienteWillGoService } from '../../../../core/services/acudiente-will-go.service';

/** Ingreso del acudiente: documento → código al correo → panel. */
@Component({
  selector: 'app-ingreso-acudiente',
  standalone: true,
  imports: [FormsModule, InstalarAppComponent, TranslatePipe, SelectorIdiomaComponent],
  templateUrl: './ingreso-acudiente.html',
  styleUrls: ['../login-will-go/login-will-go.css', './ingreso-acudiente.css'],
})
export class IngresoAcudiente implements OnInit {
  private servicio = inject(AcudienteWillGoService);
  private router = inject(Router);

  paso: 'documento' | 'codigo' = 'documento';
  documento = '';
  codigo = '';
  correo: string | null = null;
  cargando = false;
  error = '';
  logoFallo = false;

  readonly billetesFondo = [
    { top: 8, left: 6, ancho: 120, giro: -14, retraso: 0, color: '#FF6B1A' },
    { top: 16, left: 74, ancho: 90, giro: 12, retraso: 1.5, color: '#FFE3C7' },
    { top: 62, left: 3, ancho: 96, giro: 8, retraso: 3, color: '#FFE3C7' },
    { top: 74, left: 70, ancho: 130, giro: -10, retraso: 2, color: '#FF6B1A' },
    { top: 40, left: 86, ancho: 70, giro: 20, retraso: 4, color: '#FF6B1A' },
  ];

  private enNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  ngOnInit(): void {
    if (this.enNavegador && AcudienteWillGoService.sesion()) this.router.navigateByUrl('/acudiente-will-go/panel');
  }

  get documentoValido(): boolean { return this.documento.replace(/\D/g, '').length >= 5; }

  pedirCodigo(): void {
    if (!this.documentoValido || this.cargando) return;
    this.cargando = true;
    this.error = '';
    this.servicio.pedirCodigo(this.documento).subscribe({
      next: (r) => { this.cargando = false; this.correo = r.correo; this.paso = 'codigo'; },
      error: (e) => { this.cargando = false; this.error = AcudienteWillGoService.mensaje(e); },
    });
  }

  entrar(): void {
    this.codigo = this.codigo.replace(/\D/g, '');
    if (this.codigo.length !== 6 || this.cargando) return;
    this.cargando = true;
    this.error = '';
    this.servicio.entrar(this.documento, this.codigo).subscribe({
      next: () => { this.cargando = false; this.router.navigateByUrl('/acudiente-will-go/panel'); },
      error: (e) => { this.cargando = false; this.error = AcudienteWillGoService.mensaje(e); },
    });
  }
}
