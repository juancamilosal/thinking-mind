import { RolWillGo } from '../../core/services/will-go.service';

export interface OpcionMenu {
  texto: string;
  ruta?: string; // sin ruta = todavía no está lista ("Próximamente")
  icono: string; // path de un ícono de 24x24 (heroicons outline)
}

const ICONOS = {
  inicio: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  personas: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  edicion: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  billetes: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  rubrica: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  fondos: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  caja: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  tasas: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z',
};

const INICIO: OpcionMenu = { texto: 'Inicio', ruta: '/private-will-go/inicio', icono: ICONOS.inicio };

/** Lo que ve cada colaborador en su menú. */
export const MENU_POR_ROL: Record<RolWillGo, OpcionMenu[]> = {
  administrativo: [
    INICIO,
    { texto: 'Colaboradores', ruta: '/private-will-go/colaboradores', icono: ICONOS.personas },
    { texto: 'Ediciones', ruta: '/private-will-go/ediciones', icono: ICONOS.edicion },
    { texto: 'Tipo de cambio', icono: ICONOS.tasas },
  ],
  administrador: [
    INICIO,
    { texto: 'Colaboradores', ruta: '/private-will-go/colaboradores', icono: ICONOS.personas },
    { texto: 'Ediciones', ruta: '/private-will-go/ediciones', icono: ICONOS.edicion },
    { texto: 'Tipo de cambio', icono: ICONOS.tasas },
  ],
  docente: [
    INICIO,
    { texto: 'Entregar billetes', icono: ICONOS.billetes },
    { texto: 'Rúbrica', icono: ICONOS.rubrica },
  ],
  banco: [
    INICIO,
    { texto: 'Repartir a docentes', icono: ICONOS.billetes },
    { texto: 'Banco', ruta: '/private-will-go/banco', icono: ICONOS.caja },
    { texto: 'W-Funds', icono: ICONOS.fondos },
  ],
  cajero: [
    INICIO,
    { texto: 'Caja GO•STORE', icono: ICONOS.caja },
  ],
};
