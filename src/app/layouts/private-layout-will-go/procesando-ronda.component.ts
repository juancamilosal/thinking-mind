import { Component, Input, OnDestroy, OnInit } from '@angular/core';

/**
 * Tarjeta que se muestra cuando el reloj de la ronda llega a 0 y el servidor está cerrándola:
 * cuenta los votos, calcula las ganancias y abona a los estudiantes (tarda hasta un minuto).
 */
@Component({
  selector: 'wg-procesando-ronda',
  standalone: true,
  template: `
    <div class="relative overflow-hidden rounded-2xl p-5 text-white shadow bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500" role="status" aria-live="polite">
      <!-- Brillo que recorre la tarjeta -->
      <div class="brillo absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent" aria-hidden="true"></div>

      <div class="relative flex items-center gap-4">
        <div class="relative w-14 h-14 shrink-0" aria-hidden="true">
          <div class="absolute inset-0 rounded-full border-4 border-white/25"></div>
          <div class="absolute inset-0 rounded-full border-4 border-transparent border-t-white animate-spin"></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/></svg>
          </div>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-wide opacity-90">{{ ronda }} terminó</p>
          <p class="text-lg font-extrabold leading-snug">Estamos procesando los votos</p>
          <p class="text-sm opacity-95">y calculando las ganancias de las empresas…</p>
        </div>
      </div>

      <ol class="relative mt-4 space-y-2">
        @for (p of pasos; track p; let i = $index) {
          <li class="flex items-center gap-2.5 text-sm" [class.opacity-60]="i > paso">
            @if (i < paso) {
              <span class="w-5 h-5 rounded-full bg-white text-violet-600 flex items-center justify-center text-xs font-black" aria-hidden="true">✓</span>
            } @else if (i === paso) {
              <span class="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" aria-hidden="true"></span>
            } @else {
              <span class="w-5 h-5 rounded-full border-2 border-white/50" aria-hidden="true"></span>
            }
            {{ p }}
          </li>
        }
      </ol>

      <div class="relative mt-4 h-1.5 rounded-full bg-white/25 overflow-hidden" aria-hidden="true">
        <div class="barra h-full w-1/3 rounded-full bg-white"></div>
      </div>
      <p class="relative mt-2 text-xs opacity-90">En unos segundos verás los resultados. No cierres esta página.</p>
    </div>
  `,
  styles: [`
    @keyframes recorrer { from { transform: translateX(0); } to { transform: translateX(400%); } }
    @keyframes avanzar { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
    .brillo { animation: recorrer 2.6s ease-in-out infinite; }
    .barra { animation: avanzar 1.4s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { .brillo, .barra, .animate-spin { animation: none; } }
  `],
})
export class ProcesandoRondaComponent implements OnInit, OnDestroy {
  @Input() ronda = 'La ronda';
  readonly pasos = ['Ronda cerrada', 'Contando los votos', 'Calculando las ganancias', 'Abonando a los estudiantes'];
  paso = 1;
  private reloj: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    // Avanza los pasos poco a poco; el último se queda girando hasta que llegan los resultados
    this.reloj = setInterval(() => { if (this.paso < this.pasos.length - 1) this.paso++; }, 3500);
  }

  ngOnDestroy(): void {
    if (this.reloj) clearInterval(this.reloj);
  }
}
