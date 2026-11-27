import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})

export class StorageServices {
  public static CURRENT_USER = 'current_user';

  private static get isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
  }

  static saveInSessionStorage(name: string, item: string): void {
    if (this.isBrowser) {
      sessionStorage.setItem(name, item);
    }
  }

  static saveInLocalStorage(name: string, item: string): void {
    if (this.isBrowser) {
      localStorage.setItem(name, item);
    }
  }

  static saveObjectInSessionStorage(name: string, item: any): void {
    if (this.isBrowser) {
      sessionStorage.setItem(name, JSON.stringify(item));
    }
  }

  static saveObjectInLocalStorage(name: string, item: any): void {
    if (this.isBrowser) {
      localStorage.setItem(name, JSON.stringify(item));
    }
  }

  static getItemFromSessionStorage(name: string): string | null {
    if (this.isBrowser) {
      return sessionStorage.getItem(name) || localStorage.getItem(name);
    }
    return null;
  }

  static getItemObjectFromSessionStorage(name: string): any {
    if (this.isBrowser) {
      const item: string | null = sessionStorage.getItem(name) || localStorage.getItem(name);
      return item != null ? JSON.parse(item) : null;
    }
    return null;
  }

  /**
   * En Will-Go la sesión también se guarda en el navegador (localStorage), no solo en la pestaña:
   * en el celular, imprimir o abrir algo desde la app instalada pasa la página a otra pestaña, y sin esto pedía el login.
   * Al cerrar sesión se borra de los dos lados (clearSession / clearTokens).
   */
  private static esWillGo(): boolean {
    if (!this.isBrowser) return false;
    try { return !!localStorage.getItem('wge_perfil') || location.pathname.includes('will-go'); } catch { return false; }
  }

  private static tambienEnNavegador(name: string, item: string): void {
    if (!this.esWillGo()) return;
    try { localStorage.setItem(name, item); } catch { /* sin almacenamiento */ }
  }

  // Métodos específicos para tokens de autenticación
  static setAccessToken(token: string): void {
    this.saveInSessionStorage('access_token', token);
    this.tambienEnNavegador('access_token', token);
  }

  static getAccessToken(): string | null {
    return this.getItemFromSessionStorage('access_token');
  }

  static setRefreshToken(token: string): void {
    this.saveInSessionStorage('refresh_token', token);
    this.tambienEnNavegador('refresh_token', token);
  }

  static getRefreshToken(): string | null {
    return this.getItemFromSessionStorage('refresh_token');
  }

  static setUserData(current_user: any): void {
    this.saveObjectInSessionStorage(this.CURRENT_USER, current_user);
    this.tambienEnNavegador(this.CURRENT_USER, JSON.stringify(current_user));
  }

  static getCurrentUser(): any {
    return this.getItemObjectFromSessionStorage(this.CURRENT_USER);
  }

  static clearTokens(): void {
    if (this.isBrowser) {
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('refresh_token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }

  static clearSession(): void {
    if (this.isBrowser) {
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('refresh_token');
      sessionStorage.removeItem(this.CURRENT_USER);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem(this.CURRENT_USER);
    }
  }

  static clearAllSession(): void {
    if (this.isBrowser) {
      sessionStorage.clear();
      localStorage.clear();
    }
  }
}
