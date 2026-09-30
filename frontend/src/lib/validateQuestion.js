// Per-question checks for the question model in CLAUDE.md.
// Shared by scripts/validate-questions.js (Node) and the run builder (browser),
// so it stays CommonJS without dependencies.

const TYPES = ["single", "multiple", "truefalse"];
const ID_PATTERN = /^[a-z]{3}-\d{3}$/;

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim() !== "";

// Returns a list of problems for one question. An empty list means valid.
// Cross-question checks (duplicate ids) are left to the caller.
const validateQuestion = (q, categories) => {
  if (!isObject(q)) {
    return ["must be an object"];
  }

  const problems = [];
  const category = Array.isArray(categories)
    ? categories.find((c) => isObject(c) && c.id === q.category)
    : undefined;

  if (!isNonEmptyString(q.id) || !ID_PATTERN.test(q.id)) {
    problems.push('id must look like "dbm-001" (3 lowercase letters, dash, 3 digits)');
  } else if (category && q.id.slice(0, 3) !== category.prefix) {
    problems.push(
      `id prefix "${q.id.slice(0, 3)}" does not match category prefix "${category.prefix}"`
    );
  }
  if (!category) {
    problems.push(`unknown category "${q.category}"`);
  }
  if (!TYPES.includes(q.type)) {
    problems.push(`type must be one of ${TYPES.join(", ")}, got "${q.type}"`);
  }
  if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 3) {
    problems.push("difficulty must be an integer 1-3");
  }
  if (!isNonEmptyString(q.question)) {
    problems.push("question must be a non-empty string");
  }
  if (!isNonEmptyString(q.explanation)) {
    problems.push("explanation must be a non-empty string");
  }
  if (typeof q.reviewed !== "boolean") {
    problems.push("reviewed must be true or false");
  }

  if (!Array.isArray(q.answers) || q.answers.length === 0) {
    problems.push("answers must be a non-empty array");
    return problems;
  }

  let answersValid = true;
  const seenTexts = new Set();
  q.answers.forEach((answer, index) => {
    const label = `answer ${index + 1}`;
    if (!isObject(answer)) {
      problems.push(`${label} must be an object`);
      answersValid = false;
      return;
    }
    if (!isNonEmptyString(answer.text)) {
      problems.push(`${label}: text must be a non-empty string`);
      answersValid = false;
    } else {
      const key = answer.text.trim().toLowerCase();
      if (seenTexts.has(key)) {
        problems.push(`duplicate answer text "${answer.text}"`);
      }
      seenTexts.add(key);
    }
    if (typeof answer.correct !== "boolean") {
      problems.push(`${label}: correct must be true or false`);
      answersValid = false;
    }
  });

  // Per-type rules need well-formed answers and a known type
  if (!answersValid || !TYPES.includes(q.type)) {
    return problems;
  }

  const total = q.answers.length;
  const correct = q.answers.filter((answer) => answer.correct).length;

  if (q.type === "single") {
    if (total !== 4) {
      problems.push(`single needs 4 answers, has ${total}`);
    }
    if (correct !== 1) {
      problems.push(`single needs exactly 1 correct answer, has ${correct}`);
    }
  } else if (q.type === "multiple") {
    if (total < 5 || total > 6) {
      problems.push(`multiple needs 5-6 answers, has ${total}`);
    }
    if (correct < 2) {
      problems.push(`multiple needs at least 2 correct answers, has ${correct}`);
    }
    if (correct === total) {
      problems.push("multiple needs at least 1 wrong answer");
    }
  } else {
    const texts = q.answers.map((answer) => answer.text).sort().join(",");
    if (texts !== "False,True") {
      problems.push('truefalse needs exactly the answers "True" and "False"');
    }
    if (correct !== 1) {
      problems.push(`truefalse needs exactly 1 correct answer, has ${correct}`);
    }
  }

  return problems;
};

module.exports = { validateQuestion, isObject, isNonEmptyString };
