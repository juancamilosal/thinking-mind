export interface AnswerOption {
  id: number;
  respuestas: string;
  correcta: boolean;
  puntaje: number;
  test_id?: number;
}

export interface TestQuestion {
  id: number;
  pregunta: string;
  idioma: string;
  // Directus relational field: can return nested array of answers
  respuestas_id?: AnswerOption[];
}

// Allowed language values from Directus
export type TestLanguage = 'INGLÉS' | 'FRANCÉS';
