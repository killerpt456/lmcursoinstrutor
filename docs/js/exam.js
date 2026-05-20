function shuffleArray(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function pickRandom(questions, quantity) {
  return shuffleArray(questions).slice(0, Math.min(quantity, questions.length));
}

function prepareQuestion(question, shuffleOptions) {
  const optionEntries = question.opcoes.map((text, index) => ({ text, originalIndex: index }));
  const displayEntries = shuffleOptions ? shuffleArray(optionEntries) : optionEntries;
  const displayOptions = displayEntries.map((entry) => entry.text);
  const mappedCorrect =
    Number.isInteger(question.correta)
      ? displayEntries.findIndex((entry) => entry.originalIndex === question.correta)
      : null;

  return {
    ...question,
    corretaOriginal: question.correta,
    correta: mappedCorrect,
    displayOptions,
    optionMap: displayEntries.map((entry) => entry.originalIndex),
    selected: null,
  };
}

export function buildQuestionPool(questions, settings, state) {
  if (settings.mode === "oficial") {
    return shuffleArray(questions);
  }

  if (settings.mode === "treino-erradas") {
    const wrongIds = new Set(state.lastWrongIds || []);
    return questions.filter((question) => wrongIds.has(question.id));
  }

  if (settings.mode === "favoritas") {
    const favoriteIds = new Set(state.favoriteIds || []);
    return questions.filter((question) => favoriteIds.has(question.id));
  }

  return questions;
}

export function createExamSession(pool, settings) {
  const quantity = settings.mode === "oficial" ? 100 : Number(settings.quantity) || 20;
  const selectedPool = settings.mode === "aleatorio" || settings.mode === "oficial"
    ? pickRandom(pool, quantity)
    : pickRandom(pool, quantity);

  return {
    id: `exam-${Date.now()}`,
    mode: settings.mode,
    category: settings.category,
    difficulty: settings.mode === "oficial" ? "misto" : settings.difficulty,
    quantity: Math.min(quantity, selectedPool.length),
    shuffleOptions: Boolean(settings.shuffleOptions),
    training: settings.mode === "treino" || settings.mode === "treino-erradas",
    currentIndex: 0,
    startedAt: Date.now(),
    completedAt: null,
    elapsedMs: 0,
    finished: false,
    questions: selectedPool.map((question) => prepareQuestion(question, Boolean(settings.shuffleOptions))),
  };
}

export function answerQuestion(session, questionIndex, selectedIndex) {
  const question = session.questions[questionIndex];
  if (!question) return session;
  question.selected = selectedIndex;
  return session;
}

export function goToQuestion(session, nextIndex) {
  if (nextIndex < 0 || nextIndex >= session.questions.length) return session;
  session.currentIndex = nextIndex;
  return session;
}

export function getSessionProgress(session) {
  const answered = session.questions.filter((question) => Number.isInteger(question.selected)).length;
  const validated = session.questions.filter((question) => Number.isInteger(question.correta)).length;
  return {
    answered,
    total: session.questions.length,
    unanswered: session.questions.length - answered,
    validated,
    pendingValidation: session.questions.length - validated,
    percentage: session.questions.length ? Math.round((answered / session.questions.length) * 100) : 0,
  };
}

export function finalizeSession(session) {
  session.finished = true;
  session.completedAt = Date.now();
  session.elapsedMs = session.completedAt - session.startedAt;

  const review = session.questions.map((question, index) => {
    const hasValidatedAnswer = Number.isInteger(question.correta);
    const isCorrect = hasValidatedAnswer && question.selected === question.correta;

    return {
      index,
      id: question.id,
      categoria: question.categoria,
      pergunta: question.pergunta,
      opcoes: question.displayOptions,
      selected: question.selected,
      correta: question.correta,
      explicacao: question.explicacao,
      validada: hasValidatedAnswer,
      isCorrect: hasValidatedAnswer ? isCorrect : null,
    };
  });

  const validatedReview = review.filter((item) => item.validada);
  const correct = validatedReview.filter((item) => item.isCorrect).length;
  const wrong = validatedReview.filter((item) => item.isCorrect === false).length;
  const pending = review.length - validatedReview.length;
  const score = validatedReview.length ? Math.round((correct / validatedReview.length) * 100) : 0;
  const passed = session.mode === "oficial" ? score >= 80 && pending === 0 : score >= 70 && pending === 0;

  return {
    sessionId: session.id,
    mode: session.mode,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    elapsedMs: session.elapsedMs,
    score,
    passed,
    correct,
    wrong,
    pending,
    answered: review.filter((item) => Number.isInteger(item.selected)).length,
    total: review.length,
    review,
    wrongIds: review.filter((item) => item.isCorrect === false).map((item) => item.id),
    provisional: pending > 0,
  };
}

export function serializeSession(session) {
  return JSON.parse(JSON.stringify(session));
}

export function deserializeSession(savedSession) {
  return savedSession;
}

export function formatDuration(elapsedMs) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const padded = [minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
  return hours ? `${String(hours).padStart(2, "0")}:${padded}` : padded;
}
