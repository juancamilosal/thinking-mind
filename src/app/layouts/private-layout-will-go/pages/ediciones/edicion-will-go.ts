import { Component, OnInit, inject, ViewChild, ElementRef, HostListener } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { Edicion, Pais, WillGoService } from '../../../../core/services/will-go.service';
import { ESTADO_EDICION } from './estado-edicion';
import { TabGeneral } from './tabs/tab-general';
import { EliminarEdicionComponent } from './eliminar-edicion.component';
import { TabParticipantes } from './tabs/tab-participantes';
import { TabTienda } from './tabs/tab-tienda';
import { TabEconomia } from './tabs/tab-economia';
import { TabEquipo } from './tabs/tab-equipo';
import { TabResumen } from './tabs/tab-resumen';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

type Pestana = 'general' | 'economia' | 'participantes' | 'tienda' | 'equipo' | 'resumen';

@Component({
  selector: 'app-edicion-will-go',
  standalone: true,
  imports: [RouterLink, DecimalPipe, EliminarEdicionComponent, TabGeneral, TabEconomia, TabParticipantes, TabTienda, TabEquipo, TabResumen, FormsModule, TranslatePipe],
  template: `
    <div class="max-w-6xl mx-auto">
      <a routerLink="/private-will-go/ediciones" class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-orange-700">{{ 'wg.admin.edi.volver' | translate }}</a>

      @if (cargando) {
        <div class="mt-4 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.admin.edi.cargando' | translate }}</div>
      } @else if (error) {
        <div class="mt-4 bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
      } @else if (edicion) {
        <!-- Encabezado -->
        <div class="mt-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
          <div class="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-2xl font-bold text-gray-800">{{ edicion.nombre }}</h1>
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full" [class]="estado[edicion.estado].clase">{{ estado[edicion.estado].texto | translate }}</span>
              </div>
              <p class="text-gray-500 mt-1">{{ edicion.colegio_nombre || ('wg.admin.sinColegio' | translate) }} · {{ edicion.programa_nombre || ('wg.admin.sinPrograma' | translate) }}{{ edicion.edicion_programa ? ' · ' + ('wg.admin.edicionN' | translate: { n: edicion.edicion_programa }) : '' }}</p>
            </div>
            <div class="flex flex-col sm:flex-row gap-2">
            <button type="button" (click)="eliminando = true"
                    class="order-2 sm:order-1 px-4 py-3 rounded-xl text-sm font-semibold border border-red-200 text-red-700 hover:bg-red-50">
              {{ 'wg.admin.eliminar' | translate }}
            </button>
            @if (edicion.estado === 'borrador') {
              <button type="button" (click)="verificarApertura()"
                      class="order-1 sm:order-2 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 shadow hover:brightness-110">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {{ 'wg.admin.edi.abrir' | translate }}
              </button>
            } @else if (edicion.estado === 'abierta') {
              <p class="order-1 sm:order-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">{{ 'wg.admin.edi.enMarcha' | translate }}</p>
              <button type="button" (click)="abrirCierre()"
                      class="order-1 sm:order-3 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-white bg-slate-800 hover:bg-slate-900 shadow">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>
                {{ 'wg.admin.edi.cerrar' | translate }}
              </button>
            } @else if (edicion.estado === 'cerrada') {
              <p class="order-1 sm:order-2 text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded-xl px-4 py-2">{{ 'wg.admin.edi.cerradaTexto' | translate }} <button type="button" class="font-semibold underline p-0" (click)="pestana = 'resumen'">{{ 'wg.admin.edi.cerradaEnlace' | translate }}</button>{{ 'wg.admin.edi.cerradaFin' | translate }}</p>
            }
            </div>
          </div>

          <!-- Resumen -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div class="rounded-xl bg-gray-50 p-3"><p class="text-xl font-bold text-gray-800">{{ edicion.participantes }}</p><p class="text-xs text-gray-500">{{ 'wg.admin.edi.estudiantes' | translate }}{{ edicion.retirados ? ' · ' + ('wg.admin.edi.retirados' | translate: { n: edicion.retirados }) : '' }}</p></div>
            <div class="rounded-xl p-3" [class]="edicion.sin_pais ? 'bg-amber-50' : 'bg-gray-50'"><p class="text-xl font-bold" [class]="edicion.sin_pais ? 'text-amber-700' : 'text-gray-800'">{{ edicion.sin_pais }}</p><p class="text-xs text-gray-500">{{ 'wg.admin.edi.sinPaisAsignado' | translate }}</p></div>
            <div class="rounded-xl bg-gray-50 p-3"><p class="text-xl font-bold text-gray-800">{{ edicion.tasa_inicial | number }}</p><p class="text-xs text-gray-500">{{ 'wg.admin.edi.tasaInicial' | translate }}</p></div>
            <div class="rounded-xl bg-gray-50 p-3"><p class="text-xl font-bold text-gray-800">{{ edicion.investment_bill }}</p><p class="text-xs text-gray-500">{{ 'wg.admin.billetesBienvenida' | translate }}</p></div>
          </div>
        </div>

        <!-- Pestañas -->
        <div #barraPestanas (scroll)="medirBarra()" class="sin-barra mt-5 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto scroll-smooth">
          <div class="inline-flex gap-1 bg-white border border-gray-200 rounded-2xl p-1 shadow-sm" role="tablist">
            @for (p of pestanas; track p.id) {
              <button type="button" role="tab" [attr.aria-selected]="pestana === p.id" (click)="elegirPestana(p.id, $event)"
                      class="whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-semibold transition"
                      [class]="pestana === p.id ? 'bg-slate-800 text-white shadow' : 'text-gray-600 hover:bg-gray-100'">
                {{ p.texto | translate }}
              </button>
            }
          </div>
        </div>
        <!-- Indicador de desplazamiento: se ve solo si las pestañas no caben (p. ej. en celular) -->
        @if (barra.hay) {
          <div class="mt-2 mx-auto w-24 h-1.5 rounded-full bg-gray-200 overflow-hidden" aria-hidden="true">
            <div class="h-full rounded-full bg-slate-500 transition-[margin] duration-150" [style.width.%]="barra.ancho" [style.margin-left.%]="barra.inicio"></div>
          </div>
        }

        <div class="mt-5">
          @switch (pestana) {
            @case ('general') { <app-tab-general [edicion]="edicion" (guardada)="edicion = $event" /> }
            @case ('economia') { <app-tab-economia [edicion]="edicion" (guardada)="edicion = $event" /> }
            @case ('participantes') { <app-tab-participantes [edicion]="edicion" (cambio)="recargar()" /> }
            @case ('equipo') { <app-tab-equipo [edicion]="edicion" (cambio)="recargar()" /> }
            @case ('tienda') { <app-tab-tienda [edicion]="edicion" (guardada)="edicion = $event" /> }
            @case ('resumen') { <app-tab-resumen [edicion]="edicion" /> }
          }
        </div>
      }
    </div>

    <!-- Cerrar la edición -->
    @if (cerrando && edicion) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="cerrando = false">
        <div class="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 max-h-[92vh] overflow-y-auto" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-cierre-edicion">
          <h2 id="titulo-cierre-edicion" class="text-lg font-bold text-gray-800">{{ 'wg.admin.edi.cierreTitulo' | translate: { nombre: edicion.nombre } }}</h2>
          <p class="text-sm text-gray-600 mt-2">{{ 'wg.admin.edi.cierreIntro' | translate }}</p>
          <ul class="mt-2 space-y-1.5 text-sm text-gray-700">
            <li class="flex gap-2"><span aria-hidden="true">🛑</span> {{ 'wg.admin.edi.cierre1' | translate }}</li>
            <li class="flex gap-2"><span aria-hidden="true">💰</span> {{ 'wg.admin.edi.cierre2' | translate }}</li>
            <li class="flex gap-2"><span aria-hidden="true">🔒</span> {{ 'wg.admin.edi.cierre3' | translate }}</li>
            <li class="flex gap-2"><span aria-hidden="true">📊</span> {{ 'wg.admin.edi.cierre4' | translate }}</li>
          </ul>
          <p class="mt-3 text-sm font-semibold text-red-700">{{ 'wg.admin.edi.noDeshacer' | translate }}</p>
          <label for="confirmar-cierre" class="block mt-4 text-sm text-gray-700" [innerHTML]="'wg.admin.edi.escribePalabra' | translate: { palabra: palabraCierre }"></label>
          <input id="confirmar-cierre" [(ngModel)]="textoCierre" autocomplete="off" autocapitalize="characters"
                 class="mt-1 w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-semibold tracking-wider focus:outline-none focus:ring-2 focus:ring-slate-300">
          @if (errorCierre) { <p class="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ errorCierre }}</p> }
          <div class="mt-5 flex gap-2">
            <button type="button" (click)="cerrando = false" class="flex-1 py-3 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200">{{ 'wg.admin.cancelar' | translate }}</button>
            <button type="button" (click)="cerrar()" [disabled]="cerrandoAhora || textoCierre.trim().toUpperCase() !== palabraCierre.toUpperCase()"
                    class="flex-1 py-3 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-40">{{ (cerrandoAhora ? 'wg.admin.edi.cerrando' : 'wg.admin.edi.cerrar') | translate }}</button>
          </div>
        </div>
      </div>
    }

    @if (eliminando && edicion) {
      <wg-eliminar-edicion [edicion]="edicion" (cancelar)="eliminando = false" (eliminada)="alEliminar()" />
    }

    <!-- Revisión antes de abrir -->
    @if (revision) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" (click)="revision = null">
        <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6" (click)="$event.stopPropagation()" role="alertdialog" aria-modal="true">
          <h2 class="text-lg font-bold text-gray-800">{{ 'wg.admin.edi.aperturaTitulo' | translate }}</h2>
          <p class="text-gray-600 mt-1 text-sm">{{ 'wg.admin.edi.aperturaTexto' | translate }}</p>
          <ul class="mt-4 space-y-2">
            @for (r of revision; track $index) {
              <li class="flex items-start gap-2 text-sm">
                <span [class]="r.ok ? 'text-emerald-600' : (r.bloquea ? 'text-red-600' : 'text-amber-600')">{{ r.ok ? '✓' : (r.bloquea ? '✕' : '!') }}</span>
                <span [class]="r.ok ? 'text-gray-700' : (r.bloquea ? 'text-red-700' : 'text-amber-800')">{{ r.texto | translate: r.params }}</span>
              </li>
            }
          </ul>
          @if (errorApertura) {
            <p class="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ errorApertura }}</p>
          }
          <div class="flex gap-3 mt-6">
            <button type="button" (click)="revision = null" class="flex-1 py-2.5 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">{{ 'wg.admin.cancelar' | translate }}</button>
            <button type="button" (click)="abrir()" [disabled]="abriendo || bloqueado"
                    class="flex-1 py-2.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {{ (abriendo ? 'wg.admin.edi.abriendo' : 'wg.admin.edi.abrirAhora') | translate }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (aviso) {
      <div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-slate-900 text-white px-5 py-3 shadow-lg text-sm" role="status">{{ aviso }}</div>
    }
  `,
  styles: [':host { display: block; } .sin-barra { scrollbar-width: none; } .sin-barra::-webkit-scrollbar { display: none; }'],
})
export class EdicionWillGo implements OnInit {
  private willGo = inject(WillGoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private t = inject(TranslateService);
  readonly estado = ESTADO_EDICION;
  private readonly todas: { id: Pestana; texto: string }[] = [
    { id: 'general', texto: 'wg.admin.edi.pestana.general' },
    { id: 'economia', texto: 'wg.admin.edi.pestana.economia' },
    { id: 'tienda', texto: 'wg.admin.edi.pestana.tienda' },
    { id: 'participantes', texto: 'wg.admin.edi.pestana.participantes' },
    { id: 'equipo', texto: 'wg.admin.edi.pestana.equipo' },
    { id: 'resumen', texto: 'wg.admin.edi.pestana.resumen' },
  ];
  /** El resumen aparece cuando la edición ya arrancó (abierta: vista previa; cerrada: resumen final). */
  get pestanas(): { id: Pestana; texto: string }[] {
    const e = this.edicion?.estado;
    return this.todas.filter((p) => p.id !== 'resumen' || e === 'abierta' || e === 'cerrada')
      .map((p) => (p.id === 'resumen' && e === 'cerrada' ? { ...p, texto: 'wg.admin.edi.pestana.resumenFinal' } : p));
  }

  edicion: Edicion | null = null;
  paises: Pais[] = [];
  pestana: Pestana = 'general';

  @ViewChild('barraPestanas') set refBarra(el: ElementRef<HTMLElement> | undefined) {
    this.elBarra = el?.nativeElement;
    setTimeout(() => this.medirBarra());
  }
  private elBarra?: HTMLElement;
  /** Tamaño y posición del indicador de desplazamiento (en % de su carril). */
  barra = { hay: false, ancho: 100, inicio: 0 };

  @HostListener('window:resize') medirBarra(): void {
    const el = this.elBarra;
    if (!el) return;
    const total = el.scrollWidth, visible = el.clientWidth;
    const hay = total > visible + 2;
    const ancho = hay ? Math.max(20, (visible / total) * 100) : 100;
    const inicio = hay ? (el.scrollLeft / (total - visible)) * (100 - ancho) : 0;
    this.barra = { hay, ancho, inicio: Math.min(100 - ancho, Math.max(0, inicio)) };
  }

  /** Cambia de pestaña y la deja centrada en la barra (en celular la barra se desliza). */
  elegirPestana(id: Pestana, evento?: Event): void {
    this.pestana = id;
    const boton = evento?.currentTarget as HTMLElement | undefined;
    boton?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
  cargando = true;
  error = '';
  /** Puntos de la revisión: `texto` es la clave de traducción y `params` sus valores. */
  revision: { texto: string; params?: Record<string, unknown>; ok: boolean; bloquea: boolean }[] | null = null;
  abriendo = false;
  errorApertura = '';
  aviso = '';
  eliminando = false;

  get bloqueado(): boolean {
    return !!this.revision?.some((r) => !r.ok && r.bloquea);
  }

  ngOnInit(): void {
    const pestana = this.route.snapshot.queryParamMap.get('pestana') as Pestana | null;
    if (pestana && this.todas.some((p) => p.id === pestana)) this.pestana = pestana;
    this.pestanaPedida = !!pestana;
    this.recargar();
  }

  recargar(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.willGo.edicion(id).subscribe({
      next: (e) => {
        this.edicion = e;
        this.cargando = false;
        // Una edición cerrada abre directo en su resumen final
        if (e.estado === 'cerrada' && !this.pestanaPedida) { this.pestana = 'resumen'; this.pestanaPedida = true; }
        if (this.pestana === 'resumen' && e.estado === 'borrador') this.pestana = 'general';
        const partes = [
          e.nuevos ? this.t.instant(e.nuevos === 1 ? 'wg.admin.edi.avisoNuevo' : 'wg.admin.edi.avisoNuevos', { n: e.nuevos }) : '',
          e.quitados ? this.t.instant(e.quitados === 1 ? 'wg.admin.edi.avisoQuitado' : 'wg.admin.edi.avisoQuitados', { n: e.quitados }) : '',
        ].filter(Boolean);
        if (partes.length) this.mostrarAviso(partes.join(' '));
      },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  /** Revisa lo necesario antes de abrir: lo que bloquea y lo que solo es una advertencia. */
  verificarApertura(): void {
    const e = this.edicion!;
    this.errorApertura = '';
    this.willGo.seccion<Pais>(e.id, 'paises').subscribe({
      next: (paises) => {
        this.paises = paises;
        const sinProvision = paises.filter((p) => !p.provision_inicial);
        const conPais = e.participantes - e.sin_pais;
        this.revision = [
          { texto: 'wg.admin.edi.rev.paises', params: { n: paises.length }, ok: paises.length > 0, bloquea: true },
          {
            texto: sinProvision.length ? 'wg.admin.edi.rev.sinProvision' : 'wg.admin.edi.rev.todosProvision',
            params: { paises: sinProvision.map((p) => p.nombre).join(', ') },
            ok: !sinProvision.length, bloquea: true,
          },
          { texto: 'wg.admin.edi.rev.inscritos', params: { n: e.participantes }, ok: e.participantes > 0, bloquea: false },
          {
            texto: e.sin_pais ? 'wg.admin.edi.rev.sinPais' : 'wg.admin.edi.rev.todosConPais', params: { n: e.sin_pais },
            ok: !e.sin_pais, bloquea: false,
          },
          {
            texto: e.equipo ? 'wg.admin.edi.rev.equipo' : 'wg.admin.edi.rev.sinEquipo', params: { n: e.equipo },
            ok: !!e.equipo, bloquea: false,
          },
          { texto: 'wg.admin.edi.rev.horario', params: { n: e.horario?.length ?? 0 }, ok: !!e.horario?.length, bloquea: false },
          {
            texto: 'wg.admin.edi.rev.bienvenida', params: { billetes: e.investment_bill, n: conPais },
            ok: true, bloquea: false,
          },
        ];
      },
      error: (err) => (this.aviso = WillGoService.mensajeDeError(err)),
    });
  }

  abrir(): void {
    if (!this.edicion || this.bloqueado) return;
    this.abriendo = true;
    this.errorApertura = '';
    this.willGo.abrirEdicion(this.edicion.id).subscribe({
      next: (r) => {
        this.abriendo = false;
        this.revision = null;
        this.mostrarAviso(this.t.instant('wg.admin.edi.avisoAbierta', { provisiones: r.provisiones, bienvenidas: r.bienvenidas }));
        this.recargar();
      },
      error: (err) => { this.abriendo = false; this.errorApertura = WillGoService.mensajeDeError(err); },
    });
  }

  private pestanaPedida = false;
  cerrando = false;
  cerrandoAhora = false;
  textoCierre = '';
  errorCierre = '';
  /** Palabra que hay que escribir para cerrar (cambia con el idioma). */
  get palabraCierre(): string { return this.t.instant('wg.admin.edi.palabraCierre'); }
  abrirCierre(): void { this.textoCierre = ''; this.errorCierre = ''; this.cerrando = true; }
  cerrar(): void {
    if (!this.edicion || this.cerrandoAhora) return;
    this.cerrandoAhora = true;
    this.errorCierre = '';
    this.willGo.cerrarEdicion(this.edicion.id).subscribe({
      next: (r) => {
        this.cerrandoAhora = false;
        this.cerrando = false;
        const partes: string[] = [this.t.instant('wg.admin.edi.avisoCerrada')];
        if (r.rondas_cerradas) partes.push(this.t.instant('wg.admin.edi.avisoRondaCerrada'));
        if (r.inversiones_liquidadas) partes.push(this.t.instant(r.inversiones_liquidadas === 1 ? 'wg.admin.edi.avisoInversion' : 'wg.admin.edi.avisoInversiones', { n: r.inversiones_liquidadas }));
        this.mostrarAviso(partes.join(' '));
        this.pestana = 'resumen';
        this.pestanaPedida = true;
        this.recargar();
      },
      error: (err) => { this.cerrandoAhora = false; this.errorCierre = WillGoService.mensajeDeError(err); },
    });
  }

  alEliminar(): void {
    this.eliminando = false;
    this.router.navigateByUrl('/private-will-go/ediciones');
  }

  private mostrarAviso(texto: string): void {
    this.aviso = texto;
    setTimeout(() => { if (this.aviso === texto) this.aviso = ''; }, 5000);
  }
}
