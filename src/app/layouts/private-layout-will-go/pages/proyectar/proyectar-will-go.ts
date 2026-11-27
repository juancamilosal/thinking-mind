import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { EdicionVigente, WillGoService } from '../../../../core/services/will-go.service';

/** Rol TV: las economías (ediciones vigentes) que se pueden proyectar; al elegir una, se abre el televisor. */
@Component({
  selector: 'app-proyectar-will-go',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="max-w-4xl mx-auto">
      <h1 class="text-2xl font-bold text-gray-800">{{ 'wg.proyectar.titulo' | translate }}</h1>
      <p class="text-gray-500 mt-1">{{ 'wg.proyectar.subtitulo' | translate }}</p>

      @if (cargando) {
        <div class="mt-5 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.operacion.comun.cargando' | translate }}</div>
      } @else if (error) {
        <div class="mt-5 bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
      } @else if (!ediciones.length) {
        <div class="mt-5 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">{{ 'wg.tv.sinEdiciones' | translate }}</div>
      } @else {
        <div class="mt-5 grid gap-4 sm:grid-cols-2">
          @for (e of ediciones; track e.id) {
            <button type="button" (click)="proyectar(e.id)"
                    class="group text-left rounded-2xl overflow-hidden bg-gradient-to-br from-[#0b2a57] to-[#001938] text-white shadow hover:shadow-xl hover:-translate-y-0.5 transition">
              <div class="px-5 pt-5 pb-4">
                <p class="text-xs font-bold uppercase tracking-widest text-orange-300">{{ (e.estado === 'abierta' ? 'wg.proyectar.enCurso' : 'wg.proyectar.preparacion') | translate }}</p>
                <p class="mt-1 text-xl font-extrabold">{{ e.nombre }}</p>
                @if (e.colegio) { <p class="text-sm text-white/70">{{ e.colegio }}</p> }
              </div>
              <div class="flex items-center gap-2 px-5 py-3 bg-white/10 text-sm font-bold text-orange-200 group-hover:bg-white/15">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                {{ 'wg.proyectar.boton' | translate }}
              </div>
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class ProyectarWillGo implements OnInit {
  private willGo = inject(WillGoService);
  private router = inject(Router);
  ediciones: EdicionVigente[] = [];
  cargando = true;
  error = '';

  ngOnInit(): void {
    this.willGo.misEdiciones().subscribe({
      next: (l) => { this.ediciones = l; this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  /** Abre el televisor en pantalla completa con esa economía. */
  proyectar(id: string): void {
    document.documentElement.requestFullscreen?.().catch(() => {});
    this.router.navigate(['/will-go-tv'], { queryParams: { edicion: id } });
  }
}
