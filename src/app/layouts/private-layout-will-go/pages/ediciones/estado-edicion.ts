/** `texto` es una clave de traducción: se muestra con | translate. */
export const ESTADO_EDICION: Record<string, { texto: string; clase: string }> = {
  borrador: { texto: 'wg.nucleo.estadoEdicion.borrador', clase: 'bg-amber-100 text-amber-800' },
  abierta: { texto: 'wg.nucleo.estadoEdicion.abierta', clase: 'bg-emerald-100 text-emerald-800' },
  cerrada: { texto: 'wg.nucleo.estadoEdicion.cerrada', clase: 'bg-gray-200 text-gray-700' },
};

/** `texto` es una clave de traducción: se muestra con | translate. */
export const DIAS_SEMANA = [
  { id: 'lunes', texto: 'wg.nucleo.dias.lunes' },
  { id: 'martes', texto: 'wg.nucleo.dias.martes' },
  { id: 'miercoles', texto: 'wg.nucleo.dias.miercoles' },
  { id: 'jueves', texto: 'wg.nucleo.dias.jueves' },
  { id: 'viernes', texto: 'wg.nucleo.dias.viernes' },
  { id: 'sabado', texto: 'wg.nucleo.dias.sabado' },
  { id: 'domingo', texto: 'wg.nucleo.dias.domingo' },
];

/** Precio en billetes con la tasa (igual que la caja: hacia arriba). */
export const precioEnBilletes = (precioCop: number, tasa: number): number => Math.ceil(precioCop / Math.max(tasa, 1));

/**
 * Reduce una foto en el navegador a máx. 800 px y la devuelve como JPEG en base64.
 * Si falla, el `message` del error es una clave de traducción (wg.nucleo.foto.*): mostrarlo con translate.instant().
 */
export function reducirFoto(archivo: File, maximo = 800): Promise<{ base64: string; tipo: string }> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('wg.nucleo.foto.noSeLeyo'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('wg.nucleo.foto.noEsImagen'));
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
