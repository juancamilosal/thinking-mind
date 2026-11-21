import { Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Edicion, Pais, Producto, WillGoService } from '../../../../../core/services/will-go.service';
import { precioEnBilletes, reducirFoto } from '../estado-edicion';

type Borrador = Partial<Producto> & { fotoVista?: string | null };

@Component({
  selector: 'app-tab-tienda',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
      <p class="text-sm text-gray-500">El precio se pone en <b>pesos educativos</b>. En la caja se convierte a billetes con la tasa vigente del país de cada estudiante.</p>
      <button type="button" (click)="nuevo()" class="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 shadow hover:brightness-110">
        + Nuevo producto
      </button>
    </div>

    @if (cargando) {
      <div class="mt-4 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Cargando productos…</div>
    } @else if (!productos.length) {
      <div class="mt-4 bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
        <p class="font-semibold text-gray-700">La tienda está vacía</p>
        <p class="text-sm text-gray-500 mt-1">Agrega los productos con su foto, precio y unidades disponibles.</p>
      </div>
    } @else {
      <div class="mt-4 grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        @for (p of productos; track p.id) {
          <article class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col" [class.opacity-60]="!p.activo">
            <div class="aspect-[4/3] bg-orange-50 flex items-center justify-center">
              @if (p.foto) {
                <img [src]="urlFoto(p.foto)" [alt]="p.nombre" class="w-full h-full object-cover" loading="lazy">
              } @else {
                <span class="text-5xl" aria-hidden="true">🛍️</span>
              }
            </div>
            <div class="p-4 flex-1 flex flex-col">
              <p class="font-semibold text-gray-800 leading-tight">{{ p.nombre }}</p>
              <p class="text-sm text-gray-500 mt-1">{{ p.precio_cop | number }} pesos</p>
              <div class="mt-2 flex flex-wrap gap-1">
                @for (pa of paises; track pa.id) {
                  <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white" [style.background]="pa.color">{{ billetes(p, pa) }} {{ pa.codigo_moneda }}</span>
                }
              </div>
              <p class="text-xs mt-2" [class]="p.stock > 0 ? 'text-gray-500' : 'text-red-600 font-semibold'">
                {{ p.stock > 0 ? p.stock + ' disponibles' : 'Agotado' }}{{ p.maximo_por_estudiante ? ' · máx. ' + p.maximo_por_estudiante + ' por estudiante' : '' }}
              </p>
              @if (!p.activo) { <p class="text-xs font-semibold text-gray-500 mt-1">Oculto en la caja</p> }
              <button type="button" (click)="editar(p)" class="mt-auto pt-3 text-sm font-semibold text-orange-700 hover:underline text-left">Editar</button>
            </div>
          </article>
        }
      </div>
    }

    @if (borrador) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="borrador = null">
        <div class="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <div class="px-6 pt-6 pb-2 flex items-start justify-between">
            <h2 class="text-xl font-bold text-gray-800">{{ borrador.id ? 'Editar producto' : 'Nuevo producto' }}</h2>
            <button type="button" (click)="borrador = null" class="p-1 text-gray-400 hover:text-gray-600" aria-label="Cerrar">✕</button>
          </div>
          <div class="px-6 pb-6 space-y-4">
            <div class="flex items-center gap-4">
              <div class="w-24 h-24 shrink-0 rounded-2xl bg-orange-50 overflow-hidden flex items-center justify-center border border-orange-100">
                @if (borrador.fotoVista) { <img [src]="borrador.fotoVista" alt="" class="w-full h-full object-cover"> } @else { <span class="text-4xl">🛍️</span> }
              </div>
              <label class="cursor-pointer px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                {{ subiendo ? 'Subiendo…' : (borrador.foto ? 'Cambiar foto' : 'Subir foto') }}
                <input type="file" accept="image/*" class="sr-only" (change)="elegirFoto($event)" [disabled]="subiendo">
              </label>
            </div>
            <div>
              <label for="p-nombre" class="block text-sm font-semibold text-gray-700 mb-1">Nombre</label>
              <input id="p-nombre" [(ngModel)]="borrador.nombre" class="campo" placeholder="Ej.: Gorra Will-Go">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="p-precio" class="block text-sm font-semibold text-gray-700 mb-1">Precio (pesos)</label>
                <input id="p-precio" type="number" min="0" step="100" [(ngModel)]="borrador.precio_cop" class="campo">
              </div>
              <div>
                <label for="p-stock" class="block text-sm font-semibold text-gray-700 mb-1">Unidades</label>
                <input id="p-stock" type="number" min="0" step="1" [(ngModel)]="borrador.stock" class="campo">
              </div>
            </div>
            <div>
              <label for="p-max" class="block text-sm font-semibold text-gray-700 mb-1">Máximo por estudiante <span class="font-normal text-gray-400">(vacío = sin límite)</span></label>
              <input id="p-max" type="number" min="1" step="1" [(ngModel)]="borrador.maximo_por_estudiante" class="campo">
            </div>
            @if (borrador.precio_cop) {
              <p class="text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">Hoy costaría:
                @for (pa of paises; track pa.id) { <b class="ml-1">{{ billetes($any(borrador), pa) }} {{ pa.codigo_moneda }}</b> }
              </p>
            }
            <label class="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" [(ngModel)]="borrador.activo"> Visible en la caja
            </label>
            @if (error) { <p class="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ error }}</p> }
            <div class="flex gap-3 pt-2">
              @if (borrador.id) {
                <button type="button" (click)="borrar()" [disabled]="guardando" class="px-4 py-3 rounded-xl border border-red-200 font-semibold text-red-700 hover:bg-red-50">Eliminar</button>
              }
              <button type="button" (click)="borrador = null" class="flex-1 py-3 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button type="button" (click)="guardar()" [disabled]="guardando || subiendo" class="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:brightness-110 disabled:opacity-60">
                {{ guardando ? 'Guardando…' : 'Guardar' }}
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
  private willGo = inject(WillGoService);

  productos: Producto[] = [];
  paises: Pais[] = [];
  cargando = true;
  borrador: Borrador | null = null;
  guardando = false;
  subiendo = false;
  error = '';

  ngOnInit(): void {
    this.willGo.seccion<Pais>(this.edicion.id, 'paises').subscribe({ next: (p) => (this.paises = p) });
    this.willGo.seccion<Producto>(this.edicion.id, 'productos').subscribe({
      next: (l) => { this.productos = l; this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
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
      this.error = (e as Error).message;
    }
  }

  guardar(): void {
    const b = this.borrador;
    if (!b) return;
    if (!b.nombre?.trim() || b.precio_cop == null || Number(b.precio_cop) < 0) {
      this.error = 'Escribe el nombre y el precio.';
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
    if (!b?.id || !confirm(`¿Eliminar «${b.nombre}»? Si ya tiene ventas, solo se ocultará de la caja.`)) return;
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
