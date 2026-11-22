import { Component, Input, OnChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Arqueo, DatosArqueo, PaisArqueo, WillGoService } from '../../core/services/will-go.service';
import { NumeroMilesDirective, formatearNumero } from './numero-miles.directive';

/** Imagen del billete según el país (los diseños impresos de Wonderland, Neverland y Dreamland). */
export function imagenBillete(pais: { nombre: string } | undefined, denominacion: number): string | null {
  const clave = (pais?.nombre ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return ['wonderland', 'neverland', 'dreamland'].includes(clave) ? `assets/images/billetes/${clave}/${denominacion}.jpg` : null;
}

/** Arqueo del banco: cuántos billetes hay de cada denominación y si cuadra con el sistema. */
@Component({
  selector: 'wg-arqueo',
  standalone: true,
  imports: [FormsModule, DatePipe, NumeroMilesDirective],
  template: `
    @if (cargando) {
      <div class="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Cargando…</div>
    } @else if (error && !datos) {
      <div class="bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
    } @else if (datos) {
      <!-- País -->
      <div class="flex flex-wrap gap-2">
        @for (p of datos.paises; track p.id) {
          <button type="button" (click)="pais = p" class="px-4 py-2 rounded-xl text-sm font-semibold border-2 transition"
                  [style.background]="pais?.id === p.id ? (p.color || '#1e293b') : '#fff'"
                  [style.border-color]="p.color || '#cbd5e1'" [style.color]="pais?.id === p.id ? '#fff' : '#334155'">
            {{ p.nombre }}
          </button>
        }
      </div>

      @if (pais) {
        <!-- Billetes -->
        <div class="mt-4 grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          @for (d of datos.denominaciones; track d) {
            <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" [class.ring-2]="cantidad(d) > 0" [style.--tw-ring-color]="pais.color || '#f97316'">
              @if (imagen(d); as src) {
                <img [src]="src" [alt]="'Billete de ' + miles(d) + ' de ' + pais.nombre" class="w-full aspect-[520/281] object-cover" loading="lazy">
              } @else {
                <div class="w-full aspect-[520/281] flex items-center justify-center text-2xl font-black text-white" [style.background]="pais.color || '#64748b'">{{ miles(d) }}</div>
              }
              <div class="p-3">
                <label class="sr-only" [attr.for]="'den-' + d">Cantidad de billetes de {{ miles(d) }}</label>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-gray-500">×</span>
                  <input [id]="'den-' + d" wgNumero [ngModel]="conteos[pais.id][d]" (ngModelChange)="poner(d, $event)" placeholder="0"
                         class="w-full px-3 py-2 bg-gray-50 border-2 border-gray-200 rounded-lg text-center font-semibold focus:outline-none focus:ring-2 focus:ring-orange-300">
                </div>
                <p class="text-xs text-gray-500 text-center mt-1.5">{{ cantidad(d) ? '= ' + miles(d * cantidad(d)) : '' }}&nbsp;</p>
              </div>
            </div>
          }
        </div>

        <!-- Cuadre -->
        <div class="sticky bottom-0 mt-4 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-gray-50/95 backdrop-blur">
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col lg:flex-row lg:items-center gap-4">
            <div class="grid grid-cols-3 gap-3 flex-1">
              <div><p class="text-xs text-gray-500">Contado</p><p class="text-xl font-bold text-gray-800">{{ miles(total) }}</p></div>
              <div><p class="text-xs text-gray-500">Debe haber</p><p class="text-xl font-bold text-gray-800">{{ miles(pais.saldo_sistema) }}</p></div>
              <div>
                <p class="text-xs text-gray-500">Diferencia</p>
                <p class="text-xl font-bold" [class]="diferencia === 0 ? 'text-emerald-600' : diferencia < 0 ? 'text-red-600' : 'text-amber-600'">
                  {{ diferencia === 0 ? '✓ Cuadra' : (diferencia < 0 ? 'Faltan ' : 'Sobran ') + miles(abs(diferencia)) }}
                </p>
              </div>
            </div>
            <input [(ngModel)]="observaciones" placeholder="Observación (opcional)" aria-label="Observación"
                   class="lg:w-64 px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
            <button type="button" (click)="guardar()" [disabled]="guardando || !total"
                    class="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:brightness-110 disabled:opacity-50">
              {{ guardando ? 'Guardando…' : 'Guardar arqueo' }}
            </button>
          </div>
          @if (aviso) { <p class="mt-2 text-sm" [class]="avisoError ? 'text-red-700' : 'text-emerald-700'" role="status">{{ aviso }}</p> }
        </div>

        <!-- Historial -->
        <h3 class="font-bold text-gray-800 mt-6 mb-3">Arqueos anteriores</h3>
        @if (!historialPais.length) {
          <p class="text-sm text-gray-500">Todavía no hay arqueos de {{ pais.nombre }}.</p>
        } @else {
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <ul class="divide-y divide-gray-100">
              @for (a of historialPais; track a.id) {
                <li class="px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  <span class="font-semibold text-gray-800 w-36">{{ a.date_created | date:'d MMM, h:mm a' }}</span>
                  <span class="text-gray-600">Contado {{ miles(a.total_contado) }} · Debía {{ miles(a.saldo_sistema) }}</span>
                  <span class="font-semibold" [class]="a.diferencia === 0 ? 'text-emerald-600' : a.diferencia < 0 ? 'text-red-600' : 'text-amber-600'">
                    {{ a.diferencia === 0 ? '✓ Cuadró' : (a.diferencia < 0 ? 'Faltaron ' : 'Sobraron ') + miles(abs(a.diferencia)) }}
                  </span>
                  <span class="text-gray-500 lg:ml-auto">{{ a.responsable }}{{ a.observaciones ? ' · ' + a.observaciones : '' }}</span>
                </li>
              }
            </ul>
          </div>
        }
      }
    }
  `,
})
export class ArqueoComponent implements OnChanges {
  @Input({ required: true }) edicionId!: string;
  private willGo = inject(WillGoService);
  readonly miles = (v: unknown) => formatearNumero(v as number);
  readonly abs = Math.abs;

  datos: DatosArqueo | null = null;
  pais: PaisArqueo | null = null;
  /** Conteo en curso por país: { paisId: { denominación: cantidad } } */
  conteos: Record<string, Record<number, number | null>> = {};
  observaciones = '';
  cargando = true;
  guardando = false;
  error = '';
  aviso = '';
  avisoError = false;

  ngOnChanges(): void {
    this.cargar();
  }

  get total(): number {
    if (!this.pais || !this.datos) return 0;
    return this.datos.denominaciones.reduce((t, d) => t + d * this.cantidad(d), 0);
  }

  get diferencia(): number {
    return this.total - (this.pais?.saldo_sistema ?? 0);
  }

  get historialPais(): Arqueo[] {
    return (this.datos?.historial ?? []).filter((a) => a.pais_id === this.pais?.id);
  }

  cantidad(d: number): number {
    return Number(this.pais ? this.conteos[this.pais.id]?.[d] ?? 0 : 0) || 0;
  }

  poner(d: number, valor: number | null): void {
    if (this.pais) this.conteos[this.pais.id][d] = valor;
  }

  imagen(d: number): string | null {
    return imagenBillete(this.pais ?? undefined, d);
  }

  cargar(): void {
    this.cargando = true;
    this.willGo.arqueo(this.edicionId).subscribe({
      next: (datos) => {
        this.datos = datos;
        for (const p of datos.paises) this.conteos[p.id] ??= {};
        this.pais = datos.paises.find((p) => p.id === this.pais?.id) ?? datos.paises[0] ?? null;
        this.cargando = false;
      },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  guardar(): void {
    if (!this.pais || !this.datos) return;
    const conteo: Record<string, number> = {};
    for (const d of this.datos.denominaciones) if (this.cantidad(d)) conteo[d] = this.cantidad(d);
    this.guardando = true;
    this.aviso = '';
    const pais = this.pais;
    this.willGo.guardarArqueo(this.edicionId, pais.id, conteo, this.observaciones).subscribe({
      next: (a) => {
        this.guardando = false;
        this.avisoError = a.diferencia !== 0;
        this.aviso = a.diferencia === 0 ? `Arqueo de ${pais.nombre} guardado: cuadra.`
          : `Arqueo de ${pais.nombre} guardado: ${a.diferencia < 0 ? 'faltan' : 'sobran'} ${this.miles(Math.abs(a.diferencia))} billetes.`;
        this.conteos[pais.id] = {};
        this.observaciones = '';
        this.cargar();
      },
      error: (e) => { this.guardando = false; this.avisoError = true; this.aviso = WillGoService.mensajeDeError(e); },
    });
  }
}
