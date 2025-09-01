import { ApplicationConfig } from '@angular/core';
import { provideRouter, withPreloading, NoPreloading } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withPreloading(NoPreloading)),
    provideHttpClient(
      withFetch(),
      withInterceptors([AuthInterceptor])
    )
  ]
};
