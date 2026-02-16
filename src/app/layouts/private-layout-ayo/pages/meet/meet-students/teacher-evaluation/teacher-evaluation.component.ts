import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ProgramaAyoService } from '../../../../../../core/services/programa-ayo.service';
import { CriterioEvaluacion } from '../../../../../../core/models/Evaluation';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-teacher-evaluation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TranslateModule],
  templateUrl: './teacher-evaluation.component.html',
  styleUrls: ['./teacher-evaluation.component.css']
})
export class TeacherEvaluationComponent implements OnInit {
  @Input() teacherName: string = '';
  @Input() className: string = '';
  @Output() onSubmitEvaluation = new EventEmitter<any>();
  @Output() onCancel = new EventEmitter<void>();

  evaluationForm: FormGroup;
  questions: { id: string, text: string, key?: string }[] = [];
  isLoading = true;

  constructor(
    private fb: FormBuilder,
    private programaAyoService: ProgramaAyoService,
    private translate: TranslateService
  ) {
    this.evaluationForm = this.fb.group({
      observations: ['']
    });
  }

  ngOnInit(): void {
    this.loadCriteria();
  }

  loadCriteria(): void {
    this.isLoading = true;
    this.programaAyoService.getCriteriosEvaluacion().subscribe({
      next: (response) => {
        if (response.data) {
          this.questions = response.data.map((item: CriterioEvaluacion) => {
            const key = this.getQuestionKey(item.nombre);
            return {
              id: item.id,
              text: item.nombre,
              key
            };
          });

          // Add controls for each question
          this.questions.forEach(q => {
            this.evaluationForm.addControl(q.id, this.fb.control(0, [Validators.required, Validators.min(1)]));
            this.evaluationForm.addControl('obs_' + q.id, this.fb.control(''));
          });
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading evaluation criteria:', err);
        this.isLoading = false;
      }
    });
  }

  getQuestionKey(name?: string): string | undefined {
    const v = (name || '').trim();
    if (!v) return undefined;
    if (v === '¿El docente utilizó ejemplos claros y prácticos?') return 'evaluation.questions.examples';
    if (v === '¿El docente fomentó la participación durante la clase?') return 'evaluation.questions.participation';
    if (v === '¿El docente explicó claramente el tema de la clase?') return 'evaluation.questions.clarity';
    if (v === '¿Cómo calificarías la puntualidad y organización del docente?') return 'evaluation.questions.punctuality';
    if (v === '¿El docente resolvió tus dudas de manera efectiva?') return 'evaluation.questions.resolveDoubts';
    return undefined;
  }

  setRating(questionId: string, rating: number): void {
    this.evaluationForm.get(questionId)?.setValue(rating);
  }

  submit(): void {
    if (this.evaluationForm.valid) {
      this.onSubmitEvaluation.emit(this.evaluationForm.value);
    } else {
      this.evaluationForm.markAllAsTouched();
    }
  }

  cancel(): void {
    this.onCancel.emit();
  }
}
