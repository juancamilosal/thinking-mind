export const ESTADO_EDICION: Record<string, { texto: string; clase: string }> = {
  borrador: { texto: 'En preparación', clase: 'bg-amber-100 text-amber-800' },
  abierta: { texto: 'Abierta', clase: 'bg-emerald-100 text-emerald-800' },
  cerrada: { texto: 'Cerrada', clase: 'bg-gray-200 text-gray-700' },
};

export const DIAS_SEMANA = [
  { id: 'lunes', texto: 'Lunes' },
  { id: 'martes', texto: 'Martes' },
  { id: 'miercoles', texto: 'Miércoles' },
  { id: 'jueves', texto: 'Jueves' },
  { id: 'viernes', texto: 'Viernes' },
  { id: 'sabado', texto: 'Sábado' },
  { id: 'domingo', texto: 'Domingo' },
];

/** Precio en billetes con la tasa (igual que la caja: hacia arriba). */
export const precioEnBilletes = (precioCop: number, tasa: number): number => Math.ceil(precioCop / Math.max(tasa, 1));

/** Reduce una foto en el navegador a máx. 800 px y la devuelve como JPEG en base64. */
export function reducirFoto(archivo: File, maximo = 800): Promise<{ base64: string; tipo: string }> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer la foto'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo no es una imagen válida'));
      img.onload = () => {
        const escala = Math.min(1, maximo / Math.max(img.width, img.height));
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.round(img.width * escala);
        lienzo.height = Math.round(img.height * escala);
        const ctx = lienzo.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, lienzo.width, lienzo.height);
        ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
        resolve({ base64: lienzo.toDataURL('image/jpeg', 0.85).split(',')[1], tipo: 'image/jpeg' });
      };
      img.src = String(lector.result);
    };
    lector.readAsDataURL(archivo);
  });
}
