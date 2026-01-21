import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NotificationData } from '../../components/notification-modal/notification-modal';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationSubject = new BehaviorSubject<NotificationData | null>(null);
  private isVisibleSubject = new BehaviorSubject<boolean>(false);

  constructor() {}

  // Observables para que los componentes se suscriban
  get notification$(): Observable<NotificationData | null> {
    return this.notificationSubject.asObservable();
  }

  get isVisible$(): Observable<boolean> {
    return this.isVisibleSubject.asObservable();
  }

  // Método para mostrar notificación de éxito
  showSuccess(title: string, message: string, duration: number = 3000, onClose?: () => void): void {
    this.showNotification({
      type: 'success',
      title,
      message,
      duration,
      onClose
    });
  }

  // Método para mostrar notificación de error
  showError(title: string, message?: string, duration?: number): void {
    this.showNotification({
      type: 'error',
      title,
      message,
      duration // Los errores no se cierran automáticamente por defecto
    });
  }

  // Método para mostrar notificación de advertencia
  showWarning(title: string, message: string, duration: number = 4000): void {
    this.showNotification({
      type: 'warning',
      title,
      message,
      duration
    });
  }

  // Método para mostrar notificación informativa
  showInfo(title: string, message: string, duration: number = 3000): void {
    this.showNotification({
      type: 'info',
      title,
      message,
      duration
    });
  }

  // Método genérico para mostrar cualquier tipo de notificación
  showNotification(notification: NotificationData): void {
    this.notificationSubject.next(notification);
    this.isVisibleSubject.next(true);
  }

  // Método para cerrar la notificación
  hideNotification(): void {
    this.isVisibleSubject.next(false);
    // Limpiar la notificación después de un pequeño delay para permitir la animación
    setTimeout(() => {
      this.notificationSubject.next(null);
    }, 300);
  }

  // Métodos de conveniencia para casos comunes
  showClientCreated(clientName: string): void {
    this.showSuccess(
      'Cliente Creado',
      `El cliente ${clientName} ha sido creado exitosamente.`,
      3000
    );
  }

  showStudentCreated(studentName: string): void {
    this.showSuccess(
      'Estudiante Registrado',
      `El estudiante ${studentName} ha sido registrado exitosamente.`,
      3000
    );
  }

  showAccountReceivableCreated(invoiceNumber: string): void {
    this.showSuccess(
      'Cuenta por Cobrar Creada',
      `La factura ${invoiceNumber} ha sido creada exitosamente.`,
      3000
    );
  }

  showCourseCreated(courseName: string): void {
    this.showSuccess(
      'Programa Creado',
      `El programa ${courseName} ha sido creado exitosamente.`,
      3000
    );
  }

  showValidationError(message: string = 'Por favor, verifica los datos ingresados.'): void {
    this.showError(
      'Error de Validación',
      message
    );
  }

  showServerError(message: string = 'Ha ocurrido un error en el servidor. Inténtalo nuevamente.'): void {
    this.showError(
      'Error del Servidor',
      message
    );
  }

  showNetworkError(): void {
    this.showError(
      'Error de Conexión',
      'No se pudo conectar con el servidor. Verifica tu conexión a internet.'
    );
  }
}
