/** Estilos compartidos de los formularios de la edición. */
export const ESTILOS_CAMPOS = `
  .campo { width: 100%; padding: 0.625rem 1rem; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 0.75rem; }
  .campo:focus { outline: none; border-color: #fb923c; box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.2); }
  .campo:disabled { color: #6b7280; background: #f3f4f6; cursor: not-allowed; }
  .etiqueta { display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.25rem; }
  .ayuda { font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem; }
  .tarjeta { background: #fff; border: 1px solid #e5e7eb; border-radius: 1rem; box-shadow: 0 1px 2px rgba(0,0,0,.04); padding: 1.25rem; }
  .boton-guardar { padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: 600; color: #fff; background: linear-gradient(90deg, #f97316, #ea580c); }
  .boton-guardar:hover { filter: brightness(1.1); }
  .boton-guardar:disabled { opacity: .6; }
`;
