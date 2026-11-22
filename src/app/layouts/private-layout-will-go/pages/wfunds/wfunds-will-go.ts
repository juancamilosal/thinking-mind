import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { DatosWfunds, FondoWfunds, InversionWfunds, PaisWfunds, WillGoService, EdicionVigente } from '../../../../core/services/will-go.service';
import { formatearNumero } from '../../numero-miles.directive';
import { SelectorEdicionComponent } from '../../selector-edicion.component';
import { SelectorBilletesComponent } from '../../selector-billetes.component';
import { TarjetaFondoComponent } from '../../tarjeta-fondo.component';
import { GraficaRendimientoComponent } from '../../grafica-rendimiento.component';
import { ProcesandoRondaComponent } from '../../procesando-ronda.component';

type Estudiante = PaisWfunds['estudiantes'][number];
type Vista = 'invertir' | 'invertido' | 'resultados';

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const RIESGO: Record<string, { texto: string; clase: string }> = {
  bajo: { texto: 'Riesgo bajo', clase: 'bg-emerald-100 text-emerald-800' },
  medio: { texto: 'Riesgo medio', clase: 'bg-amber-100 text-amber-800' },
  alto: { texto: 'Riesgo alto', clase: 'bg-red-100 text-red-800' },
};

/** W-Funds (banco): rondas, inversiones (siguen invertidas ronda tras ronda) y retiros cuando el estudiante los pide. */
@Component({
  selector: 'app-wfunds-will-go',
  standalone: true,
  imports: [FormsModule, DatePipe, SelectorBilletesComponent, TarjetaFondoComponent, GraficaRendimientoComponent, ProcesandoRondaComponent, SelectorEdicionComponent],
  template: `
    <div class="max-w-3xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">W-Funds</h1>
          <p class="text-gray-500 mt-1">Inversiones de los estudiantes en las empresas.</p>
        </div>
      </div>
      <wg-selector-edicion class="block mt-4" [ediciones]="ediciones" [(edicionId)]="edicionId" (cambio)="cargar()" />

      @if (cargando && !datos) {
        <div class="mt-5 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Cargando…</div>
      } @else if (error && !datos) {
        <div class="mt-5 bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
      } @else if (!ediciones.length) {
        <div class="mt-5 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">No haces parte del equipo de ninguna edición abierta.</div>
      } @else if (datos && !pais) {
        <div class="mt-5 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">No eres responsable del banco de ningún país en esta edición.</div>
      } @else if (datos && pais) {
        @if (datos.paises.length > 1) {
          <div class="mt-5 flex flex-wrap gap-2">
            @for (p of datos.paises; track p.id) {
              <button type="button" (click)="elegirPais(p)" class="px-4 py-2 rounded-xl text-sm font-semibold border-2"
                      [style.background]="pais.id === p.id ? (p.color || '#1e293b') : '#fff'" [style.border-color]="p.color || '#cbd5e1'"
                      [style.color]="pais.id === p.id ? '#fff' : '#334155'">{{ p.nombre }}</button>
            }
          </div>
        }

        <!-- Estado de la ronda -->
        @if (datos.ronda; as r) {
          @if (r.cierre_programado && restante <= 0) {
            <wg-procesando-ronda class="block mt-4" [ronda]="r.nombre" />
          } @else {
          <div class="mt-4 rounded-2xl p-5 text-white shadow bg-gradient-to-br from-emerald-500 to-teal-600">
            <div class="flex items-center gap-2 text-sm font-semibold opacity-95">
              <span class="w-2.5 h-2.5 rounded-full bg-white animate-pulse" aria-hidden="true"></span>
              {{ r.nombre }} abierta{{ r.duracion_minutos ? ' · rondas de ' + r.duracion_minutos + ' min' : '' }}
            </div>
            @if (r.cierre_programado) {
              <p class="mt-2 text-sm opacity-90">{{ restante > 0 ? 'Cierra en' : 'Cerrando…' }}</p>
              <p class="text-5xl font-extrabold tabular-nums leading-none" role="timer" aria-live="off">{{ reloj }}</p>
              <p class="text-xs opacity-90 mt-1">a las {{ r.cierre_programado | date:'h:mm a' }}{{ recortada(r) ? ' (fin del horario)' : '' }}</p>
            }
            <div class="mt-4 rounded-xl bg-white/15 px-4 py-3 flex items-center justify-between gap-3">
              <span class="text-sm">Invertido en {{ pais.nombre }}<br><span class="text-xs opacity-90">{{ pais.vigentes.length }} {{ pais.vigentes.length === 1 ? 'inversión' : 'inversiones' }} · {{ pais.inversiones.length }} nuevas en esta ronda</span></span>
              <span class="text-xl font-extrabold break-all">{{ miles(totalInvertido) }}</span>
            </div>
            <button type="button" (click)="confirmarCierre = true" class="mt-4 w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold bg-white text-emerald-700 hover:bg-emerald-50">Cerrar ronda ahora</button>
          </div>
          }
        } @else {
          <div class="mt-4 rounded-2xl p-5 bg-white border border-gray-200 shadow-sm">
            <p class="font-bold text-gray-800">No hay ronda abierta</p>
            @if (datos.edicion.estado === 'abierta' && datos.reanudacion?.automaticas && datos.reanudacion.proxima) {
              <div class="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                <p class="text-sm font-semibold text-emerald-800">Las rondas siguen solas ({{ datos.reanudacion.duracion }} min)</p>
                <p class="text-sm text-emerald-800">
                  {{ datos.fin_horario ? 'La siguiente se abre en un momento.' : 'La próxima se abre el ' + (datos.reanudacion.proxima | date:"EEEE d 'de' MMMM, h:mm a") + ', al empezar el horario.' }}
                </p>
                <button type="button" (click)="detenerRondas()" [disabled]="trabajando" class="mt-2 text-sm font-semibold text-red-700 hover:underline disabled:opacity-50">Detener las rondas</button>
              </div>
            }
            @if (datos.edicion.estado !== 'abierta') {
              <p class="text-sm text-gray-500 mt-1">Podrás abrir rondas cuando la edición esté abierta.</p>
            } @else if (!datos.fin_horario && sigueSola) {
              <!-- Fuera del horario y las rondas siguen solas: el aviso verde de arriba lo dice todo -->
            } @else if (!datos.fin_horario) {
              <p class="text-sm text-gray-500 mt-1">Estamos fuera del horario de la economía. Las rondas se abren dentro del horario.</p>
            } @else {
              <p class="text-sm text-gray-600 mt-3 font-semibold">¿Cuánto dura cada ronda?</p>
              <div class="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Duración de la ronda">
                @for (m of datos.duraciones; track m) {
                  <button type="button" role="radio" [attr.aria-checked]="duracion === m" (click)="duracion = m"
                          class="py-2.5 rounded-xl text-sm font-bold border-2" [class]="duracion === m ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'">{{ m }} min</button>
                }
              </div>
              <p class="text-xs text-gray-500 mt-3">Al terminar, se cierra sola y se abre la siguiente, hasta que acabe el horario ({{ datos.fin_horario | date:'h:mm a' }}).</p>
            }
@if (!(sigueSola && !datos.fin_horario)) {
                        <button type="button" (click)="abrirRonda()" [disabled]="trabajando || datos.edicion.estado !== 'abierta' || !datos.fin_horario"
                    class="mt-4 w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 disabled:opacity-40">
              {{ trabajando ? 'Abriendo…' : 'Abrir ronda ' + (datos.rondas.length + 1) + ' · ' + duracion + ' min' }}
            </button>
            }
          </div>
        }

        @if (aviso) {
          <p class="mt-3 rounded-xl px-4 py-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800" role="status">{{ aviso }}</p>
        }
        @if (error) {
          <p class="mt-3 rounded-xl px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700" role="alert">{{ error }}</p>
        }

        <!-- Pestañas -->
        <div class="mt-5 inline-flex gap-1 bg-white border border-gray-200 rounded-xl p-1" role="tablist">
          @for (v of vistas; track v.id) {
            <button type="button" role="tab" [attr.aria-selected]="vista === v.id" (click)="vista = v.id"
                    class="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5" [class]="vista === v.id ? 'bg-orange-100 text-orange-800' : 'text-gray-500 hover:bg-gray-100'">
              {{ v.texto }}
            </button>
          }
        </div>

        <!-- Invertir -->
        @if (vista === 'invertir') {
          @if (!datos.ronda) {
            <p class="mt-4 text-sm text-gray-500">Abre una ronda para recibir inversiones.</p>
          } @else {
            <input type="search" [(ngModel)]="busqueda" placeholder="Buscar estudiante…" aria-label="Buscar estudiante"
                   class="mt-4 w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
            <ul class="mt-3 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              @for (e of filtrados; track e.id) {
                <li class="flex items-center gap-3 px-4 py-3">
                  <div class="w-11 h-11 shrink-0 rounded-full text-white font-bold flex items-center justify-center" [style.background]="pais.color || '#0d9488'">{{ (e.nombre[0] || '') + (e.apellido[0] || '') }}</div>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-gray-800 truncate">{{ e.nombre }} {{ e.apellido }}</p>
                    <p class="text-xs text-gray-500">Tiene <b class="text-gray-700">{{ miles(e.saldo) }}</b>{{ invertidoPor(e) ? ' · invirtió ' + miles(invertidoPor(e)) : '' }}</p>
                  </div>
                  <button type="button" (click)="abrirInversion(e)" [disabled]="!e.saldo"
                          class="shrink-0 px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">Invertir</button>
                </li>
              }
              @if (!filtrados.length) { <li class="px-4 py-6 text-center text-sm text-gray-500">{{ pais.estudiantes.length ? 'Nadie coincide con «' + busqueda + '».' : 'No hay estudiantes en ' + pais.nombre + '.' }}</li> }
            </ul>

            @if (pais.inversiones.length) {
              <h2 class="mt-6 text-sm font-bold text-gray-700">Inversiones de esta ronda</h2>
              <ul class="mt-2 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
                @for (i of pais.inversiones; track i.id) {
                  <li class="flex items-center gap-3 px-4 py-3">
                    @if (fondo(i.fondo_id); as f) {
                      @if (f.logo) { <img [src]="logo(f)" alt="" class="w-10 h-10 rounded-xl object-cover shrink-0"> }
                      @else { <div class="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">{{ iniciales(f.nombre) }}</div> }
                    }
                    <div class="min-w-0 flex-1">
                      <p class="font-semibold text-gray-800 truncate">{{ i.nombre }} {{ i.apellido }}</p>
                      <p class="text-xs text-gray-500 truncate">{{ fondo(i.fondo_id)?.nombre }} · {{ i.date_created | date:'h:mm a' }}</p>
                    </div>
                    <p class="font-bold text-gray-800 whitespace-nowrap">{{ miles(i.monto) }}</p>
                  </li>
                }
              </ul>
            }
          }
        }

        <!-- Invertido: el dinero sigue en las empresas ronda tras ronda hasta que el estudiante lo retire -->
        @if (vista === 'invertido') {
          @if (pais.vigentes.length || pais.retiradas.length) {
            <input type="search" [(ngModel)]="busquedaInvertido" placeholder="Buscar estudiante o empresa…" aria-label="Buscar en las inversiones"
                   class="mt-4 w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
          }
          @if (busquedaInvertido && !vigentesFiltradas.length && !retiradasFiltradas.length) {
            <p class="mt-4 text-sm text-gray-500">Nadie coincide con «{{ busquedaInvertido }}».</p>
          } @else if (!pais.vigentes.length) {
            <p class="mt-4 text-sm text-gray-500">Nadie tiene dinero invertido. Lo que inviertan sigue en la empresa ronda tras ronda, ganando o perdiendo, hasta que pidan retirarlo.</p>
          } @else if (vigentesFiltradas.length) {
            <ul class="mt-4 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              @for (i of vigentesFiltradas; track i.id) {
                <li class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <div class="min-w-0 flex-1">
                      <p class="font-semibold text-gray-800 truncate">{{ i.nombre }} {{ i.apellido }}</p>
                      <p class="text-xs text-gray-500 truncate">{{ fondo(i.fondo_id)?.nombre }} · desde la {{ i.ronda }}</p>
                      <p class="text-sm mt-0.5 text-gray-500">Invirtió {{ miles(i.monto) }} → <b class="text-gray-800">hoy vale {{ miles(i.valor_actual) }}</b></p>
                    </div>
                    <div class="text-right shrink-0">
                      <p class="font-bold" [class]="ganancia(i) >= 0 ? 'text-emerald-700' : 'text-red-600'">{{ ganancia(i) >= 0 ? '+' : '−' }}{{ miles(abs(ganancia(i))) }}</p>
                      <button type="button" (click)="aRetirar = i" class="mt-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900">Retirar</button>
                    </div>
                  </div>
                  @if (i.historial?.length) {
                    <div class="mt-2 flex flex-wrap gap-1.5">
                      @for (h of i.historial; track $index) {
                        <span class="text-[11px] px-2 py-0.5 rounded-full" [class]="h.rendimiento >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'">{{ h.ronda }}: {{ porcentaje(h.rendimiento) }}</span>
                      }
                    </div>
                  }
                </li>
              }
            </ul>
          }
          @if (retiradasFiltradas.length) {
            <h2 class="mt-6 text-sm font-bold text-gray-700">Retiros</h2>
            <ul class="mt-2 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
              @for (i of retiradasFiltradas; track i.id) {
                <li class="flex items-center justify-between gap-3 px-4 py-3">
                  <div class="min-w-0">
                    <p class="font-semibold text-gray-800 truncate">{{ i.nombre }} {{ i.apellido }}</p>
                    <p class="text-xs text-gray-500 truncate">{{ fondo(i.fondo_id)?.nombre }} · invirtió {{ miles(i.monto) }} · {{ i.cobrado_en | date:'d MMM, h:mm a' }}</p>
                  </div>
                  <p class="font-bold whitespace-nowrap text-gray-800">{{ miles(i.monto_pagado) }}</p>
                </li>
              }
            </ul>
          }
        }

        <!-- Resultados -->
        @if (vista === 'resultados') {
          <wg-grafica-rendimiento class="block mt-4" [fondos]="datos.fondos" [rondas]="cronologicas" />
          @if (!cerradas.length) {
            <p class="mt-4 text-sm text-gray-500">Aquí verás cuánto ganó o perdió cada empresa cuando cierres una ronda.</p>
          }
          @for (r of cerradas; track r.id) {
            <section class="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 class="font-bold text-gray-800">{{ r.nombre }}</h2>
                <span class="text-xs text-gray-500">{{ r.apertura | date:'d MMM, h:mm a' }} – {{ r.cierre | date:'h:mm a' }}</span>
              </div>
              <ul class="divide-y divide-gray-100">
                @for (x of ordenados(r.resultados); track x.fondo_id) {
                  <li class="flex items-center gap-3 px-4 py-3">
                    @if (fondo(x.fondo_id); as f) {
                      @if (f.logo) { <img [src]="logo(f)" alt="" class="w-10 h-10 rounded-xl object-cover shrink-0"> }
                      @else { <div class="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">{{ iniciales(x.fondo) }}</div> }
                    }
                    <p class="flex-1 font-semibold text-gray-800 truncate">{{ x.fondo }}</p>
                    <span class="px-2.5 py-1 rounded-full text-sm font-bold" [class]="x.rendimiento >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'">{{ porcentaje(x.rendimiento) }}</span>
                  </li>
                }
              </ul>
            </section>
          }
        }
      }
    </div>

    <!-- Invertir: elegir empresa y billetes -->
    @if (estudiante && pais && datos) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="cerrarPanel()">
        <div class="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-inversion">
          <div class="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 id="titulo-inversion" class="text-lg font-bold text-gray-800">{{ empresa ? 'Billetes que entrega' : '¿En qué empresa invierte?' }}</h2>
              <p class="text-sm text-gray-500 truncate">{{ estudiante.nombre }} {{ estudiante.apellido }} · tiene {{ miles(estudiante.saldo) }}</p>
            </div>
            <button type="button" (click)="cerrarPanel()" class="p-1 text-gray-400 hover:text-gray-600" aria-label="Cerrar">✕</button>
          </div>
          <div class="flex-1 overflow-y-auto px-5 pb-3">
            @if (!empresa) {
              <div class="space-y-3">
                @for (f of activos; track f.id) {
                  <button type="button" (click)="empresa = f" class="w-full text-left rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-400">
                    <wg-tarjeta-fondo [fondo]="f" [logoUrl]="logo(f)" />
                  </button>
                }
              </div>
            } @else {
              <div class="flex items-center gap-3 mb-4 p-3 rounded-2xl bg-gray-50 border border-gray-200">
                @if (empresa.logo) { <img [src]="logo(empresa)" alt="" class="w-12 h-12 rounded-xl object-cover"> }
                @else { <div class="w-12 h-12 rounded-xl bg-slate-200 text-slate-700 font-bold flex items-center justify-center">{{ iniciales(empresa.nombre) }}</div> }
                <div class="flex-1 min-w-0">
                  <p class="font-bold text-gray-800 truncate">{{ empresa.nombre }}</p>
                  <span class="text-xs font-semibold px-2 py-0.5 rounded-full" [class]="riesgo(empresa).clase">{{ riesgo(empresa).texto }}</span>
                </div>
                <button type="button" (click)="empresa = null" class="text-sm font-semibold text-orange-600 hover:underline">Cambiar</button>
              </div>
              <wg-selector-billetes [pais]="pais" [denominaciones]="datos.denominaciones" [elegidos]="elegidos" [topeTotal]="estudiante.saldo" />
            }
          </div>
          @if (empresa) {
            <div class="px-5 py-4 border-t border-gray-100">
              @if (errorPanel) { <p class="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ errorPanel }}</p> }
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm text-gray-500">Invierte en {{ empresa.nombre }}</span>
                <span class="text-2xl font-extrabold text-gray-800 break-all">{{ miles(total) }} <span class="text-sm font-semibold text-gray-500">{{ pais.codigo_moneda }}</span></span>
              </div>
              <button type="button" (click)="invertir()" [disabled]="!total || enviando || total > estudiante.saldo"
                      class="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">
                {{ enviando ? 'Guardando…' : (total ? 'Invertir ' + miles(total) : 'Elige los billetes') }}
              </button>
            </div>
          }
        </div>
      </div>
    }

    <!-- Confirmar retiro de una inversión -->
    @if (aRetirar) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="aRetirar = null">
        <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-retiro">
          <h2 id="titulo-retiro" class="text-lg font-bold text-gray-800">¿Retirar la inversión de {{ aRetirar.nombre }}?</h2>
          <p class="text-sm text-gray-600 mt-2">
            Sale de <b>{{ fondo(aRetirar.fondo_id)?.nombre }}</b> y recibe <b>{{ miles(aRetirar.valor_actual) }}</b> en su saldo
            (invirtió {{ miles(aRetirar.monto) }}). Ese dinero ya no sigue ganando ni perdiendo.
          </p>
          @if (errorPanel) { <p class="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ errorPanel }}</p> }
          <div class="mt-5 flex gap-2">
            <button type="button" (click)="aRetirar = null" class="flex-1 py-3 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200">Cancelar</button>
            <button type="button" (click)="retirar()" [disabled]="enviando" class="flex-1 py-3 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50">{{ enviando ? 'Retirando…' : 'Retirar ' + miles(aRetirar.valor_actual) }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Confirmar cierre de ronda -->
    @if (confirmarCierre && datos?.ronda) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="confirmarCierre = false">
        <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-cierre">
          <h2 id="titulo-cierre" class="text-lg font-bold text-gray-800">¿Cerrar {{ datos!.ronda!.nombre }} ahora?</h2>
          <p class="text-sm text-gray-600 mt-2">Se calcula cuánto ganó o perdió cada empresa y se actualiza lo que vale cada inversión; el dinero sigue invertido en la ronda siguiente. Se cierra para todos los países de la edición.</p>
          <div class="mt-5 space-y-2">
            <button type="button" (click)="cerrarRonda(true)" [disabled]="trabajando" class="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 disabled:opacity-50">
              {{ trabajando ? 'Cerrando…' : 'Cerrar y abrir la siguiente' }}
            </button>
            <button type="button" (click)="cerrarRonda(false)" [disabled]="trabajando" class="w-full py-3 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50">Cerrar y detener las rondas</button>
            <button type="button" (click)="confirmarCierre = false" class="w-full py-3 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200">Cancelar</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class WfundsWillGo implements OnInit, OnDestroy {
  private willGo = inject(WillGoService);
  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);
  readonly Number = Number;
  readonly vistas: { id: Vista; texto: string }[] = [
    { id: 'invertir', texto: 'Invertir' },
    { id: 'invertido', texto: 'Invertido' },
    { id: 'resultados', texto: 'Resultados' },
  ];

  ediciones: EdicionVigente[] = [];
  edicionId = '';
  datos: DatosWfunds | null = null;
  pais: PaisWfunds | null = null;
  vista: Vista = 'invertir';
  busqueda = '';
  cargando = true;
  trabajando = false;
  confirmarCierre = false;
  error = '';
  aviso = '';

  estudiante: Estudiante | null = null;
  empresa: FondoWfunds | null = null;
  elegidos: Record<number, number | null> = {};
  clave = '';
  enviando = false;
  errorPanel = '';

  duracion = 30;
  /** Milisegundos que faltan para que cierre la ronda (con la hora del servidor). */
  restante = 0;
  private desfase = 0;
  private reloj$: ReturnType<typeof setInterval> | null = null;
  private refresco$: ReturnType<typeof setInterval> | null = null;
  private ultimaRecarga = 0;

  ngOnDestroy(): void {
    if (this.reloj$) clearInterval(this.reloj$);
    if (this.refresco$) clearInterval(this.refresco$);
  }

  /** Cada segundo actualiza la cuenta regresiva; cuando llega a 0 recarga hasta ver la ronda cerrada. */
  private tic(): void {
    const cierre = this.datos?.ronda?.cierre_programado;
    this.restante = cierre ? new Date(cierre).getTime() - (Date.now() + this.desfase) : 0;
    if (cierre && this.restante <= 0 && !this.cargando && Date.now() - this.ultimaRecarga > 5000) {
      this.ultimaRecarga = Date.now();
      this.cargar();
    }
  }

  get reloj(): string {
    const s = Math.max(0, Math.ceil(this.restante / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    const dos = (n: number) => String(n).padStart(2, '0');
    return h ? `${h}:${dos(m)}:${dos(x)}` : `${dos(m)}:${dos(x)}`;
  }

  /** La ronda dura menos de lo elegido porque se acaba el horario. */
  recortada(r: { apertura: string; cierre_programado: string | null; duracion_minutos: number | null }): boolean {
    if (!r.cierre_programado || !r.duracion_minutos) return false;
    return new Date(r.cierre_programado).getTime() - new Date(r.apertura).getTime() < r.duracion_minutos * 60000 - 1000;
  }

  ngOnInit(): void {
    this.willGo.misEdiciones().subscribe({
      next: (l) => { this.ediciones = l; this.edicionId = l[0]?.id ?? ''; if (this.edicionId) this.cargar(); else this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  cargar(): void {
    this.cargando = true;
    this.willGo.wfunds(this.edicionId).subscribe({
      next: (d) => {
        this.datos = d;
        this.cronologicas = d.rondas.filter((r) => r.estado !== 'abierta').reverse();
        this.desfase = new Date(d.ahora).getTime() - Date.now();
        if (d.ronda?.duracion_minutos) this.duracion = d.ronda.duracion_minutos;
        else if (d.reanudacion?.duracion) this.duracion = d.reanudacion.duracion;
        this.pais = d.paises.find((p) => p.id === this.pais?.id) ?? d.paises[0] ?? null;
        if (!this.reloj$) this.reloj$ = setInterval(() => this.tic(), 1000);
        if (!this.refresco$) this.refresco$ = setInterval(() => { if (!this.estudiante && !this.aRetirar && !this.confirmarCierre && !this.enviando && !this.trabajando) this.cargar(); }, 20000);
        this.tic();
        this.cargando = false;
      },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  elegirPais(p: PaisWfunds): void { this.pais = p; this.busqueda = ''; this.busquedaInvertido = ''; }

  get filtrados(): Estudiante[] {
    const palabras = normalizar(this.busqueda).split(/\s+/).filter(Boolean);
    return (this.pais?.estudiantes ?? []).filter((e) => { const n = normalizar(`${e.nombre} ${e.apellido}`); return palabras.every((w) => n.includes(w)); });
  }

  get activos(): FondoWfunds[] { return (this.datos?.fondos ?? []).filter((f) => f.activo); }
  busquedaInvertido = '';
  /** Filtra por nombre del estudiante o de la empresa (sin importar tildes ni mayúsculas). */
  private filtrarInversiones(lista: InversionWfunds[]): InversionWfunds[] {
    const palabras = normalizar(this.busquedaInvertido).split(/\s+/).filter(Boolean);
    if (!palabras.length) return lista;
    return lista.filter((i) => { const t = normalizar(`${i.nombre} ${i.apellido} ${this.fondo(i.fondo_id)?.nombre ?? ''}`); return palabras.every((w) => t.includes(w)); });
  }
  get vigentesFiltradas(): InversionWfunds[] { return this.filtrarInversiones(this.pais?.vigentes ?? []); }
  get retiradasFiltradas(): InversionWfunds[] { return this.filtrarInversiones(this.pais?.retiradas ?? []); }

  /** Las rondas se reanudan solas al empezar la siguiente franja del horario. */
  get sigueSola(): boolean { return !!(this.datos?.edicion.estado === 'abierta' && this.datos.reanudacion?.automaticas && this.datos.reanudacion.proxima); }

  get cerradas() { return (this.datos?.rondas ?? []).filter((r) => r.estado !== 'abierta'); }
  /** Rondas cerradas de la más vieja a la más nueva (para la gráfica); se recalcula solo cuando cambian los datos. */
  cronologicas: DatosWfunds['rondas'] = [];
  /** Lo que valen hoy todas las inversiones vigentes del país. */
  get totalInvertido(): number { return (this.pais?.vigentes ?? []).reduce((t, i) => t + Number(i.valor_actual ?? i.monto), 0); }
  get total(): number { return (this.datos?.denominaciones ?? []).reduce((t, d) => t + d * (Number(this.elegidos[d]) || 0), 0); }

  invertidoPor(e: Estudiante): number {
    return (this.pais?.inversiones ?? []).filter((i) => i.participante_id === e.id).reduce((t, i) => t + Number(i.monto), 0);
  }

  fondo(id: string): FondoWfunds | undefined { return this.datos?.fondos.find((f) => f.id === id); }
  logo(f: FondoWfunds): string | null { return f.logo ? this.willGo.urlFoto(f.logo) : null; }
  riesgo(f: FondoWfunds) { return RIESGO[f.riesgo] ?? RIESGO['medio']; }
  iniciales(n: string): string { return n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase(); }
  ordenados<T extends { rendimiento: number }>(l: T[]): T[] { return [...l].sort((a, b) => b.rendimiento - a.rendimiento); }

  porcentaje(r: unknown): string {
    const v = Number(r) * 100;
    return `${v > 0 ? '+' : ''}${v.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`;
  }

  private temporizadorAviso: ReturnType<typeof setTimeout> | null = null;
  /** Muestra un aviso 5 s; si llega otro antes, el nuevo dura sus 5 s completos. */
  private mostrarAviso(texto: string): void {
    this.aviso = texto;
    if (this.temporizadorAviso) clearTimeout(this.temporizadorAviso);
    this.temporizadorAviso = setTimeout(() => (this.aviso = ''), 5000);
  }

  detenerRondas(): void {
    if (!this.datos) return;
    this.trabajando = true;
    this.error = '';
    this.willGo.detenerRondas(this.datos.edicion.id).subscribe({
      next: () => { this.trabajando = false; this.mostrarAviso('Rondas detenidas. No se abrirán solas hasta que abras una.'); this.cargar(); },
      error: (e) => { this.trabajando = false; this.error = WillGoService.mensajeDeError(e); },
    });
  }

  abrirRonda(): void {
    if (!this.datos) return;
    this.trabajando = true;
    this.error = '';
    this.willGo.abrirRonda(this.datos.edicion.id, this.duracion).subscribe({
      next: (r) => { this.trabajando = false; this.vista = 'invertir'; this.mostrarAviso(`${r.nombre} abierta. Ya pueden invertir.`); this.cargar(); },
      error: (e) => { this.trabajando = false; this.error = WillGoService.mensajeDeError(e); },
    });
  }

  cerrarRonda(continuar: boolean): void {
    const r = this.datos?.ronda;
    if (!r) return;
    this.trabajando = true;
    this.error = '';
    this.willGo.cerrarRonda(r.id, continuar).subscribe({
      next: (x) => {
        this.trabajando = false;
        this.confirmarCierre = false;
        this.vista = 'invertido';
        this.mostrarAviso(`${r.nombre} cerrada: lo invertido pasó de ${this.miles(x.valor_antes)} a ${this.miles(x.valor_despues)}.${x.siguiente ? ` Abierta ${x.siguiente.nombre}.` : ''}`);
        this.cargar();
      },
      error: (e) => { this.trabajando = false; this.confirmarCierre = false; this.error = WillGoService.mensajeDeError(e); },
    });
  }

  abrirInversion(e: Estudiante): void {
    this.estudiante = e;
    this.empresa = null;
    this.elegidos = {};
    this.errorPanel = '';
    this.clave = crypto.randomUUID();
  }

  cerrarPanel(): void {
    if (this.enviando) return;
    this.estudiante = null;
  }

  /** Ganancia (o pérdida, negativa) de una inversión liquidada. */
  ganancia(i: InversionWfunds): number { return Number(i.valor_actual ?? i.monto) - Number(i.monto); }

  aRetirar: InversionWfunds | null = null;
  retirar(): void {
    const i = this.aRetirar;
    if (!i || this.enviando) return;
    this.enviando = true;
    this.errorPanel = '';
    this.willGo.retirarInversion(i.id).subscribe({
      next: (r) => { this.enviando = false; this.aRetirar = null; this.mostrarAviso(`${i.nombre} retiró ${this.miles(r.monto_pagado)} de ${this.fondo(i.fondo_id)?.nombre}.`); this.cargar(); },
      error: (e) => { this.enviando = false; this.errorPanel = WillGoService.mensajeDeError(e); },
    });
  }
  abs(v: number): number { return Math.abs(v); }

  private billetesElegidos(): Record<string, number> {
    const b: Record<string, number> = {};
    for (const d of this.datos!.denominaciones) { const n = Number(this.elegidos[d]) || 0; if (n) b[d] = n; }
    return b;
  }

  invertir(): void {
    const e = this.estudiante, f = this.empresa, r = this.datos?.ronda;
    if (!e || !f || !r || !this.total) return;
    this.enviando = true;
    this.errorPanel = '';
    this.willGo.invertir(e.id, f.id, r.id, this.billetesElegidos(), this.clave).subscribe({
      next: (x) => { this.enviando = false; this.estudiante = null; this.mostrarAviso(`${e.nombre} invirtió ${this.miles(x.monto)} en ${f.nombre}.`); this.cargar(); },
      error: (err) => { this.enviando = false; this.errorPanel = WillGoService.mensajeDeError(err); },
    });
  }

}
