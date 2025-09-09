import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService } from '../../../../../core/services/notification.service';
import { BudgetService } from '../../../../../core/services/budget.service';


@Component({
  selector: 'app-presupuesto',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './presupuesto.html'
})
export class Presupuesto implements OnInit {
  presupuestoForm!: FormGroup;
  budgets: any[] = [];
  loadingBudgets: boolean = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private budgetService: BudgetService,
    private notificationService: NotificationService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadBudgets();
    // Datos de prueba temporales para verificar que la tabla funciona
    setTimeout(() => {
      if (this.budgets.length === 0) {
        this.budgets = [
          { id: 1, anio: '2024', monto_meta: 50000000 },
          { id: 2, anio: '2023', monto_meta: 45000000 }
        ];
        this.loadingBudgets = false;
      }
    }, 3000);
  }

  private initForm(): void {
    this.presupuestoForm = this.fb.group({
      anio: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      monto_meta: ['', [Validators.required, Validators.min(1)]]
    });
  }

  onPrueba(): void {
    if (this.presupuestoForm.valid) {
      const budgetData = {
        anio: this.presupuestoForm.value.anio,
        monto_meta: this.presupuestoForm.value.monto_meta
      };

      this.budgetService.createBudget(budgetData).subscribe({
           next: (response) => {
             this.notificationService.showSuccess('Éxito', 'Presupuesto creado exitosamente');
             this.onReset();
             this.loadBudgets();
           },
          error: (error) => {
            console.error('Error al crear presupuesto:', error);
            this.notificationService.showError('Error', 'No se pudo crear el presupuesto');
          }
        });
    } else {
      this.notificationService.showWarning('Advertencia', 'Por favor, complete todos los campos correctamente');
    }
  }

  onReset(): void {
    this.presupuestoForm.reset();
  }

  loadBudgets(): void {
    this.loadingBudgets = true;
    this.budgetService.getBudgets().subscribe({
      next: (response) => {
        this.budgets = response.data || [];
        this.loadingBudgets = false;
      },
      error: (error) => {
        console.error('Error al cargar presupuestos:', error);
        this.notificationService.showError('Error', 'No se pudieron cargar los presupuestos');
        this.loadingBudgets = false;
      }
    });
  }

  onRegresar(): void {
    this.router.navigate(['/private/reports']);
  }

  onYearClick(budget: any): void {
    const anio = Number(budget.anio);
    const presupuesto = Number(budget.monto_meta);
    const id = budget.id; // Mantener como string


    // Navegar a la pantalla de informe con los parámetros
    this.router.navigate(['/private/budget-report'], {
      queryParams: {
        anio: anio,
        presupuesto: presupuesto,
        id: id
      }
    });
  }
}
