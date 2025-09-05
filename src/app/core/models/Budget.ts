export interface PaymentRecord {
  id: string;
  valor: number;
  fecha_pago: string;
  metodo_pago: string;
  pagador: string;
  numero_aprobacion: string;
  estado: string;
  cuenta_cobrar_id: {
    id: string;
    monto: number;
    fecha_limite: string;
    saldo: number;
    cliente_id: string;
    estudiante_id: {
      id: string;
      nombre: string;
      apellido: string;
      tipo_documento: string;
      numero_documento: string;
    };
    estado: string;
    link_pago: string | null;
    observaciones: string | null;
    pin_entregado: string;
    fecha_creacion: string | null;
    pagos: string[];
    curso_id: {
      id: string;
      nombre: string;
      precio: string;
      img: string;
      sku: string;
      precio_inscripcion: number;
      estudiantes: string[];
      cuentas_cobrar: string[];
    };
  };
  comprobante: string | null;
}

export class Budget {
  id: string;
  anio: string;
  monto_meta: number;
  recaudado: number;
  faltante: number;
  meta_mensual: number;
  meta_semanal: number;
  meta_acumulada_mes: number;
  meta_acumulada_sem: number;
  estado_mes: string;
  estado_semana: string;
  recaudo_mes: number;
  recaudo_semana: number;
  listado_pagos: PaymentRecord[];
}
