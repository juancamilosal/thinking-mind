import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NOMBRE_ROL, WillGoService } from '../../../../core/services/will-go.service';
import { MENU_POR_ROL, OpcionMenu } from '../../menu-will-go';

@Component({
  selector: 'app-inicio-will-go',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="max-w-5xl mx-auto">
      <div class="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white p-6 sm:p-8 shadow-lg">
        <p class="text-teal-300 text-sm font-semibold">{{ nombreRol }}</p>
        <h1 class="text-2xl sm:text-3xl font-bold mt-1">Hola, {{ perfil?.nombre }} 👋</h1>
        <p class="text-slate-300 mt-2">Bienvenido a Will-Go Economy. Desde aquí manejas tu parte del fin de semana.</p>
      </div>

      <h2 class="text-lg font-semibold text-gray-800 mt-8 mb-4">Tus opciones</h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (op of opciones; track op.texto) {
          @if (op.ruta) {
            <a [routerLink]="op.ruta" class="group bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-teal-300 transition">
              <div class="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="op.icono"/></svg>
              </div>
              <p class="mt-4 font-semibold text-gray-800">{{ op.texto }}</p>
              <p class="text-sm text-teal-700 mt-1">Abrir →</p>
            </a>
          } @else {
            <div class="bg-white/60 rounded-2xl border border-dashed border-gray-300 p-5">
              <div class="w-11 h-11 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="op.icono"/></svg>
              </div>
              <p class="mt-4 font-semibold text-gray-500">{{ op.texto }}</p>
              <p class="text-sm text-gray-400 mt-1">Muy pronto</p>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class InicioWillGo {
  perfil = WillGoService.perfilGuardado();
  opciones: OpcionMenu[] = (this.perfil?.rol ? MENU_POR_ROL[this.perfil.rol] : []).filter((o) => o.texto !== 'Inicio');
  nombreRol = this.perfil?.rol ? NOMBRE_ROL[this.perfil.rol] : '';
}
