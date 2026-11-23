export class Roles {
  public static RECTOR: string = 'a4ed6390-5421-46d1-b81e-5cad06115abc';
  public static SALES: string = 'b40cfe25-bd79-4d62-818b-6cf96674fc12';
  public static STUDENT: string = 'ca8ffc29-c040-439f-8017-0dcb141f0fd3';
  public static TEACHER: string = 'fe83d2f3-1b89-477d-984a-de3b56e12001';
  public static CEO: string = 'ad299f85-8137-4709-a3ad-beaeb579cdb3';
  public static ADMIN: string = 'ca89252c-6b5c-4f51-a6e4-34ab4d0e2a02';

  // WILL-GO ECONOMY
  public static WG_ADMINISTRATIVO: string = 'a503069d-e76a-474f-8a91-f852dbfae4e6';
  public static WG_DOCENTE: string = '7d3849bf-bd47-4673-bba2-c64e2afa0304';
  public static WG_BANCO: string = '819c2de5-cad6-44e4-9f20-c815b4975882';
  public static WG_CAJERO: string = '2c8d1334-5a49-4d0b-8637-9926fa373bef';
  public static WG_ACUDIENTE: string = '1c8141e4-e5b0-41e9-add4-a777662a9de3';

  /** Funcionarios que entran por el login de Will Go. */
  public static readonly WILL_GO_STAFF: string[] = [
    Roles.WG_ADMINISTRATIVO, Roles.WG_DOCENTE, Roles.WG_BANCO, Roles.WG_CAJERO
  ];

  private static readonly CLAVE_LOGIN = 'login_origen';
  private static readonly LOGINS = ['/login', '/login-ayo', '/login-will-go'];

  /** Guarda por cuál ingreso entró el usuario, para devolverlo ahí cuando se le acabe la sesión. */
  public static recordarLogin(ruta: string): void {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(Roles.CLAVE_LOGIN, ruta); } catch { /* sin almacenamiento */ }
  }

  /**
   * Login al que debe volver un usuario. En orden: el de la sección donde está (Will Go o AYO),
   * el ingreso por el que entró la última vez y, si no se sabe, el que corresponde a su rol.
   */
  public static loginRoute(role?: string | null): string {
    const ruta = typeof location !== 'undefined' ? location.pathname : '';
    if (ruta.startsWith('/private-will-go')) return '/login-will-go';
    if (ruta.startsWith('/private-ayo')) return '/login-ayo';
    let recordado: string | null = null;
    try { recordado = typeof localStorage !== 'undefined' ? localStorage.getItem(Roles.CLAVE_LOGIN) : null; } catch { recordado = null; }
    if (recordado && Roles.LOGINS.includes(recordado)) return recordado;
    if (role && Roles.WILL_GO_STAFF.includes(role)) return '/login-will-go';
    return role === Roles.STUDENT || role === Roles.TEACHER ? '/login-ayo' : '/login';
  }
}
