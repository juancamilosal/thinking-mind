import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { DatosReparto, DocenteReparto, EntregaReparto, PaisReparto, WillGoService } from '../../../../core/services/will-go.service';
import { NumeroMilesDirective, formatearNumero } from '../../numero-miles.directive';
import { imagenBillete } from '../../arqueo.component';

/** Repartir a docentes: el banco entrega billetes de su país a los docentes del equipo. */
@Component({
  selector: 'app-repartir-will-go',
  standalone: true,
  imports: [FormsModule, DatePipe, NumeroMilesDirective],
  template: `
    <div class="max-w-3xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">Repartir a docentes</h1>
          <p class="text-gray-500 mt-1">Entrega billetes del banco a cada docente.</p>
        </div>
        @if (ediciones.length > 1) {
          <select [(ngModel)]="edicionId" (ngModelChange)="cargar()" aria-label="Edición" class="sm:w-72 px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
            @for (e of ediciones; track e.id) { <option [value]="e.id">{{ e.nombre }}</option> }
          </select>
        }
      </div>

      @if (cargando) {
        <div class="mt-5 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Cargando…</div>
      } @else if (error) {
        <div class="mt-5 bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
      } @else if (!datos?.paises?.length) {
        <div class="mt-5 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">No eres responsable del banco de ningún país en esta edición.</div>
      } @else if (datos && pais) {
        @if (datos.paises.length > 1) {
          <div class="mt-5 flex flex-wrap gap-2">
            @for (p of datos.paises; track p.id) {
              <button type="button" (click)="pais = p" class="px-4 py-2 rounded-xl text-sm font-semibold border-2"
                      [style.background]="pais.id === p.id ? (p.color || '#1e293b') : '#fff'" [style.border-color]="p.color || '#cbd5e1'"
                      [style.color]="pais.id === p.id ? '#fff' : '#334155'">{{ p.nombre }}</button>
            }
          </div>
        }

        <!-- Banco -->
        <div class="mt-4 rounded-2xl p-5 text-white shadow" [style.background]="pais.color || '#1e293b'">
          <p class="text-sm opacity-90">Banco de {{ pais.nombre }}</p>
          <p class="text-3xl font-extrabold mt-1 break-all">{{ miles(pais.saldo_banco) }} <span class="text-base font-semibold opacity-90">{{ pais.codigo_moneda }}</span></p>
          @if (datos.edicion.estado !== 'abierta') {
            <p class="text-sm mt-2 bg-white/20 rounded-lg px-3 py-1.5 inline-block">Se puede repartir cuando la edición esté abierta.</p>
          }
        </div>

        @if (aviso) {
          <p class="mt-3 rounded-xl px-4 py-3 text-sm" [class]="avisoError ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'" role="status">{{ aviso }}</p>
        }

        <!-- Docentes -->
        <h2 class="font-bold text-gray-800 mt-6 mb-3">Docentes</h2>
        @if (!pais.docentes.length) {
          <div class="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600">No hay docentes de {{ pais.nombre }} en el equipo de la edición.</div>
        } @else {
          <ul class="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            @for (d of pais.docentes; track d.id) {
              <li class="flex items-center gap-3 px-4 py-3">
                <div class="w-11 h-11 shrink-0 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center">{{ (d.nombre[0] || '') + (d.apellido[0] || '') }}</div>
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-gray-800 truncate">{{ d.nombre }} {{ d.apellido }}</p>
                  <p class="text-xs text-gray-500">Tiene <b class="text-gray-700">{{ miles(d.saldo) }}</b> · recibió {{ miles(d.recibido) }}</p>
                </div>
                <button type="button" (click)="abrir(d)" [disabled]="datos.edicion.estado !== 'abierta'"
                        class="shrink-0 px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">Entregar</button>
              </li>
            }
          </ul>
        }

        <!-- Últimas entregas -->
        <h2 class="font-bold text-gray-800 mt-6 mb-3">Últimas entregas</h2>
        @if (!pais.entregas.length) {
          <p class="text-sm text-gray-500">Todavía no hay entregas.</p>
        } @else {
          <ul class="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            @for (e of pais.entregas; track e.id) {
              <li class="px-4 py-3">
                <div class="flex items-center justify-between gap-3">
                  <p class="font-semibold text-gray-800 truncate">{{ e.nombre }} {{ e.apellido }}</p>
                  <p class="font-bold text-gray-800 whitespace-nowrap">{{ miles(e.monto) }}</p>
                </div>
                <p class="text-xs text-gray-500">{{ e.date_created | date:'d MMM, h:mm a' }}{{ detalle(e) ? ' · ' + detalle(e) : '' }}</p>
              </li>
            }
          </ul>
        }
      }
    </div>

    <!-- Panel para entregar -->
    @if (docente && pais && datos) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="cerrar()">
        <div class="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-entrega">
          <div class="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="titulo-entrega" class="text-lg font-bold text-gray-800">Entregar a {{ docente.nombre }} {{ docente.apellido }}</h2>
              <p class="text-sm text-gray-500">Toca los billetes que le das.</p>
            </div>
            <button type="button" (click)="cerrar()" class="p-1 text-gray-400 hover:text-gray-600" aria-label="Cerrar">✕</button>
          </div>
          <div class="flex-1 overflow-y-auto px-5">
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-3">
              @for (d of datos.denominaciones; track d) {
                <div class="rounded-xl border-2 overflow-hidden" [style.border-color]="cantidad(d) ? (pais.color || '#f97316') : '#e5e7eb'" [class.opacity-40]="quedan(d) <= 0">
                  <button type="button" class="block w-full" (click)="sumar(d, 1)" [disabled]="quedan(d) - cantidad(d) <= 0" [attr.aria-label]="'Agregar un billete de ' + miles(d)">
                    @if (imagen(d); as src) {
                      <img [src]="src" [alt]="'Billete de ' + miles(d)" class="w-full aspect-[520/281] object-cover">
                    } @else {
                      <div class="w-full aspect-[520/281] flex items-center justify-center text-xl font-black text-white" [style.background]="pais.color || '#64748b'">{{ miles(d) }}</div>
                    }
                  </button>
                  <div class="flex items-center gap-1 p-1.5">
                    <button type="button" (click)="sumar(d, -1)" [disabled]="!cantidad(d)" class="w-9 h-9 shrink-0 rounded-lg bg-gray-100 text-lg font-bold text-gray-700 disabled:opacity-30" [attr.aria-label]="'Quitar un billete de ' + miles(d)">−</button>
                    <input wgNumero [ngModel]="elegidos[d]" (ngModelChange)="poner(d, $event)" placeholder="0" [attr.aria-label]="'Billetes de ' + miles(d)"
                           class="w-full min-w-0 h-9 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-orange-300">
                    <button type="button" (click)="sumar(d, 1)" [disabled]="quedan(d) - cantidad(d) <= 0" class="w-9 h-9 shrink-0 rounded-lg bg-gray-100 text-lg font-bold text-gray-700 disabled:opacity-30" [attr.aria-label]="'Agregar un billete de ' + miles(d)">+</button>
                  </div>
                  <p class="text-[11px] text-center pb-1.5" [class]="cantidad(d) > quedan(d) ? 'text-red-600 font-semibold' : 'text-gray-500'">Quedan {{ miles(quedan(d)) }}</p>
                </div>
              }
            </div>
          </div>
          <div class="px-5 py-4 border-t border-gray-100">
            @if (errorEntrega) { <p class="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ errorEntrega }}</p> }
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm text-gray-500">Total a entregar</span>
              <span class="text-2xl font-extrabold text-gray-800 break-all">{{ miles(total) }} <span class="text-sm font-semibold text-gray-500">{{ pais.codigo_moneda }}</span></span>
            </div>
            <button type="button" (click)="entregar()" [disabled]="!total || enviando || excede"
                    class="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">
              {{ enviando ? 'Entregando…' : (total ? 'Entregar ' + miles(total) : 'Elige los billetes') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class RepartirWillGo implements OnInit {
  private willGo = inject(WillGoService);
  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);

  ediciones: { id: string; nombre: string; estado: string }[] = [];
  edicionId = '';
  datos: DatosReparto | null = null;
  pais: PaisReparto | null = null;
  cargando = true;
  error = '';
  aviso = '';
  avisoError = false;

  docente: DocenteReparto | null = null;
  elegidos: Record<number, number | null> = {};
  clave = '';
  enviando = false;
  errorEntrega = '';

  ngOnInit(): void {
    this.willGo.misEdiciones().subscribe({
      next: (l) => { this.ediciones = l; this.edicionId = l[0]?.id ?? ''; if (this.edicionId) this.cargar(); else this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  cargar(): void {
    this.cargando = true;
    this.willGo.reparto(this.edicionId).subscribe({
      next: (d) => {
        this.datos = d;
        this.pais = d.paises.find((p) => p.id === this.pais?.id) ?? d.paises[0] ?? null;
        this.cargando = false;
      },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  imagen(d: number): string | null { return imagenBillete(this.pais ?? undefined, d); }
  quedan(d: number): number { return Number(this.pais?.inventario?.[d] ?? 0); }
  cantidad(d: number): number { return Number(this.elegidos[d]) || 0; }
  get total(): number { return (this.datos?.denominaciones ?? []).reduce((t, d) => t + d * this.cantidad(d), 0); }
  get excede(): boolean { return (this.datos?.denominaciones ?? []).some((d) => this.cantidad(d) > this.quedan(d)) || this.total > (this.pais?.saldo_banco ?? 0); }

  sumar(d: number, n: number): void { this.elegidos[d] = Math.max(0, Math.min(this.cantidad(d) + n, Math.max(this.quedan(d), 0))); }
  poner(d: number, v: number | null): void { this.elegidos[d] = v; }

  detalle(e: EntregaReparto): string {
    const b = (typeof e.billetes === 'string' ? JSON.parse(e.billetes) : e.billetes) ?? {};
    return Object.entries(b).sort((x, y) => Number(y[0]) - Number(x[0])).map(([d, n]) => `${n} de ${this.miles(Number(d))}`).join(', ');
  }

  abrir(d: DocenteReparto): void {
    this.docente = d;
    this.elegidos = {};
    this.errorEntrega = '';
    this.clave = crypto.randomUUID(); // la misma entrega no se registra dos veces aunque se toque dos veces
  }

  cerrar(): void {
    if (!this.enviando) this.docente = null;
  }

  entregar(): void {
    if (!this.docente || !this.pais || !this.total || this.excede) return;
    const billetes: Record<string, number> = {};
    for (const d of this.datos!.denominaciones) if (this.cantidad(d)) billetes[d] = this.cantidad(d);
    const docente = this.docente;
    this.enviando = true;
    this.errorEntrega = '';
    this.willGo.entregarADocente(this.pais.id, docente.id, billetes, this.clave).subscribe({
      next: (r) => {
        this.enviando = false;
        this.docente = null;
        this.avisoError = false;
        this.aviso = `Entregaste ${this.miles(r.monto)} a ${docente.nombre}.`;
        setTimeout(() => (this.aviso = ''), 5000);
        this.cargar();
      },
      error: (e) => { this.enviando = false; this.errorEntrega = WillGoService.mensajeDeError(e); },
    });
  }
}
