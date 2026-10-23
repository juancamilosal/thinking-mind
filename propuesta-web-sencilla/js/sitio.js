// Partes compartidas de la propuesta: cabecera, pie, tarjetas de programas y comportamientos.
// Todo se dibuja antes de aplicar el idioma, para que el traductor encuentre los textos.

const PORTAL_PAGOS = 'https://appthinkingmind.com/payment-record';
const WHATSAPP = 'https://wa.me/573213711595';

const ICONOS = {
  cama: '<path d="M3 18v-8m0 4h18m0 4v-6a3 3 0 0 0-3-3h-7v7M7 11.5a1.5 1.5 0 1 0 0-.01"/>',
  plato: '<path d="M4 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M6 12v9M16 3c-1.7 1-3 3.5-3 6.5 0 2 1 3.5 3 3.5v8"/>',
  libro: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  avion: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  pasaporte: '<rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 17h6"/>',
  bus: '<path d="M6 17h12M5 17V6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v11M5 11h14"/><circle cx="8" cy="18.5" r="1.5"/><circle cx="16" cy="18.5" r="1.5"/>',
  mapa: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',
  escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12h6M12 9v6"/>',
  morral: '<path d="M5 10a7 7 0 0 1 14 0v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM9 6V4a3 3 0 0 1 6 0v2M8 14h8v4H8z"/>',
  juego: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M15 12h.01M18 13.5h.01"/>',
  diploma: '<circle cx="12" cy="9" r="6"/><path d="M8.5 13.8 7 22l5-3 5 3-1.5-8.2"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  grupo: '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.1a4 4 0 0 1 0 7.8M21 21v-2a4 4 0 0 0-3-3.9"/>',
  bombilla: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
  reloj: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  pantalla: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  globo: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  correo: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  telefono: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  ubicacion: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  maleta: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  lavadora: '<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M8 6h.01M11 6h.01"/>',
  camiseta: '<path d="M20.4 6.6 16 3a4 4 0 0 1-8 0L3.6 6.6a1 1 0 0 0-.3 1.2l1.6 3a1 1 0 0 0 1.2.5L8 10.5V21h8V10.5l1.9.8a1 1 0 0 0 1.2-.5l1.6-3a1 1 0 0 0-.3-1.2z"/>',
  enchufe: '<path d="M12 22v-5M9 8V2M15 8V2M18 8v4a6 6 0 0 1-12 0V8z"/>'
};
const REDES = {
  Facebook: ['http://facebook.com/thinkingmindla', '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8a1 1 0 0 1 1-1z"/>'],
  Instagram: ['http://instagram.com/thinkingmindco', '<path d="M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm6-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0zM21.9 8c-.1-1.6-.4-3-1.6-4.2S17.6 2.2 16 2.1C14.4 2 9.6 2 8 2.1 6.4 2.2 5 2.6 3.8 3.8S2.2 6.4 2.1 8C2 9.6 2 14.4 2.1 16c.1 1.6.4 3 1.6 4.2s2.6 1.5 4.2 1.6c1.6.1 6.4.1 8 0 1.6-.1 3-.4 4.2-1.6s1.5-2.6 1.6-4.2c.1-1.6.1-6.4.1-8zm-2 9.9a3 3 0 0 1-1.7 1.7c-1.2.5-4 .4-5.2.4s-4.1.1-5.2-.4a3 3 0 0 1-1.7-1.7c-.5-1.2-.4-4-.4-5.3s-.1-4.1.4-5.3A3 3 0 0 1 5.8 4.6C7 4.1 9.8 4.2 11 4.2s4.1-.1 5.2.4a3 3 0 0 1 1.7 1.7c.5 1.2.4 4 .4 5.3s.1 4.1-.4 5.3z"/>'],
  YouTube: ['https://www.youtube.com/channel/UCg63GxujnnHu03lEsOraaNw', '<path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15V9l5.8 3z"/>'],
  LinkedIn: ['https://www.linkedin.com/company/thinkingmind/', '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.2c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V21h-4z"/>']
};
const BANDERAS = {
  es: '<svg viewBox="0 0 30 20" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><rect width="30" height="10" fill="#FCD116"/><rect y="10" width="30" height="5" fill="#003893"/><rect y="15" width="30" height="5" fill="#CE1126"/></svg>',
  en: '<svg viewBox="0 0 60 40" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><rect width="60" height="40" fill="#012169"/><path d="M0 0l60 40M60 0L0 40" stroke="#fff" stroke-width="8"/><path d="M0 0l60 40M60 0L0 40" stroke="#C8102E" stroke-width="3"/><path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="12"/><path d="M30 0v40M0 20h60" stroke="#C8102E" stroke-width="7"/></svg>',
  fr: '<svg viewBox="0 0 3 2" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><rect width="1" height="2" fill="#002395"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ED2939"/></svg>'
};

const icono = nombre => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[nombre] || ICONOS.libro}</svg>`;
const flecha = dir => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${dir === 'izq' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'}"/></svg>`;
const pesos = n => '$ ' + n.toLocaleString('es-CO');
const foto = (p, i = 0) => `media/programas/${p.id}-${i}.jpg`;
const enlacePrograma = p => `programa.html?p=${p.id}`;
const redes = () => Object.entries(REDES).map(([n, [url, d]]) => `<a href="${url}" target="_blank" rel="noopener" aria-label="${n}"><svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg></a>`).join('');

// ---------- Cabecera ----------
function cabecera(pagina) {
  const actual = id => pagina === id ? ' aria-current="page"' : '';
  const columna = cat => `<div class="submenu__col"><b>${CATEGORIAS[cat].nombre}</b>${PROGRAMAS.filter(p => p.cat === cat).map(p => `<a href="${enlacePrograma(p)}"><img src="${foto(p)}" alt="" loading="lazy">${p.nombre}</a>`).join('')}</div>`;
  return `
<a class="saltar" href="#contenido">Saltar al contenido</a>
<div class="aviso">
  <div class="contenedor aviso__fila">
    <p>Inscripciones abiertas para los viajes · Planes de pago flexibles</p>
    <div class="aviso__datos">
      <a href="tel:+573213711595">+57 321 371 1595</a>
      <a href="mailto:tm@thinkingmind.co">tm@thinkingmind.co</a>
      <span class="aviso__redes">${Object.entries(REDES).map(([n, [url, d]]) => `<a href="${url}" target="_blank" rel="noopener" aria-label="${n}"><svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg></a>`).join('')}</span>
      <a href="${PORTAL_PAGOS}" class="aviso__pagos">Pagos en línea</a>
    </div>
  </div>
</div>
<header class="cabecera">
  <div class="contenedor cabecera__fila">
    <a href="index.html" class="cabecera__logo"><img src="img/logo.webp" alt="Thinking Mind" width="176" height="47"></a>
    <nav class="menu" id="menu" aria-label="Menú principal">
      <a href="nosotros.html"${actual('nosotros')}>Nosotros</a>
      <div class="menu__grupo">
        <a href="programas.html"${actual('programas')}>Programas<span class="menu__flecha" aria-hidden="true"></span></a>
        <div class="submenu">
          ${columna('viajes')}${columna('colombia')}${columna('online')}
          <div class="submenu__todos"><span>10 programas para todas las edades</span><a href="programas.html">Ver todos los programas →</a></div>
        </div>
      </div>
      <a href="experiencia.html"${actual('experiencia')}>Experiencia</a>
      <a href="inscripcion.html"${actual('inscripcion')}>Cómo inscribirte</a>
      <a href="contacto.html"${actual('contacto')}>Contacto</a>
      <a href="${PORTAL_PAGOS}" class="menu__pagos">Pagos en línea</a>
      <a href="contacto.html#formulario" class="boton boton--naranja menu__cta">Agenda una asesoría</a>
    </nav>
    <div class="idioma" role="group" aria-label="Idioma de la página">
      <button type="button" data-idioma="es" aria-pressed="true" title="Español" aria-label="Español">${BANDERAS.es}<span>ES</span></button>
      <button type="button" data-idioma="en" aria-pressed="false" title="English" aria-label="English">${BANDERAS.en}<span>EN</span></button>
      <button type="button" data-idioma="fr" aria-pressed="false" title="Français" aria-label="Français">${BANDERAS.fr}<span>FR</span></button>
    </div>
    <button type="button" class="cabecera__abrir" aria-controls="menu" aria-expanded="false" aria-label="Abrir menú">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
    </button>
  </div>
</header>`;
}

// ---------- Pie ----------
function pie() {
  return `
<section class="llamado">
  <div class="contenedor llamado__fila">
    <div class="llamado__texto">
      <p class="etiqueta etiqueta--clara">¿Listo para empezar?</p>
      <p class="llamado__titulo">Inscríbete hoy y comienza tu viaje hacia la fluidez.</p>
    </div>
    <div class="llamado__botones">
      <a href="inscripcion.html" class="boton boton--naranja">Inscríbete</a>
      <a href="${WHATSAPP}" class="boton boton--whatsapp" target="_blank" rel="noopener"><img src="img/whatsapp.png" alt="" width="24" height="24">Escríbenos por WhatsApp</a>
    </div>
  </div>
</section>
<footer class="pie">
  <div class="contenedor">
    <div class="pie__columnas">
      <div class="pie__marca">
        <a href="index.html" class="pie__logo"><img src="img/logo.webp" alt="Thinking Mind" width="176" height="47"></a>
        <p>Doing the impossible in education.</p>
        <div class="redes">${redes()}</div>
      </div>
      <div>
        <h2>Contáctanos</h2>
        <a href="mailto:tm@thinkingmind.co">tm@thinkingmind.co</a>
        <a href="tel:+5718841826">+57 1 884 1826</a>
        <a href="tel:+573213711595">+57 321 371 1595</a>
        <a href="tel:+573132807204">+57 313 280 7204</a>
      </div>
      <div>
        <h2>Visítanos</h2>
        <p>Cra 3 # 22 – 01, Bl. 06, Of. 105</p>
        <p>Chía, Cundinamarca</p>
        <p>Atención internacional 24/7</p>
      </div>
      <div>
        <h2>Programas</h2>
        ${PROGRAMAS.filter(p => p.popular).map(p => `<a href="${enlacePrograma(p)}">${p.nombre}</a>`).join('')}
        <a href="programas.html">Ver todos</a>
      </div>
      <div>
        <h2>Links frecuentes</h2>
        <a href="nosotros.html">Sobre nosotros</a>
        <a href="experiencia.html#campus">Campus en Inglaterra</a>
        <a href="inscripcion.html#preguntas">Preguntas frecuentes</a>
        <a href="nosotros.html#trabaja">Trabaja con nosotros</a>
        <a href="${PORTAL_PAGOS}">Pagos en línea</a>
      </div>
    </div>
    <div class="pie__base">
      <p>© Thinking Mind S.A.S. 2026</p>
      <ul class="pie__sellos" aria-label="Certificaciones">
        <li><img src="img/sello-tsg.png" alt="Especialidad Tradicional Garantizada"></li>
        <li><img src="img/sello-era.png" alt="ERA 2025"></li>
        <li><img src="img/sello-glc.png" alt="Global Learning Council"></li>
      </ul>
    </div>
  </div>
</footer>
<a class="whatsapp" href="${WHATSAPP}" target="_blank" rel="noopener" aria-label="Escríbenos por WhatsApp"><img src="img/whatsapp.png" alt="" width="62" height="62"></a>
<div class="visor" role="dialog" aria-modal="true" aria-label="Galería de fotos">
  <img src="" alt="">
  <button type="button" class="visor__cerrar" aria-label="Cerrar">×</button>
  <button type="button" class="visor__ant" aria-label="Foto anterior">‹</button>
  <button type="button" class="visor__sig" aria-label="Foto siguiente">›</button>
</div>`;
}

// ---------- Tarjeta de programa ----------
function tarjeta(p) {
  const cat = CATEGORIAS[p.cat];
  const dirigido = (p.datos.find(d => d[0] === 'Dirigido a') || [])[1];
  return `
<article class="tarjeta" data-cat="${p.cat}">
  <a class="tarjeta__foto" href="${enlacePrograma(p)}" tabindex="-1" aria-hidden="true">
    <img src="${foto(p)}" alt="" loading="lazy">
    ${p.popular ? '<span class="tarjeta__popular">Más visto</span>' : ''}
  </a>
  <div class="tarjeta__cuerpo">
    <span class="chip chip--${cat.clase}">${cat.nombre}</span>
    <h3><a href="${enlacePrograma(p)}">${p.nombre}</a></h3>
    <p class="tarjeta__resumen">${p.resumen}</p>
    ${dirigido ? `<p class="tarjeta__meta"><span>${dirigido}</span></p>` : ''}
    <div class="tarjeta__pie">
      <p class="tarjeta__precio"><span>Desde</span> <b>${pesos(p.precio)}</b></p>
      <a href="${enlacePrograma(p)}" class="boton boton--naranja boton--chico">Ver programa</a>
    </div>
  </div>
</article>`;
}

const video = (id, clase = '', portada = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`) => `<button type="button" class="video ${clase}" data-video="${id}" aria-label="Reproducir video"><img src="${portada}" alt="" loading="lazy"><span class="video__play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4l15 8-15 8z"/></svg></span></button>`;

// ---------- Contenido dinámico de cada página ----------
function dibujar() {
  document.querySelectorAll('[data-programas]').forEach(el => {
    const modo = el.dataset.programas;
    let lista = PROGRAMAS;
    if (modo === 'otros') lista = PROGRAMAS.filter(p => p.id !== programaActual().id).slice(0, 8);
    el.innerHTML = lista.map(tarjeta).join('');
  });
  document.querySelectorAll('[data-grupo]').forEach(el => {
    el.innerHTML = PROGRAMAS.filter(p => p.cat === el.dataset.grupo).map(tarjeta).join('');
  });
  document.querySelectorAll('[data-colegios]').forEach(el => {
    const mitad = Math.ceil(COLEGIOS.length / 2);
    const fila = (lista, reversa) => `<div class="marquesina${reversa ? ' marquesina--reversa' : ''}"><div class="marquesina__pista">${[...lista, ...lista].map((c, i) => `<img src="media/colegios/${c}.png" alt="${i < lista.length ? 'Colegio aliado' : ''}">`).join('')}</div></div>`;
    el.innerHTML = fila(COLEGIOS.slice(0, mitad)) + fila(COLEGIOS.slice(mitad), true);
  });
  document.querySelectorAll('[data-video-id]').forEach(el => { el.outerHTML = video(el.dataset.videoId, el.dataset.clase || '', el.dataset.portada); });
  document.querySelectorAll('[data-icono]').forEach(el => { el.innerHTML = icono(el.dataset.icono); });
  document.querySelectorAll('[data-redes]').forEach(el => { el.innerHTML = redes(); });
  if (document.body.dataset.pagina === 'programa') dibujarPrograma();
}

function programaActual() {
  const id = new URLSearchParams(location.search).get('p');
  return PROGRAMAS.find(p => p.id === id) || PROGRAMAS[0];
}

function dibujarPrograma() {
  const p = programaActual();
  const cat = CATEGORIAS[p.cat];
  document.title = `${p.nombre} · Thinking Mind`;
  const galeria = Array.from({ length: p.fotos }, (_, i) => i).filter(i => i !== p.logo);
  const portada = document.getElementById('programa-portadilla');
  portada.innerHTML = `
    ${p.banner ? `<video src="media/banner-${p.banner}.mp4" poster="media/banner-${p.banner}.jpg" autoplay muted loop playsinline aria-hidden="true"></video>` : `<img src="${foto(p, galeria[1] ?? 0)}" alt="">`}
    <div class="contenedor portadilla__texto">
      <nav class="migas" aria-label="Ruta"><a href="index.html">Inicio</a><span aria-hidden="true">/</span><a href="programas.html">Programas</a><span aria-hidden="true">/</span><span>${p.nombre}</span></nav>
      <span class="chip chip--blanco">${cat.nombre}</span>
      <h1>${p.nombre}</h1>
      <p>${p.resumen}</p>
    </div>`;
  document.getElementById('programa-ficha').innerHTML = `
    <div>
      ${p.logo !== undefined ? `<img class="ficha__logo" src="${foto(p, p.logo)}" alt="${p.nombre}">` : ''}
      <p class="ficha__lema">${p.lema}</p>
      <div class="texto-largo">${p.texto.map(t => `<p>${t}</p>`).join('')}</div>
      <ul class="pildoras">${p.destacados.map(d => `<li>${d}</li>`).join('')}</ul>
      <p class="ficha__nota">${p.nota}</p>
    </div>
    <aside class="ficha__lateral">
      <span class="chip chip--${cat.clase}">${cat.nombre}</span>
      <p class="ficha__precio"><span>Desde</span> <b>${pesos(p.precio)}</b></p>
      <ul class="ficha__datos">${p.datos.map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`).join('')}</ul>
      <a href="inscripcion.html?p=${p.id}#formulario" class="boton boton--naranja">Inscríbete</a>
      <a href="${PORTAL_PAGOS}" class="boton boton--borde">Pagos en línea</a>
    </aside>`;
  document.getElementById('programa-incluye').innerHTML = p.incluye.map(([ic, t, d]) => `<div class="incluye__item"><span class="icono">${icono(ic)}</span><div><h3>${t}</h3><p>${d}</p></div></div>`).join('');
  const seccionGaleria = document.getElementById('programa-galeria');
  if (galeria.length > 1) {
    seccionGaleria.querySelector('.galeria').innerHTML = galeria.map(i => `<button type="button" data-ampliar="${foto(p, i)}" aria-label="Ampliar foto"><img src="${foto(p, i)}" alt="${p.nombre}" loading="lazy"></button>`).join('');
  } else seccionGaleria.remove();
  document.querySelectorAll('a[href="inscripcion.html#formulario"]').forEach(a => { a.href = `inscripcion.html?p=${p.id}#formulario`; });
  const seccionVideo = document.getElementById('programa-video');
  if (p.video) seccionVideo.querySelector('[data-hueco]').outerHTML = video(p.video, 'video--redondo', foto(p, galeria[galeria.length - 1]));
  else seccionVideo.remove();
}

// ---------- Comportamientos ----------
function activar() {
  const boton = document.querySelector('.cabecera__abrir');
  const menu = document.getElementById('menu');
  boton.addEventListener('click', () => {
    const abierto = menu.classList.toggle('abierto');
    boton.setAttribute('aria-expanded', String(abierto));
  });

  // Slider principal: avanza solo cada 7 s; se pausa si el usuario pide menos movimiento
  document.querySelectorAll('.slider').forEach(slider => {
    const slides = [...slider.querySelectorAll('.slide')];
    const puntos = slider.querySelector('.slider__puntos');
    puntos.innerHTML = slides.map((s, i) => `<button type="button" aria-label="Ir a ${s.dataset.nombre}"></button>`).join('');
    let actual = 0, temporizador;
    const ir = i => {
      actual = (i + slides.length) % slides.length;
      slides.forEach((s, j) => {
        s.classList.toggle('activo', j === actual);
        s.setAttribute('aria-hidden', String(j !== actual));
        const v = s.querySelector('video');
        if (v) { if (j === actual) { v.currentTime = 0; v.play().catch(() => {}); } else v.pause(); }
      });
      [...puntos.children].forEach((b, j) => b.setAttribute('aria-current', String(j === actual)));
    };
    const reiniciar = () => {
      clearInterval(temporizador);
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) temporizador = setInterval(() => ir(actual + 1), 7000);
    };
    slider.querySelector('.slider__flecha--ant').addEventListener('click', () => { ir(actual - 1); reiniciar(); });
    slider.querySelector('.slider__flecha--sig').addEventListener('click', () => { ir(actual + 1); reiniciar(); });
    [...puntos.children].forEach((b, i) => b.addEventListener('click', () => { ir(i); reiniciar(); }));
    ir(0); reiniciar();
  });

  // Carruseles horizontales
  document.querySelectorAll('.carrusel').forEach(c => {
    const pista = c.querySelector('.carrusel__pista');
    const paso = () => pista.firstElementChild.getBoundingClientRect().width + 22;
    c.querySelector('[data-mover="ant"]').addEventListener('click', () => pista.scrollBy({ left: -paso() }));
    c.querySelector('[data-mover="sig"]').addEventListener('click', () => pista.scrollBy({ left: paso() }));
  });

  // Filtros de programas
  const filtros = document.querySelector('.filtros');
  if (filtros) {
    const tarjetas = [...document.querySelectorAll('.rejilla .tarjeta')];
    filtros.querySelectorAll('button').forEach(b => {
      const cat = b.dataset.filtro;
      b.querySelector('span').textContent = cat === 'todos' ? tarjetas.length : tarjetas.filter(t => t.dataset.cat === cat).length;
      b.addEventListener('click', () => {
        filtros.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        tarjetas.forEach(t => { t.hidden = cat !== 'todos' && t.dataset.cat !== cat; });
      });
    });
    const inicial = new URLSearchParams(location.search).get('cat');
    if (inicial) filtros.querySelector(`[data-filtro="${inicial}"]`)?.click();
  }

  // Pestañas (campus)
  document.querySelectorAll('.pestanas').forEach(grupo => {
    const botones = [...grupo.querySelectorAll('[role="tab"]')];
    botones.forEach(b => b.addEventListener('click', () => {
      botones.forEach(x => {
        x.setAttribute('aria-selected', String(x === b));
        document.getElementById(x.getAttribute('aria-controls')).hidden = x !== b;
      });
    }));
  });

  // Videos de YouTube: se cargan solo al hacer clic
  document.addEventListener('click', e => {
    const v = e.target.closest('[data-video]');
    if (!v) return;
    const marco = document.createElement('div');
    marco.className = v.className;
    marco.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${v.dataset.video}?autoplay=1&rel=0" title="Video de Thinking Mind" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    v.replaceWith(marco);
  });

  // Visor de fotos
  const visor = document.querySelector('.visor');
  const fotos = [...document.querySelectorAll('[data-ampliar]')];
  let indice = 0;
  const mostrar = i => { indice = (i + fotos.length) % fotos.length; visor.querySelector('img').src = fotos[indice].dataset.ampliar; };
  fotos.forEach((f, i) => f.addEventListener('click', () => { mostrar(i); visor.classList.add('abierto'); visor.querySelector('.visor__cerrar').focus(); }));
  const cerrar = () => { visor.classList.remove('abierto'); fotos[indice]?.focus(); };
  visor.querySelector('.visor__cerrar').addEventListener('click', cerrar);
  visor.querySelector('.visor__ant').addEventListener('click', () => mostrar(indice - 1));
  visor.querySelector('.visor__sig').addEventListener('click', () => mostrar(indice + 1));
  visor.addEventListener('click', e => { if (e.target === visor) cerrar(); });
  document.addEventListener('keydown', e => {
    if (!visor.classList.contains('abierto')) return;
    if (e.key === 'Escape') cerrar();
    if (e.key === 'ArrowLeft') mostrar(indice - 1);
    if (e.key === 'ArrowRight') mostrar(indice + 1);
  });

  // Preselección del programa en el formulario de inscripción (?p=summer-camp)
  const selector = document.getElementById('f-programa');
  const elegido = new URLSearchParams(location.search).get('p');
  if (selector && elegido) {
    const p = PROGRAMAS.find(x => x.id === elegido);
    selector.value = p ? p.nombre : elegido === 'eurotour' ? 'EuroTour Graduation Trip' : '';
  }

  // Formularios de prototipo: validan y muestran confirmación, no envían datos
  document.querySelectorAll('form[data-prototipo]').forEach(form => {
    const ok = form.querySelector('.formulario__ok');
    form.addEventListener('submit', e => {
      e.preventDefault();
      let valido = true;
      form.querySelectorAll('[required]').forEach(campo => {
        const bien = campo.type === 'checkbox' ? campo.checked : campo.value.trim() !== '' && campo.checkValidity();
        campo.closest('.campo').classList.toggle('campo--error', !bien);
        if (!bien) valido = false;
      });
      if (!valido) { form.querySelector('.campo--error input, .campo--error select')?.focus(); return; }
      ok.hidden = false;
      form.reset();
    });
  });
}

// ---------- Idioma ----------
// Cada texto guarda su versión en español y se busca en TRADUCCIONES (js/idiomas.js)
function idiomas() {
  const IDIOMAS = ['es', 'en', 'fr'];
  const ATRIBUTOS = ['alt', 'placeholder', 'aria-label', 'title', 'label'];
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
  const traducirTitulo = idioma => tituloOriginal.split(' · ').map(t => traducir(t, idioma)).join(' · ');

  const cambiarIdioma = idioma => {
    if (!IDIOMAS.includes(idioma)) idioma = 'es';
    document.documentElement.lang = idioma;
    document.title = traducirTitulo(idioma);
    textos.forEach(t => { t.nodo.nodeValue = t.valor.replace(t.original, traducir(t.original, idioma)); });
    atributos.forEach(t => t.el.setAttribute(t.a, traducir(t.original, idioma)));
    document.querySelectorAll('[data-idioma]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.idioma === idioma)));
    try { localStorage.setItem('tm-idioma', idioma); } catch (e) {}
  };
  document.querySelectorAll('[data-idioma]').forEach(b => b.addEventListener('click', () => cambiarIdioma(b.dataset.idioma)));
  let inicial = new URLSearchParams(location.search).get('lang');
  if (!inicial) { try { inicial = localStorage.getItem('tm-idioma'); } catch (e) {} }
  if (inicial && inicial !== 'es') cambiarIdioma(inicial);
}

document.addEventListener('DOMContentLoaded', () => {
  const pagina = document.body.dataset.pagina;
  document.body.insertAdjacentHTML('afterbegin', cabecera(pagina));
  document.body.insertAdjacentHTML('beforeend', pie());
  dibujar();
  activar();
  idiomas();
});
