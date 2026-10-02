// Reads and writes questions.json in its existing hand-written style:
// 2-space indent, one question object per block, each answer on one line
// as { "text": ..., "correct": ... }, a trailing newline. Line endings of
// the existing file are kept.
// CommonJS, Node only (used by the import and review scripts).

const fs = require("fs");
const path = require("path");

const DEFAULT_QUESTIONS_PATH = path.join(__dirname, "..", "data", "questions.json");
const DEFAULT_CATEGORIES_PATH = path.join(__dirname, "..", "data", "categories.json");

const inlineObject = (object) =>
  `{ ${Object.entries(object)
    .map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`)
    .join(", ")} }`;

const serializeField = (key, value) => {
  if (key === "answers" && Array.isArray(value)) {
    if (value.length === 0) {
      return `    "answers": []`;
    }
    const rows = value.map((answer) => `      ${inlineObject(answer)}`);
    return `    "answers": [\n${rows.join(",\n")}\n    ]`;
  }
  return `    ${JSON.stringify(key)}: ${JSON.stringify(value)}`;
};

// Keeps the key order of each object. Always LF, see toEol.
const serializeQuestions = (questions) => {
  if (questions.length === 0) {
    return "[]\n";
  }
  const blocks = questions.map(
    (q) =>
      `  {\n${Object.entries(q)
        .map(([key, value]) => serializeField(key, value))
        .join(",\n")}\n  }`
  );
  return `[\n${blocks.join(",\n")}\n]\n`;
};

const toLf = (text) => text.replace(/\r\n/g, "\n");
const toEol = (text, eol) => (eol === "\r\n" ? text.replace(/\n/g, "\r\n") : text);

// Returns { questions, eol, roundTrip }. roundTrip is false when writing the
// parsed data back would change the file (beyond line endings). Throws on
// unreadable files, a BOM, invalid JSON or a non-array.
const readQuestionsFile = (filePath = DEFAULT_QUESTIONS_PATH) => {
  const text = fs.readFileSync(filePath, "utf8");
  if (text.charCodeAt(0) === 0xfeff) {
    throw new Error(`${filePath} starts with a byte order mark (BOM)`);
  }
  const questions = JSON.parse(text);
  if (!Array.isArray(questions)) {
    throw new Error(`${filePath} must contain a JSON array`);
  }
  return {
    questions,
    eol: text.includes("\r\n") ? "\r\n" : "\n",
    roundTrip: serializeQuestions(questions) === toLf(text),
  };
};

const writeQuestionsFile = (filePath, questions, eol = "\n") => {
  fs.writeFileSync(filePath, toEol(serializeQuestions(questions), eol), "utf8");
};

const readCategoriesFile = (filePath = DEFAULT_CATEGORIES_PATH) =>
  JSON.parse(fs.readFileSync(filePath, "utf8"));

const ROUND_TRIP_ERROR =
  "questions.json would change formatting when rewritten. Nothing was written. " +
  "Restore the usual style (2-space indent, one answer per line) or report this.";

module.exports = {
  DEFAULT_QUESTIONS_PATH,
  DEFAULT_CATEGORIES_PATH,
  ROUND_TRIP_ERROR,
  serializeQuestions,
  readQuestionsFile,
  writeQuestionsFile,
  readCategoriesFile,
};
