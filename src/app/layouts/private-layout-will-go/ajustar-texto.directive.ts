import { AfterViewInit, Directive, ElementRef, HostListener, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Achica la letra de un campo de texto cuando lo escrito no cabe, para que siempre se vea completo
 * (p. ej. un correo largo en un celular). Nunca baja de 10 px ni sube del tamaño original del campo.
 */
@Directive({ selector: 'input[wgAjustarTexto]', standalone: true })
export class AjustarTextoDirective implements AfterViewInit, OnDestroy {
  private el = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private observador: ResizeObserver | null = null;
  private cuadro = 0;

  ngAfterViewInit(): void {
    if (!this.navegador) return;
    if (typeof ResizeObserver !== 'undefined') {
      this.observador = new ResizeObserver(() => this.ajustar());
      this.observador.observe(this.el);
    }
    this.ajustar();
    // El autocompletado del navegador llena el campo sin evento de teclado: se revisa un momento después
    setTimeout(() => this.ajustar(), 600);
  }

  ngOnDestroy(): void { this.observador?.disconnect(); cancelAnimationFrame(this.cuadro); }

  @HostListener('input') @HostListener('change') @HostListener('focus') @HostListener('blur')
  alCambiar(): void { cancelAnimationFrame(this.cuadro); this.cuadro = requestAnimationFrame(() => this.ajustar()); }

  private ajustar(): void {
    const el = this.el;
    el.style.fontSize = '';
    if (!el.value || el.clientWidth === 0) return;
    let tam = parseFloat(getComputedStyle(el).fontSize) || 16;
    while (el.scrollWidth > el.clientWidth && tam > 10) {
      tam -= 0.5;
      el.style.fontSize = `${tam}px`;
    }
  }
}
