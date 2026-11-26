import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CajaCajero, DatosCaja, EstudianteCaja, PaisCaja, ProductoCaja, VentaCaja, WillGoService, EdicionVigente } from '../../../../core/services/will-go.service';
import { EscanerQrComponent } from '../../escaner-qr.component';
import { NumeroMilesDirective, formatearNumero } from '../../numero-miles.directive';
import { SelectorEdicionComponent } from '../../selector-edicion.component';
import { FechaWillGoPipe } from '../../fecha.pipe';
import { precioEnBilletes } from '../ediciones/estado-edicion';

type Vista = 'vender' | 'caja' | 'ventas';
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const sumaBilletes = (b: Record<number, number | null>) => Object.entries(b).reduce((t, [d, n]) => t + Number(d) * (Number(n) || 0), 0);
/** Llave de tarjeta como la guarda el servidor: minúsculas y con @ adelante. */
const normalizarLlave = (t: string) => { const l = t.trim().toLowerCase(); return l.startsWith('@') ? l : '@' + l; };
/** Pasos para redondear hacia arriba lo que entrega el estudiante (sugerencias de «¿Con cuánto paga?»). */
const PASOS_REDONDEO = [10, 50, 100, 500, 1000, 5000, 10000, 50000];

/** Caja GO•STORE: el encargado vende los productos y cobra en efectivo (con cuánto paga y el vuelto, como montos) o con la tarjeta débito del estudiante. */
@Component({
  selector: 'app-caja-will-go',
  standalone: true,
  imports: [FormsModule, NumeroMilesDirective, FechaWillGoPipe, SelectorEdicionComponent, EscanerQrComponent, TranslatePipe],
  template: `
    <div class="max-w-3xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <h1 class="sr-only">{{ 'wg.operacion.caja.titulo' | translate }}</h1>
          <img src="assets/images/will-go/gostore-logo.png" alt="GO.STORE · Earn · Shop · Take Home" class="h-14 sm:h-16 w-auto max-w-full -ml-1">
          <p class="text-gray-500 mt-2">{{ 'wg.operacion.caja.subtitulo' | translate }}</p>
        </div>
      </div>
      <wg-selector-edicion class="block mt-4" [ediciones]="ediciones" [(edicionId)]="edicionId" (cambio)="cargar()" />

      @if (cargando && !datos) {
        <div class="mt-5 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.operacion.comun.cargando' | translate }}</div>
      } @else if (error && !datos) {
        <div class="mt-5 bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
      } @else if (!ediciones.length) {
        <div class="mt-5 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">{{ 'wg.operacion.comun.sinEquipo' | translate }}</div>
      } @else if (datos) {
        @if (datos.puede_vender && datos.edicion.estado !== 'abierta') {
          <p class="mt-4 rounded-xl px-4 py-3 text-sm bg-gray-100 text-gray-600">{{ 'wg.operacion.caja.podrasVender' | translate }}</p>
        }
        @if (aviso) { <p class="mt-3 rounded-xl px-4 py-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800" role="status">{{ aviso }}</p> }
        @if (error) { <p class="mt-3 rounded-xl px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700" role="alert">{{ error }}</p> }

        <div class="mt-5 inline-flex gap-1 bg-white border border-gray-200 rounded-xl p-1" role="tablist">
          @for (v of vistas; track v.id) {
            <button type="button" role="tab" [attr.aria-selected]="vista === v.id" (click)="vista = v.id"
                    class="px-5 py-2 rounded-lg text-sm font-semibold" [class]="vista === v.id ? 'bg-orange-100 text-orange-800' : 'text-gray-500 hover:bg-gray-100'">{{ v.texto | translate }}</button>
          }
        </div>

        @if (vista === 'vender') {
        @if (!estudiante && etapa === 'productos') {
          <!-- PASO 1: productos -->
          <div class="mt-5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 class="text-lg font-bold text-gray-800">{{ 'wg.operacion.caja.paso1' | translate }}</h2>
            <p class="text-xs text-gray-500">
              @for (pa of datos.paises; track pa.id; let ultimo = $last) {
                <span class="font-semibold" [style.color]="pa.color || '#374151'">1 {{ pa.codigo_moneda }} = {{ miles(pa.tasa_actual) }}</span>@if (!ultimo) { · }
              } pesos
            </p>
          </div>
          <ul class="mt-3 space-y-3">
            @for (p of datos.productos; track p.id) {
              <li class="bg-white rounded-2xl border p-3 flex items-center gap-3 transition" [class]="cantidad(p) ? 'border-orange-300 ring-2 ring-orange-100' : 'border-gray-200'" [class.opacity-50]="!disponible(p)">
                <div class="w-16 h-16 shrink-0 rounded-xl bg-orange-50 overflow-hidden flex items-center justify-center">
                  @if (p.foto) { <img [src]="urlFoto(p.foto)" [alt]="p.nombre" class="w-full h-full object-cover"> } @else { <span class="text-3xl" aria-hidden="true">🛍️</span> }
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-gray-800 truncate">{{ p.nombre }}</p>
                  <div class="mt-1 flex flex-wrap gap-1.5">
                    @if (p.descuento) { <span class="rounded-md px-2 py-0.5 text-xs font-extrabold bg-red-100 text-red-700">-{{ p.descuento }}%</span> }
                    @for (pa of datos.paises; track pa.id) {
                      <span class="rounded-md px-2 py-0.5 text-xs font-extrabold" [style.color]="pa.color || '#111827'" [style.background]="(pa.color || '#64748b') + '14'">{{ miles(precioEn(p, pa)) }} {{ pa.codigo_moneda }}</span>
                    }
                  </div>
                  <p class="text-xs text-gray-500 mt-1">{{ textoDisponible(p) }}</p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <button type="button" (click)="sumar(p, -1)" [disabled]="!cantidad(p)" class="w-9 h-9 p-0 rounded-lg bg-gray-100 text-lg font-bold text-gray-700 disabled:opacity-30" [attr.aria-label]="'wg.operacion.caja.quitar' | translate: { nombre: p.nombre }">−</button>
                  <span class="w-7 text-center font-bold">{{ cantidad(p) }}</span>
                  <button type="button" (click)="sumar(p, 1)" [disabled]="!puedeSumar(p)" class="w-9 h-9 p-0 rounded-lg bg-gray-100 text-lg font-bold text-gray-700 disabled:opacity-30" [attr.aria-label]="'wg.operacion.caja.agregar' | translate: { nombre: p.nombre }">+</button>
                </div>
              </li>
            }
            @if (!datos.productos.length) { <li class="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">{{ 'wg.operacion.caja.sinProductos' | translate }}</li> }
          </ul>
        } @else if (!estudiante) {
          <!-- PASO 2: quién compra -->
          <button type="button" (click)="etapa = 'productos'" class="block mt-5 text-sm font-semibold text-orange-600 hover:underline p-0">← {{ 'wg.operacion.caja.volverProductos' | translate }}</button>
          <h2 class="mt-2 text-lg font-bold text-gray-800">{{ 'wg.operacion.caja.eligeEstudiante' | translate }}</h2>
          <p class="text-sm text-gray-500">{{ resumenCarrito }}</p>
          <div class="mt-3 flex flex-col sm:flex-row gap-2">
            <input type="search" [(ngModel)]="busqueda" [placeholder]="'wg.operacion.comun.buscarEstudiante' | translate" [attr.aria-label]="'wg.operacion.comun.buscarEstudianteAria' | translate"
                   class="flex-1 min-w-0 w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
            <button type="button" (click)="abrirEscaner('estudiante')"
                    class="shrink-0 px-4 py-3 rounded-xl font-semibold text-white bg-slate-800 hover:bg-slate-700 flex items-center justify-center gap-2">
              <span aria-hidden="true">💳</span> {{ 'wg.tarjeta.escanearTarjeta' | translate }}
            </button>
          </div>
          <ul class="mt-3 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            @for (e of filtrados; track e.id) {
              <li>
                <button type="button" (click)="elegir(e)" class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
                  <span class="w-3 h-10 rounded-full shrink-0" [style.background]="pais(e.pais_id)?.color || '#94a3b8'" aria-hidden="true"></span>
                  <span class="min-w-0 flex-1">
                    <span class="block font-semibold text-gray-800 truncate">{{ e.nombre }} {{ e.apellido }}</span>
                    <span class="block text-xs text-gray-500">{{ pais(e.pais_id)?.nombre }} · {{ 'wg.tarjeta.efectivo' | translate }} <b class="text-gray-700">{{ miles(e.saldo) }}</b> · {{ 'wg.tarjeta.cuenta' | translate }} <b class="text-gray-700">{{ miles(e.cuenta) }}</b> {{ pais(e.pais_id)?.codigo_moneda }}</span>
                  </span>
                  <span class="text-right shrink-0">
                    <span class="block font-extrabold" [style.color]="noLeAlcanza(e) ? '#dc2626' : (pais(e.pais_id)?.color || '#111827')">{{ miles(totalPara(e)) }} {{ pais(e.pais_id)?.codigo_moneda }}</span>
                    <span class="block text-[11px]" [class]="noLeAlcanza(e) ? 'text-red-600 font-semibold' : 'text-gray-400'">{{ (noLeAlcanza(e) ? 'wg.operacion.caja.noLeAlcanza' : 'wg.operacion.caja.leCuesta') | translate }}</span>
                  </span>
                </button>
              </li>
            }
            @if (!filtrados.length) { <li class="px-4 py-6 text-center text-sm text-gray-500">{{ datos.estudiantes.length ? ('wg.operacion.comun.nadieCoincide' | translate: { q: busqueda }) : ('wg.operacion.caja.sinEstudiantesPais' | translate) }}</li> }
          </ul>
        } @else {
          <!-- Estudiante elegido: revisar y cobrar -->
          <button type="button" (click)="cambiarEstudiante()" class="block mt-5 text-sm font-semibold text-orange-600 hover:underline p-0">← {{ 'wg.operacion.caja.cambiarEstudiante' | translate }}</button>
          <div class="mt-2 rounded-2xl p-4 text-white shadow" [style.background]="paisEst?.color || '#1e293b'">
            <p class="text-xs opacity-90">{{ paisEst?.nombre }} · 1 {{ paisEst?.codigo_moneda }} = {{ miles(paisEst?.tasa_actual) }} pesos</p>
            <p class="text-lg font-extrabold truncate">{{ estudiante.nombre }} {{ estudiante.apellido }}</p>
            <p class="text-sm opacity-95">{{ 'wg.tarjeta.efectivo' | translate }} <b>{{ miles(estudiante.saldo) }} {{ paisEst?.codigo_moneda }}</b> · {{ 'wg.tarjeta.cuenta' | translate }} <b>{{ miles(estudiante.cuenta) }} {{ paisEst?.codigo_moneda }}</b></p>
            @if (llaveLeida) { <p class="mt-1 inline-block rounded-md bg-white/20 px-2 py-0.5 text-xs font-semibold">💳 {{ 'wg.tarjeta.identificadoTarjeta' | translate: { llave: llaveLeida } }}</p> }
          </div>
          <ul class="mt-3 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            @for (p of enCarrito; track p.id) {
              <li class="px-4 py-3 flex items-center gap-3">
                <span class="font-bold text-gray-800 w-8">{{ cantidad(p) }} ×</span>
                <span class="flex-1 min-w-0">
                  <span class="block text-gray-800 truncate">{{ p.nombre }}</span>
                  @if (cantidad(p) > maximoDe(p)) { <span class="block text-xs font-semibold text-red-600">{{ avisoMaximo(p) }}</span> }
                </span>
                <span class="font-extrabold" [style.color]="paisEst?.color || '#111827'">{{ miles(precio(p) * cantidad(p)) }} {{ paisEst?.codigo_moneda }}</span>
              </li>
            }
          </ul>
        }
        }

        <!-- MOVIMIENTOS: ventas y entregas al banco -->
        @if (vista === 'ventas') {
          <!-- Dinero que hay en la caja de cada país (solo el monto) -->
          <h2 class="mt-5 text-sm font-bold text-gray-700">{{ (datos.es_admin ? 'wg.operacion.caja.totalCajas' : 'wg.operacion.caja.tuCaja') | translate }}</h2>
          <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            @for (p of datos.paises; track p.id) {
              <section class="rounded-2xl p-4 text-white shadow-sm flex items-center gap-3" [style.background]="p.color || '#1e293b'">
                <div class="flex-1 min-w-0">
                  <p class="text-sm opacity-90">{{ 'wg.operacion.caja.cajaDe' | translate: { pais: p.nombre } }}</p>
                  <p class="text-2xl font-extrabold break-all">{{ miles(p.saldo_caja) }} <span class="text-sm font-semibold opacity-90">{{ p.codigo_moneda }}</span></p>
                </div>
                @if (datos.puede_vender && !datos.es_admin && p.saldo_caja > 0) {
                  <button type="button" (click)="abrirEntrega(p)" class="shrink-0 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-semibold">{{ 'wg.operacion.caja.entregarAlBanco' | translate }}</button>
                }
              </section>
            }
          </div>
          <!-- Administrativo: la caja de cada cajero (cada uno lleva su propio efectivo) -->
          @if (datos.es_admin && datos.cajas?.length) {
            <h2 class="mt-6 text-sm font-bold text-gray-700">{{ 'wg.operacion.caja.cajasPorCajero' | translate }}</h2>
            <ul class="mt-2 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
              @for (c of datos.cajas; track (c.usuario_id ?? 'general') + c.pais_id) {
                <li class="px-4 py-3 flex items-center gap-3">
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" [style.background]="pais(c.pais_id)?.color || '#64748b'"></span>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-gray-800 truncate">{{ c.usuario_id ? c.nombre : ('wg.operacion.caja.cajaGeneral' | translate) }}</p>
                    <p class="text-xs text-gray-500">{{ pais(c.pais_id)?.nombre }}</p>
                  </div>
                  <p class="font-bold text-gray-800 whitespace-nowrap">{{ miles(c.saldo) }} <span class="text-xs font-semibold text-gray-500">{{ pais(c.pais_id)?.codigo_moneda }}</span></p>
                  @if (c.saldo > 0) {
                    <button type="button" (click)="abrirEntregaDe(c)" class="shrink-0 px-3 py-1.5 rounded-lg border border-orange-200 text-sm font-semibold text-orange-700 hover:bg-orange-50">{{ 'wg.operacion.caja.entregar' | translate }}</button>
                  }
                </li>
              }
            </ul>
          }
          <h2 class="mt-6 text-sm font-bold text-gray-700">{{ 'wg.operacion.caja.ventasTitulo' | translate }}</h2>
          @if (!datos.ventas.length) {
            <p class="mt-4 text-sm text-gray-500">{{ 'wg.operacion.caja.sinVentas' | translate }}</p>
          } @else {
            <ul class="mt-4 space-y-3">
              @for (v of datos.ventas; track v.id) {
                <li class="bg-white rounded-2xl border border-gray-200 p-4">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="font-semibold text-gray-800 truncate">{{ v.nombre }} {{ v.apellido }}</p>
                      <p class="text-xs text-gray-500">{{ v.numero_recibo }} · {{ v.date_created | wgFecha:'d MMM, h:mm a' }}@if (datos.es_admin && v.cajero) { · {{ 'wg.operacion.caja.cobro' | translate: { nombre: v.cajero } }} }</p>
                    </div>
                    <!-- En efectivo entra a la caja (verde, «+»); con tarjeta va al banco, no a la caja (gris) -->
                    @if (v.metodo_pago === 'tarjeta') {
                      <p class="font-extrabold whitespace-nowrap text-gray-700">{{ miles(v.total_billetes) }} <span class="text-xs font-semibold text-gray-500">{{ pais(v.pais_id)?.codigo_moneda }}</span></p>
                    } @else {
                      <p class="font-extrabold whitespace-nowrap text-emerald-700">+{{ miles(v.total_billetes) }} <span class="text-xs font-semibold text-emerald-600">{{ pais(v.pais_id)?.codigo_moneda }}</span></p>
                    }
                  </div>
                  <p class="text-sm text-gray-600 mt-1">{{ textoItems(v) }}</p>
                  @if (v.metodo_pago === 'tarjeta') {
                    <p class="text-xs mt-0.5"><span class="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700">💳 {{ 'wg.tarjeta.pagadoTarjeta' | translate }}</span></p>
                  } @else {
                    <p class="text-xs text-gray-500 mt-0.5"><span class="rounded-md bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">{{ 'wg.tarjeta.efectivo' | translate }}</span>@if (suma(v.billetes_recibidos)) { · {{ 'wg.operacion.caja.entrego' | translate: { n: miles(suma(v.billetes_recibidos)) } }}{{ suma(v.billetes_vuelto) ? ' · ' + ('wg.operacion.caja.vueltoN' | translate: { n: miles(suma(v.billetes_vuelto)) }) : '' }} }</p>
                  }
                </li>
              }
            </ul>
          }
          @if (datos.entregas.length) {
            <h2 class="mt-6 text-sm font-bold text-gray-700">{{ 'wg.operacion.caja.entregasAlBanco' | translate }}</h2>
            <ul class="mt-2 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
              @for (t of datos.entregas; track t.id) {
                <li class="px-4 py-3 flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-semibold text-gray-800">{{ 'wg.operacion.caja.alBancoDe' | translate: { pais: pais(t.pais_id)?.nombre } }}</p>
                    <p class="text-xs text-gray-500">{{ t.date_created | wgFecha:'d MMM, h:mm a' }}{{ t.quien ? ' · ' + t.quien : '' }}</p>
                  </div>
                  <!-- Sale de la caja: en rojo y con «−» -->
                  <p class="font-bold text-red-600 whitespace-nowrap">−{{ miles(t.monto) }} <span class="text-xs font-semibold text-red-400">{{ pais(t.pais_id)?.codigo_moneda }}</span></p>
                </li>
              }
            </ul>
          }
        }
      }

      <!-- Carrito fijo abajo -->
      @if (vista === 'vender' && datos && unidades && !estudiante && etapa === 'productos') {
        <div class="sticky bottom-0 sm:bottom-4 z-30 mt-6 -mx-4 sm:mx-0 bg-white border-t sm:border border-gray-200 sm:rounded-2xl shadow-[0_-6px_20px_rgba(0,0,0,.08)] sm:shadow-lg px-4 py-3">
          <div class="flex items-center gap-3">
            <p class="flex-1 min-w-0 font-bold text-gray-800">{{ unidades }} {{ (unidades === 1 ? 'wg.operacion.comun.producto' : 'wg.operacion.comun.productos') | translate }}</p>
            <button type="button" (click)="etapa = 'estudiante'; busqueda = ''"
                    class="shrink-0 px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600">{{ 'wg.operacion.caja.siguienteEstudiante' | translate }} →</button>
          </div>
        </div>
      }
      @if (vista === 'vender' && estudiante && datos && unidades) {
        <div class="sticky bottom-0 sm:bottom-4 z-30 mt-6 -mx-4 sm:mx-0 bg-white border-t sm:border border-gray-200 sm:rounded-2xl shadow-[0_-6px_20px_rgba(0,0,0,.08)] sm:shadow-lg px-4 py-3">
          <div class="mb-3 grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1" role="radiogroup" [attr.aria-label]="'wg.tarjeta.formaPago' | translate">
            <button type="button" role="radio" [attr.aria-checked]="metodo === 'efectivo'" (click)="metodo = 'efectivo'"
                    class="py-2 rounded-lg text-sm font-semibold" [class]="metodo === 'efectivo' ? 'bg-white shadow text-emerald-700' : 'text-gray-500'">💵 {{ 'wg.tarjeta.efectivo' | translate }}</button>
            <button type="button" role="radio" [attr.aria-checked]="metodo === 'tarjeta'" (click)="metodo = 'tarjeta'"
                    class="py-2 rounded-lg text-sm font-semibold" [class]="metodo === 'tarjeta' ? 'bg-white shadow text-slate-800' : 'text-gray-500'">💳 {{ 'wg.tarjeta.tarjeta' | translate }}</button>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-xs text-gray-500">{{ unidades }} {{ (unidades === 1 ? 'wg.operacion.comun.producto' : 'wg.operacion.comun.productos') | translate }}</p>
              <p class="text-xl font-extrabold" [class]="total > disponibleMetodo ? 'text-red-600' : 'text-gray-800'">{{ miles(total) }} {{ paisEst?.codigo_moneda }}</p>
              @if (motivoNoCobrar) { <p class="text-xs font-semibold text-red-600">{{ motivoNoCobrar }}</p> }
            </div>
            <button type="button" (click)="abrirCobro()" [disabled]="!!motivoNoCobrar"
                    class="shrink-0 px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">{{ 'wg.operacion.caja.cobrar' | translate }}</button>
          </div>
        </div>
      }
    </div>

    <!-- Cobro en efectivo: con cuánto paga y el vuelto (solo montos) -->
    @if (cobrando && estudiante && paisEst && datos) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="cerrarCobro()">
        <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94vh] flex flex-col" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-cobro">
          <div class="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="titulo-cobro" class="text-lg font-bold text-gray-800">{{ 'wg.montotienda.cobroEfectivo' | translate }}</h2>
              <p class="text-sm text-gray-500">{{ estudiante.nombre }} · {{ 'wg.operacion.caja.totalMin' | translate }} <b>{{ miles(total) }} {{ paisEst.codigo_moneda }}</b></p>
            </div>
            <button type="button" (click)="cerrarCobro()" class="p-1 text-gray-400 hover:text-gray-600" [attr.aria-label]="'wg.operacion.comun.cerrar' | translate">✕</button>
          </div>
          <div class="flex-1 overflow-y-auto px-5 pb-3">
            <label for="monto-recibido" class="block text-sm font-semibold text-gray-700">{{ 'wg.montotienda.conCuantoPaga' | translate }}</label>
            <input id="monto-recibido" wgNumero [(ngModel)]="recibidoMonto" placeholder="0"
                   class="mt-1.5 w-full px-4 py-3 text-2xl font-extrabold bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
            <!-- Atajos: exacto y redondeos hacia arriba -->
            <div class="mt-2 flex flex-wrap gap-2">
              <button type="button" (click)="recibidoMonto = total" class="px-3 py-1.5 rounded-lg text-sm font-semibold border-2"
                      [class]="recibido === total ? 'border-orange-400 bg-orange-50 text-orange-800' : 'border-gray-200 bg-white text-gray-700'">{{ 'wg.montotienda.exacto' | translate }}</button>
              @for (n of sugerenciasPago; track n) {
                <button type="button" (click)="recibidoMonto = n" class="px-3 py-1.5 rounded-lg text-sm font-semibold border-2"
                        [class]="recibido === n ? 'border-orange-400 bg-orange-50 text-orange-800' : 'border-gray-200 bg-white text-gray-700'">{{ miles(n) }}</button>
              }
            </div>
            @if (recibido && recibido < total) {
              <p class="mt-2 text-sm font-semibold text-red-600">{{ 'wg.operacion.caja.faltan' | translate: { n: miles(total - recibido) } }}</p>
            } @else if (recibido > (estudiante.saldo || 0)) {
              <p class="mt-2 text-xs font-semibold text-amber-700">{{ 'wg.montotienda.masQueEfectivo' | translate: { n: miles(estudiante.saldo) } }}</p>
            }
            <!-- Vuelto en grande -->
            <div class="mt-4 rounded-2xl p-4 text-center" [class]="recibido >= total ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'">
              <p class="text-sm font-semibold" [class]="recibido >= total ? 'text-emerald-800' : 'text-gray-500'">{{ 'wg.operacion.caja.vuelto' | translate }}</p>
              <p class="text-4xl font-extrabold break-all" [class]="recibido >= total ? 'text-emerald-700' : 'text-gray-400'">{{ miles(vueltoDebido) }} <span class="text-base font-semibold">{{ paisEst.codigo_moneda }}</span></p>
              @if (recibido >= total) { <p class="mt-1 text-xs text-emerald-800">{{ (vueltoDebido ? 'wg.montotienda.devuelve' : 'wg.montotienda.sinVuelto') | translate: { n: miles(vueltoDebido) } }}</p> }
            </div>
          </div>
          <div class="px-5 py-4 border-t border-gray-100">
            @if (errorCobro) { <p class="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ errorCobro }}</p> }
            <div class="grid grid-cols-3 gap-2 mb-3 text-center">
              <div class="rounded-xl bg-gray-50 py-2"><p class="text-[11px] text-gray-500">{{ 'wg.operacion.caja.total' | translate }}</p><p class="font-extrabold text-gray-800 break-all">{{ miles(total) }}</p></div>
              <div class="rounded-xl bg-gray-50 py-2"><p class="text-[11px] text-gray-500">{{ 'wg.montotienda.recibido' | translate }}</p><p class="font-extrabold break-all" [class]="recibido < total ? 'text-red-600' : 'text-gray-800'">{{ miles(recibido) }}</p></div>
              <div class="rounded-xl bg-gray-50 py-2"><p class="text-[11px] text-gray-500">{{ 'wg.operacion.caja.vuelto' | translate }}</p><p class="font-extrabold text-gray-800 break-all">{{ miles(vueltoDebido) }}</p></div>
            </div>
            <button type="button" (click)="confirmar()" [disabled]="enviando || recibido < total"
                    class="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">
              {{ enviando ? ('wg.operacion.comun.guardando' | translate) : (!recibido ? ('wg.montotienda.escribeConCuanto' | translate) : (recibido < total ? ('wg.operacion.caja.faltan' | translate: { n: miles(total - recibido) }) : ('wg.operacion.caja.confirmarVenta' | translate))) }}
            </button>
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
            <h2 id="titulo-recibo" class="mt-3 text-lg font-bold text-gray-800">{{ 'wg.operacion.caja.ventaRegistrada' | translate }}</h2>
            <p class="text-sm text-gray-500">{{ recibo.numero }}</p>
          </div>
          <ul class="mt-4 divide-y divide-gray-100 text-sm">
            @for (i of recibo.items; track $index) {
              <li class="py-2 flex justify-between gap-3"><span>{{ i.cantidad }} × {{ i.nombre }}</span><b>{{ miles(i.cantidad * i.precio_billetes) }}</b></li>
            }
          </ul>
          <div class="mt-3 rounded-xl bg-gray-50 p-3 text-sm space-y-1">
            <p class="flex justify-between"><span>{{ 'wg.operacion.caja.total' | translate }}</span><b>{{ miles(recibo.total) }} {{ recibo.moneda }}</b></p>
            @if (recibo.metodo === 'tarjeta') {
              <p class="flex justify-between"><span>💳 {{ 'wg.tarjeta.pagadoTarjeta' | translate }}</span><span class="font-semibold">{{ recibo.llave }}</span></p>
              <p class="flex justify-between text-gray-500"><span>{{ 'wg.tarjeta.leQuedanCuenta' | translate }}</span><span>{{ miles(recibo.saldo) }}</span></p>
            } @else {
              <p class="flex justify-between"><span>{{ 'wg.montotienda.recibido' | translate }}</span><span>{{ miles(recibo.recibido) }}</span></p>
              <p class="flex justify-between text-base"><span class="font-semibold">{{ 'wg.operacion.caja.vuelto' | translate }}</span><b class="text-emerald-700">{{ miles(recibo.vuelto) }} {{ recibo.moneda }}</b></p>
              <p class="flex justify-between text-gray-500"><span>{{ 'wg.operacion.caja.leQuedan' | translate }}</span><span>{{ miles(recibo.saldo) }}</span></p>
            }
          </div>
          <button type="button" (click)="recibo = null" class="mt-5 w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600">{{ 'wg.operacion.caja.nuevaVenta' | translate }}</button>
        </div>
      </div>
    }

    <!-- Escanear la tarjeta (se quita del DOM al cerrar para apagar la cámara) -->
    @if (escaneando) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="cerrarEscaner()">
        <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94vh] overflow-y-auto p-5" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-escaner">
          <div class="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 id="titulo-escaner" class="text-lg font-bold text-gray-800">{{ 'wg.tarjeta.escanearTarjeta' | translate }}</h2>
              <p class="text-sm text-gray-500">{{ (escaneando === 'pago' && estudiante ? 'wg.tarjeta.leeTarjetaDe' : 'wg.tarjeta.leeTarjeta') | translate: { nombre: estudiante?.nombre } }}</p>
            </div>
            <button type="button" (click)="cerrarEscaner()" class="p-1 text-gray-400 hover:text-gray-600" [attr.aria-label]="'wg.operacion.comun.cerrar' | translate">✕</button>
          </div>
          <wg-escaner-qr [activo]="!buscandoLlave" (leido)="alLeer($event)" />
          @if (buscandoLlave) { <p class="mt-3 text-sm text-gray-500 text-center" role="status">{{ 'wg.tarjeta.buscando' | translate }}</p> }
          @if (errorEscaner) { <p class="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ errorEscaner }}</p> }
        </div>
      </div>
    }

    <!-- Confirmar pago con tarjeta -->
    @if (pagandoTarjeta && estudiante && paisEst && datos) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="cerrarPagoTarjeta()">
        <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-5" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-pago-tarjeta">
          <div class="flex items-start justify-between gap-3">
            <h2 id="titulo-pago-tarjeta" class="text-lg font-bold text-gray-800">{{ 'wg.tarjeta.pagoTitulo' | translate }}</h2>
            <button type="button" (click)="cerrarPagoTarjeta()" class="p-1 text-gray-400 hover:text-gray-600" [attr.aria-label]="'wg.operacion.comun.cerrar' | translate">✕</button>
          </div>
          <div class="mt-3 rounded-2xl p-4 text-white shadow" [style.background]="paisEst.color || '#1e293b'">
            <p class="text-lg font-extrabold truncate">{{ estudiante.nombre }} {{ estudiante.apellido }}</p>
            <p class="text-sm opacity-95 font-mono">{{ llaveLeida }}</p>
            <p class="mt-2 text-xs opacity-90">{{ 'wg.operacion.caja.total' | translate }}</p>
            <p class="text-2xl font-extrabold">{{ miles(total) }} <span class="text-sm font-semibold opacity-90">{{ paisEst.codigo_moneda }}</span></p>
          </div>
          <p class="mt-3 text-sm text-gray-600" [innerHTML]="'wg.tarjeta.seDescuenta' | translate: { tiene: miles(estudiante.cuenta), quedan: miles(cuentaTras), moneda: paisEst.codigo_moneda }"></p>
          @if (motivoNoCobrar) { <p class="mt-3 text-sm font-semibold text-red-600">{{ motivoNoCobrar }}</p> }
          @if (errorCobro) { <p class="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ errorCobro }}</p> }
          <button type="button" (click)="pagarConTarjeta()" [disabled]="enviando || !!motivoNoCobrar"
                  class="mt-4 w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-slate-700 to-slate-900 disabled:opacity-40">
            {{ (enviando ? 'wg.tarjeta.pagando' : 'wg.tarjeta.pagarConTarjeta') | translate }}
          </button>
        </div>
      </div>
    }

    <!-- Entregar al banco: un monto (hasta lo que hay en la caja) -->
    @if (entregaPais && datos) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="cerrarEntrega()">
        <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94vh] flex flex-col" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-entrega-banco">
          <div class="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="titulo-entrega-banco" class="text-lg font-bold text-gray-800">{{ 'wg.operacion.caja.entregarAlBancoDe' | translate: { pais: entregaPais.nombre } }}</h2>
              <p class="text-sm text-gray-500">{{ 'wg.montotienda.ayudaEntregaBanco' | translate }}</p>
            </div>
            <button type="button" (click)="cerrarEntrega()" class="p-1 text-gray-400 hover:text-gray-600" [attr.aria-label]="'wg.operacion.comun.cerrar' | translate">✕</button>
          </div>
          <div class="flex-1 overflow-y-auto px-5 pb-3">
            <label for="monto-banco" class="block text-sm font-semibold text-gray-700">{{ 'wg.montotienda.montoAEntregar' | translate }}</label>
            <input id="monto-banco" wgNumero [(ngModel)]="montoBanco" placeholder="0"
                   class="mt-1.5 w-full px-4 py-3 text-2xl font-extrabold bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
            <div class="mt-1.5 flex items-center justify-between gap-3">
              <p class="text-xs" [class]="montoBancoNum > entregaPais.saldo_caja ? 'text-red-600 font-semibold' : 'text-gray-500'">{{ 'wg.montotienda.enCajaHay' | translate: { n: miles(entregaPais.saldo_caja) } }} {{ entregaPais.codigo_moneda || '' }}</p>
              <button type="button" (click)="todoAlBanco()" class="shrink-0 text-sm font-semibold text-orange-600 hover:underline">{{ 'wg.operacion.caja.entregarTodo' | translate }}</button>
            </div>
          </div>
          <div class="px-5 py-4 border-t border-gray-100">
            @if (errorCobro) { <p class="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ errorCobro }}</p> }
            <button type="button" (click)="entregar()" [disabled]="enviando || !montoBancoValido"
                    class="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">
              {{ enviando ? ('wg.operacion.comun.entregando' | translate) : (montoBancoNum ? ('wg.operacion.comun.entregarMonto' | translate: { n: miles(montoBancoNum) }) : ('wg.transferir.escribeMonto' | translate)) }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CajaWillGo implements OnInit {
  private willGo = inject(WillGoService);
  private t = inject(TranslateService);
  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);
  readonly vistas: { id: Vista; texto: string }[] = [{ id: 'vender', texto: 'wg.operacion.caja.vistaTienda' }, { id: 'ventas', texto: 'wg.operacion.caja.vistaMovimientos' }];

  ediciones: EdicionVigente[] = [];
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
  /** Con cuánto paga el estudiante en efectivo (un monto; el vuelto lo calcula el servidor). */
  recibidoMonto: number | null = null;
  clave = '';
  enviando = false;
  errorCobro = '';
  recibo: { numero: string; items: { nombre: string; cantidad: number; precio_billetes: number }[]; total: number; recibido: number; vuelto: number; saldo: number; moneda: string; metodo: 'efectivo' | 'tarjeta'; llave?: string } | null = null;

  /** Forma de pago elegida en la barra de cobro. */
  metodo: 'efectivo' | 'tarjeta' = 'efectivo';
  /** Llave de la tarjeta con la que se identificó el estudiante elegido (null si se eligió de la lista). */
  llaveLeida: string | null = null;
  /** Escáner abierto: para elegir al estudiante o para leer su tarjeta al pagar. */
  escaneando: 'estudiante' | 'pago' | null = null;
  buscandoLlave = false;
  errorEscaner = '';
  pagandoTarjeta = false;
  private ultimaLectura = { texto: '', hora: 0 };

  entregaPais: PaisCaja | null = null;
  /** Monto que la caja le entrega al banco. */
  montoBanco: number | null = null;

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
  /** Ventas viejas: suma del detalle de billetes que se guardó (las nuevas solo guardan el monto). */
  suma(b: Record<string | number, number | null> | string | null | undefined): number {
    const x = typeof b === 'string' ? JSON.parse(b) : b;
    return x ? sumaBilletes(x) : 0;
  }
  textoItems(v: VentaCaja): string { return v.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(', '); }

  get filtrados(): EstudianteCaja[] {
    const palabras = normalizar(this.busqueda).split(/\s+/).filter(Boolean);
    return (this.datos?.estudiantes ?? []).filter((e) => { const n = normalizar(`${e.nombre} ${e.apellido}`); return palabras.every((w) => n.includes(w)); });
  }

  /** Paso de la venta: primero los productos, luego quién compra. */
  etapa: 'productos' | 'estudiante' = 'productos';
  elegir(e: EstudianteCaja, llave: string | null = null): void { this.estudiante = e; this.llaveLeida = llave; this.metodo = llave ? 'tarjeta' : 'efectivo'; }
  cambiarEstudiante(): void { this.estudiante = null; this.llaveLeida = null; this.metodo = 'efectivo'; this.etapa = 'estudiante'; }
  /** No le alcanza ni en efectivo ni en su cuenta. */
  noLeAlcanza(e: EstudianteCaja): boolean { return this.totalPara(e) > Math.max(Number(e.saldo) || 0, Number(e.cuenta) || 0); }
  /** Lo que tiene el estudiante elegido con la forma de pago elegida. */
  get disponibleMetodo(): number { return Number(this.metodo === 'tarjeta' ? this.estudiante?.cuenta : this.estudiante?.saldo) || 0; }
  /** Lo que le queda en la cuenta después de pagar con tarjeta. */
  get cuentaTras(): number { return (Number(this.estudiante?.cuenta) || 0) - this.total; }
  /** Productos elegidos. */
  get enCarrito(): ProductoCaja[] { return (this.datos?.productos ?? []).filter((p) => this.cantidad(p) > 0); }
  /** «2 × Gorra, 1 × Snack» */
  get resumenCarrito(): string { return this.enCarrito.map((p) => `${this.cantidad(p)} × ${p.nombre}`).join(', '); }
  /** Lo que le cuesta lo elegido a un estudiante, en la moneda de su país. */
  totalPara(e: EstudianteCaja): number {
    const pa = this.pais(e.pais_id);
    return pa ? this.enCarrito.reduce((t, p) => t + this.precioEn(p, pa) * this.cantidad(p), 0) : 0;
  }
  /** Lo máximo que puede llevar el estudiante elegido de un producto. */
  maximoDe(p: ProductoCaja): number { return this.maximo(p); }
  /** Por qué no puede llevar tantas unidades: ya compró antes, llegó al máximo o no hay stock. */
  avisoMaximo(p: ProductoCaja): string {
    const ya = this.datos?.comprado?.[this.estudiante?.id ?? '']?.[p.id] ?? 0;
    if (p.maximo_por_estudiante && this.cantidad(p) + ya > p.maximo_por_estudiante) {
      return this.t.instant('wg.operacion.caja.excedeMaximo', { ya, max: p.maximo_por_estudiante, puede: Math.max(0, p.maximo_por_estudiante - ya) });
    }
    return this.t.instant('wg.operacion.caja.disponibles', { n: this.miles(p.stock) });
  }
  /** ¿Lleva más de lo que le permite el máximo por estudiante o el stock? */
  get excede(): boolean { return this.enCarrito.some((p) => this.cantidad(p) > this.maximo(p)); }
  /** Por qué no se puede cobrar todavía (vacío = se puede). */
  get motivoNoCobrar(): string {
    const d = this.datos, e = this.estudiante;
    if (!d || !e) return '';
    if (d.edicion.estado !== 'abierta') return this.t.instant('wg.operacion.caja.motivoEdicionCerrada');
    if (!d.puede_vender) return this.t.instant('wg.operacion.caja.soloCajeros');
    if (this.metodo === 'tarjeta') {
      if (this.total > (Number(e.cuenta) || 0)) return this.t.instant('wg.tarjeta.noAlcanzaCuenta', { n: this.miles(e.cuenta) });
    } else if (this.total > e.saldo) return this.t.instant('wg.operacion.caja.noAlcanza', { n: this.miles(e.saldo) });
    if (this.excede) return this.t.instant('wg.operacion.caja.motivoExcede');
    return '';
  }

  // ---- Carrito ----
  precio(p: ProductoCaja): number { return precioEnBilletes(Number(p.precio_cop), Number(this.paisEst?.tasa_actual) || 1, Number(p.descuento) || 0); }
  /** Lo que vale un producto en la moneda de un país (precio en pesos ÷ tasa, hacia arriba, igual que al cobrar). */
  precioEn(p: ProductoCaja, pais: PaisCaja): number { return precioEnBilletes(Number(p.precio_cop), Number(pais.tasa_actual) || 1, Number(p.descuento) || 0); }
  /** Los países distintos al del estudiante elegido (para mostrar el precio en las otras monedas). */
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
    if (Number(p.stock) <= 0) return this.t.instant('wg.operacion.comun.agotado');
    const ya = this.datos?.comprado?.[this.estudiante?.id ?? '']?.[p.id] ?? 0;
    if (p.maximo_por_estudiante && ya >= p.maximo_por_estudiante) return this.t.instant('wg.operacion.caja.yaComproMax', { n: p.maximo_por_estudiante });
    return this.t.instant('wg.operacion.caja.disponibles', { n: this.miles(p.stock) })
      + (p.maximo_por_estudiante ? ' · ' + this.t.instant('wg.operacion.caja.maxPorEstudiante', { n: p.maximo_por_estudiante }) : '');
  }
  sumar(p: ProductoCaja, n: number): void {
    const v = Math.max(0, Math.min(this.cantidad(p) + n, this.maximo(p)));
    this.carrito = { ...this.carrito, [p.id]: v };
  }
  get unidades(): number { return Object.values(this.carrito).reduce((t, n) => t + n, 0); }
  get total(): number { return (this.datos?.productos ?? []).reduce((t, p) => t + this.precio(p) * this.cantidad(p), 0); }

  // ---- Cobro ----
  get recibido(): number { return Number(this.recibidoMonto) || 0; }
  get vueltoDebido(): number { return Math.max(0, this.recibido - this.total); }
  /** Montos redondos por encima del total (p. ej. total 37 → 40, 50, 100), sin pasar de lo que tiene en efectivo si le alcanza. */
  get sugerenciasPago(): number[] {
    const total = this.total;
    if (!total) return [];
    const saldo = Number(this.estudiante?.saldo) || 0;
    const tope = saldo >= total ? saldo : Infinity;
    const lista = PASOS_REDONDEO.map((p) => Math.ceil(total / p) * p).filter((n) => n > total && n <= tope);
    return [...new Set(lista)].sort((a, b) => a - b).slice(0, 4);
  }

  abrirCobro(): void {
    if (this.metodo === 'tarjeta') {
      // Con tarjeta: si no se identificó con su tarjeta, primero hay que leerla.
      if (this.llaveLeida) this.abrirPagoTarjeta(); else this.abrirEscaner('pago');
      return;
    }
    this.cobrando = true;
    this.recibidoMonto = null;
    this.errorCobro = '';
    this.clave = crypto.randomUUID();
  }
  cerrarCobro(): void { if (!this.enviando) this.cobrando = false; }

  confirmar(): void {
    const e = this.estudiante, p = this.paisEst;
    if (!e || !p || !this.datos || this.enviando || this.recibido < this.total) return;
    const items = Object.entries(this.carrito).filter(([, n]) => n > 0).map(([producto_id, cantidad]) => ({ producto_id, cantidad }));
    const total = this.total, recibido = this.recibido;
    this.enviando = true;
    this.errorCobro = '';
    // Efectivo: solo con cuánto paga; el servidor calcula el vuelto (recibido − total)
    this.willGo.vender({ participante_id: e.id, items, recibido, clave_idempotencia: this.clave }).subscribe({
      next: (r) => {
        this.enviando = false;
        this.cobrando = false;
        const rec = Number(r.recibido ?? recibido);
        this.recibo = { numero: r.numero_recibo, items: r.items, total: Number(r.total_billetes ?? total), recibido: rec, vuelto: Number(r.vuelto ?? rec - total), saldo: r.saldo, moneda: p.codigo_moneda ?? '', metodo: 'efectivo' };
        this.carrito = {};
        this.estudiante = null;
        this.llaveLeida = null;
        this.etapa = 'productos';
        this.busqueda = '';
        this.cargar();
      },
      error: (err) => { this.enviando = false; this.errorCobro = WillGoService.mensajeDeError(err); },
    });
  }

  // ---- Tarjeta débito ----
  abrirEscaner(para: 'estudiante' | 'pago'): void {
    this.escaneando = para;
    this.errorEscaner = '';
    this.buscandoLlave = false;
    this.ultimaLectura = { texto: '', hora: 0 };
  }
  cerrarEscaner(): void { this.escaneando = null; this.buscandoLlave = false; }

  /** Llega la llave leída del QR (o escrita): busca al estudiante en esta caja. */
  alLeer(texto: string): void {
    if (this.buscandoLlave || !this.datos) return;
    const llave = normalizarLlave(texto);
    if (llave === '@') return;
    // La cámara lee el mismo QR varias veces por segundo: no repetir el mismo aviso.
    const ahora = Date.now();
    if (llave === this.ultimaLectura.texto && ahora - this.ultimaLectura.hora < 2500) return;
    this.ultimaLectura = { texto: llave, hora: ahora };
    this.errorEscaner = '';
    const local = this.datos.estudiantes.find((e) => (e.llave ?? '').toLowerCase() === llave);
    if (local) { this.usarTarjeta(local, llave); return; }
    this.buscandoLlave = true;
    this.willGo.duenoDeLlave(llave).subscribe({
      next: (d) => {
        this.buscandoLlave = false;
        const e = this.datos?.estudiantes.find((x) => x.id === d.participante_id);
        if (e) this.usarTarjeta(e, d.llave ? normalizarLlave(d.llave) : llave);
        else this.errorEscaner = this.t.instant('wg.tarjeta.noEstaEnCaja', { nombre: `${d.nombre} ${d.apellido}`.trim(), pais: d.pais });
      },
      error: (err) => {
        this.buscandoLlave = false;
        this.errorEscaner = err?.status === 404 ? this.t.instant('wg.tarjeta.llaveNoExiste', { llave }) : WillGoService.mensajeDeError(err);
      },
    });
  }

  private usarTarjeta(e: EstudianteCaja, llave: string): void {
    if (this.escaneando === 'pago') {
      if (this.estudiante && e.id !== this.estudiante.id) {
        this.errorEscaner = this.t.instant('wg.tarjeta.esDeOtro', { nombre: `${e.nombre} ${e.apellido}`.trim(), elegido: this.estudiante.nombre });
        return;
      }
      this.llaveLeida = llave;
      this.cerrarEscaner();
      this.abrirPagoTarjeta();
      return;
    }
    this.cerrarEscaner();
    this.elegir(e, llave);
  }

  abrirPagoTarjeta(): void {
    this.pagandoTarjeta = true;
    this.errorCobro = '';
    this.clave = crypto.randomUUID();
  }
  cerrarPagoTarjeta(): void { if (!this.enviando) this.pagandoTarjeta = false; }

  pagarConTarjeta(): void {
    const e = this.estudiante, p = this.paisEst, llave = this.llaveLeida;
    if (!e || !p || !llave || !this.datos || this.enviando || this.motivoNoCobrar) return;
    const items = Object.entries(this.carrito).filter(([, n]) => n > 0).map(([producto_id, cantidad]) => ({ producto_id, cantidad }));
    const total = this.total, quedan = this.cuentaTras;
    this.enviando = true;
    this.errorCobro = '';
    this.willGo.vender({ participante_id: e.id, items, clave_idempotencia: this.clave, metodo: 'tarjeta', llave }).subscribe({
      next: (r) => {
        this.enviando = false;
        this.pagandoTarjeta = false;
        this.recibo = { numero: r.numero_recibo, items: r.items, total, recibido: 0, vuelto: 0, saldo: quedan, moneda: p.codigo_moneda ?? '', metodo: 'tarjeta', llave };
        this.carrito = {};
        this.estudiante = null;
        this.llaveLeida = null;
        this.metodo = 'efectivo';
        this.etapa = 'productos';
        this.busqueda = '';
        this.cargar();
      },
      error: (err) => { this.enviando = false; this.errorCobro = WillGoService.mensajeDeError(err); },
    });
  }

  // ---- Entregar al banco ----
  /** De qué caja se entrega (solo el administrativo elige la de un cajero; null = la propia). */
  entregaCajaDe: string | null = null;
  abrirEntrega(p: PaisCaja): void { this.entregaCajaDe = null; this.entregaPais = p; this.montoBanco = null; this.errorCobro = ''; this.clave = crypto.randomUUID(); }
  /** El administrativo entrega al banco el efectivo de la caja de un cajero. */
  abrirEntregaDe(c: CajaCajero): void {
    const p = this.datos?.paises.find((x) => x.id === c.pais_id);
    if (!p) return;
    this.entregaCajaDe = c.usuario_id ?? 'general';
    this.entregaPais = { ...p, saldo_caja: c.saldo };
    this.montoBanco = null; this.errorCobro = ''; this.clave = crypto.randomUUID();
  }
  cerrarEntrega(): void { if (!this.enviando) this.entregaPais = null; }
  todoAlBanco(): void { if (this.entregaPais) this.montoBanco = Number(this.entregaPais.saldo_caja) || 0; }
  get montoBancoNum(): number { return Number(this.montoBanco) || 0; }
  get montoBancoValido(): boolean { return this.montoBancoNum > 0 && this.montoBancoNum <= (Number(this.entregaPais?.saldo_caja) || 0); }
  entregar(): void {
    const p = this.entregaPais;
    if (!p || !this.datos || this.enviando || !this.montoBancoValido) return;
    this.enviando = true;
    this.errorCobro = '';
    this.willGo.entregarCajaAlBanco(this.datos.edicion.id, p.id, this.montoBancoNum, this.clave, this.entregaCajaDe).subscribe({
      next: (r) => { this.enviando = false; this.entregaPais = null; this.avisar(this.t.instant('wg.operacion.caja.avisoEntregaste', { monto: this.miles(r.monto), pais: p.nombre })); this.cargar(); },
      error: (err) => { this.enviando = false; this.errorCobro = WillGoService.mensajeDeError(err); },
    });
  }
}
