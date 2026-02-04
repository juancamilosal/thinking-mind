import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';

export interface MeetingSession {
  meetingId: string;
  startTime: number;
  elapsedMinutes: number;
  isActive: boolean;
  notified: boolean;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  actualStartTime?: string;
  gradingDeadline?: string;
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
  startSession(meetingId: string, scheduledStart?: Date, scheduledEnd?: Date): void {
    const existingSession = this.getSession();

    // If there's already an active session for a different meeting, end it first
    if (existingSession && existingSession.meetingId !== meetingId) {
      this.endSession();
    }

    const now = new Date();
    // Always set actualStartTime to now - this is when the teacher actually started the session
    const actualStart = now.toISOString();
    const gradingDeadline = scheduledEnd ? new Date(scheduledEnd.getTime() + 10 * 60 * 1000).toISOString() : undefined;

    const session: MeetingSession = {
      meetingId,
      startTime: Date.now(),
      elapsedMinutes: 0,
      isActive: true,
      notified: false,
      scheduledStartTime: scheduledStart?.toISOString(),
      scheduledEndTime: scheduledEnd?.toISOString(),
      actualStartTime: actualStart,
      gradingDeadline
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

    const now = Date.now();
    const elapsedMs = now - session.startTime;
    const totalSeconds = Math.floor(elapsedMs / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toString().padStart(2, '0');

    if (hours > 0) {
      return `${hours}:${formattedMinutes}:${formattedSeconds}`;
    }
    return `${formattedMinutes}:${formattedSeconds}`;
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
   * Start the timer that updates every second
   */
  private startTimer(): void {
    // Update every second (1000ms)
    this.timerSubscription = interval(1000).subscribe(() => {
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

        // Save session less frequently to avoid excessive writes?
        // Or just save every second? LocalStorage is fast enough usually.
        // Let's optimize to save only if minutes changed or every 10 seconds if needed,
        // but for now simple is better.
        // However, we MUST emit sessionSubject to trigger UI updates every second.

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
   * Check if current time is within grading window (10 min after class end)
   */
  isWithinGradingWindow(): boolean {
    const session = this.getSession();
    if (!session || !session.gradingDeadline) return false;

    const now = new Date();
    const deadline = new Date(session.gradingDeadline);
    return now <= deadline;
  }

  /**
   * Get time remaining until grading deadline in seconds
   */
  getTimeUntilGradingDeadline(): number {
    const session = this.getSession();
    if (!session || !session.gradingDeadline) return 0;

    const now = new Date();
    const deadline = new Date(session.gradingDeadline);
    return Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));
  }

  /**
   * Get class duration in hours from actual start to now
   */
  getClassDurationInHours(): number {
    const session = this.getSession();
    if (!session || !session.actualStartTime) return 0;

    const start = new Date(session.actualStartTime);
    const now = new Date();
    const durationMs = now.getTime() - start.getTime();
    return durationMs / (1000 * 60 * 60);
  }

  /**
   * Get formatted grading deadline countdown
   */
  getFormattedGradingCountdown(): string {
    const seconds = this.getTimeUntilGradingDeadline();
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
