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

type Pestana = 'general' | 'economia' | 'participantes' | 'tienda' | 'equipo';

@Component({
  selector: 'app-edicion-will-go',
  standalone: true,
  imports: [RouterLink, DecimalPipe, EliminarEdicionComponent, TabGeneral, TabEconomia, TabParticipantes, TabTienda, TabEquipo],
  template: `
    <div class="max-w-6xl mx-auto">
      <a routerLink="/private-will-go/ediciones" class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-orange-700">← Ediciones</a>

      @if (cargando) {
        <div class="mt-4 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Cargando edición…</div>
      } @else if (error) {
        <div class="mt-4 bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
      } @else if (edicion) {
        <!-- Encabezado -->
        <div class="mt-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
          <div class="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-2xl font-bold text-gray-800">{{ edicion.nombre }}</h1>
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full" [class]="estado[edicion.estado].clase">{{ estado[edicion.estado].texto }}</span>
              </div>
              <p class="text-gray-500 mt-1">{{ edicion.colegio_nombre || 'Sin colegio' }} · {{ edicion.programa_nombre || 'Sin programa' }}{{ edicion.edicion_programa ? ' · Edición ' + edicion.edicion_programa : '' }}</p>
            </div>
            <div class="flex flex-col sm:flex-row gap-2">
            <button type="button" (click)="eliminando = true"
                    class="order-2 sm:order-1 px-4 py-3 rounded-xl text-sm font-semibold border border-red-200 text-red-700 hover:bg-red-50">
              Eliminar
            </button>
            @if (edicion.estado === 'borrador') {
              <button type="button" (click)="verificarApertura()"
                      class="order-1 sm:order-2 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 shadow hover:brightness-110">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Abrir edición
              </button>
            } @else if (edicion.estado === 'abierta') {
              <p class="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">La economía está en marcha: el banco ya tiene sus billetes.</p>
            }
            </div>
          </div>

          <!-- Resumen -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div class="rounded-xl bg-gray-50 p-3"><p class="text-xl font-bold text-gray-800">{{ edicion.participantes }}</p><p class="text-xs text-gray-500">Estudiantes{{ edicion.retirados ? ' · ' + edicion.retirados + ' retirados' : '' }}</p></div>
            <div class="rounded-xl p-3" [class]="edicion.sin_pais ? 'bg-amber-50' : 'bg-gray-50'"><p class="text-xl font-bold" [class]="edicion.sin_pais ? 'text-amber-700' : 'text-gray-800'">{{ edicion.sin_pais }}</p><p class="text-xs text-gray-500">Sin país asignado</p></div>
            <div class="rounded-xl bg-gray-50 p-3"><p class="text-xl font-bold text-gray-800">{{ edicion.tasa_inicial | number }}</p><p class="text-xs text-gray-500">Tasa inicial (pesos por billete)</p></div>
            <div class="rounded-xl bg-gray-50 p-3"><p class="text-xl font-bold text-gray-800">{{ edicion.investment_bill }}</p><p class="text-xs text-gray-500">Billetes de bienvenida</p></div>
          </div>
        </div>

        <!-- Pestañas -->
        <div #barraPestanas (scroll)="medirBarra()" class="sin-barra mt-5 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto scroll-smooth">
          <div class="inline-flex gap-1 bg-white border border-gray-200 rounded-2xl p-1 shadow-sm" role="tablist">
            @for (p of pestanas; track p.id) {
              <button type="button" role="tab" [attr.aria-selected]="pestana === p.id" (click)="elegirPestana(p.id, $event)"
                      class="whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-semibold transition"
                      [class]="pestana === p.id ? 'bg-slate-800 text-white shadow' : 'text-gray-600 hover:bg-gray-100'">
                {{ p.texto }}
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
          }
        </div>
      }
    </div>

    @if (eliminando && edicion) {
      <wg-eliminar-edicion [edicion]="edicion" (cancelar)="eliminando = false" (eliminada)="alEliminar()" />
    }

    <!-- Revisión antes de abrir -->
    @if (revision) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" (click)="revision = null">
        <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6" (click)="$event.stopPropagation()" role="alertdialog" aria-modal="true">
          <h2 class="text-lg font-bold text-gray-800">Abrir la edición</h2>
          <p class="text-gray-600 mt-1 text-sm">Al abrir, cada estudiante con país recibe sus billetes de bienvenida desde el banco de su país, y empieza a moverse la tasa.</p>
          <ul class="mt-4 space-y-2">
            @for (r of revision; track r.texto) {
              <li class="flex items-start gap-2 text-sm">
                <span [class]="r.ok ? 'text-emerald-600' : (r.bloquea ? 'text-red-600' : 'text-amber-600')">{{ r.ok ? '✓' : (r.bloquea ? '✕' : '!') }}</span>
                <span [class]="r.ok ? 'text-gray-700' : (r.bloquea ? 'text-red-700' : 'text-amber-800')">{{ r.texto }}</span>
              </li>
            }
          </ul>
          @if (errorApertura) {
            <p class="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ errorApertura }}</p>
          }
          <div class="flex gap-3 mt-6">
            <button type="button" (click)="revision = null" class="flex-1 py-2.5 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="button" (click)="abrir()" [disabled]="abriendo || bloqueado"
                    class="flex-1 py-2.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {{ abriendo ? 'Abriendo…' : 'Abrir ahora' }}
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
  readonly estado = ESTADO_EDICION;
  readonly pestanas: { id: Pestana; texto: string }[] = [
    { id: 'general', texto: 'General' },
    { id: 'economia', texto: 'Economía' },
    { id: 'tienda', texto: 'GO•STORE' },
    { id: 'participantes', texto: 'Estudiantes' },
    { id: 'equipo', texto: 'Colaboradores' },
  ];

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
  revision: { texto: string; ok: boolean; bloquea: boolean }[] | null = null;
  abriendo = false;
  errorApertura = '';
  aviso = '';
  eliminando = false;

  get bloqueado(): boolean {
    return !!this.revision?.some((r) => !r.ok && r.bloquea);
  }

  ngOnInit(): void {
    const pestana = this.route.snapshot.queryParamMap.get('pestana') as Pestana | null;
    if (pestana && this.pestanas.some((p) => p.id === pestana)) this.pestana = pestana;
    this.recargar();
  }

  recargar(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.willGo.edicion(id).subscribe({
      next: (e) => {
        this.edicion = e;
        this.cargando = false;
        const partes = [
          e.nuevos ? (e.nuevos === 1 ? 'Llegó 1 inscrito nuevo.' : `Llegaron ${e.nuevos} inscritos nuevos.`) : '',
          e.quitados ? (e.quitados === 1 ? 'Salió 1 estudiante que no es del colegio de la edición.' : `Salieron ${e.quitados} estudiantes que no son del colegio de la edición.`) : '',
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
          { texto: `${paises.length} países configurados`, ok: paises.length > 0, bloquea: true },
          {
            texto: sinProvision.length ? `Sin provisión del banco: ${sinProvision.map((p) => p.nombre).join(', ')}` : 'Todos los países tienen provisión del banco',
            ok: !sinProvision.length, bloquea: true,
          },
          { texto: `${e.participantes} estudiantes inscritos`, ok: e.participantes > 0, bloquea: false },
          {
            texto: e.sin_pais ? `${e.sin_pais} estudiantes sin país (no reciben bienvenida hasta tener uno)` : 'Todos los estudiantes tienen país',
            ok: !e.sin_pais, bloquea: false,
          },
          {
            texto: e.equipo ? `${e.equipo} colaboradores en el equipo` : 'La edición no tiene colaboradores: nadie podrá entregar billetes ni cobrar',
            ok: !!e.equipo, bloquea: false,
          },
          { texto: `Horario con ${e.horario?.length ?? 0} franjas (fuera de ellas la tasa no cambia)`, ok: !!e.horario?.length, bloquea: false },
          {
            texto: `Bienvenida: ${e.investment_bill} billetes × ${conPais} estudiantes con país`,
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
        this.mostrarAviso(`Edición abierta: ${r.provisiones} provisiones del banco y ${r.bienvenidas} bienvenidas entregadas.`);
        this.recargar();
      },
      error: (err) => { this.abriendo = false; this.errorApertura = WillGoService.mensajeDeError(err); },
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
