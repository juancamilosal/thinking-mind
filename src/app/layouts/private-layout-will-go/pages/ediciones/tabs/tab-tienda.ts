import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NumeroMilesDirective, formatearNumero } from '../../../numero-miles.directive';
import { DecimalPipe } from '@angular/common';
import { Edicion, Funcionario, Pais, Producto, WillGoService } from '../../../../../core/services/will-go.service';
import { BuscadorPersonaComponent } from '../../../buscador-persona.component';
import { precioEnBilletes, reducirFoto } from '../estado-edicion';

type Borrador = Partial<Producto> & { fotoVista?: string | null };

@Component({
  selector: 'app-tab-tienda',
  standalone: true,
  imports: [FormsModule, NumeroMilesDirective, DecimalPipe, BuscadorPersonaComponent, TranslatePipe],
  template: `
    <!-- Encargado de la caja -->
    <section class="mb-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <label for="encargado-caja" class="block text-sm font-semibold text-gray-700">{{ 'wg.pestanas.tienda.encargadoCaja' | translate }}</label>
      <p class="text-xs text-gray-500 mb-2">{{ 'wg.pestanas.tienda.soloEncargado' | translate }}</p>
      <div class="flex flex-col sm:flex-row gap-2">
        <div class="flex-1">
          <wg-buscador-persona inputId="encargado-caja" [(ngModel)]="encargado" [personas]="cajeros"
                               [placeholder]="'wg.pestanas.tienda.buscarCajero' | translate" [vacio]="'wg.pestanas.tienda.sinCajeros' | translate" />
        </div>
        <button type="button" (click)="guardarEncargado()" [disabled]="guardandoEncargado || encargado === (edicion.responsable_caja ?? null)"
                class="shrink-0 px-5 py-3 rounded-xl font-semibold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-40">
          {{ (guardandoEncargado ? 'wg.pestanas.comun.guardando' : 'wg.pestanas.comun.guardar') | translate }}
        </button>
      </div>
      @if (!cajeros.length) { <p class="text-xs text-gray-500 mt-2" [innerHTML]="'wg.pestanas.tienda.crearCajero' | translate"></p> }
      @if (avisoEncargado) { <p class="text-sm text-emerald-700 mt-2" role="status">{{ avisoEncargado }}</p> }
    </section>

    <div class="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
      <p class="text-sm text-gray-500" [innerHTML]="'wg.pestanas.tienda.precioPesos' | translate"></p>
      <button type="button" (click)="nuevo()" class="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 shadow hover:brightness-110">
        {{ 'wg.pestanas.tienda.nuevoProducto' | translate }}
      </button>
    </div>

    @if (cargando) {
      <div class="mt-4 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.pestanas.tienda.cargando' | translate }}</div>
    } @else if (!productos.length) {
      <div class="mt-4 bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
        <p class="font-semibold text-gray-700">{{ 'wg.pestanas.tienda.vacia' | translate }}</p>
        <p class="text-sm text-gray-500 mt-1">{{ 'wg.pestanas.tienda.vaciaAyuda' | translate }}</p>
      </div>
    } @else {
      <div class="mt-4 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        @for (p of productos; track p.id) {
          <article class="min-w-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col" [class.opacity-60]="!p.activo">
            <!-- Computador: foto grande arriba -->
            <div class="hidden sm:flex aspect-[4/3] bg-orange-50 items-center justify-center">
              @if (p.foto) { <img [src]="urlFoto(p.foto)" [alt]="p.nombre" class="w-full h-full object-cover" loading="lazy"> }
              @else { <span class="text-5xl" aria-hidden="true">🛍️</span> }
            </div>
            <div class="p-4 flex-1 min-w-0 flex flex-col">
              <!-- Celular: foto pequeña al lado del nombre -->
              <div class="flex items-start gap-3">
                <div class="sm:hidden w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-orange-50 flex items-center justify-center">
                  @if (p.foto) { <img [src]="urlFoto(p.foto)" [alt]="p.nombre" class="w-full h-full object-cover" loading="lazy"> }
                  @else { <span class="text-3xl" aria-hidden="true">🛍️</span> }
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-gray-800 leading-tight">{{ p.nombre }}</p>
                  <p class="text-sm text-gray-500 mt-0.5">{{ 'wg.pestanas.tienda.pesos' | translate: { n: (p.precio_cop | number) } }}</p>
                  <p class="text-xs mt-1" [class]="p.stock > 0 ? 'text-gray-500' : 'text-red-600 font-semibold'">
                    {{ p.stock > 0 ? ('wg.pestanas.tienda.disponibles' | translate: { n: (p.stock | number) }) : ('wg.pestanas.tienda.agotado' | translate) }}{{ p.maximo_por_estudiante ? ' · ' + ('wg.pestanas.tienda.maxPorEstudiante' | translate: { n: p.maximo_por_estudiante }) : '' }}
                  </p>
                  @if (!p.activo) { <p class="text-xs font-semibold text-gray-500 mt-1">{{ 'wg.pestanas.tienda.ocultoCaja' | translate }}</p> }
                </div>
              </div>
              <!-- Precio en la moneda de cada país -->
              <div class="mt-3 grid grid-cols-3 gap-1.5">
                @for (pa of paises; track pa.id) {
                  <span class="text-xs font-bold px-2 py-1 rounded-lg text-white text-center whitespace-nowrap" [style.background]="pa.color">{{ billetes(p, pa) | number }} {{ pa.codigo_moneda }}</span>
                }
              </div>
              <button type="button" (click)="editar(p)" class="mt-3 sm:mt-auto sm:pt-3 w-full sm:w-auto py-2 sm:py-0 rounded-xl sm:rounded-none border border-orange-200 sm:border-0 text-sm font-semibold text-orange-700 hover:bg-orange-50 sm:hover:bg-transparent sm:hover:underline sm:text-left">{{ 'wg.pestanas.comun.editar' | translate }}</button>
            </div>
          </article>
        }
      </div>
    }

    @if (borrador) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="borrador = null">
        <div class="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <div class="px-6 pt-6 pb-2 flex items-start justify-between">
            <h2 class="text-xl font-bold text-gray-800">{{ (borrador.id ? 'wg.pestanas.tienda.tituloEditar' : 'wg.pestanas.tienda.tituloNuevo') | translate }}</h2>
            <button type="button" (click)="borrador = null" class="p-1 text-gray-400 hover:text-gray-600" [attr.aria-label]="'wg.pestanas.comun.cerrar' | translate">✕</button>
          </div>
          <div class="px-6 pb-6 space-y-4">
            <div class="flex items-center gap-4">
              <div class="w-24 h-24 shrink-0 rounded-2xl bg-orange-50 overflow-hidden flex items-center justify-center border border-orange-100">
                @if (borrador.fotoVista) { <img [src]="borrador.fotoVista" alt="" class="w-full h-full object-cover"> } @else { <span class="text-4xl">🛍️</span> }
              </div>
              <label class="cursor-pointer px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                {{ (subiendo ? 'wg.pestanas.tienda.subiendo' : (borrador.foto ? 'wg.pestanas.tienda.cambiarFoto' : 'wg.pestanas.tienda.subirFoto')) | translate }}
                <input type="file" accept="image/*" class="sr-only" (change)="elegirFoto($event)" [disabled]="subiendo">
              </label>
            </div>
            <div>
              <label for="p-nombre" class="block text-sm font-semibold text-gray-700 mb-1">{{ 'wg.pestanas.comun.nombre' | translate }}</label>
              <input id="p-nombre" [(ngModel)]="borrador.nombre" class="campo" [placeholder]="'wg.pestanas.tienda.ejemploNombre' | translate">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="p-precio" class="block text-sm font-semibold text-gray-700 mb-1">{{ 'wg.pestanas.tienda.precio' | translate }}</label>
                <input id="p-precio" wgNumero [(ngModel)]="borrador.precio_cop" class="campo">
              </div>
              <div>
                <label for="p-stock" class="block text-sm font-semibold text-gray-700 mb-1">{{ 'wg.pestanas.tienda.unidades' | translate }}</label>
                <input id="p-stock" wgNumero [(ngModel)]="borrador.stock" class="campo">
              </div>
            </div>
            <div>
              <label for="p-max" class="block text-sm font-semibold text-gray-700 mb-1">{{ 'wg.pestanas.tienda.maximo' | translate }} <span class="font-normal text-gray-400">{{ 'wg.pestanas.tienda.sinLimite' | translate }}</span></label>
              <input id="p-max" wgNumero [(ngModel)]="borrador.maximo_por_estudiante" class="campo">
            </div>
            @if (borrador.precio_cop) {
              <p class="text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">{{ 'wg.pestanas.tienda.hoyCostaria' | translate }}
                @for (pa of paises; track pa.id) { <b class="ml-1">{{ billetes($any(borrador), pa) | number }} {{ pa.codigo_moneda }}</b> }
              </p>
            }
            <label class="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" [(ngModel)]="borrador.activo"> {{ 'wg.pestanas.tienda.visibleCaja' | translate }}
            </label>
            @if (error) { <p class="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ error }}</p> }
            <!-- Celular: un botón por línea (Guardar arriba). Computador: en fila -->
            <div class="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
              @if (borrador.id) {
                <button type="button" (click)="borrar()" [disabled]="guardando" class="w-full sm:w-auto px-4 py-3 rounded-xl border border-red-200 font-semibold text-red-700 hover:bg-red-50">{{ 'wg.pestanas.comun.eliminar' | translate }}</button>
              }
              <button type="button" (click)="borrador = null" class="w-full sm:w-auto sm:flex-1 py-3 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">{{ 'wg.pestanas.comun.cancelar' | translate }}</button>
              <button type="button" (click)="guardar()" [disabled]="guardando || subiendo" class="w-full sm:w-auto sm:flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:brightness-110 disabled:opacity-60">
                {{ (guardando ? 'wg.pestanas.comun.guardando' : 'wg.pestanas.comun.guardar') | translate }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .campo { width: 100%; padding: 0.625rem 1rem; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 0.75rem; }
    .campo:focus { outline: none; border-color: #fb923c; box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.2); }
  `],
})
export class TabTienda implements OnInit {
  @Input({ required: true }) edicion!: Edicion;
  @Output() guardada = new EventEmitter<Edicion>();
  private willGo = inject(WillGoService);
  private t = inject(TranslateService);

  cajeros: Funcionario[] = [];
  encargado: string | null = null;
  guardandoEncargado = false;
  avisoEncargado = '';

  productos: Producto[] = [];
  paises: Pais[] = [];
  cargando = true;
  borrador: Borrador | null = null;
  guardando = false;
  subiendo = false;
  error = '';

  ngOnInit(): void {
    this.encargado = this.edicion.responsable_caja ?? null;
    this.willGo.funcionarios().subscribe({ next: (l) => (this.cajeros = l.filter((f) => f.rol === 'cajero' && f.estado === 'active')) });
    this.willGo.seccion<Pais>(this.edicion.id, 'paises').subscribe({ next: (p) => (this.paises = p) });
    this.willGo.seccion<Producto>(this.edicion.id, 'productos').subscribe({
      next: (l) => { this.productos = l; this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  guardarEncargado(): void {
    this.guardandoEncargado = true;
    this.error = '';
    this.willGo.actualizarEdicion(this.edicion.id, { responsable_caja: this.encargado }).subscribe({
      next: (e) => {
        this.guardandoEncargado = false;
        this.edicion = e;
        this.guardada.emit(e);
        const c = this.cajeros.find((x) => x.id === e.responsable_caja);
        this.avisoEncargado = c
          ? this.t.instant('wg.pestanas.tienda.avisoEncargado', { nombre: `${c.nombre} ${c.apellido}` })
          : this.t.instant('wg.pestanas.tienda.sinEncargado');
        setTimeout(() => (this.avisoEncargado = ''), 5000);
      },
      error: (err) => { this.guardandoEncargado = false; this.error = WillGoService.mensajeDeError(err); },
    });
  }

  urlFoto(id: string): string {
    return this.willGo.urlFoto(id);
  }

  billetes(p: Partial<Producto>, pais: Pais): number {
    return precioEnBilletes(Number(p.precio_cop) || 0, Number(pais.tasa_actual || this.edicion.tasa_inicial));
  }

  nuevo(): void {
    this.error = '';
    this.borrador = { nombre: '', precio_cop: undefined, stock: 0, maximo_por_estudiante: null, activo: true, foto: null, fotoVista: null };
  }

  editar(p: Producto): void {
    this.error = '';
    this.borrador = { ...p, fotoVista: p.foto ? this.urlFoto(p.foto) : null };
  }

  async elegirFoto(evento: Event): Promise<void> {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (!archivo || !this.borrador) return;
    this.subiendo = true;
    this.error = '';
    try {
      const { base64, tipo } = await reducirFoto(archivo);
      this.borrador.fotoVista = `data:${tipo};base64,${base64}`;
      this.willGo.subirFoto(archivo.name.replace(/\.[^.]+$/, '') + '.jpg', tipo, base64).subscribe({
        next: ({ id }) => { if (this.borrador) this.borrador.foto = id; this.subiendo = false; },
        error: (e) => { this.subiendo = false; this.error = WillGoService.mensajeDeError(e); },
      });
    } catch (e) {
      this.subiendo = false;
      this.error = this.t.instant((e as Error).message);
    }
  }

  guardar(): void {
    const b = this.borrador;
    if (!b) return;
    if (!b.nombre?.trim() || b.precio_cop == null || Number(b.precio_cop) < 0) {
      this.error = this.t.instant('wg.pestanas.tienda.faltanDatos');
      return;
    }
    const datos: Partial<Producto> = {
      nombre: b.nombre.trim(), precio_cop: Number(b.precio_cop), stock: Number(b.stock) || 0,
      maximo_por_estudiante: b.maximo_por_estudiante ? Number(b.maximo_por_estudiante) : null,
      activo: !!b.activo, foto: b.foto ?? null,
    };
    this.guardando = true;
    const peticion = b.id
      ? this.willGo.actualizarEnSeccion<Producto>('productos', b.id, datos)
      : this.willGo.crearEnSeccion<Producto>(this.edicion.id, 'productos', datos);
    peticion.subscribe({
      next: (p) => {
        this.productos = b.id ? this.productos.map((x) => (x.id === p.id ? p : x)) : [...this.productos, p].sort((a, c) => a.nombre.localeCompare(c.nombre));
        this.guardando = false;
        this.borrador = null;
      },
      error: (e) => { this.guardando = false; this.error = WillGoService.mensajeDeError(e); },
    });
  }

  borrar(): void {
    const b = this.borrador;
    if (!b?.id || !confirm(this.t.instant('wg.pestanas.tienda.confirmarEliminar', { nombre: b.nombre }))) return;
    this.guardando = true;
    this.willGo.borrarProducto(b.id).subscribe({
      next: (r) => {
        this.productos = r.borrado ? this.productos.filter((x) => x.id !== b.id) : this.productos.map((x) => (x.id === b.id ? { ...x, activo: false } : x));
        this.guardando = false;
        this.borrador = null;
      },
      error: (e) => { this.guardando = false; this.error = WillGoService.mensajeDeError(e); },
    });
  }
}
