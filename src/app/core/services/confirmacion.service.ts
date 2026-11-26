import { Injectable, signal } from '@angular/core';

/** Lo que muestra el modal de confirmación de la app (en lugar del confirm() del navegador). */
export interface PedidoConfirmacion {
  titulo: string;
  texto?: string;
  aceptar?: string;
  cancelar?: string;
  /** Acción que no se puede deshacer (quitar, eliminar): el botón sale en rojo. */
  peligro?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmacionService {
  readonly actual = signal<(PedidoConfirmacion & { resolver: (ok: boolean) => void }) | null>(null);

  /** Abre el modal y responde true si la persona acepta. */
  pedir(pedido: PedidoConfirmacion): Promise<boolean> {
    this.actual()?.resolver(false);
    return new Promise((resolver) => this.actual.set({ ...pedido, resolver }));
  }

  responder(ok: boolean): void {
    const a = this.actual();
    if (!a) return;
    this.actual.set(null);
    a.resolver(ok);
  }
}
