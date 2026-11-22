/** Imagen del billete según el país (los diseños impresos de Wonderland, Neverland y Dreamland). */
export function imagenBillete(pais: { nombre: string } | undefined, denominacion: number): string | null {
  const clave = (pais?.nombre ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return ['wonderland', 'neverland', 'dreamland'].includes(clave) ? `assets/images/billetes/${clave}/${denominacion}.jpg` : null;
}
