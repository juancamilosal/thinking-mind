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
