# Thinking Mind · Propuesta de página web

Prototipo navegable con el contenido, los programas y las fotos de thinkingmind.co, en español, inglés y francés.

## Pantallas

| Pantalla | Archivo |
|---|---|
| Inicio | `index.html` |
| Nosotros | `nosotros.html` |
| Programas (los 10, con filtros) | `programas.html` |
| Detalle de cada programa | `programa.html?p=summer-camp` (y los demás `id` de `js/datos.js`) |
| Experiencia (viajes, campus, inmersión) | `experiencia.html` |
| Cómo inscribirte (formulario, pagos, preguntas) | `inscripcion.html` |
| Contacto | `contacto.html` |

## Archivos

- `js/datos.js`: los programas (orden, precios, textos, fotos, videos) y los logos de colegios.
- `js/idiomas.js`: las traducciones; la clave es el texto en español.
- `js/sitio.js`: cabecera, pie y comportamientos compartidos.
- `media/`: banners del slider convertidos a MP4, fotos de programas, campus y logos de colegios.

Los formularios son de demostración: validan y muestran un mensaje, pero no envían datos.
El idioma se puede abrir directo con `?lang=en` o `?lang=fr`.

## Ver en local

Con `ng serve`: http://localhost:4200/propuesta-web-sencilla/

O sin Angular:

```bash
cd propuesta-web-sencilla
python3 -m http.server 8080
```
