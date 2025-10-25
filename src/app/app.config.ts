import { ApplicationConfig, LOCALE_ID } from '@angular/core';
import { provideRouter, withPreloading, NoPreloading } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import localeEsCO from '@angular/common/locales/es-CO';

// Registrar los datos de localización
registerLocaleData(localeEs);
registerLocaleData(localeEsCO);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withPreloading(NoPreloading)),
    provideHttpClient(
      withFetch(),
      withInterceptors([AuthInterceptor])
    ),
    { provide: LOCALE_ID, useValue: 'es-CO' }
  ]
};
