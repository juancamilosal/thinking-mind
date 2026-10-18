/* Thinking Mind · Propuesta de página web (prototipo navegable) */
(function () {
  'use strict';

  var PORTAL_URL = '/payment-record';
  var WHATSAPP_URL = 'https://wa.me/573213711595';
  var IMG = 'assets/img/';

  // ---------- Datos de programas (del diseño) ----------
  var CATS = {
    viajes: ['Viaje internacional', '#E7ECF8', '#0B1F5C'],
    colombia: ['En Colombia', '#E4F3EA', '#0E6633'],
    online: ['Online', '#FDE9E1', '#A9320B']
  };
  var PROGRAMS = [
    { name: 'Summer Camp', cat: 'viajes', age: '7 a 17 años', price: '$ 37.000.000', desc: 'Diviértete, descubre culturas y países. Aprende inglés en Inglaterra.', img: '68819f31f5fc7e7d07be93fd2b8279dc.jpg', href: 'programa-summer-camp.html' },
    { name: 'Winter Camp', cat: 'viajes', age: 'Colegios', price: '$ 32.000.000', desc: 'Programa de inmersión multicultural de invierno.', img: '7ada8968c0762ce55c9a9ae42af2f00b.jpg', href: 'viajes.html' },
    { name: 'ACE Programme', cat: 'viajes', age: 'Inglés A2+', price: '$ 26.800.000', desc: 'Competencia lingüística internacional e inmersión multicultural.', img: 'c49dffb6813ca9b76889a12a41917377.jpg', href: 'viajes.html' },
    { name: 'Grow Camp', cat: 'colombia', age: 'Colegios', price: '$ 4.500.000', desc: 'Tu primer campamento en Colombia.', img: '534487ff62842d0d9e41d3f139e7167d.jpg', href: 'programas.html' },
    { name: 'Will Go!', cat: 'colombia', age: 'Colegios', price: '$ 600.000', desc: 'Fin de semana de inmersión en idiomas y recreación.', img: '39e04b6fda509fc6406eff619ef4487a.jpg', href: 'will-go.html' },
    { name: 'AYO Weekend', cat: 'online', age: 'Colegios', price: '$ 250.000', desc: 'Inmersión virtual de fin de semana en inglés y francés.', img: 'cbdcfc81d2aa9cb4c60659909d375eb3.jpg', href: 'e-programmes.html' },
    { name: 'AYO Conversational Club', cat: 'online', age: 'Colegios', price: '$ 300.000', desc: 'Clases conversacionales de inglés y francés.', img: '10923d52c4fd9b13467c648fe2e0cc97.jpg', href: 'e-programmes.html' },
    { name: 'Talky', cat: 'online', age: '+18 años', price: '$ 292.000', desc: 'El idioma como herramienta de vida. Keep talking.', img: 'c263723b39a2e706e6ae3acda55ca8eb.jpg', href: 'e-programmes.html' },
    { name: 'E-Summer Camp', cat: 'online', age: 'Colegios', price: '$ 599.100', desc: 'Campamento de verano en línea. See it, live it & boosted.', img: 'eea4d7617367e50047c08635ee7b39e9.jpg', href: 'e-programmes.html' },
    { name: 'E-Winter Camp', cat: 'online', age: 'Colegios', price: '$ 599.100', desc: 'Campamento de invierno online.', img: '010959d9f8546fe353a100f39c772b51.jpg', href: 'e-programmes.html' }
  ];

  var FAQS = [
    { q: '¿El costo de la visa está incluido en el precio del programa?', a: 'Sí. Además te ofrecemos apoyo con todos los procedimientos sin costo adicional.' },
    { q: '¿El costo del tiquete aéreo está incluido en el precio del programa?', a: 'Sí. Aunque el precio del programa no varía, el del tiquete depende de la aerolínea: si se reserva con anticipación, los precios son menores. Es muy importante cumplir con las fechas de pago establecidas para evitar costos adicionales.' },
    { q: '¿Ofrecen flexibilidad de pago?', a: 'Sí. Ofrecemos diferentes planes de pago para los programas de viaje. Conoce el que mejor se ajusta a tus necesidades con nuestro departamento de finanzas.' },
    { q: '¿Cuánto dinero de bolsillo debería llevar?', a: 'Cada familia decide el presupuesto. Aconsejamos unas £80 GBP o €100 EUR por semana para compras personales; todo lo esencial ya está pago dentro del programa.' },
    { q: '¿Es necesario hablar el idioma para inscribirse?', a: 'No. En la mayoría de los programas hay clases para todos los niveles, de principiante a avanzado, y los estudiantes se ubican según su edad y una prueba inicial. Solo el ACE Programme requiere un nivel básico de inglés por su naturaleza competitiva.' }
  ];

  // ---------- Estado y valores de cada página ----------
  var state = { f: 'all', q: '', open: 0 };
  var page = document.body.getAttribute('data-page');

  function programVals(longTabs) {
    var labels = longTabs
      ? { all: 'Todos', viajes: 'Viajes internacionales', colombia: 'En Colombia', online: 'Online' }
      : { all: 'Todos', viajes: 'Viajes', colombia: 'En Colombia', online: 'Online' };
    var query = state.q.trim().toLowerCase();
    var list = PROGRAMS.filter(function (p) {
      return (state.f === 'all' || p.cat === state.f) && (!query || p.name.toLowerCase().indexOf(query) !== -1 || p.desc.toLowerCase().indexOf(query) !== -1);
    });
    return {
      shown: list.length,
      tabs: ['all', 'viajes', 'colombia', 'online'].map(function (id) {
        var active = id === state.f;
        return {
          label: labels[id],
          count: id === 'all' ? PROGRAMS.length : PROGRAMS.filter(function (p) { return p.cat === id; }).length,
          bg: active ? '#0B1F5C' : '#FFFFFF',
          color: active ? '#FFFFFF' : '#26304F',
          border: active ? '#0B1F5C' : '#CDD5E6',
          pressed: active ? 'true' : 'false',
          pick: function () { state.f = id; render(); }
        };
      }),
      programs: list.map(function (p) {
        return {
          name: p.name, age: p.age, price: p.price, desc: p.desc, img: IMG + p.img, href: p.href,
          catLabel: CATS[p.cat][0], tint: CATS[p.cat][1], ink: CATS[p.cat][2]
        };
      })
    };
  }

  function faqVals() {
    return {
      faqs: FAQS.map(function (f, i) {
        var open = i === state.open;
        return {
          q: f.q, a: f.a,
          open: open ? 'true' : 'false',
          display: open ? 'block' : 'none',
          sign: open ? '−' : '+',
          signBg: open ? '#D23F0E' : '#F1F4FA',
          signColor: open ? '#FFFFFF' : '#0B1F5C',
          border: open ? '#0B1F5C' : '#E3E8F2',
          toggle: function () { state.open = open ? -1 : i; render(); }
        };
      })
    };
  }

  function vals() {
    if (page === 'inicio') return programVals(false);
    if (page === 'programas') return programVals(true);
    if (page === 'faq') return faqVals();
    return {};
  }

  // ---------- Render de plantillas <template data-for> ----------
  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render() {
    var v = vals();
    document.querySelectorAll('template[data-for]').forEach(function (tpl) {
      var name = tpl.getAttribute('data-for');
      var alias = tpl.getAttribute('data-as');
      var items = v[name] || [];
      var parent = tpl.parentNode;
      parent.querySelectorAll('[data-rendered="' + name + '"]').forEach(function (n) { n.remove(); });
      // El navegador guarda los atributos en minúsculas (onclick)
      var source = tpl.innerHTML.replace(new RegExp('onclick="\\{\\{' + alias + '\\.(\\w+)\\}\\}"', 'gi'), 'data-click="$1"');
      items.forEach(function (item) {
        var html = source.replace(new RegExp('\\{\\{' + alias + '\\.(\\w+)\\}\\}', 'g'), function (_, key) {
          return item[key] === undefined ? '' : esc(item[key]);
        });
        var holder = document.createElement('template');
        holder.innerHTML = html.trim();
        Array.prototype.slice.call(holder.content.children).forEach(function (el) {
          el.setAttribute('data-rendered', name);
          var targets = el.matches('[data-click]') ? [el] : [];
          targets = targets.concat(Array.prototype.slice.call(el.querySelectorAll('[data-click]')));
          targets.forEach(function (t) {
            var fn = item[t.getAttribute('data-click')];
            if (typeof fn === 'function') t.addEventListener('click', fn);
          });
          if (name === 'tabs') el.setAttribute('aria-pressed', item.pressed);
          parent.insertBefore(el, tpl);
        });
      });
    });
    document.querySelectorAll('[data-hole]').forEach(function (el) {
      var key = el.getAttribute('data-hole');
      if (v[key] !== undefined) el.textContent = v[key];
    });
  }

  // ---------- Buscador de programas ----------
  var search = document.getElementById('buscar');
  if (search) {
    search.addEventListener('input', function () { state.q = search.value; render(); });
  }

  // ---------- Calendarios del detalle de programa ----------
  document.querySelectorAll('input[type="radio"][name="cal"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      document.querySelectorAll('input[type="radio"][name="cal"]').forEach(function (r) {
        var label = r.closest('label');
        if (!label) return;
        label.style.border = r.checked ? '2px solid #0B1F5C' : '1.5px solid #CDD5E6';
        label.style.background = r.checked ? '#F1F4FA' : 'transparent';
      });
    });
  });

  // ---------- Formularios de demostración ----------
  document.querySelectorAll('form').forEach(function (form) {
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    form.querySelectorAll('button').forEach(function (btn) {
      var text = (btn.textContent || '').trim().toLowerCase();
      if (!/enviar|inscrib|postular|reservar|solicitar/.test(text)) return;
      btn.addEventListener('click', function () {
        var old = form.querySelector('.tm-form-ok');
        if (old) old.remove();
        var ok = document.createElement('div');
        ok.className = 'tm-form-ok';
        ok.setAttribute('role', 'status');
        ok.textContent = '¡Gracias! Recibimos tu información. Un asesor de Thinking Mind te contactará pronto. (Prototipo: el formulario no envía datos.)';
        btn.insertAdjacentElement('afterend', ok);
      });
    });
  });

  // ---------- Menú móvil ----------
  var header = document.querySelector('.tm-header');
  if (header) {
    var bar = header.firstElementChild;
    var actions = document.createElement('div');
    actions.className = 'tm-mobile-actions';
    actions.innerHTML =
      '<a class="tm-mobile-cta" href="inscripcion.html">Inscríbete</a>' +
      '<button type="button" class="tm-burger" aria-label="Abrir menú" aria-expanded="false">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>';
    bar.appendChild(actions);

    var links = [
      ['index.html', 'Inicio', 'inicio'], ['sobre-nosotros.html', 'Sobre nosotros', 'nosotros'],
      ['programas.html', 'Programas', 'programas'], ['viajes.html', 'Viajes', 'viajes'],
      ['e-programmes.html', 'E-Programmes', 'e-programmes'], ['will-go.html', 'Will-Go!', 'will-go'],
      ['contacto.html', 'Contacto', 'contacto']
    ];
    var menu = document.createElement('div');
    menu.className = 'tm-menu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-modal', 'true');
    menu.setAttribute('aria-label', 'Menú');
    menu.hidden = true;
    menu.innerHTML =
      '<div class="tm-menu-head"><img src="' + IMG + '57e87f701d365da0a713712755645338.webp" alt="Thinking Mind">' +
      '<button type="button" class="tm-menu-close" aria-label="Cerrar menú"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
      '<nav class="tm-menu-nav">' + links.map(function (l) {
        var current = l[2] === page || (page === 'programa' && l[2] === 'programas');
        return '<a href="' + l[0] + '"' + (current ? ' class="is-current" aria-current="page"' : '') + '>' + l[1] + '<span aria-hidden="true">›</span></a>';
      }).join('') + '</nav>' +
      '<div class="tm-menu-chips"><a href="' + PORTAL_URL + '">Pagos en línea</a><a href="preguntas-frecuentes.html">Preguntas frecuentes</a><a href="trabaja-con-nosotros.html">Trabaja con nosotros</a></div>' +
      '<div class="tm-menu-foot"><a class="tm-menu-primary" href="inscripcion.html">Inscripción a viajes</a>' +
      '<a class="tm-menu-whatsapp" href="' + WHATSAPP_URL + '" target="_blank" rel="noopener">WhatsApp · +57 321 371 1595</a>' +
      '<div class="tm-menu-social">Facebook · Instagram · YouTube · LinkedIn</div></div>';
    document.body.appendChild(menu);

    var burger = actions.querySelector('.tm-burger');
    var closeBtn = menu.querySelector('.tm-menu-close');
    function openMenu() {
      menu.hidden = false;
      burger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('tm-menu-open');
      closeBtn.focus();
    }
    function closeMenu() {
      menu.hidden = true;
      burger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('tm-menu-open');
      burger.focus();
    }
    burger.addEventListener('click', openMenu);
    closeBtn.addEventListener('click', closeMenu);
    menu.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  render();
})();
