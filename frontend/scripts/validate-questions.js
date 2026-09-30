// Validates src/data/questions.json and src/data/categories.json against the
// question model in CLAUDE.md.
// Usage: npm run validate:questions [-- --require-reviewed]
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "src", "data");
const TYPES = ["single", "multiple", "truefalse"];
const ID_PATTERN = /^[a-z]{3}-\d{3}$/;
const MIN_REVIEWED_PER_CORE_CATEGORY = 5;

const requireReviewed = process.argv.includes("--require-reviewed");

const readJsonArray = (file) => {
  let data;
  try {
    const text = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
    if (text.charCodeAt(0) === 0xfeff) {
      console.error(`${file} starts with a byte order mark (BOM). Save it as UTF-8 without BOM.`);
      process.exit(1);
    }
    data = JSON.parse(text);
  } catch (error) {
    console.error(`Cannot read ${file}: ${error.message}`);
    process.exit(1);
  }
  if (!Array.isArray(data)) {
    console.error(`${file} must contain a JSON array`);
    process.exit(1);
  }
  return data;
};

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim() !== "";

const categories = readJsonArray("categories.json");
const questions = readJsonArray("questions.json");
const errors = [];

// Categories: only what the question checks rely on
const categoryIds = new Set();
categories.forEach((category, index) => {
  const label = `categories.json #${index + 1}`;
  if (!isObject(category)) {
    errors.push(`${label}: must be an object`);
    return;
  }
  if (!isNonEmptyString(category.id)) {
    errors.push(`${label}: id must be a non-empty string`);
  } else if (categoryIds.has(category.id)) {
    errors.push(`${label}: duplicate id "${category.id}"`);
  } else {
    categoryIds.add(category.id);
  }
  if (!isNonEmptyString(category.name)) {
    errors.push(`${label}: name must be a non-empty string`);
  }
  if (typeof category.weight !== "number" || !(category.weight >= 0)) {
    errors.push(`${label}: weight must be a number >= 0`);
  }
  if (typeof category.extra !== "boolean") {
    errors.push(`${label}: extra must be true or false`);
  }
});

// Returns a list of problems for one question
const checkQuestion = (q) => {
  const problems = [];

  if (!isNonEmptyString(q.id) || !ID_PATTERN.test(q.id)) {
    problems.push('id must look like "dbm-001" (3 lowercase letters, dash, 3 digits)');
  }
  if (!categoryIds.has(q.category)) {
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

const seenIds = new Set();
questions.forEach((q, index) => {
  if (!isObject(q)) {
    errors.push(`question #${index + 1}: must be an object`);
    return;
  }
  const label = isNonEmptyString(q.id) ? q.id : `question #${index + 1} (no id)`;
  if (isNonEmptyString(q.id)) {
    if (seenIds.has(q.id)) {
      errors.push(`${label}: duplicate id`);
    }
    seenIds.add(q.id);
  }
  checkQuestion(q).forEach((problem) => errors.push(`${label}: ${problem}`));
});

if (errors.length > 0) {
  console.error(`Found ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`  ${error}`));
  process.exit(1);
}

// Summary table per category
const countRow = (label, list) => ({
  category: label,
  total: list.length,
  reviewed: list.filter((q) => q.reviewed).length,
  single: list.filter((q) => q.type === "single").length,
  multiple: list.filter((q) => q.type === "multiple").length,
  truefalse: list.filter((q) => q.type === "truefalse").length,
});

const categoryRows = categories.map((category) => ({
  ...countRow(
    category.extra ? `${category.id} (extra)` : category.id,
    questions.filter((q) => q.category === category.id)
  ),
  id: category.id,
  extra: category.extra,
}));
const totalRow = countRow("total", questions);

const columns = ["category", "total", "reviewed", "single", "multiple", "truefalse"];
const header = Object.fromEntries(columns.map((column) => [column, column]));
const widths = columns.map((column) =>
  Math.max(...[header, ...categoryRows, totalRow].map((row) => String(row[column]).length))
);
const formatRow = (row) =>
  columns
    .map((column, index) =>
      index === 0
        ? String(row[column]).padEnd(widths[index])
        : String(row[column]).padStart(widths[index])
    )
    .join("  ");
const separator = widths.map((width) => "-".repeat(width)).join("  ");

console.log(formatRow(header));
console.log(separator);
categoryRows.forEach((row) => console.log(formatRow(row)));
console.log(separator);
console.log(formatRow(totalRow));
console.log(`\nOK: ${questions.length} questions pass all checks.`);

if (requireReviewed) {
  const shortCategories = categoryRows.filter(
    (row) => !row.extra && row.reviewed < MIN_REVIEWED_PER_CORE_CATEGORY
  );
  if (shortCategories.length > 0) {
    console.error(
      `\n--require-reviewed: every core category needs at least ${MIN_REVIEWED_PER_CORE_CATEGORY} reviewed questions:`
    );
    shortCategories.forEach((row) =>
      console.error(`  ${row.id}: ${row.reviewed} reviewed`)
    );
    process.exit(1);
  }
  console.log(
    `--require-reviewed: every core category has at least ${MIN_REVIEWED_PER_CORE_CATEGORY} reviewed questions.`
  );
}
