// Imports drafted questions into src/data/questions.json.
// Usage: npm run import:questions -- <file.json> [--dry-run]
//
// The input is a JSON array of questions without id and reviewed (both are
// ignored if present, reviewed is always false). All or nothing: any
// validation error or duplicate question text means nothing is written.
const fs = require("fs");
const { validateQuestion, isObject } = require("../src/lib/validateQuestion");
const {
  DEFAULT_QUESTIONS_PATH,
  DEFAULT_CATEGORIES_PATH,
  ROUND_TRIP_ERROR,
  readQuestionsFile,
  writeQuestionsFile,
  readCategoriesFile,
} = require("../src/lib/questionsFile");

const ALLOWED_FIELDS = [
  "id",
  "reviewed",
  "category",
  "type",
  "difficulty",
  "question",
  "answers",
  "explanation",
  "source",
];

// Case-insensitive, whitespace-normalized question text
const normalizeText = (text) =>
  typeof text === "string" ? text.trim().replace(/\s+/g, " ").toLowerCase() : "";

// Canonical field order for new questions, reviewed always false
const toQuestion = (item, id) => {
  const question = {
    id,
    category: item.category,
    type: item.type,
    difficulty: item.difficulty,
    question: item.question,
    answers: Array.isArray(item.answers)
      ? item.answers.map((answer) =>
          isObject(answer) ? { text: answer.text, correct: answer.correct } : answer
        )
      : item.answers,
    explanation: item.explanation,
  };
  if ("source" in item) {
    question.source = item.source;
  }
  question.reviewed = false;
  return question;
};

const highestNumber = (pool, prefix) =>
  pool.reduce((max, q) => {
    const match = isObject(q) && typeof q.id === "string" && q.id.match(/^([a-z]{3})-(\d{3})$/);
    return match && match[1] === prefix ? Math.max(max, Number(match[2])) : max;
  }, 0);

// Pure: returns { errors } or { added, questions } (the merged pool)
const planImport = (pool, input, categories) => {
  if (!Array.isArray(input)) {
    return { errors: ["input must be a JSON array of questions"] };
  }
  const errors = [];
  const prefixOf = Object.fromEntries(categories.map((c) => [c.id, c.prefix]));
  const seenTexts = new Map(
    pool.filter(isObject).map((q) => [normalizeText(q.question), q.id])
  );

  input.forEach((item, index) => {
    const label = `#${index}`;
    if (!isObject(item)) {
      errors.push(`${label}: must be an object`);
      return;
    }
    Object.keys(item)
      .filter((key) => !ALLOWED_FIELDS.includes(key))
      .forEach((key) => errors.push(`${label}: unknown field "${key}"`));

    // Temporary id with the right prefix so validateQuestion can run
    const tempId = `${prefixOf[item.category] || "xxx"}-000`;
    validateQuestion(toQuestion(item, tempId), categories).forEach((problem) =>
      errors.push(`${label}: ${problem}`)
    );

    const key = normalizeText(item.question);
    if (key) {
      if (seenTexts.has(key)) {
        errors.push(`${label}: duplicate question text (same as ${seenTexts.get(key)})`);
      } else {
        seenTexts.set(key, label);
      }
    }
  });
  if (errors.length > 0) {
    return { errors };
  }

  const next = {};
  const added = input.map((item) => {
    const prefix = prefixOf[item.category];
    next[prefix] = (next[prefix] || highestNumber(pool, prefix)) + 1;
    return toQuestion(item, `${prefix}-${String(next[prefix]).padStart(3, "0")}`);
  });
  const overflow = added.filter((q) => Number(q.id.slice(4)) > 999);
  if (overflow.length > 0) {
    return { errors: [`no free ids left for ${overflow.map((q) => q.category).join(", ")}`] };
  }
  return { added, questions: [...pool, ...added] };
};

// Runs the import. Returns an exit code, prints through log/error.
const runImport = ({
  inputPath,
  dryRun = false,
  questionsPath = DEFAULT_QUESTIONS_PATH,
  categoriesPath = DEFAULT_CATEGORIES_PATH,
  log = console.log,
  error = console.error,
}) => {
  if (!inputPath) {
    error("Usage: npm run import:questions -- <file.json> [--dry-run]");
    return 1;
  }
  let input;
  let file;
  let categories;
  try {
    const text = fs.readFileSync(inputPath, "utf8");
    // Drafts may be saved with a BOM by some editors
    input = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
    file = readQuestionsFile(questionsPath);
    categories = readCategoriesFile(categoriesPath);
  } catch (readError) {
    error(`Cannot read input: ${readError.message}`);
    return 1;
  }
  if (!file.roundTrip) {
    error(ROUND_TRIP_ERROR);
    return 1;
  }

  const plan = planImport(file.questions, input, categories);
  if (plan.errors) {
    error(`Found ${plan.errors.length} problem(s), nothing was written:`);
    plan.errors.forEach((problem) => error(`  ${problem}`));
    return 1;
  }

  log(`${dryRun ? "Would add" : "Added"} ${plan.added.length} question(s):`);
  categories.forEach((category) => {
    const count = plan.added.filter((q) => q.category === category.id).length;
    if (count > 0) {
      const ids = plan.added.filter((q) => q.category === category.id).map((q) => q.id);
      log(`  ${category.id}: ${count} (${ids[0]} to ${ids[ids.length - 1]})`);
    }
  });
  log(`New total: ${plan.questions.length} questions.`);
  if (dryRun) {
    log("Dry run: nothing was written.");
    return 0;
  }
  writeQuestionsFile(questionsPath, plan.questions, file.eol);
  return 0;
};

if (require.main === module) {
  const args = process.argv.slice(2);
  process.exitCode = runImport({
    inputPath: args.find((arg) => !arg.startsWith("--")),
    dryRun: args.includes("--dry-run"),
  });
}

module.exports = { normalizeText, planImport, runImport };
