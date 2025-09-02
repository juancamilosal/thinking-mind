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

  static saveObjectInSessionStorage(name: string, item: any): void {
    if (this.isBrowser) {
      sessionStorage.setItem(name, JSON.stringify(item));
    }
  }

  static getItemFromSessionStorage(name: string): string | null {
    if (this.isBrowser) {
      return sessionStorage.getItem(name);
    }
    return null;
  }

  static getItemObjectFromSessionStorage(name: string): any {
    if (this.isBrowser) {
      const item: string | null = sessionStorage.getItem(name);
      return item != null ? JSON.parse(item) : null;
    }
    return null;
  }

  // Métodos específicos para tokens de autenticación
  static setAccessToken(token: string): void {
    this.saveInSessionStorage('access_token', token);
  }

  static getAccessToken(): string | null {
    return this.getItemFromSessionStorage('access_token');
  }

  static setRefreshToken(token: string): void {
    this.saveInSessionStorage('refresh_token', token);
  }

  static getRefreshToken(): string | null {
    return this.getItemFromSessionStorage('refresh_token');
  }

  static setUserData(current_user: any): void {
    this.saveObjectInSessionStorage(this.CURRENT_USER, current_user);
  }

  static getCurrentUser(): any {
    return this.getItemObjectFromSessionStorage(this.CURRENT_USER);
  }

  static clearTokens(): void {
    if (this.isBrowser) {
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('refresh_token');
    }
  }

  static clearSession(): void {
    if (this.isBrowser) {
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('refresh_token');
      sessionStorage.removeItem(this.CURRENT_USER);
    }
  }

  static clearAllSession(): void {
    if (this.isBrowser) {
      sessionStorage.clear();
    }
  }
}
