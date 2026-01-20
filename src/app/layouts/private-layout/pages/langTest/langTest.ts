import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LangTestService } from '../../../../core/services/langTest.service';
import { TestQuestion, TestLanguage } from '../../../../core/models/LangTestModels';

@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './langTest.html',
})

export class LangTest {
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

  constructor(private langTestService: LangTestService) {}

  // Welcome actions
  selectLanguage(lang: TestLanguage) {
    this.selectedLanguage = lang;
    this.fetchQuestions(lang);
  }

  // Data fetch
  private fetchQuestions(lang: TestLanguage) {
    this.loading = true;
    this.langTestService.getQuestionsByLanguage(lang).subscribe({
      next: (res) => {
        this.questions = res.data || [];
        this.currentIndex = 0;
        this.answersByQuestion = {};
        for (const q of this.questions) {
          this.answersByQuestion[q.id] = null;
        }
        this.loading = false;
      },
      error: () => {
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
    this.langTestService.submitTest(selectedAnswerIds).subscribe({
      next: (response) => {
        this.score = response.data.respuestas_correctas;
        this.classification = this.getClassification(this.score);
        this.showResults = true;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error submitting test:', err);
        this.loading = false;
      }
    });
  }
}
