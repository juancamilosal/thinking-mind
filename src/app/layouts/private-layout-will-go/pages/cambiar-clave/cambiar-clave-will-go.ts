import { ChangeDetectorRef, Component, NgZone, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { WillGoService } from '../../../../core/services/will-go.service';

const claveSegura = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? '');
  return v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v) ? null : { debil: true };
};

@Component({
  selector: 'app-cambiar-clave-will-go',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="max-w-md mx-auto">
      @if (obligatorio) {
        <div class="mb-5 rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 text-amber-800">
          <p class="font-semibold">Crea tu contraseña</p>
          <p class="text-sm mt-1">Entraste con una clave temporal. Para continuar, crea una contraseña que solo tú conozcas.</p>
        </div>
      }
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
        <h1 class="text-xl font-bold text-gray-800">Cambiar contraseña</h1>
        <form [formGroup]="form" (ngSubmit)="guardar()" class="mt-6 space-y-5" novalidate>
          <div>
            <label for="nueva" class="block text-sm font-semibold text-gray-700 mb-2">Nueva contraseña</label>
            <input id="nueva" [type]="ver ? 'text' : 'password'" formControlName="nueva" autocomplete="new-password"
                   class="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
            <ul class="mt-2 text-sm space-y-1">
              <li [class]="largo ? 'text-teal-700' : 'text-gray-500'">{{ largo ? '✓' : '•' }} Al menos 8 caracteres</li>
              <li [class]="letrasYNumeros ? 'text-teal-700' : 'text-gray-500'">{{ letrasYNumeros ? '✓' : '•' }} Letras y números</li>
            </ul>
          </div>
          <div>
            <label for="confirmar" class="block text-sm font-semibold text-gray-700 mb-2">Repite la contraseña</label>
            <input id="confirmar" [type]="ver ? 'text' : 'password'" formControlName="confirmar" autocomplete="new-password"
                   class="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
            @if (form.get('confirmar')?.touched && !coinciden) {
              <p class="text-red-500 text-sm mt-1">Las contraseñas no coinciden.</p>
            }
          </div>
          <label class="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" [checked]="ver" (change)="ver = !ver" class="rounded text-teal-600"> Mostrar contraseñas
          </label>
          @if (error) {
            <p class="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ error }}</p>
          }
          @if (listo) {
            <p class="rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-800" role="status">Contraseña actualizada.</p>
          }
          <button type="submit" [disabled]="guardando"
                  class="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-teal-600 to-blue-600 hover:brightness-110 disabled:opacity-60">
            {{ guardando ? 'Guardando…' : 'Guardar contraseña' }}
          </button>
        </form>
      </div>
    </div>
  `,
})
export class CambiarClaveWillGo {
  ver = false;
  guardando = false;
  listo = false;
  error = '';
  obligatorio = !!WillGoService.perfilGuardado()?.debe_cambiar_clave;
  private fb = inject(FormBuilder);
  form = this.fb.group({
    nueva: ['', [Validators.required, claveSegura]],
    confirmar: ['', Validators.required],
  });

  constructor(private willGo: WillGoService, private router: Router, private cdr: ChangeDetectorRef, private zone: NgZone) {}

  private get valor(): string { return String(this.form.value.nueva ?? ''); }
  get largo(): boolean { return this.valor.length >= 8; }
  get letrasYNumeros(): boolean { return /[A-Za-z]/.test(this.valor) && /\d/.test(this.valor); }
  get coinciden(): boolean { return this.form.value.nueva === this.form.value.confirmar; }

  guardar(): void {
    this.form.markAllAsTouched();
    this.error = '';
    if (this.form.invalid || !this.coinciden) {
      if (this.form.get('nueva')?.invalid) this.error = 'La contraseña debe tener al menos 8 caracteres, con letras y números.';
      return;
    }
    this.guardando = true;
    this.willGo.cambiarClave(this.valor).subscribe({
      next: () => {
        this.guardando = false;
        this.listo = true;
        this.form.reset();
        if (this.obligatorio) this.zone.run(() => this.router.navigateByUrl('/private-will-go/inicio'));
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.guardando = false;
        this.error = WillGoService.mensajeDeError(e);
        this.cdr.detectChanges();
      },
    });
  }
}
