import { Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, PLATFORM_ID, ViewChild, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Lee el QR de una tarjeta Will-Go con la cámara del celular (o permite escribir la llave a mano).
 * Emite el texto leído o escrito, p. ej. «@sofia.gomez». Usa BarcodeDetector si el navegador lo trae
 * (Chrome/Android) y, si no (iPhone), la librería jsQR.
 */
@Component({
  selector: 'wg-escaner-qr',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="relative rounded-2xl overflow-hidden bg-slate-900 aspect-square max-h-[60vh] mx-auto">
      <video #video class="w-full h-full object-cover" playsinline muted></video>
      <div class="absolute inset-[18%] border-4 border-white/80 rounded-2xl pointer-events-none" aria-hidden="true"></div>
      @if (estado !== 'leyendo') {
        <div class="absolute inset-0 flex items-center justify-center p-6 text-center text-white text-sm bg-slate-900/80">
          {{ (estado === 'iniciando' ? 'wg.nucleo.qr.iniciando' : 'wg.nucleo.qr.sinCamara') | translate }}
        </div>
      }
    </div>
    <p class="mt-2 text-xs text-gray-500 text-center">{{ 'wg.nucleo.qr.ayuda' | translate }}</p>
    <form class="mt-3 flex gap-2" (submit)="$event.preventDefault(); enviarEscrita()">
      <label class="sr-only" for="llave-manual">{{ 'wg.nucleo.qr.escribirLlave' | translate }}</label>
      <input id="llave-manual" [(ngModel)]="escrita" name="llave" autocomplete="off" autocapitalize="off" spellcheck="false"
             [placeholder]="'wg.nucleo.qr.placeholder' | translate"
             class="flex-1 min-w-0 px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
      <button type="submit" [disabled]="!escrita.trim()" class="shrink-0 px-4 py-3 rounded-xl font-semibold text-white bg-slate-800 disabled:opacity-40">{{ 'wg.nucleo.qr.usar' | translate }}</button>
    </form>
  `,
})
export class EscanerQrComponent implements OnInit, OnDestroy {
  @Input() activo = true;
  @Output() leido = new EventEmitter<string>();
  @ViewChild('video', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;

  private zona = inject(NgZone);
  private navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private stream: MediaStream | null = null;
  private lienzo?: HTMLCanvasElement;
  private detector: { detect(fuente: CanvasImageSource): Promise<{ rawValue: string }[]> } | null = null;
  private cuadro = 0;
  private terminado = false;
  estado: 'iniciando' | 'leyendo' | 'sin-camara' = 'iniciando';
  escrita = '';

  async ngOnInit(): Promise<void> {
    if (!this.navegador || !navigator.mediaDevices?.getUserMedia) { this.estado = 'sin-camara'; return; }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      const v = this.videoRef.nativeElement;
      v.srcObject = this.stream;
      await v.play();
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => typeof this.detector }).BarcodeDetector;
      if (BD) { try { this.detector = new BD({ formats: ['qr_code'] }); } catch { this.detector = null; } }
      this.zona.run(() => (this.estado = 'leyendo'));
      this.zona.runOutsideAngular(() => this.buscar());
    } catch {
      this.zona.run(() => (this.estado = 'sin-camara'));
    }
  }

  ngOnDestroy(): void {
    this.terminado = true;
    if (this.navegador) cancelAnimationFrame(this.cuadro);
    this.stream?.getTracks().forEach((t) => t.stop());
  }

  enviarEscrita(): void {
    const t = this.escrita.trim();
    if (t) this.leido.emit(t);
  }

  /** Revisa unas 6 veces por segundo si hay un QR frente a la cámara. */
  private async buscar(): Promise<void> {
    if (this.terminado) return;
    const v = this.videoRef.nativeElement;
    if (this.activo && v.readyState >= 2 && v.videoWidth) {
      const texto = await this.leerCuadro(v).catch(() => null);
      if (texto) { this.zona.run(() => this.leido.emit(texto)); }
    }
    setTimeout(() => { this.cuadro = requestAnimationFrame(() => this.buscar()); }, 160);
  }

  private async leerCuadro(v: HTMLVideoElement): Promise<string | null> {
    if (this.detector) {
      const r = await this.detector.detect(v);
      return r[0]?.rawValue ?? null;
    }
    const ancho = Math.min(640, v.videoWidth), alto = Math.round(v.videoHeight * (ancho / v.videoWidth));
    this.lienzo ??= document.createElement('canvas');
    this.lienzo.width = ancho; this.lienzo.height = alto;
    const ctx = this.lienzo.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, ancho, alto);
    const { default: jsQR } = await import('jsqr');
    const r = jsQR(ctx.getImageData(0, 0, ancho, alto).data, ancho, alto, { inversionAttempts: 'dontInvert' });
    return r?.data ?? null;
  }
}
