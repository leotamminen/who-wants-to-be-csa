// Review helper for src/data/questions.json.
// Usage:
//   npm run review -- list [category-id]   unreviewed questions, compact
//   npm run review -- mark <id>...         set reviewed: true (Leo only)
//   npm run review -- unmark <id>...       set reviewed: false
//   npm run review -- status               counts and Phase 10 targets
const {
  DEFAULT_QUESTIONS_PATH,
  DEFAULT_CATEGORIES_PATH,
  ROUND_TRIP_ERROR,
  readQuestionsFile,
  writeQuestionsFile,
  readCategoriesFile,
} = require("../src/lib/questionsFile");
const {
  listUnreviewed,
  formatQuestion,
  setReviewed,
  getStatus,
  formatStatus,
} = require("../src/lib/reviewLogic");

const USAGE =
  "Usage: npm run review -- list [category-id] | mark <id>... | unmark <id>... | status";

// Runs one command. Returns an exit code, prints through log/error.
const runReview = (
  args,
  {
    questionsPath = DEFAULT_QUESTIONS_PATH,
    categoriesPath = DEFAULT_CATEGORIES_PATH,
    log = console.log,
    error = console.error,
  } = {}
) => {
  const [command, ...rest] = args;
  let file;
  let categories;
  try {
    file = readQuestionsFile(questionsPath);
    categories = readCategoriesFile(categoriesPath);
  } catch (readError) {
    error(`Cannot read data: ${readError.message}`);
    return 1;
  }

  if (command === "list") {
    const categoryId = rest[0];
    if (categoryId && !categories.some((c) => c.id === categoryId)) {
      error(`Unknown category "${categoryId}". Known: ${categories.map((c) => c.id).join(", ")}`);
      return 1;
    }
    const questions = listUnreviewed(file.questions, categoryId);
    questions.forEach((q) => log(`${formatQuestion(q)}\n`));
    log(`${questions.length} unreviewed question(s)${categoryId ? ` in ${categoryId}` : ""}.`);
    return 0;
  }

  if (command === "mark" || command === "unmark") {
    if (!file.roundTrip) {
      error(ROUND_TRIP_ERROR);
      return 1;
    }
    const result = setReviewed(file.questions, rest, command === "mark");
    if (result.errors) {
      error(`Nothing was written:`);
      result.errors.forEach((problem) => error(`  ${problem}`));
      return 1;
    }
    if (result.changed.length > 0) {
      writeQuestionsFile(questionsPath, result.questions, file.eol);
    }
    const state = command === "mark" ? "reviewed" : "unreviewed";
    log(`${result.changed.length} question(s) set to ${state}: ${result.changed.join(", ") || "-"}`);
    if (result.unchanged.length > 0) {
      log(`Already ${state}: ${result.unchanged.join(", ")}`);
    }
    return 0;
  }

  if (command === "status") {
    log(formatStatus(getStatus(file.questions, categories)));
    log("\ngap = reviewed questions still missing to reach the Phase 10 target");
    return 0;
  }

  error(USAGE);
  return 1;
};

if (require.main === module) {
  process.exitCode = runReview(process.argv.slice(2));
}

module.exports = { runReview };
