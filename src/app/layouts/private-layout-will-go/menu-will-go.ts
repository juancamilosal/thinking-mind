import { AccesoMenu, RolWillGo } from '../../core/services/will-go.service';

export interface OpcionMenu {
  texto: string; // clave de traducción (wg.nucleo.menu.*): se muestra con | translate
  ruta?: string; // sin ruta = todavía no está lista ("Próximamente")
  icono: string; // path de un ícono de 24x24 (heroicons outline)
  /** Solo se muestra si el colaborador puede usarla hoy (ver GET /wge/mi-menu). Sin esto, se muestra siempre. */
  requiere?: keyof AccesoMenu;
}

const ICONOS = {
  inicio: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  personas: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  edicion: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  billetes: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  rubrica: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  fondos: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  caja: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  tienda: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
  tarjeta: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  tasas: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z',
};

const INICIO: OpcionMenu = { texto: 'wg.nucleo.menu.inicio', ruta: '/private-will-go/inicio', icono: ICONOS.inicio };

/** Lo que ve cada colaborador en su menú. */
export const MENU_POR_ROL: Record<RolWillGo, OpcionMenu[]> = {
  administrativo: [
    INICIO,
    { texto: 'wg.nucleo.menu.colaboradores', ruta: '/private-will-go/colaboradores', icono: ICONOS.personas },
    { texto: 'wg.nucleo.menu.ediciones', ruta: '/private-will-go/ediciones', icono: ICONOS.edicion },
    { texto: 'wg.nucleo.menu.tipoCambio', ruta: '/private-will-go/tipo-cambio', icono: ICONOS.tasas },
  ],
  administrador: [
    INICIO,
    { texto: 'wg.nucleo.menu.colaboradores', ruta: '/private-will-go/colaboradores', icono: ICONOS.personas },
    { texto: 'wg.nucleo.menu.ediciones', ruta: '/private-will-go/ediciones', icono: ICONOS.edicion },
    { texto: 'wg.nucleo.menu.tipoCambio', ruta: '/private-will-go/tipo-cambio', icono: ICONOS.tasas },
  ],
  docente: [
    INICIO,
    { texto: 'wg.nucleo.menu.entregarBilletes', ruta: '/private-will-go/entregar', icono: ICONOS.billetes, requiere: 'equipo' },
    { texto: 'wg.nucleo.menu.rubrica', ruta: '/private-will-go/rubrica', icono: ICONOS.rubrica, requiere: 'equipo' },
    { texto: 'wg.nucleo.menu.tipoCambio', ruta: '/private-will-go/tipo-cambio', icono: ICONOS.tasas, requiere: 'equipo' },
  ],
  banco: [
    INICIO,
    { texto: 'wg.nucleo.menu.repartirDocentes', ruta: '/private-will-go/repartir', icono: ICONOS.billetes, requiere: 'banco' },
    { texto: 'wg.nucleo.menu.banco', ruta: '/private-will-go/banco', icono: ICONOS.caja, requiere: 'banco' },
    { texto: 'wg.nucleo.menu.cuentas', ruta: '/private-will-go/cuentas', icono: ICONOS.tarjeta, requiere: 'banco' },
    { texto: 'wg.nucleo.menu.wfunds', ruta: '/private-will-go/wfunds', icono: ICONOS.fondos, requiere: 'banco' },
    { texto: 'wg.nucleo.menu.tipoCambio', ruta: '/private-will-go/tipo-cambio', icono: ICONOS.tasas, requiere: 'equipo' },
  ],
  // El cajero solo usa la tienda: cobra al estudiante y le entrega su producto
  cajero: [
    INICIO,
    { texto: 'wg.nucleo.menu.cajaGoStore', ruta: '/private-will-go/caja', icono: ICONOS.caja, requiere: 'caja' },
  ],
};

/**
 * El menú de un rol. `acceso` (GET /wge/mi-menu) ya no oculta opciones; se usa en Inicio para avisar
 * qué asignación le falta a la persona.
 */
export function menuPara(rol: RolWillGo | null | undefined, acceso: AccesoMenu | null): OpcionMenu[] {
  if (!rol) return [];
  // Cada rol ve siempre sus opciones, aunque todavía no lo hayan asignado a una edición:
  // la pantalla misma explica qué le falta. El cajero solo usa la tienda (sin Inicio).
  void acceso;
  const menu = MENU_POR_ROL[rol];
  return rol === 'cajero' ? menu.filter((o) => o !== INICIO) : menu;
}
