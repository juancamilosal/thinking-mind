import { Component, OnInit, OnDestroy } from '@angular/core';
import { initFlowbite } from 'flowbite';
import { Router, RouterOutlet } from '@angular/router';
import { AppInstalableService } from './core/services/app-instalable.service';
import { IdiomaWillGoService } from './core/services/idioma-will-go.service';
import { TokenRefreshService } from './core/services/token-refresh.service';
import { StorageServices } from './core/services/storage.services';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  imports: [
    RouterOutlet,
    TranslateModule
  ],
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  constructor(
    private tokenRefreshService: TokenRefreshService,
    router: Router,
    appInstalable: AppInstalableService,
    idiomaWillGo: IdiomaWillGoService,
  ) {
    // Will-Go tiene su propio idioma (inglés, francés y, en desarrollo, español)
    idiomaWillGo.iniciar(router);
    // Will-Go se puede instalar en el celular (manifiesto + service worker solo en sus pantallas)
    appInstalable.iniciar(router);
  }

  ngOnInit(): void {
    // Iniciar el servicio de renovación automática de tokens si hay un token válido
    const accessToken = StorageServices.getAccessToken();
    if (accessToken) {
      this.tokenRefreshService.startTokenRefreshService();
    }
  }

  ngOnDestroy(): void {
    // Detener el servicio de renovación de tokens al destruir el componente
    this.tokenRefreshService.stopTokenRefreshService();
  }
}
