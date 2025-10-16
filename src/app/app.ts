import { Component, OnInit, OnDestroy, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { initFlowbite } from 'flowbite';
import { RouterOutlet } from '@angular/router';
import { TokenRefreshService } from './core/services/token-refresh.service';
import { StorageServices } from './core/services/storage.services';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  imports: [
    RouterOutlet
  ],
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('n');

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private tokenRefreshService: TokenRefreshService
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      initFlowbite();
      
      // Iniciar el servicio de renovación automática de tokens si hay un token válido
      const accessToken = StorageServices.getAccessToken();
      if (accessToken) {
        this.tokenRefreshService.startTokenRefreshService();
      }
    }
  }

  ngOnDestroy(): void {
    // Detener el servicio de renovación de tokens al destruir el componente
    this.tokenRefreshService.stopTokenRefreshService();
  }
}
