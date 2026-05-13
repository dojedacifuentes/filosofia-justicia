# Phronesis - Filosofía del Derecho PUCV

Plataforma web estática para estudiar Filosofía del Derecho y Teorías de la Justicia PUCV, con foco en el curso del profesor Johann Benfeld y su evaluación oral.

## Mejoras de esta versión

- Corrección de desborde horizontal en móvil y desktop.
- Flashcards centradas, legibles y con ancho máximo de 720px.
- Módulo Filosofía vs ciencia convertido en guía conceptual, sin simular comprensión automática del texto.
- Dashboard con progresión tipo RPG académico: nivel, XP, rango y misiones de estudio.
- Medallas de dominio para mapa, memoria activa, quiz, oral y Rawls Lab.
- Rawls Lab reactivo: los sliders actualizan barras, puntajes y recomendación en vivo.
- Sonido local opcional con Web Audio API; queda guardado como preferencia del navegador.
- Textos ajustados al curso de Filosofía del Derecho PUCV del profesor Johann Benfeld.

## Cómo abrir la app

Abre `index.html` directamente en el navegador. La app no requiere instalación, build, React ni servidor.

Para probar PWA y modo offline de forma completa, sí conviene servirla por HTTP o desplegarla en Vercel, porque los service workers no se activan desde `file://`.

## Estructura

- `index.html`: estructura base, meta tags PWA y carga de scripts.
- `styles.css`: diseño Dark Academia, responsive, tarjetas, navegación y componentes.
- `data.js`: todo el contenido editable: módulos, flashcards, quiz, glosario y preguntas orales.
- `app.js`: navegación, localStorage, simuladores y lógica interactiva.
- `manifest.json`: configuración instalable PWA.
- `service-worker.js`: cache offline de archivos locales.
- `README.md`: guía de uso y despliegue.

## Cómo editar contenido

Edita `data.js`.

- Para agregar flashcards, añade objetos en `flashcards`.
- Para agregar preguntas de quiz, añade objetos en `quiz`.
- Para editar términos, modifica `glossary`.
- Para cambiar preguntas orales, edita `oralExam`.
- Para cambiar módulos o mapa del curso, edita `modules` y `courseBlocks`.

No necesitas tocar `app.js` salvo que quieras cambiar comportamiento interactivo.

## Subir a GitHub

1. Crea un repositorio vacío en GitHub.
2. En esta carpeta ejecuta:

```bash
git init
git add .
git commit -m "Add Phronesis static study platform"
git branch -M main
git remote add origin https://github.com/USUARIO/REPOSITORIO.git
git push -u origin main
```

## Desplegar en Vercel

1. Entra a Vercel y elige `Add New Project`.
2. Importa el repositorio de GitHub.
3. Framework preset: `Other`.
4. Build command: dejar vacío.
5. Output directory: dejar vacío o `.`.
6. Deploy.

Vercel servirá `index.html` directamente. El manifest y el service worker quedarán disponibles por HTTPS.

También puedes subir esta carpeta como proyecto estático desde GitHub sin instalar dependencias, porque no hay React, Vite ni build step.

## Notas

La app usa HTML, CSS y JavaScript vanilla. Lucide se carga por CDN para iconos, pero la experiencia base sigue funcionando aunque ese CDN no esté disponible.
