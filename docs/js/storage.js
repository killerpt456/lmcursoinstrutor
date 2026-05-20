const KEYS = {
  theme: "smecpro-theme",
  progress: "smecpro-progress",
  stats: "smecpro-stats",
  favorites: "smecpro-favorites",
  settings: "smecpro-settings",
  auth: "smecpro-auth",
  answerOverrides: "smecpro-answer-overrides",
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function createDefaultStats() {
  return {
    examsRun: 0,
    averageScore: 0,
    passRate: 0,
    totalValidatedQuestions: 0,
    totalCorrectAnswers: 0,
    categoryPerformance: {},
    history: [],
  };
}

export function getTheme() {
  return localStorage.getItem(KEYS.theme) || "light";
}

export function saveTheme(theme) {
  localStorage.setItem(KEYS.theme, theme);
}

export function getFavorites() {
  return readJson(KEYS.favorites, []);
}

export function saveFavorites(favorites) {
  writeJson(KEYS.favorites, [...favorites]);
}

export function getStats() {
  return readJson(KEYS.stats, createDefaultStats());
}

export function saveStats(stats) {
  writeJson(KEYS.stats, stats);
}

export function clearStats() {
  const defaults = createDefaultStats();
  writeJson(KEYS.stats, defaults);
  return defaults;
}

export function getSavedProgress() {
  return readJson(KEYS.progress, null);
}

export function saveProgress(progress) {
  writeJson(KEYS.progress, progress);
}

export function clearProgress() {
  localStorage.removeItem(KEYS.progress);
}

export function getSettings() {
  return readJson(KEYS.settings, {
    mode: "facil",
    category: "Todas",
    difficulty: "todas",
    quantity: 20,
    shuffleOptions: true,
    favoritesOnly: false,
    libraryCategory: "Todas",
  });
}

export function saveSettings(settings) {
  writeJson(KEYS.settings, settings);
}

export function getAuthSession() {
  return readJson(KEYS.auth, null);
}

export function saveAuthSession(user) {
  writeJson(KEYS.auth, user);
}

export function clearAuthSession() {
  localStorage.removeItem(KEYS.auth);
}

export function getAnswerOverrides() {
  return readJson(KEYS.answerOverrides, {});
}

export function saveAnswerOverrides(overrides) {
  writeJson(KEYS.answerOverrides, overrides);
}
