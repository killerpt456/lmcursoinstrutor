import { authenticateUser } from "./auth.js";
import {
  answerQuestion,
  buildQuestionPool,
  createExamSession,
  deserializeSession,
  finalizeSession,
  goToQuestion,
  serializeSession,
} from "./exam.js";
import { filterQuestions, getCategories, getValidationSummary, loadQuestions } from "./questions.js";
import {
  clearAuthSession,
  clearProgress,
  clearStats,
  getAnswerOverrides,
  getAuthSession,
  getFavorites,
  getSavedProgress,
  getSettings,
  getStats,
  getTheme,
  saveAnswerOverrides,
  saveAuthSession,
  saveFavorites,
  saveProgress,
  saveSettings,
  saveStats,
  saveTheme,
} from "./storage.js";
import { renderDashboard, renderExam, renderLoading, renderLogin, renderResult, updateAuthUi, updateResumeButton } from "./ui.js";

const appElement = document.getElementById("app");
const resumeExamBtn = document.getElementById("resumeExamBtn");
const themeToggle = document.getElementById("themeToggle");
const navToggle = document.getElementById("navToggle");
const logoutBtn = document.getElementById("logoutBtn");
const userBadge = document.getElementById("userBadge");
const topbarNav = document.getElementById("topbarNav");
const topbarSectionButtons = [...document.querySelectorAll("[data-dashboard-section]")];
let examTickerId = null;

const state = {
  allQuestions: [],
  filteredQuestions: [],
  categories: [],
  filters: getSettings(),
  stats: getStats(),
  favoriteIds: new Set(getFavorites()),
  activeSession: null,
  lastResult: null,
  lastWrongIds: [],
  savedProgress: getSavedProgress(),
  dashboardSection: "setup",
  openConfigDropdown: null,
  authUser: getAuthSession(),
  authError: "",
  dataReady: false,
  answerOverrides: getAnswerOverrides(),
  libraryResources: [],
};

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === "dark" ? "Modo claro" : "Modo escuro";
}

function setNavOpen(isOpen) {
  navToggle?.setAttribute("aria-expanded", String(isOpen));
  topbarNav?.classList.toggle("is-open", isOpen);
}

function syncSectionButtons() {
  topbarSectionButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.dashboardSection === state.dashboardSection);
  });
}

function syncExamTicker() {
  const needsTicker = Boolean(state.activeSession) && !state.lastResult;

  if (needsTicker && !examTickerId) {
    examTickerId = window.setInterval(() => {
      if (!state.activeSession || state.lastResult) {
        syncExamTicker();
        return;
      }
      render();
    }, 1000);
  }

  if (!needsTicker && examTickerId) {
    window.clearInterval(examTickerId);
    examTickerId = null;
  }
}

function isAdmin() {
  return state.authUser?.role === "admin";
}

function showDialog({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  showCancel = true,
}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";
    overlay.innerHTML = `
      <div class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialogTitle">
        <p id="dialogTitle" class="dialog-title">${title}</p>
        <p class="dialog-message">${message}</p>
        <div class="dialog-actions">
          ${showCancel ? `<button class="ghost-btn" type="button" data-dialog-action="cancel">${cancelLabel}</button>` : ""}
          <button class="${tone === "danger" ? "secondary-btn dialog-danger" : "primary-btn"}" type="button" data-dialog-action="confirm">${confirmLabel}</button>
        </div>
      </div>
    `;

    const close = (value) => {
      document.removeEventListener("keydown", handleKeydown);
      overlay.remove();
      resolve(value);
    };

    const handleKeydown = (event) => {
      if (event.key === "Escape" && showCancel) close(false);
      if (event.key === "Enter") close(true);
    };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay && showCancel) {
        close(false);
        return;
      }

      const action = event.target.closest("[data-dialog-action]")?.dataset.dialogAction;
      if (action === "confirm") close(true);
      if (action === "cancel") close(false);
    });

    document.addEventListener("keydown", handleKeydown);
    document.body.appendChild(overlay);
    overlay.querySelector("[data-dialog-action='confirm']")?.focus();
  });
}

async function openDashboardSection(section) {
  if (state.activeSession) {
    const leaveExam = await showDialog({
      title: "Sair do exame?",
      message: "O progresso atual fica guardado automaticamente para retomar mais tarde.",
      confirmLabel: "Sair",
      cancelLabel: "Continuar exame",
    });
    if (!leaveExam) return;
  }
  state.lastResult = null;
  state.activeSession = null;
  state.dashboardSection = section;
  state.openConfigDropdown = null;
  render();
}

async function init() {
  applyTheme(getTheme());
  updateAuthUi({ logoutButton: logoutBtn, userBadge, user: state.authUser });

  if (!state.authUser) {
    render();
    return;
  }

  renderLoading(appElement);
  await loadAppData();
}

async function loadAppData() {
  if (state.dataReady) {
    render();
    return;
  }

  try {
    state.filters.search = "";
    if (typeof state.filters.shuffleOptions !== "boolean") {
      state.filters.shuffleOptions = true;
    }
    if (!state.filters.libraryCategory) {
      state.filters.libraryCategory = "Todas";
    }
    saveSettings(state.filters);

    state.allQuestions = await loadQuestions();
    state.categories = getCategories(state.allQuestions);
    try {
      state.libraryResources = await loadLibraryResources();
    } catch {
      state.libraryResources = [];
    }
    refreshFilteredQuestions();

    if (state.savedProgress) {
      state.activeSession = deserializeSession(state.savedProgress);
    }

    state.dataReady = true;
    render();
  } catch (error) {
    appElement.innerHTML = `
      <section class="panel hero">
        <div>
          <p class="eyebrow">Erro de carregamento</p>
          <h2>Não foi possível inicializar o sistema.</h2>
          <p>${error.message}</p>
        </div>
      </section>
    `;
  }
}

async function loadLibraryResources() {
  try {
    const response = await fetch("./api/library.php", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("API indisponivel");
    }

    const resources = await response.json();
    return Array.isArray(resources) ? resources : [];
  } catch {
    const fallbackResponse = await fetch("./data/library-resources.json", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!fallbackResponse.ok) {
      throw new Error("Nao foi possivel carregar a biblioteca.");
    }

    const fallbackResources = await fallbackResponse.json();
    return Array.isArray(fallbackResources) ? fallbackResources : [];
  }
}

function refreshFilteredQuestions() {
  const effectiveFilters = {
    ...state.filters,
    favoriteIds: state.favoriteIds,
  };

  let difficulty = effectiveFilters.difficulty;
  if (effectiveFilters.mode === "facil") difficulty = "facil";
  if (effectiveFilters.mode === "medio") difficulty = "medio";
  if (effectiveFilters.mode === "dificil") difficulty = "dificil";
  if (["oficial", "treino", "treino-erradas", "aleatorio", "favoritas"].includes(effectiveFilters.mode)) {
    difficulty = effectiveFilters.difficulty;
  }

  state.filteredQuestions = filterQuestions(state.allQuestions, {
    ...effectiveFilters,
    difficulty,
  });
}

function render() {
  updateAuthUi({ logoutButton: logoutBtn, userBadge, user: state.authUser });
  updateResumeButton(resumeExamBtn, state.authUser && (state.savedProgress || state.activeSession));

  if (!state.authUser) {
    renderLogin(appElement, {
      error: state.authError,
    });
    return;
  }

  setNavOpen(false);
  syncSectionButtons();
  syncExamTicker();

  if (state.lastResult) {
    renderResult(appElement, state.lastResult, isAdmin());
    return;
  }

  if (state.activeSession) {
    renderExam(appElement, state.activeSession, state.favoriteIds, isAdmin());
    return;
  }

  renderDashboard(appElement, {
    filters: state.filters,
    categories: state.categories,
    filteredQuestions: state.filteredQuestions,
    favoriteQuestions: state.allQuestions.filter((question) => state.favoriteIds.has(question.id)),
    libraryResources: state.libraryResources,
    stats: state.stats,
    validation: getValidationSummary(state.allQuestions),
    favoritesCount: state.favoriteIds.size,
    favoriteIds: state.favoriteIds,
    savedProgress: state.savedProgress,
    dashboardSection: state.dashboardSection,
    openConfigDropdown: state.openConfigDropdown,
    isAdmin: isAdmin(),
  });
}

async function login(username, password) {
  const user = await authenticateUser(username, password);

  if (!user) {
    state.authError = "Utilizador ou palavra-passe inválidos.";
    render();
    return;
  }

  state.authUser = user;
  state.authError = "";
  saveAuthSession(user);
  renderLoading(appElement);
  await loadAppData();
}

function logout() {
  state.authUser = null;
  state.authError = "";
  state.activeSession = null;
  state.lastResult = null;
  clearAuthSession();
  setNavOpen(false);
  render();
}

async function startExam() {
  refreshFilteredQuestions();
  const pool = buildQuestionPool(state.filteredQuestions, state.filters, state);

  if (!pool.length) {
    await showDialog({
      title: "Sem perguntas disponíveis",
      message: "Não existem perguntas disponíveis com os filtros atuais.",
      confirmLabel: "Fechar",
      showCancel: false,
    });
    return;
  }

  state.lastResult = null;
  state.activeSession = createExamSession(pool, state.filters);
  persistProgress();
  render();
}

async function finishExam() {
  if (!state.activeSession) return;
  const unanswered = state.activeSession.questions.filter((question) => !Number.isInteger(question.selected)).length;
  const message = unanswered
    ? `Ainda existem ${unanswered} pergunta(s) sem resposta. Pretendes terminar o exame?`
    : "Pretendes terminar o exame agora?";

  const shouldFinish = await showDialog({
    title: "Terminar exame?",
    message,
    confirmLabel: "Terminar",
    cancelLabel: "Continuar",
  });
  if (!shouldFinish) return;

  const result = finalizeSession(state.activeSession);
  state.lastWrongIds = result.wrongIds;
  state.lastResult = result;
  state.activeSession = null;
  state.savedProgress = null;
  clearProgress();
  updateStats(result);
  render();
}

function updateStats(result) {
  const nextStats = JSON.parse(JSON.stringify(state.stats));
  nextStats.examsRun += 1;
  nextStats.totalValidatedQuestions += result.correct + result.wrong;
  nextStats.totalCorrectAnswers += result.correct;
  nextStats.averageScore = Math.round(
    ((nextStats.averageScore * (nextStats.examsRun - 1)) + result.score) / nextStats.examsRun,
  );
  const fullPasses = nextStats.history.filter((item) => item.passed).length + (result.passed ? 1 : 0);
  nextStats.passRate = Math.round((fullPasses / nextStats.examsRun) * 100);

  result.review.forEach((item) => {
    if (!item.validada) return;
    if (!nextStats.categoryPerformance[item.categoria]) {
      nextStats.categoryPerformance[item.categoria] = { attempts: 0, correct: 0 };
    }
    nextStats.categoryPerformance[item.categoria].attempts += 1;
    if (item.isCorrect) nextStats.categoryPerformance[item.categoria].correct += 1;
  });

  nextStats.history.unshift({
    mode: result.mode,
    score: result.score,
    passed: result.passed,
    provisional: result.provisional,
    correct: result.correct,
    wrong: result.wrong,
    pending: result.pending,
    elapsedMs: result.elapsedMs,
    completedAt: result.completedAt,
  });
  nextStats.history = nextStats.history.slice(0, 12);

  state.stats = nextStats;
  saveStats(state.stats);
}

async function resetStats() {
  const shouldReset = await showDialog({
    title: "Repor estatísticas?",
    message: "O histórico de exames e todos os indicadores serão colocados a zero.",
    confirmLabel: "Repor",
    cancelLabel: "Cancelar",
    tone: "danger",
  });
  if (!shouldReset) return;

  state.stats = clearStats();
  render();
}

function persistProgress() {
  if (!state.activeSession) return;
  const snapshot = serializeSession(state.activeSession);
  saveProgress(snapshot);
  state.savedProgress = snapshot;
}

function updateSetting(field, value) {
  if (field === "mode") {
    state.filters.mode = value;
    if (value === "oficial") {
      state.filters.quantity = 100;
    }
  } else if (field === "quantity") {
    if (state.filters.mode === "oficial") {
      state.filters.quantity = 100;
    } else {
      state.filters.quantity = Math.max(5, Math.min(100, Number(value) || 20));
    }
  } else if (field === "shuffleOptions") {
    state.filters.shuffleOptions = value === "true";
  } else {
    state.filters[field] = value;
  }

  if (state.filters.mode === "oficial") {
    state.filters.quantity = 100;
  }

  saveSettings(state.filters);
  refreshFilteredQuestions();
  state.openConfigDropdown = null;
  render();
}

function toggleFavorite(questionId) {
  if (state.favoriteIds.has(questionId)) {
    state.favoriteIds.delete(questionId);
  } else {
    state.favoriteIds.add(questionId);
  }
  saveFavorites(state.favoriteIds);
  refreshFilteredQuestions();
  render();
}

function addLibraryResource(formData) {
  formData.set("createdBy", state.authUser?.username || "admin");
  return fetch("./api/library.php", {
    method: "POST",
    body: formData,
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel guardar o material.");
      }

      const createdResources = Array.isArray(payload) ? payload : [payload];
      state.libraryResources = [...createdResources, ...state.libraryResources];
      render();
      return true;
    });
}

function setAdminCorrectAnswer(questionId, originalCorrectIndex) {
  const key = String(questionId);
  state.answerOverrides[key] = {
    correta: originalCorrectIndex,
    updatedAt: Date.now(),
    updatedBy: state.authUser?.username || "admin",
  };
  saveAnswerOverrides(state.answerOverrides);

  const applyToQuestion = (question) => {
    if (!question || Number(question.id) !== Number(questionId)) return;
    question.validada = true;
    question.explicacao = "Resposta revista por administrador nesta instalação.";

    if (Array.isArray(question.optionMap)) {
      const displayCorrectIndex = question.optionMap.findIndex((value) => value === originalCorrectIndex);
      question.corretaOriginal = originalCorrectIndex;
      question.correta = displayCorrectIndex >= 0 ? displayCorrectIndex : originalCorrectIndex;
      return;
    }

    question.correta = originalCorrectIndex;
  };

  state.allQuestions.forEach(applyToQuestion);
  state.filteredQuestions.forEach(applyToQuestion);
  state.activeSession?.questions.forEach(applyToQuestion);

  if (state.lastResult?.review) {
    state.lastResult.review.forEach((item) => {
      if (Number(item.id) !== Number(questionId)) return;
      item.correta = originalCorrectIndex;
      item.validada = true;
      item.explicacao = "Resposta revista por administrador nesta instalação.";
      item.isCorrect = Number.isInteger(item.selected) ? item.selected === originalCorrectIndex : null;
    });

    state.lastResult.correct = state.lastResult.review.filter((item) => item.isCorrect === true).length;
    state.lastResult.wrong = state.lastResult.review.filter((item) => item.isCorrect === false).length;
    state.lastResult.pending = state.lastResult.review.filter((item) => !item.validada).length;

    const validatedCount = state.lastResult.review.filter((item) => item.validada).length;
    state.lastResult.score = validatedCount
      ? Math.round((state.lastResult.correct / validatedCount) * 100)
      : 0;
    state.lastResult.provisional = state.lastResult.pending > 0;
    state.lastResult.passed = state.lastResult.mode === "oficial"
      ? state.lastResult.score >= 80 && state.lastResult.pending === 0
      : state.lastResult.score >= 70 && state.lastResult.pending === 0;
    state.lastResult.wrongIds = state.lastResult.review
      .filter((item) => item.isCorrect === false)
      .map((item) => item.id);
  }
}

function resumeSavedExam() {
  if (!state.savedProgress) return;
  state.lastResult = null;
  state.activeSession = deserializeSession(state.savedProgress);
  render();
}

appElement.addEventListener("click", async (event) => {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) return;
  const { action } = trigger.dataset;

  if (action === "open-dashboard-section") await openDashboardSection(trigger.dataset.section || "setup");
  if (action === "toggle-config-dropdown") {
    const dropdown = trigger.dataset.dropdown || null;
    state.openConfigDropdown = state.openConfigDropdown === dropdown ? null : dropdown;
    render();
  }
  if (action === "select-config-option") {
    updateSetting(trigger.dataset.setting, trigger.dataset.value);
  }
  if (action === "start-exam") await startExam();
  if (action === "finish-exam") await finishExam();
  if (action === "prev-question" && state.activeSession) {
    goToQuestion(state.activeSession, state.activeSession.currentIndex - 1);
    persistProgress();
    render();
  }
  if (action === "next-question" && state.activeSession) {
    goToQuestion(state.activeSession, state.activeSession.currentIndex + 1);
    persistProgress();
    render();
  }
  if (action === "jump" && state.activeSession) {
    goToQuestion(state.activeSession, Number(trigger.dataset.index));
    persistProgress();
    render();
  }
  if (action === "answer" && state.activeSession) {
    answerQuestion(state.activeSession, state.activeSession.currentIndex, Number(trigger.dataset.index));
    persistProgress();
    render();
  }
  if (action === "back-dashboard") {
    const leaveExam = await showDialog({
      title: "Voltar ao menu?",
      message: "O progresso atual fica guardado automaticamente para retomar mais tarde.",
      confirmLabel: "Voltar ao menu",
      cancelLabel: "Continuar exame",
    });
    if (!leaveExam) return;
    state.activeSession = null;
    state.dashboardSection = "setup";
    render();
  }
  if (action === "restart-dashboard") {
    state.lastResult = null;
    state.dashboardSection = "setup";
    render();
  }
  if (action === "repeat-wrong") {
    state.lastResult = null;
    state.dashboardSection = "setup";
    state.filters.mode = "treino-erradas";
    saveSettings(state.filters);
    await startExam();
  }
  if (action === "toggle-favorites-only") {
    state.filters.favoritesOnly = !state.filters.favoritesOnly;
    saveSettings(state.filters);
    refreshFilteredQuestions();
    render();
  }
  if (action === "reset-stats") {
    await resetStats();
  }
  if (action === "clear-search") {
    state.filters.search = "";
    state.filters.favoritesOnly = false;
    saveSettings(state.filters);
    refreshFilteredQuestions();
    render();
  }
  if (action === "toggle-favorite") {
    toggleFavorite(Number(trigger.dataset.id));
  }
  if (action === "admin-set-correct" && isAdmin()) {
    const questionId = Number(trigger.dataset.id);
    const displayIndex = Number(trigger.dataset.index);
    let correctIndex = displayIndex;

    if (state.activeSession) {
      const currentQuestion = state.activeSession.questions[state.activeSession.currentIndex];
      if (currentQuestion && currentQuestion.id === questionId && Array.isArray(currentQuestion.optionMap)) {
        correctIndex = currentQuestion.optionMap[displayIndex];
      }
    }

    setAdminCorrectAnswer(questionId, correctIndex);
    persistProgress();
    render();
  }
});

appElement.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-action='login-form']");
  if (form) {
    event.preventDefault();
    const formData = new FormData(form);
    const username = String(formData.get("username") || "");
    const password = String(formData.get("password") || "");
    await login(username, password);
    return;
  }

  const libraryForm = event.target.closest("[data-action='library-resource-form']");
  if (libraryForm && isAdmin()) {
    event.preventDefault();
    try {
      const saved = await addLibraryResource(new FormData(libraryForm));
      if (saved) {
        libraryForm.reset();
      }
    } catch (error) {
      await showDialog({
        title: "Erro ao guardar material",
        message: error.message,
        confirmLabel: "Fechar",
        showCancel: false,
      });
    }
  }
});

appElement.addEventListener("change", (event) => {
  const field = event.target.dataset.setting;
  if (!field) return;
  updateSetting(field, event.target.value);
});

document.addEventListener("click", (event) => {
  if (!state.openConfigDropdown) return;
  if (event.target.closest(".custom-select")) return;
  state.openConfigDropdown = null;
  render();
});

resumeExamBtn.addEventListener("click", resumeSavedExam);

themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  saveTheme(nextTheme);
});

logoutBtn?.addEventListener("click", logout);

navToggle?.addEventListener("click", () => {
  const isOpen = navToggle.getAttribute("aria-expanded") === "true";
  setNavOpen(!isOpen);
});

topbarNav?.addEventListener("click", async (event) => {
  const sectionButton = event.target.closest("[data-dashboard-section]");
  if (sectionButton) {
    await openDashboardSection(sectionButton.dataset.dashboardSection || "home");
  }

  if (event.target.closest("button")) {
    setNavOpen(false);
  }
});

window.addEventListener("beforeunload", () => {
  if (state.activeSession) {
    persistProgress();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 720) {
    setNavOpen(false);
  }
});

init();
