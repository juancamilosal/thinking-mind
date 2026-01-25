import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';

export interface MeetingSession {
  meetingId: string;
  startTime: number;
  elapsedMinutes: number;
  isActive: boolean;
  notified: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MeetingTimerService {
  private readonly STORAGE_KEY = 'teacher_meeting_session';
  private readonly NOTIFICATION_THRESHOLD = 4; // minutes (AJUSTAR A 45 EN PRODUCCIÓN)
  private timerSubscription: Subscription | null = null;

  private sessionSubject = new BehaviorSubject<MeetingSession | null>(null);
  public session$: Observable<MeetingSession | null> = this.sessionSubject.asObservable();

  constructor() {
    this.loadSession();
    this.startTimer();
  }

  /**
   * Start a new meeting session
   */
  startSession(meetingId: string): void {
    const existingSession = this.getSession();

    // If there's already an active session for a different meeting, end it first
    if (existingSession && existingSession.meetingId !== meetingId) {
      this.endSession();
    }

    const session: MeetingSession = {
      meetingId,
      startTime: Date.now(),
      elapsedMinutes: 0,
      isActive: true,
      notified: false
    };

    this.saveSession(session);
    this.sessionSubject.next(session);
    this.requestNotificationPermission();
  }

  /**
   * End the current session
   */
  endSession(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.sessionSubject.next(null);
  }

  /**
   * Get the current session
   */
  getSession(): MeetingSession | null {
    return this.sessionSubject.value;
  }

  /**
   * Check if there's an active session for a specific meeting
   */
  hasActiveSession(meetingId: string): boolean {
    const session = this.getSession();
    return session !== null && session.isActive && session.meetingId === meetingId;
  }

  /**
   * Get formatted elapsed time (e.g., "45:30")
   */
  getFormattedElapsedTime(): string {
    const session = this.getSession();
    if (!session) return '00:00';

    const totalMinutes = session.elapsedMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    }
    return `${minutes}:00`;
  }

  /**
   * Load session from localStorage
   */
  private loadSession(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const session: MeetingSession = JSON.parse(stored);

        // Calculate elapsed time since last save
        const now = Date.now();
        const elapsedMs = now - session.startTime;
        session.elapsedMinutes = Math.floor(elapsedMs / 60000);

        this.sessionSubject.next(session);
      } catch (error) {
        console.error('Error loading session:', error);
        localStorage.removeItem(this.STORAGE_KEY);
      }
    }
  }

  /**
   * Save session to localStorage
   */
  private saveSession(session: MeetingSession): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
  }

  /**
   * Start the timer that updates every minute
   */
  private startTimer(): void {
    // Update every minute (60000ms)
    this.timerSubscription = interval(60000).subscribe(() => {
      const session = this.getSession();

      if (session && session.isActive) {
        const now = Date.now();
        const elapsedMs = now - session.startTime;
        session.elapsedMinutes = Math.floor(elapsedMs / 60000);

        // Check if we need to send notification
        if (session.elapsedMinutes >= this.NOTIFICATION_THRESHOLD && !session.notified) {
          this.sendNotification();
          session.notified = true;
        }

        this.saveSession(session);
        this.sessionSubject.next(session);
      }
    });
  }

  /**
   * Request browser notification permission
   */
  private requestNotificationPermission(): void {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  /**
   * Send browser notification at 45 minutes
   */
  private sendNotification(): void {
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Recordatorio de Clase', {
        body: 'Por favor recuerda hacer el cierre adecuado de la clase',
        icon: '/assets/icons/meet.png',
        badge: '/assets/icons/meet.png',
        requireInteraction: true
      });
    }

    // Also play audio if available (optional)
    this.playNotificationSound();
  }

  /**
   * Play notification sound (optional)
   */
  private playNotificationSound(): void {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE=');
      audio.play().catch(err => console.log('Audio play failed:', err));
    } catch (error) {
      // Silently fail if audio doesn't work
    }
  }

  /**
   * Clean up subscriptions
   */
  ngOnDestroy(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
  }
}
