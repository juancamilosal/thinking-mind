import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ConfirmationData } from '../../components/confirmation-modal/confirmation-modal';

@Injectable({
  providedIn: 'root'
})
export class ConfirmationService {
  private confirmationSubject = new BehaviorSubject<ConfirmationData | null>(null);
  private isVisibleSubject = new BehaviorSubject<boolean>(false);
  private confirmCallback: (() => void) | null = null;
  private cancelCallback: (() => void) | null = null;

  constructor() {}

  // Observables para que los componentes se suscriban
  get confirmation$(): Observable<ConfirmationData | null> {
    return this.confirmationSubject.asObservable();
  }

  get isVisible$(): Observable<boolean> {
    return this.isVisibleSubject.asObservable();
  }

  // Método para mostrar confirmación de eliminación
  showDeleteConfirmation(
    itemName: string, 
    itemType: string = 'elemento',
    onConfirm: () => void,
    onCancel?: () => void
  ): void {
    this.showConfirmation({
      title: `Eliminar ${itemType}`,
      message: `¿Estás seguro de que deseas eliminar ${itemName}? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      type: 'danger'
    }, onConfirm, onCancel);
  }

  // Método genérico para mostrar confirmación
  showConfirmation(
    confirmation: ConfirmationData,
    onConfirm: () => void,
    onCancel?: () => void
  ): void {
    this.confirmCallback = onConfirm;
    this.cancelCallback = onCancel || null;
    this.confirmationSubject.next(confirmation);
    this.isVisibleSubject.next(true);
  }

  // Método para confirmar
  confirm(): void {
    if (this.confirmCallback) {
      this.confirmCallback();
    }
    this.hideConfirmation();
  }

  // Método para cancelar
  cancel(): void {
    if (this.cancelCallback) {
      this.cancelCallback();
    }
    this.hideConfirmation();
  }

  // Método para ocultar confirmación
  hideConfirmation(): void {
    this.isVisibleSubject.next(false);
    this.confirmationSubject.next(null);
    this.confirmCallback = null;
    this.cancelCallback = null;
  }
}