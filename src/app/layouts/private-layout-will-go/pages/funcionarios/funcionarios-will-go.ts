import { ChangeDetectorRef, Component, HostListener, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FechaWillGoPipe } from '../../fecha.pipe';
import { DOCUMENT_TYPE } from '../../../../core/const/DocumentTypeConst';
import { Funcionario, NuevoFuncionario, WillGoService } from '../../../../core/services/will-go.service';

type RolFuncionario = Funcionario['rol'];

@Component({
  selector: 'app-funcionarios-will-go',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, FechaWillGoPipe],
  templateUrl: './funcionarios-will-go.html',
})
export class FuncionariosWillGo implements OnInit {
  readonly tiposDocumento = DOCUMENT_TYPE.filter((t) => ['CC', 'CE', 'PP'].includes(t.id));
  /** Claves de traducción del nombre de cada rol. */
  readonly nombreRol: Record<string, string> = {
    administrativo: 'wg.admin.rol.administrativo', docente: 'wg.admin.rol.docente', banco: 'wg.admin.rol.banco',
    cajero: 'wg.admin.rol.cajero', administrador: 'wg.admin.rol.administrador',
  };
  private t = inject(TranslateService);
  readonly esAdministradorGeneral = WillGoService.perfilGuardado()?.rol === 'administrador';
  readonly miId = WillGoService.perfilGuardado()?.id;

  funcionarios: Funcionario[] = [];
  cargando = true;
  errorCarga = '';
  busqueda = '';
  filtroRol: RolFuncionario | '' = '';
  /** Paginador: 10 colaboradores por página. */
  /** Cuántos colaboradores por página (se recuerda en el dispositivo). */
  readonly opcionesPorPagina = [10, 20, 50, 100];
  porPagina = (() => { try { const n = Number(localStorage.getItem('wg_colaboradores_por_pagina')); return [10, 20, 50, 100].includes(n) ? n : 10; } catch { return 10; } })();
  cambiarPorPagina(n: number): void {
    this.porPagina = Number(n) || 10;
    this.pagina = 1;
    try { localStorage.setItem('wg_colaboradores_por_pagina', String(this.porPagina)); } catch { /* sin almacenamiento */ }
  }
  pagina = 1;
  get totalPaginas(): number { return Math.max(1, Math.ceil(this.filtrados.length / this.porPagina)); }
  get paginaActual(): Funcionario[] {
    const p = Math.min(this.pagina, this.totalPaginas);
    return this.filtrados.slice((p - 1) * this.porPagina, p * this.porPagina);
  }
  get desde(): number { return this.filtrados.length ? (Math.min(this.pagina, this.totalPaginas) - 1) * this.porPagina + 1 : 0; }
  get hasta(): number { return Math.min(Math.min(this.pagina, this.totalPaginas) * this.porPagina, this.filtrados.length); }
  /** Números de página a mostrar (máximo 5 alrededor de la actual). */
  get paginas(): number[] {
    const total = this.totalPaginas, p = Math.min(this.pagina, total);
    const ini = Math.max(1, Math.min(p - 2, total - 4)), fin = Math.min(total, ini + 4);
    return Array.from({ length: fin - ini + 1 }, (_, i) => ini + i);
  }
  /** Id del colaborador cuyo menú de acciones está abierto. */
  menuAbierto: string | null = null;
  alternarMenu(f: Funcionario, ev: Event): void { ev.stopPropagation(); this.menuAbierto = this.menuAbierto === f.id ? null : f.id; }
  @HostListener('document:click') cerrarMenu(): void { this.menuAbierto = null; }
  @HostListener('document:keydown.escape') cerrarMenuEsc(): void { this.menuAbierto = null; }

  irA(n: number): void { this.pagina = Math.max(1, Math.min(n, this.totalPaginas)); }

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
    // Los perfiles administrativos no se crean ni se asignan desde esta pantalla
    return ['docente', 'banco', 'cajero'];
  }

  /** Roles marcados en el formulario (el primero es el principal). */
  rolesElegidos: RolFuncionario[] = ['docente'];

  rolesDe(f: Funcionario): RolFuncionario[] {
    return f.roles?.length ? f.roles : [f.rol];
  }

  /** Marca o desmarca un rol: el administrativo va solo; siempre queda al menos uno. */
  alternarRol(r: RolFuncionario): void {
    let lista = this.rolesElegidos.includes(r) ? this.rolesElegidos.filter((x) => x !== r) : [...this.rolesElegidos, r];
    if (r === 'administrativo' && lista.includes('administrativo')) lista = ['administrativo'];
    else if (r !== 'administrativo') lista = lista.filter((x) => x !== 'administrativo');
    if (!lista.length) return;
    this.rolesElegidos = lista;
    this.form.patchValue({ rol: lista[0] });
  }

  /** Ventana para cambiar solo los roles de un colaborador. */
  rolesEditando: { funcionario: Funcionario; roles: RolFuncionario[]; guardando: boolean; error: string } | null = null;

  abrirRoles(f: Funcionario): void {
    this.rolesEditando = { funcionario: f, roles: [...this.rolesDe(f)], guardando: false, error: '' };
  }

  alternarRolEditando(r: RolFuncionario): void {
    const e = this.rolesEditando;
    if (!e) return;
    e.roles = e.roles.includes(r) ? e.roles.filter((x) => x !== r) : [...e.roles, r];
  }

  guardarRoles(): void {
    const e = this.rolesEditando;
    if (!e || !e.roles.length) return;
    e.guardando = true;
    e.error = '';
    this.willGo.actualizarFuncionario(e.funcionario.id, { rol: e.roles[0], roles: [...e.roles] }).subscribe({
      next: (f) => {
        this.reemplazar(f);
        this.rolesEditando = null;
        this.mostrarAviso(this.t.instant('wg.pestanas.equipo.rolesGuardados', { nombre: f.nombre }));
        this.cdr.detectChanges();
      },
      error: (err) => { e.guardando = false; e.error = WillGoService.mensajeDeError(err); this.cdr.detectChanges(); },
    });
  }

  /** Lo que maneja en una edición: «Banco de Wonderland», «Caja». */
  textoEncargo(e: { tipo: 'banco' | 'caja'; pais?: string }): string {
    return e.tipo === 'banco' ? this.t.instant('wg.admin.col.encargoBanco', { pais: e.pais ?? '' }) : this.t.instant('wg.admin.col.encargoCaja');
  }

  get filtrados(): Funcionario[] {
    const q = this.busqueda.trim().toLowerCase();
    return this.funcionarios.filter((f) =>
      (!this.filtroRol || this.rolesDe(f).includes(this.filtroRol)) &&
      (!q || `${f.nombre} ${f.apellido} ${f.email} ${f.numero_documento ?? ''}`.toLowerCase().includes(q)));
  }

  conteo(rol: RolFuncionario): number {
    return this.funcionarios.filter((f) => this.rolesDe(f).includes(rol) && f.estado === 'active').length;
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
    this.rolesElegidos = ['docente'];
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
    this.rolesElegidos = [...this.rolesDe(f)];
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
      nombre: v.nombre!.trim(), apellido: v.apellido!.trim(), email: v.email!.trim().toLowerCase(),
      // A un administrativo no se le cambia el rol desde aquí
      ...(this.editando?.rol === 'administrativo' ? {} : { rol: this.rolesElegidos[0], roles: [...this.rolesElegidos] }),
      tipo_documento: v.tipo_documento || undefined, numero_documento: v.numero_documento?.trim() || undefined, celular: v.celular?.trim() || undefined,
    };

    if (this.editando) {
      const { email, ...cambios } = datos;
      this.willGo.actualizarFuncionario(this.editando.id, cambios).subscribe({
        next: (f) => {
          this.reemplazar(f);
          this.formularioAbierto = false;
          this.guardando = false;
          this.mostrarAviso(this.t.instant('wg.admin.col.avisoActualizado', { nombre: f.nombre }));
        },
        error: (e) => this.falloFormulario(e),
      });
    } else {
      this.willGo.crearFuncionario(datos).subscribe({
        next: ({ funcionario, clave_temporal, vinculado }) => {
          this.funcionarios = [...this.funcionarios, funcionario].sort((a, b) => `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`));
          this.formularioAbierto = false;
          this.guardando = false;
          // Ya tenía cuenta en la plataforma: se vinculó; entra a Will-Go con su misma contraseña
          if (vinculado || !clave_temporal) this.mostrarAviso(this.t.instant('wg.admin.col.avisoVinculado', { nombre: `${funcionario.nombre} ${funcionario.apellido}`, correo: funcionario.email }));
          else this.mostrarClave(funcionario, clave_temporal, true);
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
        next: (r) => {
          this.funcionarios = this.funcionarios.filter((x) => x.id !== funcionario.id);
          terminar();
          this.mostrarAviso(this.t.instant(r.desvinculado ? 'wg.admin.col.avisoDesvinculado' : 'wg.admin.col.avisoEliminado', { nombre: `${funcionario.nombre} ${funcionario.apellido}` }));
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
          this.mostrarAviso(this.t.instant(estado === 'active' ? 'wg.admin.col.avisoPuedeIngresar' : 'wg.admin.col.avisoNoPuedeIngresar', { nombre: f.nombre }));
        },
        error: (e) => { terminar(); this.mostrarAviso(WillGoService.mensajeDeError(e)); },
      });
    }
  }

  copiarClave(): void {
    if (!this.clave) return;
    const texto = this.t.instant('wg.admin.col.textoCopiar', { usuario: this.clave.funcionario.email, clave: this.clave.valor, url: `${location.origin}/login-will-go` });
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
    // Las ediciones vigentes no cambian al editar: se conservan las que ya tenía
    this.funcionarios = this.funcionarios.map((x) => (x.id === f.id ? { ...f, ediciones_activas: f.ediciones_activas ?? x.ediciones_activas } : x));
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
