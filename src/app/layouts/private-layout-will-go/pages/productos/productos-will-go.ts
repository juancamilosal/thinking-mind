import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { DatosCaja, EdicionVigente, PaisCaja, ProductoCaja, WillGoService } from '../../../../core/services/will-go.service';
import { SelectorEdicionComponent } from '../../selector-edicion.component';
import { formatearNumero } from '../../numero-miles.directive';

/** Catálogo de GO•STORE para el cajero: qué vende, cuánto cuesta en cada moneda y cuántas unidades quedan. */
@Component({
  selector: 'app-productos-will-go',
  standalone: true,
  imports: [FormsModule, SelectorEdicionComponent, TranslatePipe],
  template: `
    <div class="max-w-6xl mx-auto">
      <h1 class="text-2xl font-bold text-gray-800">{{ 'wg.operacion.productos.titulo' | translate }}</h1>
      <p class="text-gray-500 mt-1">{{ 'wg.operacion.productos.subtitulo' | translate }}</p>
      <wg-selector-edicion class="block mt-4" [ediciones]="ediciones" [(edicionId)]="edicionId" (cambio)="cargar()" />

      @if (cargando) {
        <div class="mt-5 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.operacion.comun.cargando' | translate }}</div>
      } @else if (error) {
        <div class="mt-5 bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
      } @else if (!ediciones.length) {
        <div class="mt-5 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">{{ 'wg.operacion.productos.noEncargado' | translate }}</div>
      } @else if (datos) {
        <!-- Tasa de cada país: con ella se pasa el precio en pesos a billetes -->
        <div class="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          @for (p of datos.paises; track p.id) {
            <div class="rounded-2xl p-4 text-white shadow" [style.background]="p.color || '#1e293b'">
              <p class="text-sm font-semibold opacity-95">{{ p.nombre }}</p>
              <p class="text-xl font-extrabold">{{ 'wg.operacion.productos.unBillete' | translate: { n: miles(p.tasa_actual) } }} <span class="text-sm font-semibold opacity-90">{{ 'wg.operacion.productos.pesos' | translate }}</span></p>
              <p class="text-xs opacity-90 mt-0.5">{{ 'wg.operacion.productos.preciosCambian' | translate: { moneda: p.codigo_moneda || p.nombre } }}</p>
            </div>
          }
        </div>

        <!-- Resumen y búsqueda -->
        <div class="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div class="flex gap-3 text-sm">
            <span class="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700"><b>{{ datos.productos.length }}</b> {{ (datos.productos.length === 1 ? 'wg.operacion.comun.producto' : 'wg.operacion.comun.productos') | translate }}</span>
            <span class="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700"><b>{{ miles(totalDisponibles) }}</b> {{ 'wg.operacion.productos.unidades' | translate }}</span>
            @if (agotados) { <span class="px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700"><b>{{ agotados }}</b> {{ (agotados === 1 ? 'wg.operacion.productos.agotadoMin' : 'wg.operacion.productos.agotados') | translate }}</span> }
          </div>
          <input type="search" [(ngModel)]="busqueda" [placeholder]="'wg.operacion.productos.buscarProducto' | translate" [attr.aria-label]="'wg.operacion.productos.buscarProductoAria' | translate"
                 class="sm:ml-auto w-full sm:w-64 px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
        </div>

        @if (!datos.productos.length) {
          <div class="mt-4 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">{{ 'wg.operacion.productos.sinProductos' | translate }}</div>
        } @else if (!visibles.length) {
          <div class="mt-4 bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600">{{ 'wg.operacion.productos.ningunoCoincide' | translate: { q: busqueda } }}</div>
        } @else {
          <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            @for (p of visibles; track p.id) {
              <article class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col" [class.opacity-60]="!p.stock">
                <div class="relative h-36 sm:h-auto sm:aspect-[4/3] bg-gray-50">
                  @if (p.foto) {
                    <img [src]="foto(p.foto)" [alt]="p.nombre" class="w-full h-full object-cover" loading="lazy">
                  } @else {
                    <div class="w-full h-full flex items-center justify-center text-5xl" aria-hidden="true">🛍️</div>
                  }
                  <span class="absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full shadow"
                        [class]="!p.stock ? 'bg-red-600 text-white' : p.stock <= 5 ? 'bg-amber-400 text-amber-950' : 'bg-white text-gray-800'">
                    {{ !p.stock ? ('wg.operacion.comun.agotado' | translate) : ('wg.operacion.productos.quedan' | translate: { n: miles(p.stock) }) }}
                  </span>
                </div>
                <div class="p-4 flex-1 flex flex-col">
                  <h2 class="font-bold text-gray-800 text-lg leading-tight">{{ p.nombre }}</h2>
                  <p class="text-sm text-gray-500">{{ 'wg.operacion.productos.nPesos' | translate: { n: miles(p.precio_cop) } }}</p>
                  <!-- Precio en billetes de cada país -->
                  <div class="mt-3 grid gap-1.5">
                    @for (pa of datos.paises; track pa.id) {
                      <div class="flex items-center justify-between rounded-lg px-3 py-1.5" [style.background]="(pa.color || '#64748b') + '14'">
                        <span class="flex items-center gap-2 text-sm text-gray-700"><span class="w-2.5 h-2.5 rounded-full" [style.background]="pa.color || '#64748b'"></span>{{ pa.nombre }}</span>
                        <span class="font-extrabold" [style.color]="pa.color || '#111827'">{{ miles(precio(p, pa)) }} <span class="text-xs font-semibold">{{ pa.codigo_moneda }}</span></span>
                      </div>
                    }
                  </div>
                  <div class="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center text-xs text-gray-500">
                    <div><p class="text-base font-bold text-gray-800">{{ miles(p.stock) }}</p>{{ 'wg.operacion.productos.disponibles' | translate }}</div>
                    <div><p class="text-base font-bold text-gray-800">{{ miles(p.vendidos ?? 0) }}</p>{{ 'wg.operacion.productos.vendidos' | translate }}</div>
                    <div><p class="text-base font-bold text-gray-800">{{ p.maximo_por_estudiante ? miles(p.maximo_por_estudiante) : ('wg.operacion.productos.sin' | translate) }}</p>{{ 'wg.operacion.productos.maxPorEstudiante' | translate }}</div>
                  </div>
                </div>
              </article>
            }
          </div>
        }
      }
    </div>
  `,
})
export class ProductosWillGo implements OnInit {
  private willGo = inject(WillGoService);
  ediciones: EdicionVigente[] = [];
  edicionId = '';
  datos: DatosCaja | null = null;
  cargando = true;
  error = '';
  busqueda = '';

  ngOnInit(): void {
    this.willGo.misEdiciones().subscribe({
      next: (l) => { this.ediciones = l; this.edicionId = l[0]?.id ?? ''; if (this.edicionId) this.cargar(); else this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  cargar(): void {
    if (!this.edicionId) return;
    this.cargando = true;
    this.error = '';
    this.willGo.caja(this.edicionId).subscribe({
      next: (d) => { this.datos = d; this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  get visibles(): ProductoCaja[] {
    const q = this.busqueda.trim().toLowerCase();
    const l = this.datos?.productos ?? [];
    return q ? l.filter((p) => p.nombre.toLowerCase().includes(q)) : l;
  }
  get totalDisponibles(): number { return (this.datos?.productos ?? []).reduce((t, p) => t + Number(p.stock || 0), 0); }
  get agotados(): number { return (this.datos?.productos ?? []).filter((p) => !Number(p.stock)).length; }

  /** Igual que la caja: precio en pesos ÷ tasa del país, hacia arriba. */
  precio(p: ProductoCaja, pais: PaisCaja): number { return Math.ceil(Number(p.precio_cop) / Math.max(Number(pais.tasa_actual) || 1, 1)); }
  foto(id: string): string { return this.willGo.urlFoto(id); }
  miles(v: number): string { return formatearNumero(Number(v) || 0); }
}
