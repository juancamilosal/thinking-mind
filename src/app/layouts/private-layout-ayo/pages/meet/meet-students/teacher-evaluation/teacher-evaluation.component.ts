import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ProgramaAyoService } from '../../../../../../core/services/programa-ayo.service';
import { CriterioEvaluacion } from '../../../../../../core/models/Evaluation';

@Component({
  selector: 'app-teacher-evaluation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './teacher-evaluation.component.html',
  styleUrls: ['./teacher-evaluation.component.css']
})
export class TeacherEvaluationComponent implements OnInit {
  @Input() teacherName: string = '';
  @Input() className: string = '';
  @Output() onSubmitEvaluation = new EventEmitter<any>();
  @Output() onCancel = new EventEmitter<void>();

  evaluationForm: FormGroup;
  questions: { id: string, text: string }[] = [];

  constructor(
    private fb: FormBuilder,
    private programaAyoService: ProgramaAyoService
  ) {
    this.evaluationForm = this.fb.group({
      observations: ['']
    });
  }

  ngOnInit(): void {
    this.loadCriteria();
  }

  loadCriteria(): void {
    this.programaAyoService.getCriteriosEvaluacion().subscribe({
      next: (response) => {
        if (response.data) {
          this.questions = response.data.map((item: CriterioEvaluacion) => ({
            id: item.id,
            text: item.nombre
          }));

          // Add controls for each question
          this.questions.forEach(q => {
            this.evaluationForm.addControl(q.id, this.fb.control(0, [Validators.required, Validators.min(1)]));
          });
        }
      },
      error: (err) => {
        console.error('Error loading evaluation criteria:', err);
      }
    });
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
