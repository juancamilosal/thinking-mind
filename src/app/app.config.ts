import { ApplicationConfig, LOCALE_ID } from '@angular/core';
import { provideRouter, withPreloading, NoPreloading } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { IdiomaWillGoInterceptor } from './core/interceptors/idioma-will-go.interceptor';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import localeEsCO from '@angular/common/locales/es-CO';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

// Registrar los datos de localización
registerLocaleData(localeEs);
registerLocaleData(localeEsCO);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withPreloading(NoPreloading)),
    provideHttpClient(
      withFetch(),
      withInterceptors([AuthInterceptor, IdiomaWillGoInterceptor])
    ),
    {
      provide: LOCALE_ID,
      useValue: 'es-CO'
    },
    provideTranslateService({
      lang: 'es',
      fallbackLang: 'es',
      loader: provideTranslateHttpLoader({
        prefix: '/assets/i18n/',
        suffix: '.json'
      })
    })
  ]
};
