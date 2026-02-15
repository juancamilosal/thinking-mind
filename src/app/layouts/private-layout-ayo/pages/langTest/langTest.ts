import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LangTestService } from '../../../../core/services/langTest.service';
import { TestQuestion, TestLanguage } from '../../../../core/models/LangTestModels';
import { StorageServices } from '../../../../core/services/storage.services';
import { Router } from '@angular/router';

@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './langTest.html',
})

export class LangTest implements OnInit, OnDestroy {
  // UI state
  selectedLanguage: TestLanguage | null = null;
  loading = false;
  showResults = false;

  // Data
  questions: TestQuestion[] = [];
  currentIndex = 0;
  answersByQuestion: Record<number, number | null> = {};
  score = 0;
  classification = '';
  studentId: string | null = null;

  constructor(
    private langTestService: LangTestService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const currentUser = StorageServices.getCurrentUser();
    if (!currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    // Check if student already completed the test
    if (currentUser.resultado_test !== null && currentUser.resultado_test !== undefined) {
      // Student has already taken the test, redirect to dashboard
      this.router.navigate(['/private-ayo/dashboard-ayo'], { queryParamsHandling: 'preserve' });
      return;
    }

    // Get student ID from current user
    this.studentId = currentUser.student_id || currentUser.id;

    // Hide sidebar by adding class to body
    if (typeof document !== 'undefined') {
      document.body.classList.add('lang-test-active');
      // Add styles to hide sidebar
      const style = document.createElement('style');
      style.id = 'lang-test-styles';
      style.textContent = `
        .lang-test-active app-sidebar,
        .lang-test-active app-header {
          display: none !important;
        }
        .lang-test-active .md\\:flex > div:first-child {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  ngOnDestroy(): void {
    // Remove class and styles when leaving component
    if (typeof document !== 'undefined') {
      document.body.classList.remove('lang-test-active');
      const style = document.getElementById('lang-test-styles');
      if (style) {
        style.remove();
      }
    }
  }

  // Welcome actions
  selectLanguage(lang: TestLanguage) {
    console.log('Language selected:', lang);
    this.selectedLanguage = lang;
    this.fetchQuestions(lang);
  }

  // Data fetch
  private fetchQuestions(lang: TestLanguage) {
    this.loading = true;
    this.langTestService.getQuestionsByLanguage(lang).subscribe({
      next: (res) => {
        console.log('Questions fetched successfully:', res);
        this.questions = res.data || [];
        this.currentIndex = 0;
        this.answersByQuestion = {};
        for (const q of this.questions) {
          this.answersByQuestion[q.id] = null;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching questions:', err);
        this.loading = false;
      }
    });
  }

  // Navigation
  prev() {
    if (this.currentIndex > 0) this.currentIndex--;
  }

  next() {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
    }
  }

  isLastQuestion(): boolean {
    return this.currentIndex === this.questions.length - 1;
  }

  // Selection
  chooseAnswer(answerId: number) {
    const q = this.currentQuestion;
    if (!q) return;
    this.answersByQuestion[q.id] = answerId;
  }

  // Computed
  get currentQuestion(): TestQuestion | undefined {
    return this.questions[this.currentIndex];
  }

  get progressPercent(): number {
    if (!this.questions.length) return 0;
    return Math.round(((this.currentIndex + 1) / this.questions.length) * 100);
  }

  get isAllAnswered(): boolean {
    return this.questions.every((q) => this.answersByQuestion[q.id] !== null);
  }

  private getClassification(score: number): string {
    if (score <= 2) return 'A1.1 – Explorer';
    if (score <= 4) return 'A1.2 – Explorer';
    if (score <= 6) return 'A1.3 – Seeker';
    return 'A1.4 – Seeker';
  }

  // Submit & score
  submitTest() {
    // Collect all selected answer IDs
    const selectedAnswerIds: string[] = [];
    for (const q of this.questions) {
      const answerId = this.answersByQuestion[q.id];
      if (answerId !== null) {
        selectedAnswerIds.push(answerId.toString());
      }
    }

    // Send to server for scoring
    this.loading = true;
    this.langTestService.submitTest(selectedAnswerIds, this.studentId || undefined).subscribe({
      next: (response) => {
        this.score = response.data.respuestas_correctas;
        this.classification = this.getClassification(this.score);
        this.showResults = true;
        this.loading = false;

        // Update user data in session storage with test result
        const currentUser = StorageServices.getCurrentUser();
        if (currentUser) {
          currentUser.resultado_test = this.score;
          StorageServices.setUserData(currentUser);
        }
      },
      error: (err) => {
        console.error('Error submitting test:', err);
        this.loading = false;
      }
    });
  }

  goToDashboard() {
    this.router.navigate(['/private-ayo/dashboard']);
  }
}
