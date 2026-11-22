import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { WillGoService } from '../../../../core/services/will-go.service';
import { OpcionMenu, menuPara } from '../../menu-will-go';

@Component({
  selector: 'app-inicio-will-go',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <div class="max-w-5xl mx-auto">
      <div class="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white p-6 sm:p-8 shadow-lg">
        <p class="text-teal-300 text-sm font-semibold">{{ claveRol | translate }}</p>
        <h1 class="text-2xl sm:text-3xl font-bold mt-1">{{ 'wg.nucleo.inicio.hola' | translate: { nombre: perfil?.nombre ?? '' } }}</h1>
        <p class="text-slate-300 mt-2">{{ 'wg.nucleo.inicio.bienvenida' | translate }}</p>
      </div>

      <h2 class="text-lg font-semibold text-gray-800 mt-8 mb-4">{{ 'wg.nucleo.inicio.tusOpciones' | translate }}</h2>
      @if (cargado && (!opciones.length || faltaPrincipal)) {
        <div class="mb-4 bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
          <p class="font-semibold text-gray-800">{{ (opciones.length ? 'wg.nucleo.inicio.faltaAsignacion' : 'wg.nucleo.inicio.sinTareas') | translate }}</p>
          <p class="text-sm text-gray-600 mt-1 max-w-md mx-auto">{{ ayudaSinTareas | translate }}</p>
        </div>
      }
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (op of opciones; track op.texto) {
          @if (op.ruta) {
            <a [routerLink]="op.ruta" class="group bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-teal-300 transition">
              <div class="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="op.icono"/></svg>
              </div>
              <p class="mt-4 font-semibold text-gray-800">{{ op.texto | translate }}</p>
              <p class="text-sm text-teal-700 mt-1">{{ 'wg.nucleo.inicio.abrir' | translate }}</p>
            </a>
          } @else {
            <div class="bg-white/60 rounded-2xl border border-dashed border-gray-300 p-5">
              <div class="w-11 h-11 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="op.icono"/></svg>
              </div>
              <p class="mt-4 font-semibold text-gray-500">{{ op.texto | translate }}</p>
              <p class="text-sm text-gray-400 mt-1">{{ 'wg.nucleo.inicio.muyPronto' | translate }}</p>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class InicioWillGo implements OnInit {
  private willGo = inject(WillGoService);
  private router = inject(Router);
  perfil = WillGoService.perfilGuardado();
  opciones: OpcionMenu[] = this.sinInicio(menuPara(this.perfil?.rol, null));
  /** Clave de traducción del nombre del rol (wg.nucleo.rol.*). */
  claveRol = this.perfil?.rol ? `wg.nucleo.rol.${this.perfil.rol}` : '';
  cargado = false;
  /** El banco sin país a cargo o el cajero sin caja: ven algo (p. ej. el tipo de cambio), pero no su sección principal. */
  faltaPrincipal = false;

  ngOnInit(): void {
    if (!this.perfil?.rol) return;
    this.willGo.miMenu().subscribe((acceso) => {
      // El cajero con caja asignada entra directo a la tienda
      if (this.perfil?.rol === 'cajero' && acceso.caja) { this.router.navigateByUrl('/private-will-go/caja', { replaceUrl: true }); return; }
      this.opciones = this.sinInicio(menuPara(this.perfil?.rol, acceso));
      const rol = this.perfil?.rol;
      this.faltaPrincipal = (rol === 'banco' && !acceso.banco) || (rol === 'cajero' && !acceso.caja);
      this.cargado = true;
    });
  }

  /** Qué le falta a la persona para tener opciones, según su rol (clave de traducción). */
  get ayudaSinTareas(): string {
    switch (this.perfil?.rol) {
      case 'banco': return 'wg.nucleo.inicio.ayudaBanco';
      case 'cajero': return 'wg.nucleo.inicio.ayudaCajero';
      default: return 'wg.nucleo.inicio.ayudaGeneral';
    }
  }

  private sinInicio(l: OpcionMenu[]): OpcionMenu[] { return l.filter((o) => o.texto !== 'wg.nucleo.menu.inicio'); }
}
