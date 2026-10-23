document.addEventListener('DOMContentLoaded', () => {
  // Menú móvil
  const boton = document.querySelector('.cabecera__abrir');
  const menu = document.getElementById('menu');
  const cerrar = () => { menu.classList.remove('abierto'); boton.setAttribute('aria-expanded', 'false'); };
  boton.addEventListener('click', () => {
    const abierto = menu.classList.toggle('abierto');
    boton.setAttribute('aria-expanded', String(abierto));
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', cerrar));

  // Los botones "Quiero información" preseleccionan el programa en el formulario
  const selector = document.getElementById('f-programa');
  document.querySelectorAll('[data-programa]').forEach(a => {
    a.addEventListener('click', () => { selector.value = a.dataset.programa; });
  });

  // Cambio de idioma: cada texto guarda su versión en español y se busca en TRADUCCIONES
  const IDIOMAS = ['es', 'en', 'fr'];
  const ATRIBUTOS = ['alt', 'placeholder', 'aria-label', 'title'];
  const textos = [];
  const recorrido = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let nodo;
  while ((nodo = recorrido.nextNode())) {
    const original = nodo.nodeValue.trim();
    if (TRADUCCIONES[original]) textos.push({ nodo, original, valor: nodo.nodeValue });
  }
  const atributos = [];
  document.querySelectorAll(ATRIBUTOS.map(a => `[${a}]`).join(',')).forEach(el => {
    ATRIBUTOS.forEach(a => {
      const original = el.getAttribute(a);
      if (original && TRADUCCIONES[original]) atributos.push({ el, a, original });
    });
  });
  const tituloOriginal = document.title;
  const traducir = (texto, idioma) => idioma === 'es' ? texto : (TRADUCCIONES[texto] || [])[IDIOMAS.indexOf(idioma) - 1] || texto;

  const cambiarIdioma = idioma => {
    if (!IDIOMAS.includes(idioma)) idioma = 'es';
    document.documentElement.lang = idioma;
    document.title = traducir(tituloOriginal, idioma);
    textos.forEach(t => { t.nodo.nodeValue = t.valor.replace(t.original, traducir(t.original, idioma)); });
    atributos.forEach(t => t.el.setAttribute(t.a, traducir(t.original, idioma)));
    document.querySelectorAll('[data-idioma]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.idioma === idioma)));
    try { localStorage.setItem('tm-idioma', idioma); } catch (e) {}
  };
  document.querySelectorAll('[data-idioma]').forEach(b => b.addEventListener('click', () => cambiarIdioma(b.dataset.idioma)));
  let inicial = new URLSearchParams(location.search).get('lang');
  if (!inicial) { try { inicial = localStorage.getItem('tm-idioma'); } catch (e) {} }
  if (inicial && inicial !== 'es') cambiarIdioma(inicial);

  // Formulario de prototipo: valida y muestra confirmación, no envía datos
  const form = document.getElementById('formulario');
  const ok = form.querySelector('.formulario__ok');
  form.addEventListener('submit', e => {
    e.preventDefault();
    let valido = true;
    form.querySelectorAll('[required]').forEach(campo => {
      const bien = campo.value.trim() !== '' && campo.checkValidity();
      campo.closest('.campo').classList.toggle('campo--error', !bien);
      if (!bien) valido = false;
    });
    if (!valido) return;
    ok.hidden = false;
    form.reset();
  });
});
