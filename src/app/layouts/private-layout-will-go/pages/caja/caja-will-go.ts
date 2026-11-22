import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { DatosCaja, EstudianteCaja, PaisCaja, ProductoCaja, VentaCaja, WillGoService } from '../../../../core/services/will-go.service';
import { formatearNumero } from '../../numero-miles.directive';
import { SelectorBilletesComponent } from '../../selector-billetes.component';
import { imagenBillete } from '../../imagen-billete';

type Vista = 'vender' | 'caja' | 'ventas';
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const sumaBilletes = (b: Record<number, number | null>) => Object.entries(b).reduce((t, [d, n]) => t + Number(d) * (Number(n) || 0), 0);
const limpiarBilletes = (b: Record<number, number | null>) => Object.fromEntries(Object.entries(b).filter(([, n]) => Number(n) > 0).map(([d, n]) => [d, Number(n)]));

/** Caja GO•STORE: el encargado vende los productos, recibe los billetes del estudiante y da el vuelto. */
@Component({
  selector: 'app-caja-will-go',
  standalone: true,
  imports: [FormsModule, DatePipe, SelectorBilletesComponent],
  template: `
    <div class="max-w-3xl mx-auto pb-28">
      <div class="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">Caja GO•STORE</h1>
          <p class="text-gray-500 mt-1">Vende los productos de la tienda y da el vuelto.</p>
        </div>
        @if (ediciones.length > 1) {
          <select [(ngModel)]="edicionId" (ngModelChange)="cargar()" aria-label="Edición" class="sm:w-72 px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
            @for (e of ediciones; track e.id) { <option [value]="e.id">{{ e.nombre }}</option> }
          </select>
        }
      </div>

      @if (cargando && !datos) {
        <div class="mt-5 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Cargando…</div>
      } @else if (error && !datos) {
        <div class="mt-5 bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
      } @else if (!ediciones.length) {
        <div class="mt-5 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">No haces parte del equipo de ninguna edición abierta.</div>
      } @else if (datos) {
        @if (!datos.puede_vender) {
          <p class="mt-4 rounded-xl px-4 py-3 text-sm bg-amber-50 border border-amber-200 text-amber-800">
            {{ datos.edicion.responsable_caja ? 'La caja la maneja ' + datos.edicion.responsable + '. Puedes ver, pero no vender.' : 'La edición todavía no tiene encargado de la caja (se asigna en Ediciones → GO•STORE).' }}
          </p>
        } @else if (datos.edicion.estado !== 'abierta') {
          <p class="mt-4 rounded-xl px-4 py-3 text-sm bg-gray-100 text-gray-600">Podrás vender cuando la edición esté abierta.</p>
        }
        @if (aviso) { <p class="mt-3 rounded-xl px-4 py-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800" role="status">{{ aviso }}</p> }
        @if (error) { <p class="mt-3 rounded-xl px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700" role="alert">{{ error }}</p> }

        <div class="mt-5 inline-flex gap-1 bg-white border border-gray-200 rounded-xl p-1" role="tablist">
          @for (v of vistas; track v.id) {
            <button type="button" role="tab" [attr.aria-selected]="vista === v.id" (click)="vista = v.id"
                    class="px-4 py-2 rounded-lg text-sm font-semibold" [class]="vista === v.id ? 'bg-orange-100 text-orange-800' : 'text-gray-500 hover:bg-gray-100'">{{ v.texto }}</button>
          }
        </div>

        <!-- VENDER -->
        @if (vista === 'vender') {
          @if (!estudiante) {
            <input type="search" [(ngModel)]="busqueda" placeholder="Buscar estudiante…" aria-label="Buscar estudiante"
                   class="mt-4 w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
            <ul class="mt-3 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              @for (e of filtrados; track e.id) {
                <li>
                  <button type="button" (click)="elegir(e)" class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
                    <span class="w-3 h-10 rounded-full shrink-0" [style.background]="pais(e.pais_id)?.color || '#94a3b8'" aria-hidden="true"></span>
                    <span class="min-w-0 flex-1">
                      <span class="block font-semibold text-gray-800 truncate">{{ e.nombre }} {{ e.apellido }}</span>
                      <span class="block text-xs text-gray-500">{{ pais(e.pais_id)?.nombre }} · tiene <b class="text-gray-700">{{ miles(e.saldo) }}</b></span>
                    </span>
                    <span class="text-orange-600 font-semibold text-sm">Elegir</span>
                  </button>
                </li>
              }
              @if (!filtrados.length) { <li class="px-4 py-6 text-center text-sm text-gray-500">{{ datos.estudiantes.length ? 'Nadie coincide con «' + busqueda + '».' : 'No hay estudiantes con país asignado.' }}</li> }
            </ul>
          } @else {
            <!-- Estudiante elegido -->
            <div class="mt-4 rounded-2xl p-4 text-white shadow flex items-center gap-3" [style.background]="paisEst?.color || '#1e293b'">
              <div class="min-w-0 flex-1">
                <p class="text-xs opacity-90">{{ paisEst?.nombre }} · 1 billete = {{ miles(paisEst?.tasa_actual) }} pesos</p>
                <p class="text-lg font-extrabold truncate">{{ estudiante.nombre }} {{ estudiante.apellido }}</p>
                <p class="text-sm opacity-95">Tiene <b>{{ miles(estudiante.saldo) }} {{ paisEst?.codigo_moneda }}</b></p>
              </div>
              <button type="button" (click)="cambiarEstudiante()" class="shrink-0 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-semibold">Cambiar</button>
            </div>

            <ul class="mt-4 space-y-3">
              @for (p of datos.productos; track p.id) {
                <li class="bg-white rounded-2xl border border-gray-200 p-3 flex items-center gap-3" [class.opacity-50]="!disponible(p)">
                  <div class="w-16 h-16 shrink-0 rounded-xl bg-orange-50 overflow-hidden flex items-center justify-center">
                    @if (p.foto) { <img [src]="urlFoto(p.foto)" [alt]="p.nombre" class="w-full h-full object-cover"> } @else { <span class="text-3xl" aria-hidden="true">🛍️</span> }
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-gray-800 truncate">{{ p.nombre }}</p>
                    <p class="text-sm font-bold" [style.color]="paisEst?.color || '#111827'">{{ miles(precio(p)) }} {{ paisEst?.codigo_moneda }}</p>
                    <p class="text-xs text-gray-500">{{ textoDisponible(p) }}</p>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button type="button" (click)="sumar(p, -1)" [disabled]="!cantidad(p)" class="w-9 h-9 p-0 rounded-lg bg-gray-100 text-lg font-bold text-gray-700 disabled:opacity-30" [attr.aria-label]="'Quitar ' + p.nombre">−</button>
                    <span class="w-7 text-center font-bold">{{ cantidad(p) }}</span>
                    <button type="button" (click)="sumar(p, 1)" [disabled]="!puedeSumar(p)" class="w-9 h-9 p-0 rounded-lg bg-gray-100 text-lg font-bold text-gray-700 disabled:opacity-30" [attr.aria-label]="'Agregar ' + p.nombre">+</button>
                  </div>
                </li>
              }
              @if (!datos.productos.length) { <li class="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">La tienda no tiene productos (se agregan en Ediciones → GO•STORE).</li> }
            </ul>
          }
        }

        <!-- CAJA: billetes por país y entregar al banco -->
        @if (vista === 'caja') {
          @for (p of datos.paises; track p.id) {
            <section class="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div class="p-4 text-white flex items-center gap-3" [style.background]="p.color || '#1e293b'">
                <div class="flex-1">
                  <p class="text-sm opacity-90">Caja · {{ p.nombre }}</p>
                  <p class="text-2xl font-extrabold">{{ miles(p.saldo_caja) }} <span class="text-sm font-semibold opacity-90">{{ p.codigo_moneda }}</span></p>
                </div>
                @if (datos.puede_vender && p.saldo_caja > 0) {
                  <button type="button" (click)="abrirEntrega(p)" class="shrink-0 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-semibold">Entregar al banco</button>
                }
              </div>
              @if (conBilletes(p).length) {
                <div class="p-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
                  @for (d of conBilletes(p); track d) {
                    <div class="rounded-lg border border-gray-200 overflow-hidden">
                      @if (imagen(p, d); as src) { <img [src]="src" [alt]="'Billete de ' + miles(d)" class="w-full aspect-[520/281] object-cover"> }
                      @else { <div class="w-full aspect-[520/281] flex items-center justify-center text-sm font-black text-white" [style.background]="p.color || '#64748b'">{{ miles(d) }}</div> }
                      <p class="text-center text-xs py-1 text-gray-600"><b class="text-gray-800">{{ miles(p.inventario[d]) }}</b> × {{ miles(d) }}</p>
                    </div>
                  }
                </div>
              } @else {
                <p class="p-4 text-sm text-gray-500">La caja no tiene billetes de {{ p.nombre }}.</p>
              }
            </section>
          }
          @if (datos.entregas.length) {
            <h2 class="mt-6 text-sm font-bold text-gray-700">Entregas al banco</h2>
            <ul class="mt-2 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
              @for (t of datos.entregas; track t.id) {
                <li class="px-4 py-3 flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-semibold text-gray-800">Al banco de {{ pais(t.pais_id)?.nombre }}</p>
                    <p class="text-xs text-gray-500">{{ t.date_created | date:'d MMM, h:mm a' }}{{ t.quien ? ' · ' + t.quien : '' }}</p>
                  </div>
                  <p class="font-bold text-gray-800 whitespace-nowrap">{{ miles(t.monto) }}</p>
                </li>
              }
            </ul>
          }
        }

        <!-- VENTAS -->
        @if (vista === 'ventas') {
          @if (!datos.ventas.length) {
            <p class="mt-4 text-sm text-gray-500">Todavía no hay ventas.</p>
          } @else {
            <ul class="mt-4 space-y-3">
              @for (v of datos.ventas; track v.id) {
                <li class="bg-white rounded-2xl border border-gray-200 p-4">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="font-semibold text-gray-800 truncate">{{ v.nombre }} {{ v.apellido }}</p>
                      <p class="text-xs text-gray-500">{{ v.numero_recibo }} · {{ v.date_created | date:'d MMM, h:mm a' }}</p>
                    </div>
                    <p class="font-extrabold whitespace-nowrap" [style.color]="pais(v.pais_id)?.color || '#111827'">{{ miles(v.total_billetes) }} {{ pais(v.pais_id)?.codigo_moneda }}</p>
                  </div>
                  <p class="text-sm text-gray-600 mt-1">{{ textoItems(v) }}</p>
                  <p class="text-xs text-gray-500 mt-0.5">Entregó {{ miles(suma(v.billetes_recibidos)) }}{{ suma(v.billetes_vuelto) ? ' · vuelto ' + miles(suma(v.billetes_vuelto)) : '' }}</p>
                </li>
              }
            </ul>
          }
        }
      }
    </div>

    <!-- Carrito fijo abajo -->
    @if (vista === 'vender' && estudiante && datos && unidades) {
      <div class="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-[0_-6px_20px_rgba(0,0,0,.08)] px-4 py-3">
        <div class="max-w-3xl mx-auto flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <p class="text-xs text-gray-500">{{ unidades }} {{ unidades === 1 ? 'producto' : 'productos' }}</p>
            <p class="text-xl font-extrabold" [class]="total > estudiante.saldo ? 'text-red-600' : 'text-gray-800'">{{ miles(total) }} {{ paisEst?.codigo_moneda }}</p>
            @if (total > estudiante.saldo) { <p class="text-xs font-semibold text-red-600">No le alcanza (tiene {{ miles(estudiante.saldo) }})</p> }
          </div>
          <button type="button" (click)="abrirCobro()" [disabled]="!datos.puede_vender || datos.edicion.estado !== 'abierta' || total > estudiante.saldo"
                  class="shrink-0 px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">Cobrar</button>
        </div>
      </div>
    }

    <!-- Cobro: billetes recibidos y vuelto -->
    @if (cobrando && estudiante && paisEst && datos) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="cerrarCobro()">
        <div class="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94vh] flex flex-col" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-cobro">
          <div class="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="titulo-cobro" class="text-lg font-bold text-gray-800">{{ paso === 'recibido' ? 'Billetes que entrega' : 'Vuelto que le das' }}</h2>
              <p class="text-sm text-gray-500">{{ estudiante.nombre }} · total <b>{{ miles(total) }} {{ paisEst.codigo_moneda }}</b></p>
            </div>
            <button type="button" (click)="cerrarCobro()" class="p-1 text-gray-400 hover:text-gray-600" aria-label="Cerrar">✕</button>
          </div>
          <div class="flex-1 overflow-y-auto px-5 pb-3">
            @if (paso === 'recibido') {
              <wg-selector-billetes [pais]="paisEst" [denominaciones]="datos.denominaciones" [elegidos]="recibidos" />
            } @else {
              <div class="mb-3 flex items-center justify-between gap-3">
                <p class="text-sm text-gray-600">Entregó {{ miles(recibido) }} · debes devolver <b>{{ miles(vueltoDebido) }}</b></p>
                <button type="button" (click)="sugerirVuelto()" class="text-sm font-semibold text-orange-600 hover:underline shrink-0">Sugerir vuelto</button>
              </div>
              <wg-selector-billetes [pais]="paisEst" [denominaciones]="conVuelto" [elegidos]="vuelto" [topes]="topesVuelto" [topeTotal]="vueltoDebido" textoTope="En caja:" />
              @if (!conVuelto.length) { <p class="text-sm text-red-600">La caja no tiene billetes para dar vuelto. Pídele billetes más pequeños.</p> }
            }
          </div>
          <div class="px-5 py-4 border-t border-gray-100">
            @if (errorCobro) { <p class="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ errorCobro }}</p> }
            <div class="grid grid-cols-3 gap-2 mb-3 text-center">
              <div class="rounded-xl bg-gray-50 py-2"><p class="text-[11px] text-gray-500">Total</p><p class="font-extrabold text-gray-800">{{ miles(total) }}</p></div>
              <div class="rounded-xl bg-gray-50 py-2"><p class="text-[11px] text-gray-500">Entregó</p><p class="font-extrabold" [class]="recibido < total ? 'text-red-600' : 'text-gray-800'">{{ miles(recibido) }}</p></div>
              <div class="rounded-xl bg-gray-50 py-2"><p class="text-[11px] text-gray-500">Vuelto</p><p class="font-extrabold text-gray-800">{{ miles(vueltoDebido) }}</p></div>
            </div>
            @if (paso === 'recibido') {
              <button type="button" (click)="siguientePaso()" [disabled]="recibido < total"
                      class="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">
                {{ recibido < total ? 'Faltan ' + miles(total - recibido) : (vueltoDebido ? 'Siguiente: dar vuelto' : 'Confirmar venta') }}
              </button>
            } @else {
              <div class="flex flex-col-reverse sm:flex-row gap-2">
                <button type="button" (click)="paso = 'recibido'" class="w-full sm:w-auto px-5 py-3 rounded-xl font-semibold text-gray-700 bg-gray-100">Atrás</button>
                <button type="button" (click)="confirmar()" [disabled]="enviando || vueltoMarcado !== vueltoDebido"
                        class="w-full sm:flex-1 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">
                  {{ enviando ? 'Guardando…' : (vueltoMarcado !== vueltoDebido ? 'Faltan ' + miles(vueltoDebido - vueltoMarcado) + ' de vuelto' : 'Confirmar venta') }}
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    }

    <!-- Recibo -->
    @if (recibo) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="recibo = null">
        <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-recibo">
          <div class="text-center">
            <div class="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl" aria-hidden="true">✓</div>
            <h2 id="titulo-recibo" class="mt-3 text-lg font-bold text-gray-800">Venta registrada</h2>
            <p class="text-sm text-gray-500">{{ recibo.numero }}</p>
          </div>
          <ul class="mt-4 divide-y divide-gray-100 text-sm">
            @for (i of recibo.items; track $index) {
              <li class="py-2 flex justify-between gap-3"><span>{{ i.cantidad }} × {{ i.nombre }}</span><b>{{ miles(i.cantidad * i.precio_billetes) }}</b></li>
            }
          </ul>
          <div class="mt-3 rounded-xl bg-gray-50 p-3 text-sm space-y-1">
            <p class="flex justify-between"><span>Total</span><b>{{ miles(recibo.total) }} {{ recibo.moneda }}</b></p>
            <p class="flex justify-between"><span>Entregó</span><span>{{ miles(recibo.recibido) }}</span></p>
            <p class="flex justify-between"><span>Vuelto</span><span>{{ miles(recibo.vuelto) }}</span></p>
            <p class="flex justify-between text-gray-500"><span>Le quedan</span><span>{{ miles(recibo.saldo) }}</span></p>
          </div>
          <button type="button" (click)="recibo = null" class="mt-5 w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600">Nueva venta</button>
        </div>
      </div>
    }

    <!-- Entregar al banco -->
    @if (entregaPais && datos) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="entregaPais = null">
        <div class="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94vh] flex flex-col" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-entrega-banco">
          <div class="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="titulo-entrega-banco" class="text-lg font-bold text-gray-800">Entregar al banco de {{ entregaPais.nombre }}</h2>
              <p class="text-sm text-gray-500">Marca los billetes que le entregas al banco.</p>
            </div>
            <button type="button" (click)="entregaPais = null" class="p-1 text-gray-400 hover:text-gray-600" aria-label="Cerrar">✕</button>
          </div>
          <div class="flex-1 overflow-y-auto px-5 pb-3">
            <button type="button" (click)="todoAlBanco()" class="mb-3 text-sm font-semibold text-orange-600 hover:underline">Entregar todo</button>
            <wg-selector-billetes [pais]="entregaPais" [denominaciones]="conBilletes(entregaPais)" [elegidos]="aEntregar" [topes]="entregaPais.inventario" textoTope="En caja:" />
          </div>
          <div class="px-5 py-4 border-t border-gray-100">
            @if (errorCobro) { <p class="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ errorCobro }}</p> }
            <button type="button" (click)="entregar()" [disabled]="enviando || !suma(aEntregar)"
                    class="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">
              {{ enviando ? 'Entregando…' : (suma(aEntregar) ? 'Entregar ' + miles(suma(aEntregar)) : 'Elige los billetes') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CajaWillGo implements OnInit {
  private willGo = inject(WillGoService);
  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);
  readonly vistas: { id: Vista; texto: string }[] = [{ id: 'vender', texto: 'Vender' }, { id: 'caja', texto: 'Caja' }, { id: 'ventas', texto: 'Ventas' }];

  ediciones: { id: string; nombre: string; estado: string }[] = [];
  edicionId = '';
  datos: DatosCaja | null = null;
  vista: Vista = 'vender';
  busqueda = '';
  cargando = true;
  error = '';
  aviso = '';

  estudiante: EstudianteCaja | null = null;
  carrito: Record<string, number> = {};
  cobrando = false;
  paso: 'recibido' | 'vuelto' = 'recibido';
  recibidos: Record<number, number | null> = {};
  vuelto: Record<number, number | null> = {};
  clave = '';
  enviando = false;
  errorCobro = '';
  recibo: { numero: string; items: { nombre: string; cantidad: number; precio_billetes: number }[]; total: number; recibido: number; vuelto: number; saldo: number; moneda: string } | null = null;

  entregaPais: PaisCaja | null = null;
  aEntregar: Record<number, number | null> = {};

  ngOnInit(): void {
    this.willGo.misEdiciones().subscribe({
      next: (l) => { this.ediciones = l; this.edicionId = l[0]?.id ?? ''; if (this.edicionId) this.cargar(); else this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  cargar(): void {
    this.cargando = true;
    this.willGo.caja(this.edicionId).subscribe({
      next: (d) => {
        this.datos = d;
        if (this.estudiante) this.estudiante = d.estudiantes.find((e) => e.id === this.estudiante!.id) ?? null;
        this.cargando = false;
        this.error = '';
      },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  private avisar(t: string): void { this.aviso = t; setTimeout(() => (this.aviso = ''), 5000); }

  pais(id: string | null | undefined): PaisCaja | undefined { return this.datos?.paises.find((p) => p.id === id); }
  get paisEst(): PaisCaja | undefined { return this.pais(this.estudiante?.pais_id); }
  urlFoto(id: string): string { return this.willGo.urlFoto(id); }
  imagen(p: PaisCaja, d: number): string | null { return imagenBillete(p, d); }
  suma(b: Record<string | number, number | null> | string | null | undefined): number {
    const x = typeof b === 'string' ? JSON.parse(b) : b;
    return x ? sumaBilletes(x) : 0;
  }
  conBilletes(p: PaisCaja): number[] { return (this.datos?.denominaciones ?? []).filter((d) => Number(p.inventario?.[d] ?? 0) > 0); }
  textoItems(v: VentaCaja): string { return v.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(', '); }

  get filtrados(): EstudianteCaja[] {
    const palabras = normalizar(this.busqueda).split(/\s+/).filter(Boolean);
    return (this.datos?.estudiantes ?? []).filter((e) => { const n = normalizar(`${e.nombre} ${e.apellido}`); return palabras.every((w) => n.includes(w)); });
  }

  elegir(e: EstudianteCaja): void { this.estudiante = e; this.carrito = {}; }
  cambiarEstudiante(): void { this.estudiante = null; this.carrito = {}; this.busqueda = ''; }

  // ---- Carrito ----
  precio(p: ProductoCaja): number { return Math.ceil(Number(p.precio_cop) / Math.max(Number(this.paisEst?.tasa_actual) || 1, 1)); }
  cantidad(p: ProductoCaja): number { return this.carrito[p.id] ?? 0; }
  /** Cuántas unidades más puede llevar este estudiante (stock y máximo por estudiante). */
  private maximo(p: ProductoCaja): number {
    const ya = this.datos?.comprado?.[this.estudiante?.id ?? '']?.[p.id] ?? 0;
    const porEstudiante = p.maximo_por_estudiante ? Math.max(0, p.maximo_por_estudiante - ya) : Infinity;
    return Math.min(Number(p.stock), porEstudiante);
  }
  disponible(p: ProductoCaja): boolean { return this.maximo(p) > 0; }
  puedeSumar(p: ProductoCaja): boolean { return this.cantidad(p) < this.maximo(p); }
  textoDisponible(p: ProductoCaja): string {
    if (Number(p.stock) <= 0) return 'Agotado';
    const ya = this.datos?.comprado?.[this.estudiante?.id ?? '']?.[p.id] ?? 0;
    if (p.maximo_por_estudiante && ya >= p.maximo_por_estudiante) return `Ya compró el máximo (${p.maximo_por_estudiante})`;
    return `${this.miles(p.stock)} disponibles${p.maximo_por_estudiante ? ` · máx. ${p.maximo_por_estudiante} por estudiante` : ''}`;
  }
  sumar(p: ProductoCaja, n: number): void {
    const v = Math.max(0, Math.min(this.cantidad(p) + n, this.maximo(p)));
    this.carrito = { ...this.carrito, [p.id]: v };
  }
  get unidades(): number { return Object.values(this.carrito).reduce((t, n) => t + n, 0); }
  get total(): number { return (this.datos?.productos ?? []).reduce((t, p) => t + this.precio(p) * this.cantidad(p), 0); }

  // ---- Cobro ----
  get recibido(): number { return sumaBilletes(this.recibidos); }
  get vueltoDebido(): number { return Math.max(0, this.recibido - this.total); }
  get vueltoMarcado(): number { return sumaBilletes(this.vuelto); }
  /** El vuelto puede salir de lo que hay en caja más lo que el estudiante acaba de entregar. */
  get topesVuelto(): Record<string, number> {
    const p = this.paisEst;
    return Object.fromEntries((this.datos?.denominaciones ?? []).map((d) => [d, Number(p?.inventario?.[d] ?? 0) + (Number(this.recibidos[d]) || 0)]));
  }
  get conVuelto(): number[] { return (this.datos?.denominaciones ?? []).filter((d) => d <= this.vueltoDebido && this.topesVuelto[d] > 0); }

  abrirCobro(): void {
    this.cobrando = true;
    this.paso = 'recibido';
    this.recibidos = {};
    this.vuelto = {};
    this.errorCobro = '';
    this.clave = crypto.randomUUID();
  }
  cerrarCobro(): void { if (!this.enviando) this.cobrando = false; }

  siguientePaso(): void {
    if (this.recibido < this.total) return;
    if (!this.vueltoDebido) { this.confirmar(); return; }
    this.vuelto = {};
    this.sugerirVuelto();
    this.paso = 'vuelto';
  }

  /** Arma el vuelto con los billetes más grandes disponibles. */
  sugerirVuelto(): void {
    let falta = this.vueltoDebido;
    const topes = this.topesVuelto;
    const v: Record<number, number> = {};
    for (const d of [...(this.datos?.denominaciones ?? [])].sort((a, b) => b - a)) {
      const n = Math.min(Math.floor(falta / d), topes[d] ?? 0);
      if (n > 0) { v[d] = n; falta -= n * d; }
    }
    this.vuelto = v;
    this.errorCobro = falta ? `La caja no tiene billetes para completar ${this.miles(falta)} de vuelto.` : '';
  }

  confirmar(): void {
    const e = this.estudiante, p = this.paisEst;
    if (!e || !p || !this.datos || this.enviando) return;
    const items = Object.entries(this.carrito).filter(([, n]) => n > 0).map(([producto_id, cantidad]) => ({ producto_id, cantidad }));
    const total = this.total, recibido = this.recibido, vuelto = this.vueltoMarcado;
    this.enviando = true;
    this.errorCobro = '';
    this.willGo.vender({ participante_id: e.id, items, billetes_recibidos: limpiarBilletes(this.recibidos), billetes_vuelto: limpiarBilletes(this.vuelto), clave_idempotencia: this.clave }).subscribe({
      next: (r) => {
        this.enviando = false;
        this.cobrando = false;
        this.recibo = { numero: r.numero_recibo, items: r.items, total, recibido, vuelto, saldo: r.saldo, moneda: p.codigo_moneda ?? '' };
        this.carrito = {};
        this.estudiante = null;
        this.busqueda = '';
        this.cargar();
      },
      error: (err) => { this.enviando = false; this.errorCobro = WillGoService.mensajeDeError(err); },
    });
  }

  // ---- Entregar al banco ----
  abrirEntrega(p: PaisCaja): void { this.entregaPais = p; this.aEntregar = {}; this.errorCobro = ''; this.clave = crypto.randomUUID(); }
  todoAlBanco(): void { if (this.entregaPais) this.aEntregar = { ...this.entregaPais.inventario }; }
  entregar(): void {
    const p = this.entregaPais;
    if (!p || !this.datos || this.enviando) return;
    this.enviando = true;
    this.errorCobro = '';
    this.willGo.entregarCajaAlBanco(this.datos.edicion.id, p.id, limpiarBilletes(this.aEntregar), this.clave).subscribe({
      next: (r) => { this.enviando = false; this.entregaPais = null; this.avisar(`Entregaste ${this.miles(r.monto)} al banco de ${p.nombre}.`); this.cargar(); },
      error: (err) => { this.enviando = false; this.errorCobro = WillGoService.mensajeDeError(err); },
    });
  }
}
