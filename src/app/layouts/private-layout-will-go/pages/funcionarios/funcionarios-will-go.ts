import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { DOCUMENT_TYPE } from '../../../../core/const/DocumentTypeConst';
import { Funcionario, NOMBRE_ROL, NuevoFuncionario, WillGoService } from '../../../../core/services/will-go.service';

type RolFuncionario = Funcionario['rol'];

@Component({
  selector: 'app-funcionarios-will-go',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './funcionarios-will-go.html',
})
export class FuncionariosWillGo implements OnInit {
  readonly tiposDocumento = DOCUMENT_TYPE.filter((t) => ['CC', 'CE', 'PP'].includes(t.id));
  readonly nombreRol = NOMBRE_ROL;
  readonly esAdministradorGeneral = WillGoService.perfilGuardado()?.rol === 'administrador';
  readonly miId = WillGoService.perfilGuardado()?.id;

  funcionarios: Funcionario[] = [];
  cargando = true;
  errorCarga = '';
  busqueda = '';
  filtroRol: RolFuncionario | '' = '';

  // Formulario de crear / editar
  formularioAbierto = false;
  editando: Funcionario | null = null;
  guardando = false;
  errorFormulario = '';
  private fb = inject(FormBuilder);
  form = this.fb.group({
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    rol: ['docente' as RolFuncionario, Validators.required],
    tipo_documento: ['CC'],
    numero_documento: [''],
    celular: [''],
  });

  // Clave temporal que se muestra una sola vez
  clave: { funcionario: Funcionario; valor: string; nuevo: boolean } | null = null;
  copiada = false;

  // Confirmaciones
  confirmar: { tipo: 'clave' | 'estado' | 'eliminar'; funcionario: Funcionario } | null = null;
  procesando = false;
  aviso = '';

  constructor(private willGo: WillGoService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.cargar();
  }

  get rolesDisponibles(): RolFuncionario[] {
    return this.esAdministradorGeneral ? ['docente', 'banco', 'cajero', 'administrativo'] : ['docente', 'banco', 'cajero'];
  }

  get filtrados(): Funcionario[] {
    const q = this.busqueda.trim().toLowerCase();
    return this.funcionarios.filter((f) =>
      (!this.filtroRol || f.rol === this.filtroRol) &&
      (!q || `${f.nombre} ${f.apellido} ${f.email} ${f.numero_documento ?? ''}`.toLowerCase().includes(q)));
  }

  conteo(rol: RolFuncionario): number {
    return this.funcionarios.filter((f) => f.rol === rol && f.estado === 'active').length;
  }

  /** Solo el administrador general maneja a otros administrativos; nadie se desactiva a sí mismo. */
  puedeManejar(f: Funcionario): boolean {
    return f.rol !== 'administrativo' || this.esAdministradorGeneral;
  }

  cargar(): void {
    this.cargando = true;
    this.errorCarga = '';
    this.willGo.funcionarios().subscribe({
      next: (lista) => { this.funcionarios = lista; this.cargando = false; this.cdr.detectChanges(); },
      error: (e) => { this.errorCarga = WillGoService.mensajeDeError(e); this.cargando = false; this.cdr.detectChanges(); },
    });
  }

  abrirNuevo(): void {
    this.editando = null;
    this.errorFormulario = '';
    this.form.reset({ nombre: '', apellido: '', email: '', rol: 'docente', tipo_documento: 'CC', numero_documento: '', celular: '' });
    this.form.get('email')?.enable();
    this.formularioAbierto = true;
  }

  abrirEditar(f: Funcionario): void {
    this.editando = f;
    this.errorFormulario = '';
    this.form.reset({
      nombre: f.nombre, apellido: f.apellido, email: f.email, rol: f.rol,
      tipo_documento: f.tipo_documento || 'CC', numero_documento: f.numero_documento || '', celular: f.celular || '',
    });
    this.form.get('email')?.disable(); // el correo es el usuario de ingreso
    this.formularioAbierto = true;
  }

  invalido(campo: string): boolean {
    const c = this.form.get(campo);
    return !!c && c.invalid && c.touched;
  }

  guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.guardando) return;
    this.guardando = true;
    this.errorFormulario = '';
    const v = this.form.getRawValue();
    const datos: NuevoFuncionario = {
      nombre: v.nombre!.trim(), apellido: v.apellido!.trim(), email: v.email!.trim().toLowerCase(), rol: v.rol!,
      tipo_documento: v.tipo_documento || undefined, numero_documento: v.numero_documento?.trim() || undefined, celular: v.celular?.trim() || undefined,
    };

    if (this.editando) {
      const { email, ...cambios } = datos;
      this.willGo.actualizarFuncionario(this.editando.id, cambios).subscribe({
        next: (f) => {
          this.reemplazar(f);
          this.formularioAbierto = false;
          this.guardando = false;
          this.mostrarAviso(`Se actualizaron los datos de ${f.nombre}.`);
        },
        error: (e) => this.falloFormulario(e),
      });
    } else {
      this.willGo.crearFuncionario(datos).subscribe({
        next: ({ funcionario, clave_temporal }) => {
          this.funcionarios = [...this.funcionarios, funcionario].sort((a, b) => `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`));
          this.formularioAbierto = false;
          this.guardando = false;
          this.mostrarClave(funcionario, clave_temporal, true);
        },
        error: (e) => this.falloFormulario(e),
      });
    }
  }

  pedirConfirmacion(tipo: 'clave' | 'estado' | 'eliminar', funcionario: Funcionario): void {
    this.confirmar = { tipo, funcionario };
  }

  confirmarAccion(): void {
    if (!this.confirmar || this.procesando) return;
    const { tipo, funcionario } = this.confirmar;
    this.procesando = true;
    const terminar = () => { this.procesando = false; this.confirmar = null; this.cdr.detectChanges(); };

    if (tipo === 'eliminar') {
      this.willGo.eliminarFuncionario(funcionario.id).subscribe({
        next: () => {
          this.funcionarios = this.funcionarios.filter((x) => x.id !== funcionario.id);
          terminar();
          this.mostrarAviso(`${funcionario.nombre} ${funcionario.apellido} fue eliminado.`);
        },
        error: (e) => { terminar(); this.mostrarAviso(WillGoService.mensajeDeError(e)); },
      });
    } else if (tipo === 'clave') {
      this.willGo.restablecerClave(funcionario.id).subscribe({
        next: ({ funcionario: f, clave_temporal }) => { this.reemplazar(f); terminar(); this.mostrarClave(f, clave_temporal, false); },
        error: (e) => { terminar(); this.mostrarAviso(WillGoService.mensajeDeError(e)); },
      });
    } else {
      const estado = funcionario.estado === 'active' ? 'suspended' : 'active';
      this.willGo.actualizarFuncionario(funcionario.id, { estado }).subscribe({
        next: (f) => {
          this.reemplazar(f);
          terminar();
          this.mostrarAviso(estado === 'active' ? `${f.nombre} puede volver a ingresar.` : `${f.nombre} ya no puede ingresar.`);
        },
        error: (e) => { terminar(); this.mostrarAviso(WillGoService.mensajeDeError(e)); },
      });
    }
  }

  copiarClave(): void {
    if (!this.clave) return;
    const texto = `Will-Go Economy\nUsuario: ${this.clave.funcionario.email}\nClave temporal: ${this.clave.valor}\nIngresa en: ${location.origin}/login-will-go`;
    navigator.clipboard?.writeText(texto).then(() => { this.copiada = true; this.cdr.detectChanges(); });
  }

  cerrarClave(): void {
    this.clave = null;
    this.copiada = false;
  }

  private mostrarClave(funcionario: Funcionario, valor: string, nuevo: boolean): void {
    this.clave = { funcionario, valor, nuevo };
    this.copiada = false;
    this.cdr.detectChanges();
  }

  private reemplazar(f: Funcionario): void {
    this.funcionarios = this.funcionarios.map((x) => (x.id === f.id ? f : x));
  }

  private falloFormulario(e: unknown): void {
    this.guardando = false;
    this.errorFormulario = WillGoService.mensajeDeError(e);
    this.cdr.detectChanges();
  }

  private mostrarAviso(texto: string): void {
    this.aviso = texto;
    this.cdr.detectChanges();
    setTimeout(() => { if (this.aviso === texto) { this.aviso = ''; this.cdr.detectChanges(); } }, 4000);
  }
}
