import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { formatearNumero } from '../../../numero-miles.directive';
import { Edicion, Grupo, Pais, Participante, WillGoService } from '../../../../../core/services/will-go.service';
import { ConfirmacionService } from '../../../../../core/services/confirmacion.service';

@Component({
  selector: 'app-tab-participantes',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <!-- Acciones -->
    <div class="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
      <p class="text-sm text-gray-500">{{ 'wg.pestanas.participantes.intro' | translate }}</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" (click)="repartir()" [disabled]="trabajando || !sinPais.length || !paises.length"
                class="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50">
          {{ 'wg.pestanas.participantes.repartir' | translate: { n: sinPais.length } }}
        </button>
      </div>
    </div>

    <!-- Conteo por país -->
    <div class="mt-4 flex flex-wrap gap-2">
      <button type="button" (click)="filtro = ''" class="chip" [class.activo]="filtro === ''">{{ 'wg.pestanas.comun.todos' | translate }} · {{ activos.length }}</button>
      @for (p of paises; track p.id) {
        <button type="button" (click)="filtro = p.id" class="chip" [class.activo]="filtro === p.id">
          <span class="w-2.5 h-2.5 rounded-full" [style.background]="p.color"></span>{{ p.nombre }} · {{ cuantos(p.id) }}
        </button>
      }
      <button type="button" (click)="filtro = 'sin'" class="chip" [class.activo]="filtro === 'sin'" [class.text-amber-800]="sinPais.length">{{ 'wg.pestanas.participantes.sinPais' | translate }} · {{ sinPais.length }}</button>
      @if (retirados.length) {
        <button type="button" (click)="filtro = 'retirados'" class="chip" [class.activo]="filtro === 'retirados'">{{ 'wg.pestanas.participantes.retirados' | translate }} · {{ retirados.length }}</button>
      }
      @if (conReembolso.length) {
        <button type="button" (click)="filtro = 'reembolso'" class="chip !border-red-200 !text-red-700" [class.activo]="filtro === 'reembolso'">{{ 'wg.pestanas.participantes.pidieronReembolso' | translate }} · {{ conReembolso.length }}</button>
      }
    </div>

    <!-- Grupos de Will-Go: tarjetas de color; tocar una filtra la lista (✎ edita, ✕ elimina) -->
    <section class="mt-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-bold text-gray-800">{{ 'wg.grupos.titulo' | translate }}</h3>
        <button type="button" (click)="nuevoGrupo()" [disabled]="!paises.length" class="shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:brightness-110 disabled:opacity-40">{{ 'wg.grupos.nuevo' | translate }}</button>
      </div>
      @if (!gruposFiltro.length) {
        <p class="mt-2 rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-4 text-sm text-gray-500">{{ 'wg.grupos.vacioCorto' | translate }}</p>
      } @else {
        <div class="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <!-- Todos -->
          <button type="button" (click)="filtroGrupoWillGo = ''; seleccion.clear()"
                  class="text-left rounded-2xl px-4 py-3 border-2 bg-white transition hover:shadow-md"
                  [class]="!filtroGrupoWillGo ? 'border-slate-800 shadow-md' : 'border-gray-200'">
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ 'wg.grupos.verTodos' | translate }}</p>
            <p class="mt-1 text-2xl font-extrabold text-gray-800">{{ totalVisibles }}</p>
            <p class="text-xs text-gray-500">{{ (totalVisibles === 1 ? 'wg.grupos.estudiante' : 'wg.grupos.estudiantes') | translate }}</p>
          </button>
          @for (g of gruposFiltro; track g.id) {
            <div class="group relative overflow-hidden rounded-2xl text-white shadow-sm transition hover:shadow-lg hover:-translate-y-0.5"
                 [style.background]="fondoGrupo(g.color)"
                 [class.ring-4]="filtroGrupoWillGo === g.id" [class.ring-offset-2]="filtroGrupoWillGo === g.id" [class.ring-slate-800]="filtroGrupoWillGo === g.id">
              <span class="absolute -right-5 -bottom-7 w-20 h-20 rounded-full bg-white/15 pointer-events-none"></span>
              <button type="button" (click)="filtroGrupoWillGo = filtroGrupoWillGo === g.id ? '' : g.id; seleccion.clear()" [attr.aria-pressed]="filtroGrupoWillGo === g.id"
                      class="relative block w-full text-left px-4 pt-3 pb-11">
                <p class="text-xs font-semibold uppercase tracking-wide opacity-85 truncate">{{ nombrePais(g.pais_id) }}</p>
                <p class="mt-0.5 font-extrabold leading-tight break-words">{{ g.nombre }}</p>
                <p class="absolute left-4 bottom-3 text-sm opacity-90"><b>{{ enGrupo(g.id) }}</b> {{ (enGrupo(g.id) === 1 ? 'wg.grupos.estudiante' : 'wg.grupos.estudiantes') | translate }}</p>
              </button>
              <div class="absolute bottom-2 right-2 flex gap-1">
                <button type="button" (click)="editarGrupo(g)" class="w-7 h-7 rounded-full bg-white/20 hover:bg-white/35 text-sm flex items-center justify-center" [attr.aria-label]="'wg.grupos.editarA' | translate: { nombre: g.nombre }">✎</button>
                <button type="button" (click)="borrarGrupo(g)" class="w-7 h-7 rounded-full bg-white/20 hover:bg-white/35 text-sm flex items-center justify-center" [attr.aria-label]="'wg.grupos.eliminarA' | translate: { nombre: g.nombre }">✕</button>
              </div>
            </div>
          }
          <!-- Sin grupo -->
          <button type="button" (click)="filtroGrupoWillGo = filtroGrupoWillGo === '__sin' ? '' : '__sin'; seleccion.clear()"
                  class="text-left rounded-2xl px-4 py-3 border-2 border-dashed bg-white transition hover:shadow-md"
                  [class]="filtroGrupoWillGo === '__sin' ? 'border-slate-800 shadow-md' : 'border-gray-300'">
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ 'wg.pestanas.participantes.sinGrupoWillGo' | translate }}</p>
            <p class="mt-1 text-2xl font-extrabold text-gray-800">{{ sinGrupoCuenta }}</p>
            <p class="text-xs text-gray-500">{{ (sinGrupoCuenta === 1 ? 'wg.grupos.estudiante' : 'wg.grupos.estudiantes') | translate }}</p>
          </button>
        </div>
      }
    </section>

    <!-- Buscador y filtro por grado (agrupa por nivel: Kinder, Transición, 1°, 2°…) -->
    <div class="mt-3 flex flex-col sm:flex-row gap-2">
      <input type="search" [(ngModel)]="busqueda" [placeholder]="'wg.pestanas.participantes.buscar' | translate" [attr.aria-label]="'wg.pestanas.participantes.buscarAria' | translate"
             class="flex-1 min-w-0 px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
      <div class="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
        <select [(ngModel)]="filtroGrado" (ngModelChange)="filtroGrupo = ''; seleccion.clear()" [attr.aria-label]="'wg.pestanas.participantes.filtrarGrado' | translate"
                class="min-w-0 sm:w-44 px-4 py-3 bg-white border-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                [class]="filtroGrado ? 'border-orange-300 text-gray-900 font-semibold' : 'border-gray-200 text-gray-600'">
          <option value="">{{ 'wg.pestanas.participantes.todosGrados' | translate }}</option>
          @for (g of grados; track g) { <option [value]="g">{{ nombreNivel(g) }}</option> }
        </select>
        <select [(ngModel)]="filtroGrupo" (ngModelChange)="seleccion.clear()" [disabled]="!filtroGrado" [attr.aria-label]="'wg.pestanas.participantes.filtrarGrupo' | translate"
                class="min-w-0 sm:w-44 px-4 py-3 bg-white border-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:opacity-50 disabled:bg-gray-50"
                [class]="filtroGrupo ? 'border-orange-300 text-gray-900 font-semibold' : 'border-gray-200 text-gray-600'">
          <option value="">{{ 'wg.pestanas.participantes.todosGrupos' | translate }}</option>
          @for (g of grupos; track g) { <option [value]="g">{{ 'wg.pestanas.participantes.grupo' | translate }} {{ g }}</option> }
        </select>
      </div>
    </div>

    <!-- Barra de selección -->
    @if (seleccion.size) {
      <div class="sticky top-16 z-10 mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-lg">
        <span class="text-sm font-semibold mr-2">{{ 'wg.pestanas.participantes.seleccionados' | translate: { n: seleccion.size } }}</span>
        @if (filtro === 'retirados') {
          <button type="button" (click)="reintegrar(seleccionLista)" class="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600">{{ 'wg.pestanas.participantes.reintegrar' | translate }}</button>
        } @else {
          <span class="text-sm text-slate-300">{{ 'wg.pestanas.participantes.asignarA' | translate }}</span>
          @for (p of paises; track p.id) {
            <button type="button" (click)="asignarSeleccion(p.id)" class="px-3 py-1.5 rounded-lg text-sm font-semibold" [style.background]="p.color">{{ p.nombre }}</button>
          }
          @if (gruposSeleccion.length) {
            <select [ngModel]="''" (ngModelChange)="asignarGrupoSeleccion($event)" [attr.aria-label]="'wg.grupos.agregarA' | translate"
                    class="px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-900 bg-white">
              <option value="" disabled>{{ 'wg.grupos.agregarA' | translate }}…</option>
              @for (g of gruposSeleccion; track g.id) { <option [value]="g.id">{{ g.nombre }}</option> }
              <option value="__sin">{{ 'wg.pestanas.participantes.sinGrupoWillGo' | translate }}</option>
            </select>
          }
          <button type="button" (click)="pedirRetiro(seleccionLista)" class="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-600">{{ 'wg.pestanas.participantes.retirar' | translate }}</button>
        }
        <button type="button" (click)="seleccion.clear()" class="ml-auto text-sm text-slate-300 hover:text-white">{{ 'wg.pestanas.participantes.quitarSeleccion' | translate }}</button>
      </div>
    }

    @if (aviso) {
      <p class="mt-3 rounded-xl px-4 py-3 text-sm" [class]="avisoError ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'" role="status">{{ aviso }}</p>
    }

    <!-- Lista -->
    <div class="mt-3 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      @if (cargando) {
        <p class="p-10 text-center text-gray-500">{{ 'wg.pestanas.participantes.cargando' | translate }}</p>
      } @else if (!activos.length && filtro !== 'retirados') {
        <div class="p-10 text-center">
          <p class="font-semibold text-gray-700">{{ 'wg.pestanas.participantes.sinInscritos' | translate }}</p>
          <p class="text-sm text-gray-500 mt-1">{{ edicion.colegio_nombre ? ('wg.pestanas.participantes.sinInscritosAyudaColegio' | translate: { colegio: edicion.colegio_nombre }) : ('wg.pestanas.participantes.sinInscritosAyuda' | translate) }}</p>
        </div>
      } @else {
        <div class="hidden xl:grid grid-cols-[2.5rem_1fr_11rem_11rem_5.5rem_5rem_5.5rem] gap-3 px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
          <label class="flex items-center"><input type="checkbox" [checked]="todosSeleccionados" (change)="seleccionarTodos($any($event.target).checked)" [attr.aria-label]="'wg.pestanas.participantes.seleccionarTodos' | translate"></label>
          <span>{{ 'wg.pestanas.participantes.estudiante' | translate }}</span><span>{{ 'wg.pestanas.comun.pais' | translate }}</span><span>{{ 'wg.pestanas.participantes.grupoWillGo' | translate }}</span><span class="text-right">{{ 'wg.pestanas.participantes.saldo' | translate }}</span><span class="text-center">{{ 'wg.pestanas.participantes.presente' | translate }}</span><span></span>
        </div>
        <ul class="divide-y divide-gray-100">
          @for (p of filtrados; track p.id) {
            <li class="px-4 py-4 xl:py-3 xl:grid xl:grid-cols-[2.5rem_1fr_11rem_11rem_5.5rem_5rem_5.5rem] xl:gap-x-3 xl:items-center" [class.bg-gray-50]="p.retirado">
              <!-- Celular: nombre y código arriba, país a lo ancho, y abajo saldo, presente y retirar -->
              <div class="xl:hidden space-y-3">
                <div class="flex items-start gap-3">
                  <input type="checkbox" class="mt-1 w-4 h-4 shrink-0" [checked]="seleccion.has(p.id)" (change)="alternar(p.id)" [attr.aria-label]="'wg.pestanas.participantes.seleccionarA' | translate: { nombre: p.nombre }">
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold leading-snug" [class]="p.retirado ? 'text-gray-500 line-through' : 'text-gray-800'">{{ p.nombre }} {{ p.apellido }}</p>
                    <p class="text-xs text-gray-500">
                      @if (p.grado) { {{ 'wg.pestanas.participantes.grado' | translate: { n: p.grado } }} }
                    </p>
                    @if (p.retirado) {
                      <p class="text-xs text-red-700">{{ 'wg.pestanas.participantes.retiradoMotivo' | translate: { motivo: p.motivo_retiro } }}</p>
                    } @else if (p.pidio_reembolso) {
                      <p class="text-xs font-semibold text-red-700">{{ 'wg.pestanas.participantes.pidioReembolso' | translate }}</p>
                    } @else if (!p.corresponde) {
                      <p class="text-xs font-semibold text-red-700">{{ 'wg.pestanas.participantes.noCorresponde' | translate }}</p>
                    }
                  </div>
                  <span class="shrink-0 text-sm font-bold text-gray-800 whitespace-nowrap">{{ miles(p.saldo) }} <span class="text-xs font-normal text-gray-500">{{ monedaDe(p.pais_id) }}</span></span>
                </div>
<div class="grid grid-cols-2 gap-2">
                                <select class="w-full min-w-0 px-3 py-2.5 rounded-xl border-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                        [style.border-color]="colorDe(p.pais_id) || '#fcd34d'" [disabled]="!!p.retirado" [ngModel]="p.pais_id" (ngModelChange)="asignar([p.id], $event)" [attr.aria-label]="'wg.pestanas.participantes.paisDe' | translate: { nombre: p.nombre }">
                  <option [ngValue]="null">{{ 'wg.pestanas.participantes.sinPais' | translate }}</option>
                  @for (pa of paises; track pa.id) { <option [ngValue]="pa.id">{{ pa.nombre }}</option> }
                </select>
                <select class="w-full min-w-0 px-3 py-2.5 rounded-xl border-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-gray-50 disabled:text-gray-400"
                        [style.border-color]="colorGrupo(p.grupo_id) || '#e5e7eb'" [disabled]="!!p.retirado || !p.pais_id || !gruposDe(p.pais_id).length" [ngModel]="p.grupo_id ?? null" (ngModelChange)="asignarGrupo(p, $event)" [attr.aria-label]="'wg.pestanas.participantes.grupoDe' | translate: { nombre: p.nombre }">
                  <option [ngValue]="null">{{ (p.pais_id && gruposDe(p.pais_id).length ? 'wg.pestanas.participantes.sinGrupoWillGo' : 'wg.pestanas.participantes.sinGruposPais') | translate }}</option>
                  @for (g of gruposDe(p.pais_id); track g.id) { <option [ngValue]="g.id">{{ g.nombre }}</option> }
                </select>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <label class="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" class="w-4 h-4" [checked]="p.presente" [disabled]="!!p.retirado" (change)="marcarPresente(p, $any($event.target).checked)">
                    {{ 'wg.pestanas.participantes.presente' | translate }}
                  </label>
                  @if (p.retirado) {
                    <button type="button" (click)="reintegrar([p])" class="px-3 py-1.5 rounded-lg text-sm font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-50">{{ 'wg.pestanas.participantes.reintegrar' | translate }}</button>
                  } @else {
                    <button type="button" (click)="pedirRetiro([p])" class="px-3 py-1.5 rounded-lg text-sm font-semibold text-red-700 border border-red-200 hover:bg-red-50">{{ 'wg.pestanas.participantes.retirar' | translate }}</button>
                  }
                </div>
              </div>
              <!-- Computador: una fila de tabla -->
              <div class="hidden xl:contents">
              <label class="flex items-center"><input type="checkbox" [checked]="seleccion.has(p.id)" (change)="alternar(p.id)" [attr.aria-label]="'wg.pestanas.participantes.seleccionarA' | translate: { nombre: p.nombre }"></label>
              <div class="min-w-0">
                <p class="font-semibold truncate" [class]="p.retirado ? 'text-gray-500 line-through' : 'text-gray-800'">{{ p.nombre }} {{ p.apellido }}</p>
                @if (p.retirado) {
                  <p class="text-xs text-red-700 truncate">{{ 'wg.pestanas.participantes.retiradoMotivo' | translate: { motivo: p.motivo_retiro } }}</p>
                } @else if (p.pidio_reembolso) {
                  <p class="text-xs font-semibold text-red-700">{{ 'wg.pestanas.participantes.pidioReembolso' | translate }}</p>
                } @else if (!p.corresponde) {
                  <p class="text-xs font-semibold text-red-700" [title]="'wg.pestanas.participantes.noCorrespondeAyuda' | translate">{{ 'wg.pestanas.participantes.noCorresponde' | translate }}{{ p.colegio_id !== edicion.colegio_id ? ' ' + ('wg.pestanas.participantes.esDe' | translate: { colegio: p.colegio || ('wg.pestanas.participantes.otroColegio' | translate) }) : ' ' + ('wg.pestanas.participantes.noInscrito' | translate: { edicion: edicion.edicion_programa }) }}</p>
                }
                <!-- El colegio solo se muestra si la edición reúne varios colegios -->
                @if (!edicion.colegio_id || p.grado || p.grupo_id) {
                  <p class="text-xs text-gray-500 truncate">{{ edicion.colegio_id ? '' : (p.colegio || ('wg.pestanas.participantes.sinColegio' | translate)) }}{{ !edicion.colegio_id && p.grado ? ' · ' : '' }}{{ p.grado ? ('wg.pestanas.participantes.grado' | translate: { n: p.grado }) : '' }}</p>
                }
              </div>
              <select class="col-start-2 xl:col-start-auto px-3 py-2 rounded-lg border-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                      [style.border-color]="colorDe(p.pais_id) || '#fcd34d'" [disabled]="!!p.retirado" [ngModel]="p.pais_id" (ngModelChange)="asignar([p.id], $event)" [attr.aria-label]="'wg.pestanas.participantes.paisDe' | translate: { nombre: p.nombre }">
                <option [ngValue]="null">{{ 'wg.pestanas.participantes.sinPais' | translate }}</option>
                @for (pa of paises; track pa.id) { <option [ngValue]="pa.id">{{ pa.nombre }}</option> }
              </select>
              <select class="col-start-2 xl:col-start-auto min-w-0 px-3 py-2 rounded-lg border-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-gray-50 disabled:text-gray-400"
                        [style.border-color]="colorGrupo(p.grupo_id) || '#e5e7eb'" [disabled]="!!p.retirado || !p.pais_id || !gruposDe(p.pais_id).length" [ngModel]="p.grupo_id ?? null" (ngModelChange)="asignarGrupo(p, $event)" [attr.aria-label]="'wg.pestanas.participantes.grupoDe' | translate: { nombre: p.nombre }">
                  <option [ngValue]="null">{{ (p.pais_id && gruposDe(p.pais_id).length ? 'wg.pestanas.participantes.sinGrupoWillGo' : 'wg.pestanas.participantes.sinGruposPais') | translate }}</option>
                  @for (g of gruposDe(p.pais_id); track g.id) { <option [ngValue]="g.id">{{ g.nombre }}</option> }
                </select>
              <span class="col-start-2 xl:col-start-auto xl:text-right text-sm font-semibold text-gray-800">{{ miles(p.saldo) }} <span class="text-xs font-normal text-gray-500">{{ monedaDe(p.pais_id) }}</span></span>
              <label class="col-start-2 xl:col-start-auto flex xl:justify-center items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" [checked]="p.presente" [disabled]="!!p.retirado" (change)="marcarPresente(p, $any($event.target).checked)">
                <span class="xl:hidden">{{ 'wg.pestanas.participantes.presente' | translate }}</span>
              </label>
              <div class="col-start-2 xl:col-start-auto xl:text-right">
                @if (p.retirado) {
                  <button type="button" (click)="reintegrar([p])" class="text-sm font-semibold text-emerald-700 hover:underline">{{ 'wg.pestanas.participantes.reintegrar' | translate }}</button>
                } @else {
                  <button type="button" (click)="pedirRetiro([p])" class="text-sm font-semibold text-red-700 hover:underline">{{ 'wg.pestanas.participantes.retirar' | translate }}</button>
                }
              </div>
              </div>
            </li>
          }
        </ul>
        @if (!filtrados.length) { <p class="p-6 text-center text-sm text-gray-500">{{ 'wg.pestanas.participantes.nadieCoincide' | translate }}</p> }
      }
    </div>

    @if (retiro) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" (click)="retiro = null">
        <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6" (click)="$event.stopPropagation()" role="alertdialog" aria-modal="true" aria-labelledby="titulo-retiro">
          <h2 id="titulo-retiro" class="text-lg font-bold text-gray-800">
            {{ retiro.length === 1 ? ('wg.pestanas.participantes.confirmarUno' | translate: { nombre: retiro[0].nombre + ' ' + retiro[0].apellido }) : ('wg.pestanas.participantes.confirmarVarios' | translate: { n: retiro.length }) }}
          </h2>
          <p class="text-sm text-gray-600 mt-2">{{ 'wg.pestanas.participantes.retiroExplica' | translate }}</p>
          @if (billetesARetirar > 0) {
            <p class="text-sm text-amber-800 bg-amber-50 rounded-xl px-4 py-3 mt-3">{{ 'wg.pestanas.participantes.billetesVuelven' | translate: { n: miles(billetesARetirar) } }}</p>
          }
          <p class="text-sm font-semibold text-gray-700 mt-4 mb-2">{{ 'wg.pestanas.participantes.motivo' | translate }}</p>
          <div class="space-y-2">
            @for (m of motivos; track m) {
              <label class="flex items-center gap-2 text-sm text-gray-700"><input type="radio" name="motivo" [value]="m" [(ngModel)]="motivo"> {{ claveMotivo[m] | translate }}</label>
            }
          </div>
          @if (motivo === 'Otro') {
            <input [(ngModel)]="motivoOtro" [placeholder]="'wg.pestanas.participantes.escribeMotivo' | translate" [attr.aria-label]="'wg.pestanas.participantes.otroMotivo' | translate"
                   class="mt-2 w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300">
          }
          @if (errorRetiro) { <p class="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ errorRetiro }}</p> }
          <div class="flex gap-3 mt-6">
            <button type="button" (click)="retiro = null" class="flex-1 py-2.5 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">{{ 'wg.pestanas.comun.cancelar' | translate }}</button>
            <button type="button" (click)="confirmarRetiro()" [disabled]="trabajando || (motivo === 'Otro' && !motivoOtro.trim())"
                    class="flex-1 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
              {{ (trabajando ? 'wg.pestanas.participantes.retirando' : 'wg.pestanas.participantes.retirar') | translate }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Crear / editar grupo -->
    @if (borradorGrupo) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="borradorGrupo = null">
        <div class="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl p-6" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-grupo">
          <h2 id="titulo-grupo" class="text-lg font-bold text-gray-800">{{ (borradorGrupo.id ? 'wg.grupos.editarTitulo' : 'wg.grupos.nuevoTituloCorto') | translate }}</h2>
          <label for="g-pais-grupo" class="mt-4 block text-sm font-semibold text-gray-700 mb-1">{{ 'wg.pestanas.comun.pais' | translate }}</label>
          <select id="g-pais-grupo" [(ngModel)]="borradorGrupo.pais_id" class="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
            @for (pa of paises; track pa.id) { <option [value]="pa.id">{{ pa.nombre }}</option> }
          </select>
          <label for="g-nombre-grupo" class="mt-4 block text-sm font-semibold text-gray-700 mb-1">{{ 'wg.pestanas.comun.nombre' | translate }}</label>
          <input id="g-nombre-grupo" [(ngModel)]="borradorGrupo.nombre" maxlength="60" [placeholder]="'wg.grupos.ejemploNombre' | translate"
                 class="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
          <p class="mt-4 text-sm font-semibold text-gray-700 mb-2">{{ 'wg.grupos.color' | translate }}</p>
          <div class="flex flex-wrap items-center gap-2">
            @for (c of coloresGrupo; track c) {
              <button type="button" (click)="borradorGrupo.color = c" class="w-9 h-9 rounded-full ring-offset-2" [style.background]="c" [class]="borradorGrupo.color === c ? 'ring-2 ring-gray-800' : ''" [attr.aria-label]="c"></button>
            }
            <input type="color" [(ngModel)]="borradorGrupo.color" class="w-9 h-9 rounded-full border border-gray-200 p-0.5 bg-white" [attr.aria-label]="'wg.grupos.otroColor' | translate">
          </div>
          <div class="mt-4 rounded-xl px-4 py-3 text-white font-extrabold" [style.background]="borradorGrupo.color">{{ borradorGrupo.nombre || ('wg.grupos.ejemploNombre' | translate) }}</div>
          @if (errorGrupo) { <p class="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ errorGrupo }}</p> }
          <div class="mt-5 flex flex-col-reverse sm:flex-row gap-2">
            <button type="button" (click)="borradorGrupo = null" class="flex-1 py-3 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">{{ 'wg.pestanas.comun.cancelar' | translate }}</button>
            <button type="button" (click)="guardarGrupo()" [disabled]="guardandoGrupo || !borradorGrupo.nombre.trim() || !borradorGrupo.pais_id" class="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-50">{{ (guardandoGrupo ? 'wg.pestanas.comun.guardando' : 'wg.pestanas.comun.guardar') | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .chip { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.85rem; border-radius: 999px; font-size: 0.85rem; font-weight: 600; background: #fff; border: 1px solid #e5e7eb; color: #4b5563; }
    .chip.activo { background: #1e293b; color: #fff; border-color: #1e293b; }
  `],
})
export class TabParticipantes implements OnInit {
  @Input({ required: true }) edicion!: Edicion;
  @Output() cambio = new EventEmitter<void>();
  private willGo = inject(WillGoService);
  private t = inject(TranslateService);
  private confirmacion = inject(ConfirmacionService);

  lista: Participante[] = [];
  paises: Pais[] = [];
  cargando = true;
  trabajando = false;
  busqueda = '';
  filtro = '';
  seleccion = new Set<string>();
  readonly miles = (v: unknown) => formatearNumero(v as number);
  aviso = '';
  avisoError = false;

  readonly coloresGrupo = ['#F97316', '#3B82F6', '#22C55E', '#A855F7', '#EF4444', '#14B8A6', '#EAB308', '#EC4899'];
  borradorGrupo: { id?: string; pais_id: string; nombre: string; color: string } | null = null;
  guardandoGrupo = false;
  errorGrupo = '';

  /** País elegido en los chips de arriba (o null). */
  get paisDelFiltro(): string | null { return ['', 'sin', 'retirados', 'reembolso'].includes(this.filtro) ? null : this.filtro; }
  enGrupo(id: string): number { return this.activos.filter((p) => p.grupo_id === id).length; }
  /** Estudiantes del país elegido (o de todos) para las tarjetas «Todos» y «Sin grupo». */
  private get delPaisFiltro(): Participante[] {
    const pais = this.paisDelFiltro;
    return this.activos.filter((p) => (pais ? p.pais_id === pais : !!p.pais_id));
  }
  get totalVisibles(): number { return this.delPaisFiltro.length; }
  get sinGrupoCuenta(): number { return this.delPaisFiltro.filter((p) => !p.grupo_id).length; }
  fondoGrupo(color: string | null): string {
    const c = color || '#475569';
    return `linear-gradient(135deg, ${c} 0%, color-mix(in srgb, ${c} 70%, #000) 100%)`;
  }

  /** Grupos que se pueden asignar a la selección: los del país de los seleccionados (si todos son del mismo). */
  get gruposSeleccion(): Grupo[] {
    const paises = new Set(this.seleccionLista.map((p) => p.pais_id));
    if (paises.size !== 1) return [];
    const pais = [...paises][0];
    return pais ? this.gruposDe(pais) : [];
  }
  asignarGrupoSeleccion(valor: string): void {
    if (!valor) return;
    const grupoId = valor === '__sin' ? null : valor;
    const ids = this.seleccionLista.map((p) => p.id);
    this.willGo.actualizarParticipantes(ids, { grupo_id: grupoId }).subscribe({
      next: () => {
        this.seleccionLista.forEach((p) => (p.grupo_id = grupoId));
        this.seleccion.clear();
        this.mostrar(this.t.instant(grupoId ? 'wg.grupos.agregados' : 'wg.grupos.sacados', { n: ids.length }), false);
      },
      error: (e) => this.mostrar(WillGoService.mensajeDeError(e), true),
    });
  }

  nuevoGrupo(): void {
    const pais = this.paisDelFiltro ?? this.paises[0]?.id ?? '';
    this.errorGrupo = '';
    this.borradorGrupo = { pais_id: pais, nombre: '', color: this.coloresGrupo[this.gruposDe(pais).length % this.coloresGrupo.length] };
  }
  editarGrupo(g: Grupo): void {
    this.errorGrupo = '';
    this.borradorGrupo = { id: g.id, pais_id: g.pais_id, nombre: g.nombre, color: g.color || this.coloresGrupo[0] };
  }
  guardarGrupo(): void {
    const b = this.borradorGrupo;
    if (!b || !b.nombre.trim() || !b.pais_id) return;
    this.guardandoGrupo = true;
    this.errorGrupo = '';
    const datos: Partial<Grupo> = { nombre: b.nombre.trim(), color: b.color, pais_id: b.pais_id };
    const peticion = b.id
      ? this.willGo.actualizarEnSeccion<Grupo>('grupos', b.id, datos)
      : this.willGo.crearEnSeccion<Grupo>(this.edicion.id, 'grupos', { ...datos, orden: this.gruposDe(b.pais_id).length + 1 });
    peticion.subscribe({
      next: (g) => {
        const anterior = this.gruposWillGo.find((x) => x.id === g.id);
        // Si el grupo cambió de país, sus estudiantes quedaron sin grupo
        if (anterior && anterior.pais_id !== g.pais_id) this.activos.forEach((p) => { if (p.grupo_id === g.id) p.grupo_id = null; });
        this.gruposWillGo = anterior ? this.gruposWillGo.map((x) => (x.id === g.id ? g : x)) : [...this.gruposWillGo, g];
        this.guardandoGrupo = false;
        this.borradorGrupo = null;
        this.mostrar(this.t.instant('wg.grupos.guardado', { nombre: g.nombre }), false);
      },
      error: (e) => { this.guardandoGrupo = false; this.errorGrupo = WillGoService.mensajeDeError(e); },
    });
  }
  async borrarGrupo(g: Grupo): Promise<void> {
    const ok = await this.confirmacion.pedir({
      titulo: this.t.instant('wg.grupos.confirmarBorrar', { nombre: g.nombre }),
      texto: this.t.instant('wg.grupos.confirmarBorrarTexto'),
      aceptar: this.t.instant('wg.pestanas.comun.eliminar'), peligro: true,
    });
    if (!ok) return;
    this.willGo.borrarGrupo(g.id).subscribe({
      next: () => {
        this.gruposWillGo = this.gruposWillGo.filter((x) => x.id !== g.id);
        this.activos.forEach((p) => { if (p.grupo_id === g.id) p.grupo_id = null; });
        if (this.filtroGrupoWillGo === g.id) this.filtroGrupoWillGo = '';
        this.mostrar(this.t.instant('wg.grupos.borrado', { nombre: g.nombre }), false);
      },
      error: (e) => this.mostrar(WillGoService.mensajeDeError(e), true),
    });
  }

  /** Filtro por grupo de Will-Go ('' = todos, '__sin' = sin grupo). */
  filtroGrupoWillGo = '';
  /** Grupos para el filtro: los del país elegido en los chips o, si no, todos. */
  get gruposFiltro(): Grupo[] {
    const pais = ['', 'sin', 'retirados', 'reembolso'].includes(this.filtro) ? null : this.filtro;
    return (pais ? this.gruposWillGo.filter((g) => g.pais_id === pais) : this.gruposWillGo)
      .slice().sort((a, b) => (a.pais_id || '').localeCompare(b.pais_id || '') || a.nombre.localeCompare(b.nombre));
  }
  nombrePais(id: string | null): string { return this.paises.find((p) => p.id === id)?.nombre ?? ''; }

  /** Grupos de Will-Go (dentro de cada país). */
  gruposWillGo: Grupo[] = [];
  gruposDe(paisId: string | null): Grupo[] { return paisId ? this.gruposWillGo.filter((g) => g.pais_id === paisId) : []; }
  colorGrupo(id: string | null | undefined): string | null { return this.gruposWillGo.find((g) => g.id === id)?.color ?? null; }

  /** Ubica al estudiante en un grupo de su país (o lo saca, con null). */
  asignarGrupo(p: Participante, grupoId: string | null): void {
    const anterior = p.grupo_id ?? null;
    p.grupo_id = grupoId;
    this.willGo.actualizarParticipantes([p.id], { grupo_id: grupoId }).subscribe({
      error: (e) => { p.grupo_id = anterior; this.mostrar(WillGoService.mensajeDeError(e), true); },
    });
  }

  ngOnInit(): void {
    this.willGo.seccion<Pais>(this.edicion.id, 'paises').subscribe({ next: (p) => (this.paises = p) });
    this.willGo.seccion<Grupo>(this.edicion.id, 'grupos').subscribe({ next: (g) => (this.gruposWillGo = g), error: () => (this.gruposWillGo = []) });
    this.cargar();
  }

  /** El motivo se guarda en español (dato del servidor); en pantalla se muestra traducido. */
  readonly motivos = ['No asistirá', 'Reembolso', 'Otro'];
  readonly claveMotivo: Record<string, string> = {
    'No asistirá': 'wg.pestanas.participantes.motivos.noAsistira',
    Reembolso: 'wg.pestanas.participantes.motivos.reembolso',
    Otro: 'wg.pestanas.participantes.motivos.otro',
  };
  retiro: Participante[] | null = null;
  motivo = 'No asistirá';
  motivoOtro = '';
  errorRetiro = '';

  /** Los retirados no cuentan en ningún conteo ni lista, salvo en su propio filtro. */
  get activos(): Participante[] {
    return this.lista.filter((p) => !p.retirado);
  }

  get retirados(): Participante[] {
    return this.lista.filter((p) => p.retirado);
  }

  get conReembolso(): Participante[] {
    return this.activos.filter((p) => p.pidio_reembolso);
  }

  get seleccionLista(): Participante[] {
    return this.lista.filter((p) => this.seleccion.has(p.id));
  }

  get billetesARetirar(): number {
    return (this.retiro ?? []).reduce((t, p) => t + (p.saldo || 0), 0);
  }

  get sinPais(): Participante[] {
    return this.activos.filter((p) => !p.pais_id);
  }

  get filtrados(): Participante[] {
    const q = this.busqueda.trim().toLowerCase();
    const base = this.filtro === 'retirados' ? this.retirados : this.filtro === 'reembolso' ? this.conReembolso : this.activos;
    return base.filter((p) =>
      (['', 'retirados', 'reembolso'].includes(this.filtro) || (this.filtro === 'sin' ? !p.pais_id : p.pais_id === this.filtro)) &&
      (!q || `${p.nombre} ${p.apellido} ${p.codigo}`.toLowerCase().includes(q)) &&
      (!this.filtroGrado || this.nivelDe(p.grado) === this.filtroGrado) &&
      (!this.filtroGrupo || this.grupoDe(p.grado) === this.filtroGrupo) &&
      (!this.filtroGrupoWillGo || (this.filtroGrupoWillGo === '__sin' ? !p.grupo_id : p.grupo_id === this.filtroGrupoWillGo)));
  }

  /** Filtro por grado: se agrupa por el nivel (la primera palabra del grado: «2 03» → 2, «TRANSICIÓN 01» → TRANSICIÓN). */
  filtroGrado = '';
  nivelDe(grado: string | null | undefined): string {
    return (grado ?? '').trim().split(/\s+/)[0]?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() || '—';
  }
  /** Grupo: lo que va después del nivel («2 03» → 03). */
  filtroGrupo = '';
  grupoDe(grado: string | null | undefined): string {
    return (grado ?? '').trim().split(/\s+/).slice(1).join(' ').toUpperCase();
  }
  private get baseGrado(): Participante[] {
    return this.filtro === 'retirados' ? this.retirados : this.filtro === 'reembolso' ? this.conReembolso : this.activos;
  }
  /** Niveles presentes en la lista (en orden: preescolar primero y luego 1°, 2°…). */
  get grados(): string[] {
    const orden = (n: string) => { const num = Number(n); return Number.isFinite(num) ? 100 + num : ({ PREJARDIN: 1, JARDIN: 2, KINDER: 3, TRANSICION: 4 } as Record<string, number>)[n] ?? (n === '—' ? 999 : 50); };
    return [...new Set(this.baseGrado.map((p) => this.nivelDe(p.grado)))].sort((a, b) => orden(a) - orden(b) || a.localeCompare(b));
  }
  /** Grupos del grado elegido. */
  get grupos(): string[] {
    if (!this.filtroGrado) return [];
    return [...new Set(this.baseGrado.filter((p) => this.nivelDe(p.grado) === this.filtroGrado).map((p) => this.grupoDe(p.grado)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }
  nombreNivel(nivel: string): string {
    if (nivel === '—') return this.t.instant('wg.pestanas.participantes.sinGrado');
    if (Number.isFinite(Number(nivel))) return `${nivel}°`;
    const conTilde: Record<string, string> = { TRANSICION: 'Transición', JARDIN: 'Jardín', PREJARDIN: 'Prejardín' };
    return conTilde[nivel] ?? nivel.charAt(0) + nivel.slice(1).toLowerCase();
  }

  get todosSeleccionados(): boolean {
    return this.filtrados.length > 0 && this.filtrados.every((p) => this.seleccion.has(p.id));
  }

  cuantos(paisId: string): number {
    return this.activos.filter((p) => p.pais_id === paisId).length;
  }

  colorDe(paisId: string | null): string | null {
    return this.paises.find((p) => p.id === paisId)?.color ?? null;
  }

  monedaDe(paisId: string | null): string {
    return this.paises.find((p) => p.id === paisId)?.codigo_moneda ?? '';
  }

  cargar(): void {
    this.willGo.participantes(this.edicion.id).subscribe({
      next: (l) => { this.lista = l; this.cargando = false; },
      error: (e) => { this.cargando = false; this.mostrar(WillGoService.mensajeDeError(e), true); },
    });
  }

  alternar(id: string): void {
    if (this.seleccion.has(id)) this.seleccion.delete(id); else this.seleccion.add(id);
  }

  seleccionarTodos(marcar: boolean): void {
    for (const p of this.filtrados) if (marcar) this.seleccion.add(p.id); else this.seleccion.delete(p.id);
  }

  /** Reparte a los que no tienen país, completando primero los países con menos gente. */
  repartir(): void {
    const conteo = new Map(this.paises.map((p) => [p.id, this.cuantos(p.id)]));
    const asignaciones = new Map<string, string[]>();
    for (const est of [...this.sinPais].sort(() => Math.random() - 0.5)) {
      const [pais] = [...conteo.entries()].sort((a, b) => a[1] - b[1])[0];
      conteo.set(pais, conteo.get(pais)! + 1);
      asignaciones.set(pais, [...(asignaciones.get(pais) ?? []), est.id]);
    }
    this.trabajando = true;
    const pendientes = [...asignaciones.entries()];
    let bienvenidas = 0;
    const siguiente = (r?: { bienvenidas: number }) => {
      bienvenidas += r?.bienvenidas ?? 0;
      const par = pendientes.shift();
      if (!par) {
        this.trabajando = false;
        this.mostrar(this.t.instant('wg.pestanas.participantes.repartidos') + (bienvenidas ? ' ' + this.t.instant('wg.pestanas.participantes.repartidosBienvenida', { n: bienvenidas }) : ''), false);
        this.cargar();
        this.cambio.emit();
        return;
      }
      this.willGo.actualizarParticipantes(par[1], { pais_id: par[0] }).subscribe({
        next: siguiente,
        error: (e) => { this.trabajando = false; this.mostrar(WillGoService.mensajeDeError(e), true); this.cargar(); },
      });
    };
    siguiente();
  }

  pedirRetiro(lista: Participante[]): void {
    this.retiro = lista.filter((p) => !p.retirado);
    this.motivo = lista.some((p) => p.pidio_reembolso) ? 'Reembolso' : 'No asistirá';
    this.motivoOtro = '';
    this.errorRetiro = '';
  }

  confirmarRetiro(): void {
    if (!this.retiro?.length) return;
    const motivo = this.motivo === 'Otro' ? this.motivoOtro.trim() : this.motivo;
    this.trabajando = true;
    this.willGo.retirarParticipantes(this.retiro.map((p) => p.id), motivo).subscribe({
      next: (r) => {
        this.trabajando = false;
        this.retiro = null;
        this.seleccion.clear();
        this.mostrar((r.retirados === 1 ? this.t.instant('wg.pestanas.participantes.retiradoUno') : this.t.instant('wg.pestanas.participantes.retiradosN', { n: r.retirados }))
          + (r.billetes_devueltos ? ' ' + this.t.instant('wg.pestanas.participantes.billetesVolvieron', { n: formatearNumero(r.billetes_devueltos) }) : ''), false);
        this.cargar();
        this.cambio.emit();
      },
      error: (e) => { this.trabajando = false; this.errorRetiro = WillGoService.mensajeDeError(e); },
    });
  }

  reintegrar(lista: Participante[]): void {
    this.willGo.reintegrarParticipantes(lista.map((p) => p.id)).subscribe({
      next: (r) => {
        this.seleccion.clear();
        this.mostrar(r.reintegrados === 1 ? this.t.instant('wg.pestanas.participantes.reintegradoUno') : this.t.instant('wg.pestanas.participantes.reintegradosN', { n: r.reintegrados }), false);
        if (!this.lista.some((p) => p.retirado && !lista.includes(p))) this.filtro = '';
        this.cargar();
        this.cambio.emit();
      },
      error: (e) => this.mostrar(WillGoService.mensajeDeError(e), true),
    });
  }

  asignarSeleccion(paisId: string): void {
    this.asignar([...this.seleccion], paisId);
  }

  asignar(ids: string[], paisId: string | null): void {
    this.willGo.actualizarParticipantes(ids, { pais_id: paisId }).subscribe({
      next: (r) => {
        for (const p of this.lista) if (ids.includes(p.id)) p.pais_id = paisId;
        this.seleccion.clear();
        const asignados = ids.length > 1 ? this.t.instant('wg.pestanas.participantes.asignadosN', { n: ids.length }) : this.t.instant('wg.pestanas.participantes.paisAsignado');
        const bienvenida = r.bienvenidas
          ? ' ' + this.t.instant(r.bienvenidas === 1 ? 'wg.pestanas.participantes.bienvenidaUno' : 'wg.pestanas.participantes.bienvenidaVarios', { n: r.bienvenidas, billetes: this.edicion.investment_bill })
          : '';
        this.mostrar(asignados + bienvenida, false);
        if (r.bienvenidas) this.cargar(); // para ver el saldo nuevo
        this.cambio.emit();
      },
      error: (e) => { this.mostrar(WillGoService.mensajeDeError(e), true); this.cargar(); },
    });
  }

  marcarPresente(p: Participante, presente: boolean): void {
    this.willGo.actualizarParticipantes([p.id], { presente }).subscribe({
      next: () => (p.presente = presente),
      error: (e) => this.mostrar(WillGoService.mensajeDeError(e), true),
    });
  }

  private mostrar(texto: string, esError: boolean): void {
    this.aviso = texto;
    this.avisoError = esError;
    if (texto && !esError) setTimeout(() => { if (this.aviso === texto) this.aviso = ''; }, 4000);
  }
}
