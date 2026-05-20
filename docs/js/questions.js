import { getAnswerOverrides } from "./storage.js";

const CATEGORY_ORDER = [
  "Todas",
  "Legislação",
  "Métodos de Ensino e Pedagogia",
  "Psicologia",
  "Trânsito e Segurança",
  "Veículo e Mecânica",
  "Resumo Bernardo",
];

export async function loadQuestions() {
  const response = await fetch("./data/questions.json");
  if (!response.ok) {
    throw new Error("Não foi possível carregar questions.json");
  }

  const questions = await response.json();
  const overrides = getAnswerOverrides();

  return questions.map((question) => ({
    ...question,
    correta: resolveCorrectAnswer(question, overrides),
    validada: resolveValidation(question, overrides),
    grupoNome: repairText(question.grupoNome),
    categoria: normalizeCategory(repairText(question.categoria)),
    pergunta: repairText(question.pergunta),
    explicacao: resolveExplanation(question, overrides),
    opcoes: Array.isArray(question.opcoes) ? question.opcoes.map((option) => repairText(option)) : [],
    dificuldade: question.dificuldade || "medio",
    favorita: false,
  }));
}

export function normalizeCategory(category) {
  const clean = String(category || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/Legislacao/i.test(clean)) return "Legislação";
  if (/Metodos de Ensino e Pedagogia/i.test(clean)) return "Métodos de Ensino e Pedagogia";
  if (/Psicologia/i.test(clean)) return "Psicologia";
  if (/Transito e Seguranca/i.test(clean)) return "Trânsito e Segurança";
  if (/Veiculo e Mecanica/i.test(clean)) return "Veículo e Mecânica";
  return category || "Trânsito e Segurança";
}

export function getCategories(questions) {
  const set = new Set(CATEGORY_ORDER);
  questions.forEach((question) => set.add(question.categoria));
  return [...set];
}

export function filterQuestions(questions, filters) {
  return questions.filter((question) => {
    const matchesCategory = filters.category === "Todas" || question.categoria === filters.category;
    const matchesDifficulty = filters.difficulty === "todas" || question.dificuldade === filters.difficulty;
    const matchesFavorites = !filters.favoritesOnly || filters.favoriteIds.has(question.id);
    return matchesCategory && matchesDifficulty && matchesFavorites;
  });
}

export function getValidationSummary(questions) {
  const validated = questions.filter((question) => Number.isInteger(question.correta)).length;
  const sequenceNumbers = questions
    .map((question) => Number(question.numero))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const sequenceSet = new Set(sequenceNumbers);
  const minNumber = sequenceNumbers[0] ?? 0;
  const maxNumber = sequenceNumbers[sequenceNumbers.length - 1] ?? 0;
  const missingNumbers = [];

  for (let current = minNumber; current <= maxNumber; current += 1) {
    if (!sequenceSet.has(current)) {
      missingNumbers.push(current);
    }
  }

  return {
    total: questions.length,
    validated,
    coverage: questions.length ? Math.round((validated / questions.length) * 100) : 0,
    minNumber,
    maxNumber,
    missingCount: missingNumbers.length,
  };
}

function repairText(value) {
  const text = String(value || "");
  if (!/[ÃƒÃ‚]/.test(text)) {
    return text;
  }

  try {
    const bytes = Uint8Array.from([...text].map((char) => char.charCodeAt(0)));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return text;
  }
}

function resolveCorrectAnswer(question, overrides) {
  const override = overrides[String(question.id)];
  return Number.isInteger(override?.correta) ? override.correta : question.correta;
}

function resolveValidation(question, overrides) {
  return overrides[String(question.id)] ? true : Boolean(question.validada);
}

function resolveExplanation(question, overrides) {
  if (overrides[String(question.id)]) {
    return "Resposta revista por administrador nesta instalação.";
  }
  return repairText(question.explicacao);
}
