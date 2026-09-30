// Selection, lock and scoring rules for the three question types.
// Pure functions, no React. CommonJS so scripts/test-answer-logic.js can
// require it in plain Node. A selection is an array of answer indexes.

const answersOf = (question) =>
  question && Array.isArray(question.answers) ? question.answers : [];

const getCorrectIndexes = (question) =>
  answersOf(question).reduce(
    (indexes, answer, index) =>
      answer && answer.correct ? [...indexes, index] : indexes,
    []
  );

// Number of answers to select: 1 for single and truefalse, N for multiple
const getRequiredCount = (question) => getCorrectIndexes(question).length;

// Returns a new selection after clicking the answer at index
const toggleSelection = (question, selected, index) => {
  const current = Array.isArray(selected) ? [...selected] : [];
  if (!Number.isInteger(index) || index < 0 || index >= answersOf(question).length) {
    return current;
  }
  if (question.type !== "multiple") {
    return [index];
  }
  if (current.includes(index)) {
    return current.filter((i) => i !== index);
  }
  if (current.length < getRequiredCount(question)) {
    return [...current, index];
  }
  return current;
};

const canLock = (question, selected) => {
  const required = getRequiredCount(question);
  return required > 0 && Array.isArray(selected) && selected.length === required;
};

// All or nothing: the selection must be exactly the correct set
const isCorrect = (question, selected) => {
  if (!Array.isArray(selected)) {
    return false;
  }
  const correct = getCorrectIndexes(question);
  const unique = new Set(selected);
  return (
    unique.size === selected.length &&
    unique.size === correct.length &&
    correct.every((index) => unique.has(index))
  );
};

// One state per answer for the reveal: "correct" for every correct answer
// (also the missed ones), "wrong" for a selected wrong answer, else "neutral"
const getAnswerStates = (question, selected) => {
  const chosen = Array.isArray(selected) ? selected : [];
  return answersOf(question).map((answer, index) =>
    answer && answer.correct
      ? "correct"
      : chosen.includes(index)
      ? "wrong"
      : "neutral"
  );
};

module.exports = {
  getCorrectIndexes,
  getRequiredCount,
  toggleSelection,
  canLock,
  isCorrect,
  getAnswerStates,
};
