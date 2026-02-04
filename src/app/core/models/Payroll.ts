export interface TeacherPayroll {
  id?: string;
  teacher_id: string | any;
  reunion_meet_id: string | any;
  programa_ayo_id: string | any;
  fecha_clase: string;
  hora_inicio_real?: string;
  hora_fin_evaluacion?: string;
  duracion_horas: number;
  calificado_a_tiempo: boolean;
  estado_pago: 'Pendiente' | 'Pagado';
  valor_hora: number;
  valor_total: number;
  metodo_pago?: string;
  fecha_pago?: string;
  date_created?: string;
  date_updated?: string;
}

export interface TeacherPayrollSummary {
  valorPorHora: number;
  horasTrabajadasMes: number;
  pagoTotalMes: number;
}

export interface PayrollHistory {
  id: string;
  horasTrabajadas: number;
  valorPorHora: number;
  fechaPago: string;
  metodoPago: string;
  estado: 'Pagado' | 'Pendiente';
  fecha_clase: string;
  calificado_a_tiempo: boolean;
}
