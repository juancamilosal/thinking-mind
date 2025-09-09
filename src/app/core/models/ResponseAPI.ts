export class ResponseAPI<T> {
  status: 'ERROR' | 'SUCCESS' | 'DISPONIBLE' | 'NO_DISPONIBLE' | 'EN_USO';
  code?: string;
  message: string;
  data: T;
  meta?: {
    total_count?: number;
    filter_count?: number;
    page?: number;
    limit?: number;
  };

  static ERROR: string = 'ERROR';
  static SUCCESS: string = 'SUCCESS';
  static DISPONIBLE: string = 'DISPONIBLE';
  static NO_DISPONIBLE: string = 'NO_DISPONIBLE';
  static EN_USO: string = 'EN_USO';
}
