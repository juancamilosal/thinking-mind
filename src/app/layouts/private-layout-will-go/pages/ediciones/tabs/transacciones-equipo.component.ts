import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MiembroEquipo, TransaccionEquipo, WillGoService } from '../../../../../core/services/will-go.service';
import { formatearNumero } from '../../../numero-miles.directive';

type Medio = '' | 'efectivo' | 'virtual';

/** Qué hizo cada colaborador con el dinero de la edición (efectivo y virtual), para el control del administrador. */
@Component({
  selector: 'wg-transacciones-equipo',
  standalone: true,
  imports: [FormsModule, TranslatePipe, DatePipe],
  template: `
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="cerrar.emit()">
      <div class="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-transacciones">
        <div class="px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 id="titulo-transacciones" class="text-lg sm:text-xl font-bold text-gray-800">{{ 'wg.pestanas.transacciones.titulo' | translate }}</h2>
              <p class="text-sm text-gray-500 truncate">{{ miembro ? miembro.nombre + ' ' + miembro.apellido : ('wg.pestanas.transacciones.todoElEquipo' | translate) }}</p>
            </div>
            <button type="button" (click)="cerrar.emit()" class="p-1 text-gray-400 hover:text-gray-600" [attr.aria-label]="'wg.pestanas.comun.cerrar' | translate">✕</button>
          </div>

          @if (!miembro && equipo.length) {
            <select [(ngModel)]="filtroUsuario" [attr.aria-label]="'wg.pestanas.transacciones.filtrarColaborador' | translate"
                    class="mt-3 w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300">
              <option value="">{{ 'wg.pestanas.transacciones.todosColaboradores' | translate }}</option>
              @for (m of equipo; track m.id) { <option [value]="m.usuario_id">{{ m.nombre }} {{ m.apellido }}</option> }
            </select>
          }

          <div class="mt-3 grid grid-cols-3 gap-1 bg-gray-100 rounded-xl p-1" role="tablist">
            @for (o of medios; track o.id) {
              <button type="button" role="tab" [attr.aria-selected]="medio === o.id" (click)="medio = o.id"
                      class="py-2 rounded-lg text-sm font-semibold" [class]="medio === o.id ? 'bg-white shadow text-gray-900' : 'text-gray-600'">{{ o.texto | translate }}</button>
            }
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-5 sm:px-6 py-4">
          @if (cargando) {
            <p class="py-10 text-center text-gray-500">{{ 'wg.pestanas.transacciones.cargando' | translate }}</p>
          } @else if (error) {
            <p class="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ error }}</p>
          } @else {
            <!-- Totales por país y medio -->
            @if (totales.length) {
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                @for (t of totales; track t.clave) {
                  <div class="rounded-2xl border px-4 py-3" [class]="t.medio === 'virtual' ? 'border-indigo-200 bg-indigo-50' : 'border-emerald-200 bg-emerald-50'">
                    <p class="text-xs font-semibold" [class]="t.medio === 'virtual' ? 'text-indigo-700' : 'text-emerald-700'">
                      {{ (t.medio === 'virtual' ? 'wg.pestanas.transacciones.virtual' : 'wg.pestanas.transacciones.efectivo') | translate }} · {{ t.pais }}
                    </p>
                    <p class="text-xl font-bold text-gray-900">{{ miles(t.monto) }} <span class="text-sm font-semibold text-gray-500">{{ t.moneda }}</span></p>
                    <p class="text-xs text-gray-500">{{ 'wg.pestanas.transacciones.nOperaciones' | translate: { n: t.n } }}</p>
                  </div>
                }
              </div>
            }

            @if (!visibles.length) {
              <p class="py-10 text-center text-gray-500">{{ 'wg.pestanas.transacciones.sinTransacciones' | translate }}</p>
            } @else {
              <ul class="space-y-2">
                @for (o of visibles; track o.id) {
                  <li class="rounded-2xl border border-gray-200 px-4 py-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <p class="font-semibold text-gray-800">{{ tipoTexto(o.tipo) | translate }}</p>
                        <p class="text-sm text-gray-600 break-words">
                          @if (o.origen) { {{ lado(o.origen, o.pais) }} }
                          @if (o.origen && o.destino) { <span class="text-gray-400"> → </span> }
                          @if (o.destino) { {{ lado(o.destino, o.pais) }} }
                        </p>
                      </div>
                      <div class="text-right shrink-0">
                        <p class="font-bold text-gray-900 whitespace-nowrap">{{ miles(o.monto) }} <span class="text-xs font-semibold text-gray-500">{{ o.moneda }}</span></p>
                        <span class="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                              [class]="o.medio === 'virtual' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'">
                          {{ (o.medio === 'virtual' ? 'wg.pestanas.transacciones.virtual' : 'wg.pestanas.transacciones.efectivo') | translate }}
                        </span>
                      </div>
                    </div>
                    <p class="mt-1 text-xs text-gray-500">
                      {{ o.fecha | date: 'd MMM, h:mm a' }}
                      @if (!miembro) { · {{ 'wg.pestanas.transacciones.hizo' | translate: { nombre: o.colaborador } }} }
                    </p>
                  </li>
                }
              </ul>
              @if (total > operaciones.length) {
                <p class="mt-3 text-xs text-center text-gray-500">{{ 'wg.pestanas.transacciones.soloUltimas' | translate: { n: operaciones.length } }}</p>
              }
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class TransaccionesEquipoComponent implements OnInit {
  @Input({ required: true }) edicionId!: string;
  /** Si viene, solo las de ese colaborador; si no, las de todo el equipo. */
  @Input() miembro: MiembroEquipo | null = null;
  @Input() equipo: MiembroEquipo[] = [];
  @Output() cerrar = new EventEmitter<void>();
  private willGo = inject(WillGoService);
  private t = inject(TranslateService);
  readonly miles = (v: unknown) => formatearNumero(v as number);
  readonly medios: { id: Medio; texto: string }[] = [
    { id: '', texto: 'wg.pestanas.transacciones.todas' },
    { id: 'efectivo', texto: 'wg.pestanas.transacciones.efectivo' },
    { id: 'virtual', texto: 'wg.pestanas.transacciones.virtual' },
  ];
  private readonly tipos: Record<string, string> = {
    provision: 'wg.pestanas.transacciones.tipos.provision',
    transferencia_salida: 'wg.pestanas.transacciones.tipos.transferencia',
    transferencia_entrada: 'wg.pestanas.transacciones.tipos.transferencia',
    bienvenida: 'wg.pestanas.transacciones.tipos.bienvenida',
    compra: 'wg.pestanas.transacciones.tipos.compra',
    pago_tarjeta: 'wg.pestanas.transacciones.tipos.pagoTarjeta',
    inversion: 'wg.pestanas.transacciones.tipos.inversion',
    pago_fondo: 'wg.pestanas.transacciones.tipos.pagoFondo',
    reverso: 'wg.pestanas.transacciones.tipos.reverso',
    consignacion: 'wg.pestanas.transacciones.tipos.consignacion',
    retiro_cuenta: 'wg.pestanas.transacciones.tipos.retiroCuenta',
    carga_virtual: 'wg.pestanas.transacciones.tipos.cargaVirtual',
  };

  operaciones: TransaccionEquipo[] = [];
  total = 0;
  cargando = true;
  error = '';
  medio: Medio = '';
  filtroUsuario = '';

  ngOnInit(): void {
    this.willGo.transaccionesEquipo(this.edicionId, this.miembro?.usuario_id).subscribe({
      next: (r) => { this.operaciones = r.operaciones; this.total = r.total; this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  private get delColaborador(): TransaccionEquipo[] {
    return this.filtroUsuario ? this.operaciones.filter((o) => o.colaborador_id === this.filtroUsuario) : this.operaciones;
  }

  get visibles(): TransaccionEquipo[] {
    return this.delColaborador.filter((o) => !this.medio || o.medio === this.medio);
  }

  /** Lo que movió por país y medio (efectivo y virtual van aparte). */
  get totales(): { clave: string; pais: string; moneda: string; medio: string; n: number; monto: number }[] {
    const m = new Map<string, { clave: string; pais: string; moneda: string; medio: string; n: number; monto: number }>();
    for (const o of this.visibles) {
      const clave = `${o.pais_id}:${o.medio}`;
      const t = m.get(clave) ?? { clave, pais: o.pais ?? '', moneda: o.moneda ?? '', medio: o.medio, n: 0, monto: 0 };
      t.n += 1; t.monto += o.monto;
      m.set(clave, t);
    }
    return [...m.values()].sort((a, b) => a.pais.localeCompare(b.pais) || a.medio.localeCompare(b.medio));
  }

  tipoTexto(tipo: string): string {
    return this.tipos[tipo] ?? 'wg.pestanas.transacciones.tipos.otro';
  }

  lado(l: NonNullable<TransaccionEquipo['origen']>, pais: string | null): string {
    switch (l.tipo) {
      case 'banco': return this.t.instant('wg.pestanas.transacciones.lados.banco', { pais: pais ?? '' });
      case 'banco_virtual': return this.t.instant('wg.pestanas.transacciones.lados.bancoVirtual', { pais: pais ?? '' });
      case 'caja': return this.t.instant('wg.pestanas.transacciones.lados.caja');
      case 'cuenta': return this.t.instant('wg.pestanas.transacciones.lados.cuenta', { nombre: l.nombre });
      case 'estudiante': return this.t.instant('wg.pestanas.transacciones.lados.estudiante', { nombre: l.nombre });
      default: return l.nombre || '—';
    }
  }
}
