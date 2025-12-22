import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { LangTestService } from '../../../../core/services/langTest.service';
import { TestQuestion, TestLanguage } from '../../../../core/models/LangTestModels';

@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
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

  // Submit & score
  submitTest() {
    let correct = 0;
    for (const q of this.questions) {
      const selectedId = this.answersByQuestion[q.id];
      const options = q.respuestas_id || [];
      const selected = options.find((o) => o.id === selectedId);
      if (selected?.correcta) correct++;
    }
    this.score = correct;
    this.showResults = true;
  }
}
