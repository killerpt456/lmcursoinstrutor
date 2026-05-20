import { formatDuration, getSessionProgress } from "./exam.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function optionLetter(index) {
  return String.fromCharCode(65 + index);
}

export function renderLoading(appElement) {
  const template = document.getElementById("loadingTemplate");
  appElement.innerHTML = "";
  appElement.appendChild(template.content.cloneNode(true));
}

export function renderLogin(appElement, model = {}) {
  const { error = "", appName = "L&M DriveLab" } = model;

  appElement.innerHTML = `
    <section class="login-shell">
      <article class="panel login-card">
        <div class="login-copy">
          <p class="eyebrow">Acesso restrito</p>
          <h2>Entrar na plataforma</h2>
          <p class="panel-subtitle">Este acesso está reservado aos colegas autorizados. Usa o teu utilizador e palavra-passe para continuar.</p>
        </div>
        <form class="login-form" data-action="login-form">
          <div class="field">
            <label for="loginUsername">Utilizador</label>
            <input id="loginUsername" name="username" type="text" autocomplete="username" required>
          </div>
          <div class="field">
            <label for="loginPassword">Palavra-passe</label>
            <input id="loginPassword" name="password" type="password" autocomplete="current-password" required>
          </div>
          ${error ? `<div class="feedback-box danger"><strong>${escapeHtml(error)}</strong></div>` : ""}
          <div class="login-actions">
            <button class="primary-btn" type="submit">Entrar</button>
          </div>
        </form>
      </article>
      <aside class="panel login-side">
        <p class="eyebrow">Plataforma</p>
        <h2>${escapeHtml(appName)}</h2>
        <p class="muted">Sistema simples de login local para limitar o acesso à app antes do início dos exames.</p>
      </aside>
    </section>
  `;
}

export function renderDashboard(appElement, model) {
  const {
    filters,
    categories,
    filteredQuestions,
    favoriteQuestions,
    libraryResources,
    stats,
    validation,
    favoritesCount,
    savedProgress,
    dashboardSection,
    favoriteIds,
    openConfigDropdown,
    isAdmin,
  } = model;
  const isOfficialMode = filters.mode === "oficial";

  const historyHtml = stats.history.length
    ? stats.history.slice(0, 6).map((item) => `
      <article class="history-item">
        <div class="meta-row">
          <span class="tag">${labelMode(item.mode)}</span>
          <span class="tag neutral">${item.score}%</span>
          <span class="tag ${item.passed ? "success" : item.provisional ? "neutral" : "danger"}">${item.provisional ? "Provisório" : item.passed ? "Aprovado" : "Reprovado"}</span>
        </div>
        <strong>${formatDate(item.completedAt)}</strong>
        <p class="muted">${item.correct} corretas, ${item.wrong} erradas, ${item.pending} pendentes · ${formatDuration(item.elapsedMs)}</p>
      </article>
    `).join("")
    : `<p class="muted">Ainda não existem exames concluídos.</p>`;

  const favoritesHtml = favoriteQuestions.map((question) => `
    <article class="search-item">
      <div class="meta-row">
        <span class="tag">${escapeHtml(question.categoria)}</span>
        <span class="tag neutral">${escapeHtml(question.dificuldade)}</span>
        ${question.validada ? '<span class="tag success">Validada</span>' : '<span class="tag danger">Resposta pendente</span>'}
      </div>
      <h3>${escapeHtml(question.pergunta)}</h3>
      <p class="muted">${escapeHtml(question.opcoes[0] || "Sem opcoes disponiveis.")}</p>
      <div class="control-row">
        <button class="chip-btn" type="button" data-action="toggle-favorite" data-id="${question.id}">
          Remover favorita
        </button>
      </div>
      ${isAdmin ? renderAdminAnswerEditor(question, question.opcoes) : ""}
    </article>
  `).join("");

  const libraryCategoryOptions = [
    ...new Set([
      ...categories.filter((category) => category !== "Todas"),
      ...libraryResources.map((item) => item.category).filter(Boolean),
    ]),
  ];
  const filteredLibraryResources = libraryResources.filter((item) => {
    return filters.libraryCategory === "Todas" || item.category === filters.libraryCategory;
  });
  const pdfResources = filteredLibraryResources.filter((item) => item.type === "pdf");
  const videoResources = filteredLibraryResources.filter((item) => item.type === "video");
  const summaryResources = filteredLibraryResources.filter((item) => item.type === "summary");

  appElement.innerHTML = `
    <section id="heroSection" class="panel hero hero-simple ${dashboardSection === "home" ? "" : "is-hidden"}">
      <div class="hero-copy">
        <p class="eyebrow">Área de Exames</p>
        <h2>Preparação simples, organizada e pronta para entrar em exame.</h2>
        <p class="panel-subtitle">A pagina inicial fica limpa. As areas de configuracao, estatisticas, biblioteca e favoritos so aparecem quando forem abertas.</p>
        <div class="hero-actions">
          <button class="primary-btn" type="button" data-action="open-dashboard-section" data-section="setup">Realizar exame</button>
          <button class="secondary-btn" type="button" data-action="open-dashboard-section" data-section="stats">Ver estatísticas</button>
          <button class="secondary-btn" type="button" data-action="open-dashboard-section" data-section="library">Abrir biblioteca</button>
        </div>
      </div>
      <div class="hero-aside">
        <article class="hero-stat">
          <span class="tiny">Perguntas disponíveis</span>
          <strong>${validation.total}</strong>
        </article>
        <article class="hero-stat">
          <span class="tiny">Favoritas</span>
          <strong>${favoritesCount}</strong>
        </article>
        <article class="hero-stat">
          <span class="tiny">Exames realizados</span>
          <strong>${stats.examsRun}</strong>
        </article>
        <article class="hero-stat">
          <span class="tiny">Retoma rápida</span>
          <strong>${savedProgress ? "Sim" : "Não"}</strong>
        </article>
      </div>
    </section>

    <section class="section-switcher">
      <button class="section-switch ${dashboardSection === "setup" ? "is-active" : ""}" type="button" data-action="open-dashboard-section" data-section="setup">Realizar exame</button>
      <button class="section-switch ${dashboardSection === "stats" ? "is-active" : ""}" type="button" data-action="open-dashboard-section" data-section="stats">Estatísticas</button>
      <button class="section-switch ${dashboardSection === "library" ? "is-active" : ""}" type="button" data-action="open-dashboard-section" data-section="library">Biblioteca</button>
      <button class="section-switch ${dashboardSection === "favorites" ? "is-active" : ""}" type="button" data-action="open-dashboard-section" data-section="favorites">Favoritos</button>
      <button class="section-switch ${dashboardSection === "home" ? "is-active" : ""}" type="button" data-action="open-dashboard-section" data-section="home">Início</button>
    </section>

    <section id="setupSection" class="panel section-panel ${dashboardSection === "setup" ? "" : "is-hidden"}">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Configuração</p>
          <h2>Preparar exame</h2>
          <p class="muted">Define o modo, os filtros e começa quando estiver pronto.</p>
        </div>
        <div class="section-heading-actions">
          <button class="secondary-btn" type="button" data-action="reset-stats">Repor a 0</button>
          <button class="ghost-btn" type="button" data-action="open-dashboard-section" data-section="home">Fechar</button>
        </div>
      </div>
      <div class="filters-grid compact-grid">
        <div class="field">
          <label for="mode">Modo</label>
          ${renderCustomSelect({
            id: "mode",
            setting: "mode",
            selectedValue: filters.mode,
            openDropdown: openConfigDropdown,
            options: [
              ["facil", "Fácil"],
              ["medio", "Médio"],
              ["dificil", "Difícil"],
              ["treino", "Modo treino"],
              ["treino-erradas", "Repetir erradas"],
              ["aleatorio", "Perguntas aleatórias"],
              ["favoritas", "Favoritas"],
              ["oficial", "Exame oficial"],
            ],
          })}
        </div>
        <div class="field">
          <label for="category">Categoria</label>
          ${renderCustomSelect({
            id: "category",
            setting: "category",
            selectedValue: filters.category,
            openDropdown: openConfigDropdown,
            options: categories.map((category) => [category, category]),
          })}
        </div>
        <div class="field">
          <label for="difficulty">Dificuldade</label>
          ${renderCustomSelect({
            id: "difficulty",
            setting: "difficulty",
            selectedValue: filters.difficulty,
            openDropdown: openConfigDropdown,
            options: [
              ["todas", "Todas"],
              ["facil", "Fácil"],
              ["medio", "Médio"],
              ["dificil", "Difícil"],
            ],
          })}
        </div>
        <div class="field">
          <label for="quantity">Quantidade de perguntas</label>
          <input
            id="quantity"
            data-setting="quantity"
            type="number"
            min="5"
            max="100"
            value="${isOfficialMode ? 100 : filters.quantity}"
            ${isOfficialMode ? "disabled" : ""}
          >
        </div>
      </div>
      <div class="control-row section-actions">
        <button class="chip-btn ${filters.favoritesOnly ? "is-active" : ""}" type="button" data-action="toggle-favorites-only">Mostrar só favoritas</button>
        <button class="secondary-btn" type="button" data-action="clear-search">Limpar filtros</button>
        <button class="primary-btn" type="button" data-action="start-exam">Começar agora</button>
      </div>
      <p class="hint">Com esta configuração tens ${filteredQuestions.length} pergunta(s) prontas a usar.</p>
    </section>

    <section id="statsSection" class="panel section-panel ${dashboardSection === "stats" ? "" : "is-hidden"}">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Desempenho</p>
          <h2>Estatísticas</h2>
          <p class="muted">Histórico recente, taxa de aprovação e desempenho por categoria.</p>
        </div>
        <button class="ghost-btn" type="button" data-action="open-dashboard-section" data-section="home">Fechar</button>
      </div>
      <div class="summary-grid">
        <article class="summary-card">
          <span class="tiny">Taxa de aprovação</span>
          <strong>${stats.passRate}%</strong>
        </article>
        <article class="summary-card">
          <span class="tiny">Média global</span>
          <strong>${stats.averageScore}%</strong>
        </article>
        <article class="summary-card">
          <span class="tiny">Perguntas validadas respondidas</span>
          <strong>${stats.totalValidatedQuestions}</strong>
        </article>
        <article class="summary-card">
          <span class="tiny">Exames realizados</span>
          <strong>${stats.examsRun}</strong>
        </article>
        <article class="summary-card">
          <span class="tiny">Perguntas importadas</span>
          <strong>${validation.total}</strong>
        </article>
        <article class="summary-card">
          <span class="tiny">Favoritas</span>
          <strong>${favoritesCount}</strong>
        </article>
      </div>
      <div class="banner">Base revista: ${validation.total} perguntas importadas, ${validation.coverage}% com resposta validada e numeração oficial até ${validation.maxNumber}.</div>
      <div class="stats-grid">
        ${renderCategoryPerformance(stats.categoryPerformance)}
      </div>
      <div class="history-list">${historyHtml}</div>
    </section>

    <section id="librarySection" class="panel section-panel ${dashboardSection === "library" ? "" : "is-hidden"}">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Biblioteca</p>
          <h2>Materiais de apoio</h2>
          <p class="muted">Area para PDFs, videos de aulas e resumos adicionados pelo administrador.</p>
        </div>
        <div class="section-heading-actions">
          <span class="metric-pill">${filteredLibraryResources.length} material(is)</span>
          <button class="ghost-btn" type="button" data-action="open-dashboard-section" data-section="home">Fechar</button>
        </div>
      </div>
      <div class="filters-grid compact-grid library-toolbar">
        <div class="field">
          <label for="libraryCategory">Categoria</label>
          ${renderCustomSelect({
            id: "libraryCategory",
            setting: "libraryCategory",
            selectedValue: filters.libraryCategory,
            openDropdown: openConfigDropdown,
            options: [["Todas", "Todas"], ...libraryCategoryOptions.map((category) => [category, category])],
          })}
        </div>
      </div>
      <div class="summary-grid library-summary-grid">
        <article class="summary-card">
          <span class="tiny">PDFs</span>
          <strong>${pdfResources.length}</strong>
        </article>
        <article class="summary-card">
          <span class="tiny">Videos</span>
          <strong>${videoResources.length}</strong>
        </article>
        <article class="summary-card">
          <span class="tiny">Resumos</span>
          <strong>${summaryResources.length}</strong>
        </article>
      </div>
      ${isAdmin ? renderLibraryAdminForm(libraryCategoryOptions) : ""}
      <div class="stats-grid library-groups-grid">
        ${renderLibraryGroup("PDFs", pdfResources)}
        ${renderLibraryGroup("Videos de aulas", videoResources)}
        ${renderLibraryGroup("Resumos", summaryResources)}
      </div>
    </section>

    <section id="favoritesSection" class="panel section-panel ${dashboardSection === "favorites" ? "" : "is-hidden"}">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Favoritos</p>
          <h2>Perguntas favoritas</h2>
          <p class="muted">Aqui aparecem apenas as perguntas que marcaste como favoritas.</p>
        </div>
        <div class="section-heading-actions">
          <span class="metric-pill">${favoritesCount} favorita(s)</span>
          <button class="ghost-btn" type="button" data-action="open-dashboard-section" data-section="home">Fechar</button>
        </div>
      </div>
      <div class="banner">PDF revisto: ${validation.total} perguntas extraídas · numeração oficial até ${validation.maxNumber} · respostas validadas: ${validation.coverage}%</div>
      <div class="search-results">
        ${favoritesHtml || '<p class="muted">Ainda nao existem perguntas favoritas.</p>'}
      </div>
    </section>
  `;
}

export function renderExam(appElement, session, favoriteIds, isAdmin = false) {
  const progress = getSessionProgress(session);
  const question = session.questions[session.currentIndex];
  const timer = formatDuration(Date.now() - session.startedAt);

  const optionHtml = question.displayOptions.map((option, index) => {
    const isSelected = question.selected === index;
    const classNames = ["option-item"];

    if (session.training && Number.isInteger(question.selected)) {
      if (Number.isInteger(question.correta) && index === question.correta) classNames.push("correct");
      if (isSelected && Number.isInteger(question.correta) && index !== question.correta) classNames.push("wrong");
      if (!Number.isInteger(question.correta) && isSelected) classNames.push("pending");
    }

    return `
      <div class="${classNames.join(" ")}">
        <input id="opt-${index}" type="radio" name="currentOption" value="${index}" ${isSelected ? "checked" : ""}>
        <label class="option-label" for="opt-${index}" data-action="answer" data-index="${index}">
          <span class="option-badge">${optionLetter(index)}</span>
          <span>${escapeHtml(option)}</span>
        </label>
      </div>
    `;
  }).join("");

  const feedback = renderTrainingFeedback(session, question);
  const jumps = session.questions.map((item, index) => {
    const classes = ["question-jump"];
    if (index === session.currentIndex) classes.push("current");
    if (Number.isInteger(item.selected)) classes.push("answered");
    if (!item.validada) classes.push("pending");
    return `<button class="${classes.join(" ")}" type="button" data-action="jump" data-index="${index}">${index + 1}</button>`;
  }).join("");

  appElement.innerHTML = `
    <section class="exam-layout">
      <aside class="panel exam-sidebar">
        <div class="meta-row">
          <span class="tag">${labelMode(session.mode)}</span>
          <span class="tag neutral">${escapeHtml(question.categoria)}</span>
        </div>
        <h2>Progresso do exame</h2>
        <p class="muted">${progress.answered} respondidas · ${progress.unanswered} por responder</p>
        <div class="progress-track">
          <div class="progress-bar" style="width: ${progress.percentage}%"></div>
        </div>
        <div class="summary-grid">
          <article class="summary-card">
            <span class="tiny">Pergunta</span>
            <strong>${session.currentIndex + 1}/${progress.total}</strong>
          </article>
          <article class="summary-card">
            <span class="tiny">Cronómetro</span>
            <strong>${timer}</strong>
          </article>
          <article class="summary-card">
            <span class="tiny">Respondidas</span>
            <strong>${progress.answered}</strong>
          </article>
          <article class="summary-card">
            <span class="tiny">Validação pendente</span>
            <strong>${progress.pendingValidation}</strong>
          </article>
        </div>
        <div class="question-nav">${jumps}</div>
      </aside>

      <section class="panel exam-main">
        <div class="question-toolbar" style="justify-content: space-between; align-items: center;">
          <div>
            <p class="eyebrow">Pergunta ${session.currentIndex + 1}</p>
            <h2 class="question-title">${escapeHtml(question.pergunta)}</h2>
          </div>
          <button class="favorite-star-btn ${favoriteIds.has(question.id) ? "is-active" : ""}" type="button" data-action="toggle-favorite" data-id="${question.id}" aria-label="${favoriteIds.has(question.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}">
            <span class="favorite-star-icon">${favoriteIds.has(question.id) ? "★" : "☆"}</span>
            <span class="favorite-star-text">${favoriteIds.has(question.id) ? "Guardada" : "Adicionar"}</span>
          </button>
        </div>
        <div class="meta-row">
          <span class="tag">${escapeHtml(question.categoria)}</span>
          <span class="tag neutral">${escapeHtml(question.dificuldade)}</span>
          ${question.validada ? '<span class="tag success">Resposta validada</span>' : '<span class="tag danger">Resposta pendente de validação</span>'}
        </div>
        <div class="question-card">
          <div class="option-list">${optionHtml}</div>
          ${feedback}
          ${isAdmin ? renderAdminAnswerEditor(question, question.displayOptions) : ""}
        </div>
        <div class="exam-actions" style="margin-top: 20px;">
          <button class="secondary-btn" type="button" data-action="prev-question" ${session.currentIndex === 0 ? "disabled" : ""}>Anterior</button>
          <button class="secondary-btn" type="button" data-action="next-question" ${session.currentIndex === progress.total - 1 ? "disabled" : ""}>Seguinte</button>
          <button class="ghost-btn" type="button" data-action="back-dashboard">Voltar ao menu</button>
          <button class="primary-btn" type="button" data-action="finish-exam">Terminar exame</button>
        </div>
      </section>
    </section>
  `;
}

export function renderResult(appElement, result, isAdmin = false) {
  const reviewHtml = result.review.map((item, index) => {
    const stateClass = item.validada ? (item.isCorrect ? "correct" : "wrong") : "pending";
    const resultLabel = item.validada ? (item.isCorrect ? "Correta" : "Errada") : "Validação pendente";
    const reviewOptions = item.opcoes.map((option, optionIndex) => {
      const classes = ["option-item"];
      if (item.validada && optionIndex === item.correta) classes.push("correct");
      if (item.validada && optionIndex === item.selected && optionIndex !== item.correta) classes.push("wrong");
      if (!item.validada && optionIndex === item.selected) classes.push("pending");
      return `
        <div class="${classes.join(" ")}">
          <div class="option-label">
            <span class="option-badge">${optionLetter(optionIndex)}</span>
            <span>${escapeHtml(option)}</span>
          </div>
        </div>
      `;
    }).join("");

    return `
      <article class="review-card ${stateClass}">
        <div class="review-meta">
          <span class="tag">${escapeHtml(item.categoria)}</span>
          <span class="tag ${item.validada ? (item.isCorrect ? "success" : "danger") : "neutral"}">${resultLabel}</span>
          <span class="tag neutral">Pergunta ${index + 1}</span>
        </div>
        <h3>${escapeHtml(item.pergunta)}</h3>
        <div class="option-list" style="margin-top: 16px;">${reviewOptions}</div>
        <div class="feedback-box ${item.validada ? (item.isCorrect ? "success" : "danger") : "warning"}">
          ${item.validada
            ? `Resposta ${item.isCorrect ? "correta" : "incorreta"}. ${escapeHtml(item.explicacao)}`
            : "Esta pergunta foi importada do PDF, mas a resposta correta ainda não foi validada automaticamente."}
        </div>
        ${isAdmin ? renderAdminAnswerEditor(item, item.opcoes) : ""}
      </article>
    `;
  }).join("");

  appElement.innerHTML = `
    <section class="result-grid">
      <aside class="panel result-panel result-score">
        <div>
          <p class="eyebrow">Resultado final</p>
          <h2 class="result-title">${result.provisional ? "Resultado provisório" : result.passed ? "Aprovado" : "Reprovado"}</h2>
        </div>
        <div class="result-badge">${result.score}%</div>
        <div class="meta-row">
          <span class="status-pill ${result.provisional ? "warning" : result.passed ? "success" : "danger"}">
            ${result.provisional ? "Pontuação parcial" : result.passed ? "Aprovado" : "Reprovado"}
          </span>
        </div>
        <div class="summary-grid">
          <article class="summary-card"><span class="tiny">Corretas</span><strong>${result.correct}</strong></article>
          <article class="summary-card"><span class="tiny">Erradas</span><strong>${result.wrong}</strong></article>
          <article class="summary-card"><span class="tiny">Pendentes</span><strong>${result.pending}</strong></article>
          <article class="summary-card"><span class="tiny">Tempo</span><strong>${formatDuration(result.elapsedMs)}</strong></article>
        </div>
        <p class="muted">Respondidas: ${result.answered}/${result.total}. No exame oficial, a aprovação exige 80% e cobertura integral validada.</p>
        <div class="result-actions">
          <button class="primary-btn" type="button" data-action="restart-dashboard">Novo exame</button>
          <button class="secondary-btn" type="button" data-action="repeat-wrong" ${result.wrongIds.length ? "" : "disabled"}>Repetir erradas</button>
        </div>
      </aside>

      <section class="panel result-panel">
        <h2>Revisão completa</h2>
        <p class="muted">Verde indica opção correta validada; vermelho indica seleção errada; amarelo sinaliza pergunta ainda pendente de validação.</p>
        <div class="review-list">${reviewHtml}</div>
      </section>
    </section>
  `;
}

export function updateResumeButton(button, savedProgress) {
  button.classList.toggle("is-hidden", !savedProgress);
}

export function updateAuthUi({ logoutButton, userBadge, user }) {
  const isAuthenticated = Boolean(user);

  if (logoutButton) {
    logoutButton.classList.toggle("is-hidden", !isAuthenticated);
  }

  if (userBadge) {
    userBadge.classList.toggle("is-hidden", !isAuthenticated);
    userBadge.textContent = isAuthenticated ? `Sessão: ${user.name}` : "";
  }
}

function renderTrainingFeedback(session, question) {
  if (!session.training || !Number.isInteger(question.selected)) {
    return "";
  }

  if (!Number.isInteger(question.correta)) {
    return `<div class="feedback-box warning">A resposta correta desta pergunta ainda não foi validada automaticamente. A pergunta mantém-se disponível para treino e revisão.</div>`;
  }

  const isCorrect = question.selected === question.correta;
  return `
    <div class="feedback-box ${isCorrect ? "success" : "danger"}">
      <strong>${isCorrect ? "Resposta correta." : "Resposta incorreta."}</strong>
      <p>${escapeHtml(question.explicacao)}</p>
    </div>
  `;
}

function renderCategoryPerformance(categoryPerformance) {
  const entries = Object.entries(categoryPerformance || {});
  if (!entries.length) {
    return `
      <article class="stat-card">
        <span class="tiny">Desempenho por categoria</span>
        <strong>Sem dados</strong>
      </article>
    `;
  }

  return entries.map(([category, item]) => `
    <article class="stat-card">
      <span class="tiny">${escapeHtml(category)}</span>
      <strong>${item.attempts ? Math.round((item.correct / item.attempts) * 100) : 0}%</strong>
      <p class="tiny">${item.correct}/${item.attempts} respostas corretas validadas</p>
    </article>
  `).join("");
}

function renderLibraryAdminForm(categories) {
  const categoryOptions = categories.map((category) => `
    <option value="${escapeHtml(category)}">${escapeHtml(category)}</option>
  `).join("");

  return `
    <section class="panel library-admin-panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Admin</p>
          <h3>Adicionar material</h3>
          <p class="muted">Escolhe o ficheiro e a app guarda automaticamente na pasta certa do projeto.</p>
        </div>
      </div>
      <form class="filters-grid compact-grid library-form" data-action="library-resource-form" enctype="multipart/form-data">
        <div class="field">
          <label for="resourceTitle">Titulo</label>
          <input id="resourceTitle" name="title" type="text" placeholder="Opcional para um ficheiro so">
        </div>
        <div class="field">
          <label for="resourceType">Tipo</label>
          <select id="resourceType" class="field-select" name="type">
            <option value="pdf">PDF</option>
            <option value="video">Video</option>
            <option value="summary">Resumo</option>
          </select>
        </div>
        <div class="field">
          <label for="resourceCategory">Categoria</label>
          <select id="resourceCategory" class="field-select" name="category" required>
            <option value="">Selecionar categoria</option>
            ${categoryOptions}
          </select>
        </div>
        <div class="field">
          <label for="resourceFile">Ficheiro</label>
          <input
            id="resourceFile"
            name="file[]"
            type="file"
            accept=".pdf,.doc,.docx,.txt,.rtf,.odt,.ppt,.pptx,.pps,.ppsx,.md,.csv,.xls,.xlsx,.canvas,.mp4,.webm,.ogg,.mov,.m4v"
            multiple
            required
          >
        </div>
        <div class="field">
          <label for="resourceDescription">Descricao</label>
          <input id="resourceDescription" name="description" type="text" placeholder="Opcional">
        </div>
        <div class="control-row section-actions" style="grid-column: 1 / -1;">
          <button class="primary-btn" type="submit">Guardar material</button>
        </div>
      </form>
    </section>
  `;
}

function renderLibraryGroup(title, items) {
  const itemsHtml = items.length
    ? items.map((item) => `
      <tr class="library-table-row">
        <td class="library-col-title" data-label="Material">
          <strong>${escapeHtml(item.title)}</strong>
          <span class="tiny">${escapeHtml(item.description || "Sem descricao adicional.")}</span>
        </td>
        <td class="library-col-category" data-label="Categoria">${escapeHtml(item.category || "Sem categoria")}</td>
        <td class="library-col-date" data-label="Data">${formatDate(item.createdAt)}</td>
        <td class="library-col-action" data-label="Ação">
          <a class="secondary-btn library-open-btn" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Abrir</a>
        </td>
      </tr>
    `).join("")
    : `
      <tr>
        <td colspan="4" class="library-empty">Sem materiais nesta categoria.</td>
      </tr>
    `;

  return `
    <article class="library-group-card">
      <div class="library-group-head">
        <div>
          <span class="tiny">${escapeHtml(title)}</span>
          <strong>${items.length}</strong>
        </div>
      </div>
      <div class="library-table-wrap">
        <table class="library-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Categoria</th>
              <th>Data</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
      </div>
    </article>
  `;
}

function renderCustomSelect({ id, setting, selectedValue, options, openDropdown }) {
  const isOpen = openDropdown === id;
  const selectedLabel = options.find(([value]) => String(value) === String(selectedValue))?.[1] || selectedValue;
  const optionsHtml = options.map(([value, label]) => `
    <button
      class="custom-select-option ${String(value) === String(selectedValue) ? "is-selected" : ""}"
      type="button"
      data-action="select-config-option"
      data-setting="${escapeHtml(setting)}"
      data-value="${escapeHtml(value)}"
    >
      ${escapeHtml(label)}
    </button>
  `).join("");

  return `
    <div class="custom-select ${isOpen ? "is-open" : ""}">
      <button
        id="${escapeHtml(id)}"
        class="custom-select-trigger"
        type="button"
        aria-expanded="${isOpen ? "true" : "false"}"
        data-action="toggle-config-dropdown"
        data-dropdown="${escapeHtml(id)}"
      >
        <span>${escapeHtml(selectedLabel)}</span>
      </button>
      <div class="custom-select-menu ${isOpen ? "is-open" : ""}">
        ${optionsHtml}
      </div>
    </div>
  `;
}

function renderAdminAnswerEditor(question, options) {
  const safeOptions = Array.isArray(options) ? options : [];
  const buttons = safeOptions.map((_, index) => `
    <button
      class="chip-btn ${question.correta === index ? "is-active" : ""}"
      type="button"
      data-action="admin-set-correct"
      data-id="${question.id}"
      data-index="${index}"
    >
      ${question.correta === index ? `Correta: ${optionLetter(index)}` : `Marcar ${optionLetter(index)}`}
    </button>
  `).join("");

  return `
    <section class="admin-answer-panel">
      <p class="tiny admin-answer-title">Admin: alterar resposta correta</p>
      <div class="control-row">${buttons}</div>
    </section>
  `;
}

function labelMode(mode) {
  const labels = {
    facil: "Fácil",
    medio: "Médio",
    dificil: "Difícil",
    treino: "Treino",
    "treino-erradas": "Treino erradas",
    aleatorio: "Aleatório",
    favoritas: "Favoritas",
    oficial: "Exame oficial",
  };
  return labels[mode] || mode;
}

function labelResourceType(type) {
  const labels = {
    pdf: "PDF",
    video: "Video",
    summary: "Resumo",
  };
  return labels[type] || type;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
