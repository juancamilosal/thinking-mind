import { Component, Input, OnChanges, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Dibuja el QR de una llave Will-Go (p. ej. «@sofia.gomez»). Lo leen el lector de la app y cualquier lector de QR. */
@Component({
  selector: 'wg-qr-llave',
  standalone: true,
  template: `@if (src()) { <img [src]="src()" [alt]="'QR ' + llave" class="block w-full h-full" style="image-rendering: pixelated"> }`,
  host: { class: 'block' },
})
export class QrLlaveComponent implements OnChanges {
  @Input({ required: true }) llave = '';
  /** Color de los módulos del QR (por defecto, casi negro). */
  @Input() color = '#0f172a';
  readonly src = signal('');
  private navegador = isPlatformBrowser(inject(PLATFORM_ID));

  async ngOnChanges(): Promise<void> {
    if (!this.navegador || !this.llave) { this.src.set(''); return; }
    const mod = await import('qrcode');
    const QR = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
    const llave = this.llave;
    const url = await QR.toDataURL(llave, { errorCorrectionLevel: 'M', margin: 1, width: 360, color: { dark: this.color, light: '#ffffff' } });
    if (llave === this.llave) this.src.set(url);
  }
}
