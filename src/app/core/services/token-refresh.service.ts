import { Injectable, OnDestroy } from '@angular/core';
import { jwtDecode } from 'jwt-decode';
import { StorageServices } from './storage.services';
import { LoginService } from './login.service';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

interface JwtPayload {
  exp: number;
  iat?: number;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class TokenRefreshService implements OnDestroy {
  private refreshTimer: any;
  private destroy$ = new Subject<void>();

  // Tiempo en minutos antes de la expiración para renovar el token
  private readonly REFRESH_BEFORE_EXPIRY_MINUTES = 2;

  constructor(
    private loginService: LoginService,
    private router: Router
  ) {}

  /**
   * Inicia el servicio de renovación automática del token
   */
  startTokenRefreshService(): void {
    this.scheduleTokenRefresh();
  }

  /**
   * Detiene el servicio de renovación automática del token
   */
  stopTokenRefreshService(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    // Si estamos en el navegador y hay una sesión activa que expiró, redirigir a session-expired
    if (typeof window !== 'undefined' && StorageServices.getAccessToken()) {
      StorageServices.clearSession();
      this.router.navigate(['/session-expired']);
    }
  }

  /**
   * Programa la próxima renovación del token
   */
  private scheduleTokenRefresh(): void {
    const token = StorageServices.getAccessToken();
    try {
      const decodedToken: JwtPayload = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000); // Tiempo actual en segundos
      const expirationTime = decodedToken.exp;

      if (!expirationTime) {
        console.warn('El token no tiene tiempo de expiración definido');
        return;
      }

      // Calcular cuándo renovar el token (X minutos antes de la expiración)
      const refreshTime = expirationTime - (this.REFRESH_BEFORE_EXPIRY_MINUTES * 60);
      const timeUntilRefresh = (refreshTime - currentTime) * 1000; // Convertir a milisegundos
      // Si el token ya debería haberse renovado, hacerlo inmediatamente
      if (timeUntilRefresh <= 0) {
        this.refreshToken();
        return;
      }

      // Programar la renovación
      this.refreshTimer = setTimeout(() => {
        this.refreshToken();
      }, timeUntilRefresh);

    } catch (error) {
      console.error('Error al decodificar el token:', error);
      // Si no se puede decodificar el token, intentar renovarlo
      this.refreshToken();
    }
  }

  /**
   * Ejecuta la renovación del token
   */
  private refreshToken(): void {
    this.loginService.refreshToken()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.scheduleTokenRefresh();
        },
        error: (error) => {
          console.error('Error al renovar el token automáticamente:', error);
          // Si falla la renovación, redirigir al login
          this.handleRefreshError();
        }
      });
  }

  /**
   * Maneja errores en la renovación del token
   */
  private handleRefreshError(): void {
    StorageServices.clearSession();
    this.router.navigate(['/login']);
  }

  /**
   * Verifica si el token está próximo a expirar
   */
  isTokenNearExpiry(): boolean {
    const token = StorageServices.getAccessToken();

    if (!token) {
      return true;
    }

    try {
      const decodedToken: JwtPayload = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = decodedToken.exp;

      if (!expirationTime) {
        return true;
      }

      const timeUntilExpiry = expirationTime - currentTime;
      const refreshThreshold = this.REFRESH_BEFORE_EXPIRY_MINUTES * 60;

      return timeUntilExpiry <= refreshThreshold;
    } catch (error) {
      console.error('Error al verificar expiración del token:', error);
      return true;
    }
  }

  /**
   * Obtiene el tiempo restante hasta la expiración del token en minutos
   */
  getTimeUntilExpiry(): number {
    const token = StorageServices.getAccessToken();

    if (!token) {
      return 0;
    }

    try {
      const decodedToken: JwtPayload = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = decodedToken.exp;

      if (!expirationTime) {
        return 0;
      }

      const timeUntilExpiry = expirationTime - currentTime;
      return Math.floor(timeUntilExpiry / 60); // Retornar en minutos
    } catch (error) {
      console.error('Error al calcular tiempo de expiración:', error);
      return 0;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopTokenRefreshService();
  }
}