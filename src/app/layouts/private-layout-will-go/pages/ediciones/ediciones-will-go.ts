import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Edicion, WillGoService } from '../../../../core/services/will-go.service';
import { ESTADO_EDICION } from './estado-edicion';

@Component({
  selector: 'app-ediciones-will-go',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  template: `
    <div class="max-w-6xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">Ediciones</h1>
          <p class="text-gray-500 mt-1">Cada fin de semana de Will-Go es una edición: países, participantes, tienda y fondos.</p>
        </div>
        <button type="button" (click)="abrirFormulario()"
                class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 shadow hover:brightness-110">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Nueva edición
        </button>
      </div>

      <div class="mt-6">
        @if (cargando) {
          <div class="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Cargando ediciones…</div>
        } @else if (error) {
          <div class="bg-white rounded-2xl border border-red-200 p-8 text-center">
            <p class="text-red-700">{{ error }}</p>
            <button type="button" (click)="cargar()" class="mt-3 text-orange-700 font-semibold hover:underline">Reintentar</button>
          </div>
        } @else if (!ediciones.length) {
          <div class="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
            <p class="text-gray-700 font-semibold">Todavía no hay ediciones</p>
            <p class="text-gray-500 text-sm mt-1">Crea la primera con «Nueva edición». Viene lista con los 3 países y los 5 fondos.</p>
          </div>
        } @else {
          <div class="grid gap-4 md:grid-cols-2">
            @for (e of ediciones; track e.id) {
              <a [routerLink]="['/private-will-go/ediciones', e.id]"
                 class="group bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-orange-300 transition">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-bold text-gray-800 text-lg truncate">{{ e.nombre }}</p>
                    <p class="text-sm text-gray-500 truncate">{{ e.colegio_nombre || 'Sin colegio' }} · {{ e.programa_nombre || 'Sin programa' }}</p>
                  </div>
                  <span class="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full" [class]="estado[e.estado].clase">{{ estado[e.estado].texto }}</span>
                </div>
                <div class="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                  <span>📅 {{ e.fecha_inicio ? (e.fecha_inicio | date:'d MMM y') : 'Sin fecha' }}</span>
                  <span>👥 {{ e.participantes }} participantes</span>
                  @if (e.sin_pais) { <span class="text-amber-700">⚠ {{ e.sin_pais }} sin país</span> }
                </div>
                <p class="mt-4 text-sm font-semibold text-orange-700">Administrar →</p>
              </a>
            }
          </div>
        }
      </div>
    </div>

    @if (formularioAbierto) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="formularioAbierto = false">
        <div class="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <div class="px-6 pt-6 pb-2 flex items-start justify-between">
            <h2 class="text-xl font-bold text-gray-800">Nueva edición</h2>
            <button type="button" (click)="formularioAbierto = false" class="p-1 text-gray-400 hover:text-gray-600" aria-label="Cerrar">✕</button>
          </div>
          <form [formGroup]="form" (ngSubmit)="crear()" class="px-6 pb-6 space-y-4" novalidate>
            <div>
              <label for="e-nombre" class="block text-sm font-semibold text-gray-700 mb-1">Nombre</label>
              <input id="e-nombre" formControlName="nombre" placeholder="Ej.: Will-Go Economy · Noviembre 2026" class="w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400">
            </div>
            <div>
              <label for="e-colegio" class="block text-sm font-semibold text-gray-700 mb-1">Colegio</label>
              <select id="e-colegio" formControlName="colegio_id" class="w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="">Todos los colegios inscritos</option>
                @for (c of colegios; track c.id) { <option [value]="c.id">{{ c.nombre }}</option> }
              </select>
            </div>
            <div>
              <label for="e-programa" class="block text-sm font-semibold text-gray-700 mb-1">Programa de donde vienen los participantes</label>
              <select id="e-programa" formControlName="curso_id" class="w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="">Elige el programa</option>
                @for (p of programas; track p.id) { <option [value]="p.id">{{ p.nombre }}</option> }
              </select>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="e-inicio" class="block text-sm font-semibold text-gray-700 mb-1">Inicia</label>
                <input id="e-inicio" type="date" formControlName="fecha_inicio" class="w-full px-3 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400">
              </div>
              <div>
                <label for="e-fin" class="block text-sm font-semibold text-gray-700 mb-1">Termina</label>
                <input id="e-fin" type="date" formControlName="fecha_fin" class="w-full px-3 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400">
              </div>
            </div>
            <p class="text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3">Se crea con Wonderland, Neverland y Dreamland, los 5 fondos y horario sábado y domingo de 8:00 a 18:00. Todo se puede cambiar después.</p>
            @if (errorFormulario) {
              <p class="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ errorFormulario }}</p>
            }
            <div class="flex gap-3 pt-2">
              <button type="button" (click)="formularioAbierto = false" class="flex-1 py-3 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button type="submit" [disabled]="guardando" class="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:brightness-110 disabled:opacity-60">
                {{ guardando ? 'Creando…' : 'Crear edición' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class EdicionesWillGo implements OnInit {
  private willGo = inject(WillGoService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  readonly estado = ESTADO_EDICION;

  ediciones: Edicion[] = [];
  cargando = true;
  error = '';
  colegios: { id: string; nombre: string }[] = [];
  programas: { id: string; nombre: string }[] = [];
  formularioAbierto = false;
  guardando = false;
  errorFormulario = '';
  form = this.fb.group({
    nombre: ['', Validators.required],
    colegio_id: [''],
    curso_id: ['', Validators.required],
    fecha_inicio: [''],
    fecha_fin: [''],
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.willGo.ediciones().subscribe({
      next: (lista) => { this.ediciones = lista; this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  abrirFormulario(): void {
    this.form.reset({ nombre: '', colegio_id: '', curso_id: '', fecha_inicio: '', fecha_fin: '' });
    this.errorFormulario = '';
    this.formularioAbierto = true;
    if (!this.programas.length) {
      this.willGo.catalogos().subscribe({
        next: (c) => {
          this.colegios = c.colegios;
          this.programas = c.programas;
          // Propone el programa de Will Go Economy si existe
          const wge = c.programas.find((p) => /will.?go economy/i.test(p.nombre) && !/prueba/i.test(p.nombre));
          if (wge && !this.form.value.curso_id) this.form.patchValue({ curso_id: wge.id });
        },
        error: (e) => (this.errorFormulario = WillGoService.mensajeDeError(e)),
      });
    }
  }

  crear(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.errorFormulario = 'Escribe el nombre y elige el programa.';
      return;
    }
    this.guardando = true;
    this.errorFormulario = '';
    const v = this.form.value;
    this.willGo.crearEdicion({
      nombre: v.nombre!, colegio_id: v.colegio_id || null, curso_id: v.curso_id || null,
      fecha_inicio: v.fecha_inicio || null, fecha_fin: v.fecha_fin || null,
    }).subscribe({
      next: (e) => { this.guardando = false; this.formularioAbierto = false; this.router.navigate(['/private-will-go/ediciones', e.id]); },
      error: (e) => { this.guardando = false; this.errorFormulario = WillGoService.mensajeDeError(e); },
    });
  }
}
