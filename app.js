(() => {
  const D = window.PHRONESIS_DATA;
  const STORAGE_KEY = "phronesis-pucv-state-v1";
  const app = document.getElementById("app");
  const toast = document.getElementById("toast");

  let deferredInstallPrompt = null;
  let toastTimer = null;
  let audioContext = null;

  const defaultState = {
    visited: ["dashboard"],
    learned: [],
    flashIndex: 0,
    flashFlipped: false,
    flashFilter: "Todas",
    quiz: { index: 0, score: 0, answered: false, selected: null, completed: false, best: 0 },
    lawStatement: "",
    lawAnalysis: null,
    classicAuthor: "platon",
    radbruchLevel: 42,
    dworkinCase: "elmer",
    dworkinPrinciples: [],
    rawlsChoice: "",
    rawlsRisk: 50,
    rawlsInequality: 50,
    tutorMessages: [],
    glossarySearch: "",
    oralIndex: 0,
    oralPracticed: [],
    soundEnabled: false
  };

  let state = loadState();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return mergeState(defaultState, saved || {});
    } catch (error) {
      return clone(defaultState);
    }
  }

  function mergeState(base, saved) {
    const merged = clone(base);
    Object.keys(saved).forEach((key) => {
      if (saved[key] && typeof saved[key] === "object" && !Array.isArray(saved[key]) && merged[key]) {
        merged[key] = { ...merged[key], ...saved[key] };
      } else {
        merged[key] = saved[key];
      }
    });
    return merged;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      showToast("No se pudo guardar progreso local en este navegador.");
    }
  }

  function icon(name) {
    return `<i data-lucide="${name}" aria-hidden="true"></i>`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function currentView() {
    const requested = window.location.hash.replace("#", "") || "dashboard";
    return D.nav.some((item) => item.id === requested) ? requested : "dashboard";
  }

  function setRoute(id) {
    window.location.hash = id;
  }

  function markVisited(id) {
    if (!state.visited.includes(id)) {
      state.visited.push(id);
      saveState();
    }
  }

  function progressStats() {
    const learned = state.learned.length;
    const cardPct = D.flashcards.length ? learned / D.flashcards.length : 0;
    const quizBest = Math.max(state.quiz.best || 0, state.quiz.score || 0);
    const quizPct = D.quiz.length ? quizBest / D.quiz.length : 0;
    const required = D.nav.map((item) => item.id);
    const visitedPct = required.filter((id) => state.visited.includes(id)).length / required.length;
    const oralPct = D.oralExam.length ? state.oralPracticed.length / D.oralExam.length : 0;
    const total = Math.round((cardPct * 0.35 + quizPct * 0.3 + visitedPct * 0.25 + oralPct * 0.1) * 100);

    return {
      total,
      learned,
      cards: D.flashcards.length,
      quizBest,
      quizTotal: D.quiz.length,
      visited: state.visited.length,
      required: required.length,
      oral: state.oralPracticed.length
    };
  }

  function rpgProfile(p) {
    const xp = (p.learned * 35) + (p.quizBest * 45) + (p.visited * 60) + (p.oral * 85);
    const level = Math.max(1, Math.floor(xp / 320) + 1);
    const base = (level - 1) * 320;
    const next = level * 320;
    const xpPct = Math.min(100, Math.round(((xp - base) / (next - base)) * 100));
    const rank = p.total >= 85
      ? "Archon de justicia"
      : p.total >= 60
        ? "Intérprete de principios"
        : p.total >= 32
          ? "Discípulo de la polis"
          : "Iniciado en phronesis";
    const nextQuest = p.learned < 12
      ? "Completar 12 flashcards antes del próximo módulo"
      : p.quizBest < 20
        ? "Subir la mejor marca del quiz de la asignatura"
        : p.oral < 6
          ? "Practicar 6 respuestas orales del curso"
          : "Resolver un caso difícil en el Tribunal de Dworkin";
    return { xp, level, xpPct, rank, nextQuest };
  }

  function createNav() {
    const top = document.querySelector(".top-nav");
    const bottom = document.querySelector(".bottom-nav");
    const active = currentView();
    top.innerHTML = D.nav.map((item) => navButton(item, active)).join("");
    bottom.innerHTML = D.nav
      .filter((item) => ["dashboard", "mapa", "flashcards", "quiz", "oral"].includes(item.id))
      .map((item) => navButton(item, active))
      .join("");
  }

  function navButton(item, active) {
    return `
      <button class="nav-button ${item.id === active ? "active" : ""}" type="button" data-route="${item.id}">
        ${icon(item.icon)}
        <span>${escapeHtml(item.label)}</span>
      </button>
    `;
  }

  function render() {
    const view = currentView();
    markVisited(view);
    createNav();

    const views = {
      dashboard: renderDashboard,
      mapa: renderCourseMap,
      "filosofia-ciencia": renderPhilosophyScience,
      "justicia-clasica": renderClassicalJustice,
      radbruch: renderRadbruch,
      "positivismo-principios": renderPositivism,
      "tribunal-dworkin": renderDworkinCourt,
      rawls: renderRawlsLab,
      flashcards: renderFlashcards,
      quiz: renderQuiz,
      tutor: renderTutor,
      glosario: renderGlossary,
      oral: renderOralExam
    };

    app.innerHTML = views[view]();
    app.focus({ preventScroll: true });
    bindView(view);
    refreshIcons();
  }

  function refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
    }
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("visible");
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2800);
  }

  function clamp(value, min = 0, max = 100) {
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  function playSound(kind = "tap") {
    if (!state.soundEnabled || !window.AudioContext && !window.webkitAudioContext) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContext = audioContext || new AudioCtx();
    if (audioContext.state === "suspended") audioContext.resume();

    const patterns = {
      tap: [320, 0.035, "sine", 0.035],
      select: [440, 0.055, "triangle", 0.045],
      card: [520, 0.075, "triangle", 0.04],
      success: [660, 0.09, "sine", 0.05],
      error: [180, 0.12, "sawtooth", 0.035],
      unlock: [780, 0.12, "triangle", 0.052]
    };
    const [freq, duration, type, volume] = patterns[kind] || patterns.tap;
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function pageTitle(title, text, eyebrow = "Phronesis PUCV") {
    return `
      <section class="page-title">
        <div class="eyebrow">${escapeHtml(eyebrow)}</div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(text)}</p>
      </section>
    `;
  }

  function renderDashboard() {
    const p = progressStats();
    const profile = rpgProfile(p);
    const ring = Math.round(p.total * 3.6);

    return `
      <section class="view">
        <div class="hero">
          <div class="hero-grid">
            <div>
              <div class="eyebrow">Curso de Filosofía del Derecho y Teorías de la Justicia</div>
              <h1>Phronesis <span>-</span> Filosofía del Derecho PUCV</h1>
              <p class="hero-copy">Plataforma de estudio para el curso de Filosofía del Derecho PUCV del profesor Johann Benfeld: autores clásicos, positivismo, principios, justicia contemporánea, flashcards, quiz y entrenamiento socrático local.</p>
              <div class="hero-actions">
                <button class="button primary" type="button" data-route="oral">${icon("mic")}Modo examen oral</button>
                <button class="button" type="button" data-route="flashcards">${icon("copy")}Repasar flashcards</button>
                <button class="button teal" type="button" id="installApp">${icon("download")}Instalar app</button>
                <button class="button sound-toggle ${state.soundEnabled ? "active" : ""}" type="button" data-action="toggle-sound">
                  ${icon(state.soundEnabled ? "volume-2" : "volume-x")}
                  Sonido ${state.soundEnabled ? "activo" : "apagado"}
                </button>
              </div>
            </div>
            <aside class="hero-panel" aria-label="Progreso general">
              <div class="progress-ring" style="--value:${ring}deg">
                <div class="progress-ring-inner">
                  <div>
                    <strong>${p.total}%</strong>
                    <small>avance global</small>
                  </div>
                </div>
              </div>
              <div class="rpg-card">
                <div class="rpg-avatar">${icon("shield")}</div>
                <div>
                  <span>Rango académico</span>
                  <strong>${escapeHtml(profile.rank)}</strong>
                  <small>Nivel ${profile.level} · ${profile.xp} XP</small>
                </div>
              </div>
              <div class="meter xp-meter" aria-label="Experiencia del nivel ${profile.xpPct}%"><span style="width:${profile.xpPct}%"></span></div>
              <p class="quest-note"><b>Próxima misión:</b> ${escapeHtml(profile.nextQuest)}</p>
              <div class="stats-grid">
                <div class="stat"><strong>${p.learned}</strong><span>tarjetas</span></div>
                <div class="stat"><strong>${p.quizBest}</strong><span>mejor quiz</span></div>
                <div class="stat"><strong>${p.visited}</strong><span>vistas</span></div>
              </div>
            </aside>
          </div>
        </div>

        <div class="quick-grid">
          ${quickLink("filosofia-ciencia", "microscope", "Guía conceptual", "Ciencia positiva vs pregunta filosófica")}
          ${quickLink("radbruch", "scale", "Balanza", "Seguridad, justicia y utilidad")}
          ${quickLink("tribunal-dworkin", "landmark", "Tribunal", "Casos difíciles por principios")}
          ${quickLink("quiz", "badge-check", "Quiz del curso", "Preguntas cruzadas con feedback")}
        </div>

        <div class="quest-grid">
          ${questCard("book-marked", "Misión 1", "Define ciencia jurídica y filosofía del derecho sin mezclar objeto material y formal.")}
          ${questCard("scale", "Misión 2", "Contrasta una ley válida con una ley justa usando Kelsen, Radbruch y Dworkin.")}
          ${questCard("mic", "Misión 3", "Responde una pregunta oral con tesis, distinción, autor, ejemplo y cierre.")}
        </div>

        <div class="section-head">
          <div>
            <h2>Medallas de dominio</h2>
            <p>Pequeños hitos para sostener constancia: mapa, memoria, quiz, oral y teoría de la justicia.</p>
          </div>
        </div>
        <div class="achievement-grid">
          ${achievementGrid(p)}
        </div>

        <div class="section-head">
          <div>
            <h2>Módulos de estudio</h2>
            <p>Una ruta compacta para dominar el curso: de la distinción filosofía-ciencia a Rawls, Dworkin y el examen oral.</p>
          </div>
          <button class="button danger" type="button" data-action="reset-progress">${icon("rotate-ccw")}Reiniciar progreso</button>
        </div>

        <div class="module-grid">
          ${D.modules.map((module) => moduleCard(module)).join("")}
        </div>
      </section>
    `;
  }

  function questCard(iconName, title, text) {
    return `
      <article class="quest-card">
        <span>${icon(iconName)}</span>
        <div>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(text)}</p>
        </div>
      </article>
    `;
  }

  function achievementGrid(p) {
    const badges = [
      { icon: "map", title: "Cartógrafo PUCV", unlocked: p.visited >= 5, text: "Visita 5 vistas clave de la plataforma." },
      { icon: "copy-check", title: "Memoria activa", unlocked: p.learned >= 12, text: "Marca 12 flashcards como aprendidas." },
      { icon: "badge-check", title: "Prueba calibrada", unlocked: p.quizBest >= 20, text: "Alcanza 20 respuestas correctas en el quiz." },
      { icon: "mic", title: "Voz de seminario", unlocked: p.oral >= 5, text: "Practica 5 preguntas orales del curso." },
      { icon: "shield-question", title: "Rawls operativo", unlocked: Boolean(state.rawlsChoice), text: "Elige un principio en Rawls Lab." }
    ];
    return badges.map((badge) => `
      <article class="achievement ${badge.unlocked ? "unlocked" : ""}">
        <span>${icon(badge.unlocked ? badge.icon : "lock")}</span>
        <div>
          <strong>${escapeHtml(badge.title)}</strong>
          <p>${escapeHtml(badge.unlocked ? "Desbloqueada." : badge.text)}</p>
        </div>
      </article>
    `).join("");
  }

  function quickLink(route, iconName, title, text) {
    return `
      <a class="quick-link" href="#${route}">
        <span class="icon-tile teal">${icon(iconName)}</span>
        <span><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></span>
      </a>
    `;
  }

  function moduleCard(module) {
    const done = state.visited.includes(module.id);
    return `
      <article class="card">
        <div class="pill-row">
          <span class="badge ${done ? "teal" : "gold"}">${done ? "Visitado" : module.level}</span>
          <span class="badge">${module.minutes} min</span>
        </div>
        <h3>${escapeHtml(module.title)}</h3>
        <p>${module.tags.map(escapeHtml).join(" · ")}</p>
        <button class="button" type="button" data-route="${module.id}">${icon("arrow-right")}Entrar</button>
      </article>
    `;
  }

  function renderCourseMap() {
    return `
      <section class="view">
        ${pageTitle("Mapa del curso", "Bloques temáticos, autores, conceptos clave y preguntas de examen. Úsalo como índice de estudio y como pauta para detectar puntos débiles.")}
        <div class="timeline">
          ${D.courseBlocks.map((block, index) => `
            <article class="timeline-item">
              <span class="timeline-dot"></span>
              <div class="card">
                <div class="pill-row">
                  <span class="badge gold">Bloque ${index + 1}</span>
                  ${block.authors.slice(0, 4).map((author) => `<span class="badge">${escapeHtml(author)}</span>`).join("")}
                </div>
                <h3>${escapeHtml(block.title)}</h3>
                <div class="three-grid">
                  <div>
                    <strong>Conceptos clave</strong>
                    <ul class="list">${block.concepts.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
                  </div>
                  <div>
                    <strong>Objetivos</strong>
                    <ul class="list">${block.objectives.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
                  </div>
                  <div>
                    <strong>Preguntas de examen</strong>
                    <ul class="list">${block.examQuestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
                  </div>
                </div>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderPhilosophyScience() {
    const analysis = state.lawAnalysis;
    const examples = [
      ["ley-injusta", "Ley injusta pero formalmente válida"],
      ["sentencia-principio", "Sentencia conforme a regla, pero contraria a principio"],
      ["constitucional-ambigua", "Norma constitucional ambigua"],
      ["seguridad-justicia", "Conflicto entre seguridad jurídica y justicia material"]
    ];
    return `
      <section class="view">
        ${pageTitle("Filosofía vs ciencia", "Guía de clasificación conceptual para distinguir lectura jurídica positiva y lectura filosófica. La app no simula comprender el texto con IA: entrega una plantilla aplicable a cualquier enunciado jurídico.")}
        <div class="two-grid">
          <div class="card gold">
            <h3>Enunciado jurídico</h3>
            <textarea class="textarea" id="lawStatement" placeholder="Ejemplo: Una ley permite sancionar administrativamente sin audiencia previa cuando existe urgencia pública.">${escapeHtml(state.lawStatement)}</textarea>
            <div class="row-actions" style="margin-top:12px">
              <button class="button primary" type="button" data-action="analyze-law">${icon("list-checks")}Construir guía</button>
            </div>
            <div class="example-actions" aria-label="Ejemplos predefinidos">
              ${examples.map(([key, label]) => `<button class="chip-button" type="button" data-example-law="${key}">${escapeHtml(label)}</button>`).join("")}
            </div>
          </div>
          <div class="card">
            <h3>Cómo usar esta vista</h3>
            <ul class="list">
              <li><strong>Objeto material:</strong> la misma realidad jurídica que aparece en el enunciado.</li>
              <li><strong>Objeto formal científico:</strong> fuente, competencia, vigencia, interpretación y efectos.</li>
              <li><strong>Objeto formal filosófico:</strong> justicia, legitimidad, racionalidad, valores y límites del derecho positivo.</li>
              <li><strong>Método:</strong> dogmática y criterios de validez frente a reflexión crítica y argumentación normativa.</li>
            </ul>
          </div>
        </div>
        <div class="section-head">
          <div>
            <h2>Plantilla de análisis</h2>
            <p>Completa cada punto con el enunciado elegido. El objetivo es entrenar el cambio de perspectiva que suele pedir la prueba del profesor Johann Benfeld.</p>
          </div>
        </div>
        ${analysis ? renderLawAnalysis(analysis) : `<div class="card empty-state">Escribe un enunciado o elige un ejemplo para desplegar la guía de clasificación.</div>`}
      </section>
    `;
  }

  function renderLawAnalysis(analysis) {
    return `
      <div class="card analysis-statement">
        <span class="badge gold">Enunciado de trabajo</span>
        <p>${escapeHtml(analysis.statement)}</p>
      </div>
      <div class="two-grid" style="margin-top:14px">
        <article class="card teal">
          <div class="badge teal">A) Lectura jurídica positiva</div>
          <h3>Fuente, validez formal y efectos</h3>
          <ul class="list">${analysis.positive.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>
        </article>
        <article class="card gold">
          <div class="badge gold">B) Lectura filosófica</div>
          <h3>Legitimidad, justicia y objeto formal</h3>
          <ul class="list">${analysis.philosophical.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>
        </article>
        <article class="card">
          <h3>C) Preguntas guía</h3>
          <ul class="list">${analysis.questions.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>
        </article>
        <article class="card red">
          <h3>Cierre oral sugerido</h3>
          <p>${escapeHtml(analysis.oral)}</p>
        </article>
      </div>
    `;
  }

  function analyzeLaw(text) {
    return {
      statement: text,
      positive: {
        points: [
          "Fuente normativa: identifica si el caso proviene de Constitución, ley, reglamento, contrato, sentencia o costumbre reconocida.",
          "Órgano competente: pregunta quién dictó la regla o decisión y si tenía atribución jurídica para hacerlo.",
          "Vigencia: revisa entrada en vigor, derogación, temporalidad, ámbito territorial y destinatarios.",
          "Procedimiento: verifica si se respetó el procedimiento de producción o aplicación de la norma.",
          "Validez formal: separa la pertenencia al sistema jurídico de la valoración moral de su contenido.",
          "Efectos jurídicos: determina consecuencias, sanciones, derechos, deberes, nulidad, inaplicación o responsabilidad."
        ]
      },
      philosophical: {
        points: [
          "Fundamento de legitimidad: pregunta por qué esa regla merece obediencia más allá de haber sido dictada por una autoridad.",
          "Justicia de la regla: examina si distribuye cargas y beneficios de modo razonable, proporcional e igualitario.",
          "Relación con igualdad: revisa si trata como iguales a quienes son iguales y si justifica las diferencias relevantes.",
          "Tensión seguridad/justicia: distingue certeza normativa, justicia material y utilidad institucional.",
          "Límites del derecho positivo: pregunta si una norma extremadamente injusta conserva autoridad jurídica plena.",
          "Objeto formal: muestra que el mismo enunciado se estudia ahora desde fundamentos, valores y justificación racional."
        ]
      },
      questions: [
        "¿La norma es válida solo por su fuente?",
        "¿Puede ser injusta y seguir siendo derecho?",
        "¿Qué diría Kelsen sobre validez y separación entre derecho y moral?",
        "¿Qué objetaría Radbruch si la injusticia supera un umbral intolerable?",
        "¿Qué preguntaría Dworkin sobre principios, integridad y respuesta correcta?"
      ],
      oral: "En la evaluación oral del curso conviene cerrar así: el objeto material es el mismo enunciado jurídico, pero cambia el objeto formal. La ciencia jurídica pregunta por fuente, órgano, procedimiento, vigencia, validez formal y efectos. La filosofía del derecho pregunta por legitimidad, justicia, igualdad, límites del derecho positivo y justificación racional."
    };
  }

  function renderClassicalJustice() {
    const author = D.classicalJustice.authors.find((item) => item.id === state.classicAuthor) || D.classicalJustice.authors[0];
    return `
      <section class="view">
        ${pageTitle("Justicia clásica", "Comparador entre Platón, Aristóteles y Tomás de Aquino. La vista está pensada para respuestas orales con tesis, distinción y contraste.")}
        <div class="switcher">
          ${D.classicalJustice.authors.map((item) => `<button type="button" class="${item.id === author.id ? "active" : ""}" data-classic="${item.id}">${escapeHtml(item.name)}</button>`).join("")}
        </div>
        <div class="two-grid">
          <article class="card gold">
            <div class="badge gold">${escapeHtml(author.name)}</div>
            <h3>${escapeHtml(author.title)}</h3>
            <p>${escapeHtml(author.thesis)}</p>
          </article>
          <article class="card teal">
            <h3>Ángulo de examen</h3>
            <p>${escapeHtml(author.examAngle)}</p>
            <div class="pill-row">${author.keyIdeas.map((idea) => `<span class="pill">${escapeHtml(idea)}</span>`).join("")}</div>
          </article>
        </div>
        <div class="section-head"><div><h2>Tabla comparativa</h2><p>Diferencias que suelen activar contra-preguntas en examen oral.</p></div></div>
        <div class="table-wrap">
          <table class="compare-table">
            <thead><tr><th>Eje</th><th>Platón</th><th>Aristóteles</th><th>Tomás de Aquino</th></tr></thead>
            <tbody>
              ${D.classicalJustice.table.map((row) => `
                <tr><td><strong>${escapeHtml(row.axis)}</strong></td><td>${escapeHtml(row.platon)}</td><td>${escapeHtml(row.aristoteles)}</td><td>${escapeHtml(row.aquinio)}</td></tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderRadbruch() {
    const level = Number(state.radbruchLevel || 0);
    const security = Math.max(8, Math.round(96 - level * 0.82));
    const justice = Math.min(100, Math.round(level * 1.05));
    const utility = Math.max(18, Math.round(78 - Math.abs(level - 48) * 0.65));
    const alert = level >= 72;
    const verdict = alert
      ? "Umbral crítico: la seguridad jurídica deja de bastar. La injusticia extrema o la negación deliberada de igualdad activa la fórmula de Radbruch."
      : level >= 48
        ? "Zona de tensión: la ley puede ser injusta, pero aún debes justificar por qué la seguridad jurídica no debe prevalecer."
        : "Zona ordinaria: la seguridad jurídica conserva peso fuerte, aunque la crítica moral siga siendo posible.";

    return `
      <section class="view">
        ${pageTitle("Balanza de Radbruch", "Simula la tensión entre seguridad jurídica, justicia material y utilidad. El punto clave es no afirmar que cualquier injusticia invalida la ley.")}
        <div class="card radbruch-panel ${alert ? "alert" : ""}">
          <div class="section-head" style="margin-top:0">
            <div>
              <h2>Nivel de injusticia de la ley: ${level}%</h2>
              <p>${escapeHtml(verdict)}</p>
            </div>
            <span class="badge ${alert ? "red" : "gold"}">${alert ? "Fórmula activada" : "Tensión ordinaria"}</span>
          </div>
          <input class="range" id="radbruchSlider" type="range" min="0" max="100" value="${level}" aria-label="Nivel de injusticia de la ley">
          <div class="balance-bars">
            ${balanceRow("Seguridad jurídica", security, false)}
            ${balanceRow("Justicia material", justice, alert)}
            ${balanceRow("Utilidad social", utility, false)}
          </div>
        </div>
        <div class="three-grid" style="margin-top:16px">
          <article class="card"><h3>Seguridad</h3><p>El derecho debe orientar conductas con estabilidad. Por eso Radbruch no descarta la ley positiva ante cualquier defecto moral.</p></article>
          <article class="card gold"><h3>Justicia</h3><p>La justicia es el valor propio del derecho y su contenido formal es la igualdad. La negación extrema de igualdad rompe la pretensión jurídica.</p></article>
          <article class="card red"><h3>Fórmula</h3><p>Cuando la contradicción entre ley positiva y justicia alcanza un grado intolerable, la ley injusta debe ceder frente a la justicia.</p></article>
        </div>
      </section>
    `;
  }

  function balanceRow(label, value, danger) {
    return `
      <div class="balance-row">
        <strong>${escapeHtml(label)}</strong>
        <div class="meter ${danger ? "danger" : ""}"><span style="width:${value}%"></span></div>
        <span>${value}%</span>
      </div>
    `;
  }

  function renderPositivism() {
    return `
      <section class="view">
        ${pageTitle("Positivismo vs principios", "Comparador entre Kelsen, Hart y Dworkin: norma básica, regla de reconocimiento, textura abierta, principios, discrecionalidad y juez Hércules.")}
        <div class="table-wrap">
          <table class="compare-table">
            <thead><tr><th>Eje</th><th>Kelsen</th><th>Hart</th><th>Dworkin</th></tr></thead>
            <tbody>
              ${D.positivism.table.map((row) => `
                <tr><td><strong>${escapeHtml(row.axis)}</strong></td><td>${escapeHtml(row.kelsen)}</td><td>${escapeHtml(row.hart)}</td><td>${escapeHtml(row.dworkin)}</td></tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        <div class="section-head"><div><h2>Conceptos de cruce</h2><p>Úsalos para responder preguntas comparativas sin caer en caricaturas.</p></div></div>
        <div class="module-grid">
          ${D.positivism.concepts.map((item) => `<article class="card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`).join("")}
        </div>
      </section>
    `;
  }

  function renderDworkinCourt() {
    const current = D.dworkinCases.find((item) => item.id === state.dworkinCase) || D.dworkinCases[0];
    const selected = state.dworkinPrinciples.length ? state.dworkinPrinciples : current.principles.slice(0, 2);
    return `
      <section class="view">
        ${pageTitle("Tribunal de Dworkin", "Simulador de casos difíciles: elige principios y compara una solución positivista con una respuesta fundada en principios.")}
        <div class="exam-grid">
          <aside class="card gold">
            <h3>Selecciona caso</h3>
            <select class="select" id="dworkinCase">
              ${D.dworkinCases.map((item) => `<option value="${item.id}" ${item.id === current.id ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}
            </select>
            <p style="margin-top:14px">${escapeHtml(current.facts)}</p>
            <strong>Principios disponibles</strong>
            <div class="principle-list" style="margin-top:10px">
              ${current.principles.map((principle) => `
                <label class="check-row">
                  <input type="checkbox" value="${escapeHtml(principle)}" ${selected.includes(principle) ? "checked" : ""} data-principle>
                  <span><strong>${escapeHtml(principle)}</strong><span>Razón jurídica con dimensión de peso para este caso.</span></span>
                </label>
              `).join("")}
            </div>
          </aside>
          <div class="two-grid">
            <article class="card">
              <div class="badge">Solución positivista</div>
              <h3>Reglas y fuentes</h3>
              <p>${escapeHtml(current.positivist)}</p>
            </article>
            <article class="card teal">
              <div class="badge teal">Solución por principios</div>
              <h3>Integridad</h3>
              <p>${escapeHtml(current.principled)}</p>
            </article>
            <article class="card gold" style="grid-column:1 / -1">
              <h3>Principios elegidos</h3>
              <div class="pill-row">${selected.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}</div>
              <p style="margin-top:12px">${escapeHtml(current.examKey)}</p>
            </article>
          </div>
        </div>
      </section>
    `;
  }

  function rawlsModel() {
    const risk = Number(state.rawlsRisk);
    const inequality = Number(state.rawlsInequality);
    const liberty = clamp(86 + risk * 0.08 - Math.max(0, inequality - 55) * 0.32);
    const opportunity = clamp(68 + risk * 0.16 - inequality * 0.15);
    const worstOff = clamp(44 + risk * 0.42 - inequality * 0.18);
    const utility = clamp(42 + inequality * 0.42 - risk * 0.18);
    const difference = clamp(54 + risk * 0.34 - Math.abs(inequality - 45) * 0.14);
    const maximin = clamp((liberty + opportunity + worstOff + difference) / 4);
    const profile = risk >= 70
      ? "Estrategia maximin fuerte"
      : inequality >= 70
        ? "Tolerancia alta a incentivos"
        : risk <= 30
          ? "Apuesta institucional moderada"
          : "Equilibrio rawlsiano prudente";
    const verdict = maximin >= 78
      ? "La configuración protege bien a la peor posición sin sacrificar libertades básicas."
      : maximin >= 58
        ? "La configuración es defendible, pero exige justificar mejor oportunidades y beneficio al peor situado."
        : "La configuración deja demasiado expuesta a la persona peor situada tras el velo de ignorancia.";
    const scores = {};
    D.rawls.choices.forEach((choice) => {
      let score = choice.fairness - choice.risk * (0.22 + risk / 180);
      if (choice.id === "diferencia") score += risk * 0.25 + (100 - Math.abs(inequality - 45)) * 0.06;
      if (choice.id === "libertad") score += risk * 0.16 + (100 - inequality) * 0.07;
      if (choice.id === "utilidad") score += inequality * 0.16 - risk * 0.12;
      if (choice.id === "merito") score += inequality * 0.1 - risk * 0.08;
      scores[choice.id] = clamp(score);
    });
    const recommended = D.rawls.choices
      .slice()
      .sort((a, b) => scores[b.id] - scores[a.id])[0];
    return { risk, inequality, liberty, opportunity, worstOff, utility, difference, maximin, profile, verdict, scores, recommended };
  }

  function rawlsMetric(label, value, id, danger = false) {
    return `
      <div class="rawls-metric">
        <span>${escapeHtml(label)}</span>
        <div class="meter ${danger ? "danger" : ""}"><span data-rawls-meter="${id}" style="width:${value}%"></span></div>
        <strong data-rawls-value="${id}">${value}%</strong>
      </div>
    `;
  }

  function renderRawlsLab() {
    const choice = D.rawls.choices.find((item) => item.id === state.rawlsChoice);
    const model = rawlsModel();
    const recommended = model.recommended;

    return `
      <section class="view">
        ${pageTitle("Rawls Lab", "Experimenta con el velo de ignorancia, bienes primarios, posición original y elección de principios.")}
        <div class="two-grid">
          <article class="card gold">
            <h3>Velo de ignorancia</h3>
            <p>No sabes tu clase social, talentos, religión, género, salud ni proyecto de vida. Solo sabes que querrás bienes primarios y que podrías estar en la peor posición.</p>
            <label class="range-label" for="rawlsRisk"><strong>Aversión al riesgo</strong><span id="rawlsRiskValue">${model.risk}%</span></label>
            <input class="range" id="rawlsRisk" type="range" min="0" max="100" value="${state.rawlsRisk}">
            <label class="range-label" for="rawlsInequality"><strong>Tolerancia a desigualdad</strong><span id="rawlsInequalityValue">${model.inequality}%</span></label>
            <input class="range" id="rawlsInequality" type="range" min="0" max="100" value="${state.rawlsInequality}">
            <div class="rawls-console" aria-live="polite">
              <div>
                <span>Perfil de elección</span>
                <strong id="rawlsProfileLabel">${escapeHtml(model.profile)}</strong>
              </div>
              <p id="rawlsVerdict">${escapeHtml(model.verdict)}</p>
            </div>
          </article>
          <article class="card">
            <h3>Principios rawlsianos</h3>
            <ul class="list">${D.rawls.principles.map((item) => `<li><strong>${escapeHtml(item.title)}:</strong> ${escapeHtml(item.body)}</li>`).join("")}</ul>
          </article>
        </div>

        <div class="card rawls-dashboard">
          <div class="section-head compact">
            <div>
              <h2>Tablero de posición original</h2>
              <p>Estas barras cambian al mover los controles: muestran qué tan protegida queda una persona sin conocer su lugar social.</p>
            </div>
            <span class="badge gold">Recomendado: <b id="rawlsRecommended">${escapeHtml(recommended.title)}</b></span>
          </div>
          <div class="rawls-metrics">
            ${rawlsMetric("Libertades básicas", model.liberty, "liberty")}
            ${rawlsMetric("Oportunidades reales", model.opportunity, "opportunity")}
            ${rawlsMetric("Peor situado", model.worstOff, "worstOff", model.worstOff < 55)}
            ${rawlsMetric("Principio de diferencia", model.difference, "difference")}
            ${rawlsMetric("Utilidad agregada", model.utility, "utility", model.utility > model.worstOff + 20)}
            ${rawlsMetric("Consistencia maximin", model.maximin, "maximin", model.maximin < 58)}
          </div>
        </div>

        <div class="section-head"><div><h2>Elige desde la posición original</h2><p>La app evalúa el riesgo de quedar mal situado y la consistencia con justicia como equidad.</p></div></div>
        <div class="module-grid">
          ${D.rawls.choices.map((item) => {
            const score = model.scores[item.id];
            return `
            <button class="choice-card card ${item.id === state.rawlsChoice ? "gold" : ""} ${item.id === recommended.id ? "recommended" : ""}" type="button" data-rawls-choice="${item.id}">
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.note)}</p>
              <div class="meter ${score < 55 ? "danger" : ""}"><span data-choice-meter="${item.id}" style="width:${score}%"></span></div>
              <small class="muted">Compatibilidad rawlsiana: <b data-choice-score="${item.id}">${score}%</b> · Riesgo base: ${item.risk}%</small>
            </button>
          `; }).join("")}
        </div>
        <div class="card teal" style="margin-top:16px">
          <h3>${choice ? "Evaluación de tu elección" : "Recomendación del laboratorio"}</h3>
          <p id="rawlsFeedbackText">${choice ? rawlsFeedback(choice) : `La opción más consistente con Rawls suele ser: ${recommended.title}. Protege libertades y evalúa desigualdades desde la posición del menos aventajado.`}</p>
        </div>
      </section>
    `;
  }

  function rawlsFeedback(choice) {
    const risk = Number(state.rawlsRisk);
    const inequality = Number(state.rawlsInequality);
    if (choice.id === "diferencia" || choice.id === "libertad") {
      return `Buena elección rawlsiana. Con aversión al riesgo ${risk}% y tolerancia a desigualdad ${inequality}%, tu respuesta protege bienes primarios y evita sacrificar libertades por utilidad agregada. ${choice.note}`;
    }
    return `Elección problemática desde Rawls. Con el velo de ignorancia no conviene aceptar un principio que podría dejarte sin libertades o sin base social del autorrespeto. ${choice.note}`;
  }

  function updateRawlsLive() {
    const model = rawlsModel();
    const setText = (selector, value) => {
      const node = document.querySelector(selector);
      if (node) node.textContent = value;
    };
    setText("#rawlsRiskValue", `${model.risk}%`);
    setText("#rawlsInequalityValue", `${model.inequality}%`);
    setText("#rawlsProfileLabel", model.profile);
    setText("#rawlsVerdict", model.verdict);
    setText("#rawlsRecommended", model.recommended.title);
    Object.entries({
      liberty: model.liberty,
      opportunity: model.opportunity,
      worstOff: model.worstOff,
      difference: model.difference,
      utility: model.utility,
      maximin: model.maximin
    }).forEach(([key, value]) => {
      const meter = document.querySelector(`[data-rawls-meter="${key}"]`);
      const label = document.querySelector(`[data-rawls-value="${key}"]`);
      if (meter) meter.style.width = `${value}%`;
      if (label) label.textContent = `${value}%`;
    });
    D.rawls.choices.forEach((choice) => {
      const score = model.scores[choice.id];
      const meter = document.querySelector(`[data-choice-meter="${choice.id}"]`);
      const label = document.querySelector(`[data-choice-score="${choice.id}"]`);
      const card = document.querySelector(`[data-rawls-choice="${choice.id}"]`);
      if (meter) meter.style.width = `${score}%`;
      if (meter?.parentElement) meter.parentElement.classList.toggle("danger", score < 55);
      if (label) label.textContent = `${score}%`;
      if (card) card.classList.toggle("recommended", choice.id === model.recommended.id);
    });
    const selected = D.rawls.choices.find((item) => item.id === state.rawlsChoice);
    setText("#rawlsFeedbackText", selected
      ? rawlsFeedback(selected)
      : `La opción más consistente con Rawls suele ser: ${model.recommended.title}. Protege libertades y evalúa desigualdades desde la posición del menos aventajado.`);
  }

  function renderFlashcards() {
    const categories = ["Todas", ...new Set(D.flashcards.map((card) => card.category))];
    const cards = filteredFlashcards();
    const index = Math.min(state.flashIndex, Math.max(cards.length - 1, 0));
    state.flashIndex = index;
    const card = cards[index] || D.flashcards[0];
    const learned = state.learned.includes(card.id);
    const p = progressStats();

    return `
      <section class="view">
        ${pageTitle("Flashcards", "Más de 60 tarjetas reales para memoria activa. Gira la tarjeta, avanza y marca aprendidas; el progreso queda guardado en localStorage.")}
        <div class="toolbar">
          <select class="select" id="flashFilter" style="max-width:280px">
            ${categories.map((cat) => `<option value="${escapeHtml(cat)}" ${cat === state.flashFilter ? "selected" : ""}>${escapeHtml(cat)}</option>`).join("")}
          </select>
          <span class="badge gold">${p.learned}/${p.cards} aprendidas</span>
          <span class="badge">${index + 1}/${cards.length}</span>
        </div>
        <div class="flashcard-stage" style="margin-top:16px">
          <button class="flashcard ${state.flashFlipped ? "flipped" : ""}" type="button" data-action="flip-card" aria-label="Girar flashcard">
            <span class="flash-face front">
              <span class="pill-row">
                <span class="badge gold">${escapeHtml(card.author)}</span>
                <span class="badge">${escapeHtml(card.difficulty)}</span>
                <span class="badge teal">${escapeHtml(card.category)}</span>
              </span>
              <span class="flash-question">${escapeHtml(card.question)}</span>
              <span class="muted">Toca para ver respuesta.</span>
            </span>
            <span class="flash-face back">
              <span class="badge teal">Respuesta</span>
              <span class="flash-answer">${escapeHtml(card.answer)}</span>
              <span class="muted">Toca para volver a la pregunta.</span>
            </span>
          </button>
        </div>
        <div class="card-actions" style="margin-top:16px">
          <button class="button" type="button" data-action="prev-card">${icon("chevron-left")}Anterior</button>
          <button class="button primary" type="button" data-action="learn-card">${icon(learned ? "check-check" : "check")} ${learned ? "Aprendida" : "Marcar aprendida"}</button>
          <button class="button" type="button" data-action="next-card">Siguiente${icon("chevron-right")}</button>
        </div>
      </section>
    `;
  }

  function filteredFlashcards() {
    if (state.flashFilter === "Todas") return D.flashcards;
    return D.flashcards.filter((card) => card.category === state.flashFilter);
  }

  function renderQuiz() {
    if (state.quiz.completed) return renderQuizResult();
    const q = D.quiz[state.quiz.index] || D.quiz[0];
    const progress = Math.round((state.quiz.index / D.quiz.length) * 100);

    return `
      <section class="view">
        ${pageTitle("Quiz del curso", "40+ preguntas complejas con alternativas, feedback y explicación. El resultado se guarda como mejor marca para la preparación de la asignatura.")}
        <div class="card gold">
          <div class="pill-row">
            <span class="badge gold">Pregunta ${state.quiz.index + 1}/${D.quiz.length}</span>
            <span class="badge">${escapeHtml(q.category)}</span>
            <span class="badge">${escapeHtml(q.difficulty)}</span>
          </div>
          <div class="meter" style="margin:14px 0 18px"><span style="width:${progress}%"></span></div>
          <h3>${escapeHtml(q.question)}</h3>
          <div class="quiz-options">
            ${q.options.map((option, idx) => quizOption(option, idx, q.answer)).join("")}
          </div>
          ${state.quiz.answered ? `
            <div class="feedback" style="margin-top:14px">
              <strong>${state.quiz.selected === q.answer ? "Correcta." : "Incorrecta."}</strong>
              ${escapeHtml(q.explanation)}
            </div>
            <div class="row-actions" style="margin-top:14px">
              <button class="button primary" type="button" data-action="next-question">${state.quiz.index === D.quiz.length - 1 ? "Ver resultado" : "Siguiente pregunta"}${icon("arrow-right")}</button>
            </div>
          ` : ""}
        </div>
      </section>
    `;
  }

  function quizOption(option, idx, answer) {
    let klass = "";
    if (state.quiz.answered) {
      if (idx === answer) klass = "correct";
      if (idx === state.quiz.selected && idx !== answer) klass = "wrong";
    }
    return `<button class="quiz-option ${klass}" type="button" data-quiz-option="${idx}" ${state.quiz.answered ? "disabled" : ""}>${escapeHtml(option)}</button>`;
  }

  function renderQuizResult() {
    const score = state.quiz.score;
    const pct = Math.round((score / D.quiz.length) * 100);
    const message = pct >= 85
      ? "Nivel examen oral sólido. Ahora conviene practicar respuestas comparativas sin mirar."
      : pct >= 65
        ? "Buen avance. Revisa explicaciones fallidas y vuelve a intentar en modo cronometrado."
        : "Base por consolidar. Vuelve a mapa, flashcards y módulos comparativos antes del siguiente intento.";

    return `
      <section class="view">
        ${pageTitle("Resultado del quiz", "Cierre del intento y recomendación de estudio.")}
        <div class="card gold">
          <div class="progress-ring" style="--value:${pct * 3.6}deg">
            <div class="progress-ring-inner"><div><strong>${pct}%</strong><small>${score}/${D.quiz.length}</small></div></div>
          </div>
          <h3>${escapeHtml(message)}</h3>
          <p class="muted">Mejor marca guardada: ${Math.max(state.quiz.best, score)}/${D.quiz.length}</p>
          <div class="row-actions">
            <button class="button primary" type="button" data-action="reset-quiz">${icon("rotate-ccw")}Nuevo intento</button>
            <button class="button" type="button" data-route="oral">${icon("mic")}Practicar oral</button>
          </div>
        </div>
      </section>
    `;
  }

  function renderTutor() {
    const messages = state.tutorMessages.length ? state.tutorMessages : [
      { role: "tutor", text: "Propón una definición o tesis. Yo responderé como tutor socrático: contra-pregunta, autor relevante y corrección conceptual." }
    ];
    return `
      <section class="view">
        ${pageTitle("Tutor socrático", "Simulación local basada en patrones doctrinales: formula contra-preguntas, corrige definiciones y sugiere mejoras argumentativas.")}
        <div class="card">
          <div class="chat-box" id="chatBox">
            ${messages.map((msg) => `<div class="message ${msg.role}">${escapeHtml(msg.text)}</div>`).join("")}
          </div>
          <div class="row-actions" style="margin-top:14px">
            <input class="input" id="tutorInput" placeholder="Ejemplo: Creo que Hart dice que el juez siempre crea derecho..." autocomplete="off">
            <button class="button primary" type="button" data-action="send-tutor">${icon("send")}Enviar</button>
            <button class="button" type="button" data-action="clear-tutor">${icon("trash-2")}Limpiar</button>
          </div>
        </div>
      </section>
    `;
  }

  function socraticReply(text) {
    const lower = text.toLowerCase();
    const hint = D.socraticHints.find((item) => item.keywords.some((keyword) => lower.includes(keyword)));
    const corrections = [];

    if (/siempre|nunca|todo|nada/.test(lower)) {
      corrections.push("Cuidado con absolutos: en examen suelen pedir umbrales, distinciones o casos límite.");
    }
    if (/justicia.*ley|ley.*justicia/.test(lower)) {
      corrections.push("Distingue validez positiva de justicia material; esa separación es clave entre legalismo, positivismo y Radbruch.");
    }
    if (/moral/.test(lower) && !/derecho/.test(lower)) {
      corrections.push("Conecta moral y derecho: ¿hablas de moral social, moral crítica o moral política institucional?");
    }

    const base = hint
      ? `${hint.author}: ${hint.reply}`
      : "Primero define el concepto y ubica al autor. Después formula una distinción: validez/justicia, regla/principio, ciencia/filosofía o seguridad/justicia.";
    const follow = "Contra-pregunta: ¿qué ejemplo jurídico mostraría que tu definición funciona y qué caso la pondría en crisis?";
    const improve = "Mejora sugerida: responde en cuatro pasos: tesis breve, distinción conceptual, autor, aplicación a un caso.";

    return [base, ...corrections, follow, improve].join(" ");
  }

  function renderGlossary() {
    const query = state.glossarySearch.trim().toLowerCase();
    const terms = D.glossary.filter((item) => {
      if (!query) return true;
      return [item.term, item.definition, item.explanation, item.author, item.example].some((value) => value.toLowerCase().includes(query));
    });

    return `
      <section class="view">
        ${pageTitle("Glosario", "80+ términos con definición breve, explicación, autor relacionado y ejemplo jurídico.")}
        <div class="toolbar">
          <div class="search-wrap" style="flex:1; min-width:240px">
            ${icon("search")}
            <input class="input" id="glossarySearch" value="${escapeHtml(state.glossarySearch)}" placeholder="Buscar término, autor o ejemplo...">
          </div>
          <span class="badge gold">${terms.length}/${D.glossary.length} términos</span>
        </div>
        <div class="glossary-grid" id="glossaryResults" style="margin-top:16px">
          ${terms.map((item) => renderTerm(item, query)).join("") || `<div class="card empty-state">No hay resultados para esa búsqueda.</div>`}
        </div>
      </section>
    `;
  }

  function renderTerm(item, query) {
    return `
      <article class="card term-card">
        <div class="pill-row">
          <span class="badge gold">${highlight(item.term, query)}</span>
          <span class="badge">${escapeHtml(item.author)}</span>
        </div>
        <h3>${highlight(item.definition, query)}</h3>
        <p>${highlight(item.explanation, query)}</p>
        <p><strong>Ejemplo:</strong> ${highlight(item.example, query)}</p>
      </article>
    `;
  }

  function highlight(value, query) {
    const text = escapeHtml(value);
    if (!query) return text;
    const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return text.replace(new RegExp(`(${safe})`, "ig"), "<mark>$1</mark>");
  }

  function renderOralExam() {
    const current = D.oralExam[state.oralIndex] || D.oralExam[0];
    const practiced = state.oralPracticed.includes(current.id);
    return `
      <section class="view">
        ${pageTitle("Modo examen oral", "Preguntas aleatorias con estructura sugerida, errores comunes y respuesta modelo. Practica respondiendo en voz alta antes de revelar el modelo completo.")}
        <div class="exam-grid">
          <aside class="card gold">
            <div class="pill-row">
              <span class="badge gold">Pregunta ${state.oralIndex + 1}/${D.oralExam.length}</span>
              <span class="badge ${practiced ? "teal" : ""}">${practiced ? "Practicada" : "Pendiente"}</span>
            </div>
            <h3>${escapeHtml(current.question)}</h3>
            <div class="row-actions">
              <button class="button" type="button" data-action="random-oral">${icon("shuffle")}Aleatoria</button>
              <button class="button" type="button" data-action="next-oral">${icon("arrow-right")}Siguiente</button>
              <button class="button primary" type="button" data-action="practice-oral">${icon("check")}Marcar practicada</button>
            </div>
          </aside>
          <div class="two-grid">
            <article class="card">
              <h3>Estructura sugerida</h3>
              <ul class="list">${current.structure.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
            </article>
            <article class="card red">
              <h3>Errores comunes</h3>
              <ul class="list">${current.commonErrors.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
            </article>
            <article class="card teal" style="grid-column:1 / -1">
              <h3>Respuesta modelo</h3>
              <p>${escapeHtml(current.model)}</p>
            </article>
          </div>
        </div>
      </section>
    `;
  }

  function bindView(view) {
    if (view === "radbruch") {
      document.getElementById("radbruchSlider")?.addEventListener("input", (event) => {
        state.radbruchLevel = Number(event.target.value);
        saveState();
        render();
      });
    }

    if (view === "rawls") {
      const riskInput = document.getElementById("rawlsRisk");
      const inequalityInput = document.getElementById("rawlsInequality");
      riskInput?.addEventListener("input", (event) => {
        state.rawlsRisk = Number(event.target.value);
        saveState();
        updateRawlsLive();
      });
      inequalityInput?.addEventListener("input", (event) => {
        state.rawlsInequality = Number(event.target.value);
        saveState();
        updateRawlsLive();
      });
      riskInput?.addEventListener("change", () => playSound("select"));
      inequalityInput?.addEventListener("change", () => playSound("select"));
    }

    if (view === "glosario") {
      document.getElementById("glossarySearch")?.addEventListener("input", (event) => {
        state.glossarySearch = event.target.value;
        saveState();
        renderGlossaryLive();
      });
    }

    if (view === "tutor") {
      const input = document.getElementById("tutorInput");
      input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") sendTutorMessage();
      });
      scrollChat();
    }

    if (view === "filosofia-ciencia") {
      document.getElementById("lawStatement")?.addEventListener("input", (event) => {
        state.lawStatement = event.target.value;
        saveState();
      });
    }
  }

  function renderGlossaryLive() {
    const query = state.glossarySearch.trim().toLowerCase();
    const terms = D.glossary.filter((item) => !query || [item.term, item.definition, item.explanation, item.author, item.example].some((value) => value.toLowerCase().includes(query)));
    const results = document.getElementById("glossaryResults");
    if (results) {
      results.innerHTML = terms.map((item) => renderTerm(item, query)).join("") || `<div class="card empty-state">No hay resultados para esa búsqueda.</div>`;
    }
    refreshIcons();
  }

  function scrollChat() {
    const box = document.getElementById("chatBox");
    if (box) box.scrollTop = box.scrollHeight;
  }

  function sendTutorMessage() {
    const input = document.getElementById("tutorInput");
    const text = input?.value.trim();
    if (!text) return;
    state.tutorMessages.push({ role: "user", text });
    state.tutorMessages.push({ role: "tutor", text: socraticReply(text) });
    input.value = "";
    saveState();
    playSound("success");
    render();
  }

  document.addEventListener("click", async (event) => {
    const route = event.target.closest("[data-route]");
    if (route) {
      event.preventDefault();
      playSound("tap");
      setRoute(route.dataset.route);
      return;
    }

    const classic = event.target.closest("[data-classic]");
    if (classic) {
      state.classicAuthor = classic.dataset.classic;
      saveState();
      playSound("select");
      render();
      return;
    }

    const rawlsChoice = event.target.closest("[data-rawls-choice]");
    if (rawlsChoice) {
      state.rawlsChoice = rawlsChoice.dataset.rawlsChoice;
      saveState();
      playSound("success");
      render();
      return;
    }

    const lawExample = event.target.closest("[data-example-law]");
    if (lawExample) {
      playSound("select");
      useLawExample(lawExample.dataset.exampleLaw);
      return;
    }

    const quizOptionButton = event.target.closest("[data-quiz-option]");
    if (quizOptionButton && !state.quiz.answered) {
      const selected = Number(quizOptionButton.dataset.quizOption);
      const q = D.quiz[state.quiz.index];
      state.quiz.selected = selected;
      state.quiz.answered = true;
      if (selected === q.answer) state.quiz.score += 1;
      saveState();
      playSound(selected === q.answer ? "success" : "error");
      render();
      return;
    }

    const action = event.target.closest("[data-action]");
    if (!action) return;

    const name = action.dataset.action;
    if (name === "toggle-sound") toggleSound();
    if (name === "reset-progress") resetProgress();
    if (name === "analyze-law") runLawAnalysis();
    if (name === "flip-card") flipCard();
    if (name === "prev-card") moveCard(-1);
    if (name === "next-card") moveCard(1);
    if (name === "learn-card") toggleLearnedCard();
    if (name === "next-question") nextQuestion();
    if (name === "reset-quiz") resetQuiz();
    if (name === "send-tutor") sendTutorMessage();
    if (name === "clear-tutor") clearTutor();
    if (name === "random-oral") randomOral();
    if (name === "next-oral") nextOral();
    if (name === "practice-oral") practiceOral();
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "flashFilter") {
      state.flashFilter = event.target.value;
      state.flashIndex = 0;
      state.flashFlipped = false;
      saveState();
      render();
    }

    if (event.target.id === "dworkinCase") {
      state.dworkinCase = event.target.value;
      const current = D.dworkinCases.find((item) => item.id === state.dworkinCase);
      state.dworkinPrinciples = current ? current.principles.slice(0, 2) : [];
      saveState();
      playSound("select");
      render();
    }

    if (event.target.matches("[data-principle]")) {
      const checks = [...document.querySelectorAll("[data-principle]:checked")].map((item) => item.value);
      state.dworkinPrinciples = checks;
      saveState();
      playSound("tap");
      render();
    }
  });

  async function tryInstall() {
    if (!deferredInstallPrompt) {
      showToast("La instalación aparece en navegador compatible desde Vercel o HTTPS. La app igual funciona abriendo index.html.");
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  }

  function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    saveState();
    if (state.soundEnabled) playSound("unlock");
    render();
    showToast(state.soundEnabled ? "Sonido local activado." : "Sonido apagado.");
  }

  function resetProgress() {
    if (!confirm("¿Reiniciar progreso local de Phronesis?")) return;
    state = clone(defaultState);
    saveState();
    playSound("error");
    render();
    showToast("Progreso reiniciado.");
  }

  function runLawAnalysis() {
    const textarea = document.getElementById("lawStatement");
    const text = textarea?.value.trim() || "";
    if (!text) {
      playSound("error");
      showToast("Escribe un enunciado jurídico o elige un ejemplo.");
      return;
    }
    state.lawStatement = text;
    state.lawAnalysis = analyzeLaw(text);
    saveState();
    playSound("success");
    render();
  }

  function useLawExample(kind) {
    const examples = {
      "ley-injusta": "Una ley formalmente aprobada permite privar de beneficios públicos a un grupo minoritario sin fundamento razonable.",
      "sentencia-principio": "Una sentencia aplica literalmente una regla procesal, pero deja sin tutela efectiva a una persona vulnerable.",
      "constitucional-ambigua": "Una norma constitucional reconoce igualdad ante la ley, pero no precisa cómo resolver medidas diferenciadas de acción afirmativa.",
      "seguridad-justicia": "Un tribunal debe decidir si mantiene una sentencia firme por seguridad jurídica o la revisa porque se dictó con una injusticia material grave."
    };
    state.lawStatement = examples[kind] || examples["ley-injusta"];
    state.lawAnalysis = analyzeLaw(state.lawStatement);
    saveState();
    render();
  }

  function flipCard() {
    state.flashFlipped = !state.flashFlipped;
    saveState();
    playSound("card");
    render();
  }

  function moveCard(delta) {
    const cards = filteredFlashcards();
    state.flashIndex = (state.flashIndex + delta + cards.length) % cards.length;
    state.flashFlipped = false;
    saveState();
    playSound("tap");
    render();
  }

  function toggleLearnedCard() {
    const card = filteredFlashcards()[state.flashIndex];
    if (!card) return;
    if (state.learned.includes(card.id)) {
      state.learned = state.learned.filter((id) => id !== card.id);
      playSound("tap");
      showToast("Tarjeta desmarcada.");
    } else {
      state.learned.push(card.id);
      playSound("success");
      showToast("Tarjeta marcada como aprendida.");
    }
    saveState();
    render();
  }

  function nextQuestion() {
    if (state.quiz.index >= D.quiz.length - 1) {
      state.quiz.completed = true;
      state.quiz.best = Math.max(state.quiz.best || 0, state.quiz.score);
    } else {
      state.quiz.index += 1;
      state.quiz.answered = false;
      state.quiz.selected = null;
    }
    saveState();
    playSound("tap");
    render();
  }

  function resetQuiz() {
    const best = state.quiz.best || 0;
    state.quiz = { index: 0, score: 0, answered: false, selected: null, completed: false, best };
    saveState();
    playSound("select");
    render();
  }

  function clearTutor() {
    state.tutorMessages = [];
    saveState();
    playSound("tap");
    render();
  }

  function randomOral() {
    state.oralIndex = Math.floor(Math.random() * D.oralExam.length);
    saveState();
    playSound("select");
    render();
  }

  function nextOral() {
    state.oralIndex = (state.oralIndex + 1) % D.oralExam.length;
    saveState();
    playSound("tap");
    render();
  }

  function practiceOral() {
    const current = D.oralExam[state.oralIndex];
    if (!state.oralPracticed.includes(current.id)) {
      state.oralPracticed.push(current.id);
      playSound("success");
      showToast("Pregunta marcada como practicada.");
      saveState();
      render();
    }
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("#installApp")) tryInstall();
  });

  window.addEventListener("hashchange", render);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }

  createNav();
  render();
})();
