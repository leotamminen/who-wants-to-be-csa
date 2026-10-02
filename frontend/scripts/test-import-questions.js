// Tests for scripts/import-questions.js, src/lib/questionsFile.js and the
// optional source field in validateQuestion. Plain Node, no dependencies.
// Works only on made-up data in temp folders, never on the real questions.json.
// Usage: npm run test:logic
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { validateQuestion } = require("../src/lib/validateQuestion");
const {
  serializeQuestions,
  readQuestionsFile,
} = require("../src/lib/questionsFile");
const { runImport, normalizeText } = require("./import-questions");
const categories = require("../src/data/categories.json");

const fake = (id, category, overrides = {}) => ({
  id,
  category,
  type: "single",
  difficulty: 1,
  question: `Made-up question ${id}`,
  answers: [
    { text: "Alpha", correct: true },
    { text: "Beta", correct: false },
    { text: "Gamma", correct: false },
    { text: "Delta", correct: false },
  ],
  explanation: `Made-up explanation ${id}.`,
  reviewed: false,
  ...overrides,
});

const basePool = [
  fake("dbm-001", "database-management"),
  fake("dbm-007", "database-management", { reviewed: true }),
  fake("pon-002", "platform-overview", { source: "https://example.invalid/doc" }),
];

const draft = (category, overrides = {}) => {
  const { id, reviewed, ...rest } = fake("xxx-000", category);
  return { ...rest, question: `Draft ${Math.random()}`, ...overrides };
};

const draftSingle = (category, text) => draft(category, { question: text });
const draftMultiple = (category, text) =>
  draft(category, {
    type: "multiple",
    difficulty: 2,
    question: text,
    answers: [
      { text: "One", correct: true },
      { text: "Two", correct: true },
      { text: "Three", correct: false },
      { text: "Four", correct: false },
      { text: "Five", correct: false },
    ],
  });
const draftTrueFalse = (category, text) =>
  draft(category, {
    type: "truefalse",
    difficulty: 3,
    question: text,
    answers: [
      { text: "True", correct: false },
      { text: "False", correct: true },
    ],
  });

// Temp folder with categories.json, questions.json and an input file
const setup = (input, { pool = basePool, eol = "\n", rawQuestions } = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "csa-import-test-"));
  const questionsPath = path.join(dir, "questions.json");
  const categoriesPath = path.join(dir, "categories.json");
  const inputPath = path.join(dir, "batch.json");
  const text = rawQuestions !== undefined ? rawQuestions : serializeQuestions(pool);
  fs.writeFileSync(questionsPath, eol === "\r\n" ? text.replace(/\n/g, "\r\n") : text);
  fs.writeFileSync(categoriesPath, JSON.stringify(categories));
  fs.writeFileSync(inputPath, JSON.stringify(input, null, 2));
  const out = [];
  const err = [];
  const run = (options = {}) =>
    runImport({
      inputPath,
      questionsPath,
      categoriesPath,
      log: (line) => out.push(line),
      error: (line) => err.push(line),
      ...options,
    });
  const read = () => fs.readFileSync(questionsPath, "utf8");
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  return { run, read, out, err, cleanup, questionsPath };
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("validateQuestion: optional source", () => {
  const base = fake("dbm-001", "database-management");
  assert.deepStrictEqual(validateQuestion(base, categories), []);
  assert.deepStrictEqual(
    validateQuestion({ ...base, source: "https://example.invalid/page" }, categories),
    []
  );
  ["", "   ", 5, null, ["x"]].forEach((source) => {
    assert.deepStrictEqual(
      validateQuestion({ ...base, source }, categories),
      ["source must be a non-empty string if present"],
      `source ${JSON.stringify(source)}`
    );
  });
});

test("questionsFile: serialize and read round trip, LF and CRLF", () => {
  const text = serializeQuestions(basePool);
  assert.ok(text.includes('      { "text": "Alpha", "correct": true },\n'));
  assert.ok(text.endsWith("  }\n]\n"));
  [("\n"), "\r\n"].forEach((eol) => {
    const env = setup([], { eol });
    try {
      const file = readQuestionsFile(env.questionsPath);
      assert.strictEqual(file.roundTrip, true);
      assert.strictEqual(file.eol, eol);
      assert.deepStrictEqual(file.questions, basePool);
    } finally {
      env.cleanup();
    }
  });
});

test("questionsFile: different formatting is detected", () => {
  const env = setup([], { rawQuestions: JSON.stringify(basePool) });
  try {
    assert.strictEqual(readQuestionsFile(env.questionsPath).roundTrip, false);
  } finally {
    env.cleanup();
  }
});

test("import: all three types, ids continue per prefix, reviewed always false", () => {
  const input = [
    { ...draftSingle("database-management", "Single A"), id: "dbm-500", reviewed: true },
    draftMultiple("database-management", "Multiple B"),
    draftTrueFalse("collaboration", "True false C"),
    { ...draftSingle("platform-overview", "Single D"), source: "https://example.invalid/d" },
  ];
  const env = setup(input);
  try {
    assert.strictEqual(env.run(), 0, env.err.join("\n"));
    const file = readQuestionsFile(env.questionsPath);
    assert.strictEqual(file.roundTrip, true);
    const added = file.questions.slice(basePool.length);
    assert.deepStrictEqual(added.map((q) => q.id), ["dbm-008", "dbm-009", "col-001", "pon-003"]);
    assert.deepStrictEqual(added.map((q) => q.type), ["single", "multiple", "truefalse", "single"]);
    assert.ok(added.every((q) => q.reviewed === false));
    assert.deepStrictEqual(Object.keys(added[3]), [
      "id", "category", "type", "difficulty", "question", "answers", "explanation", "source", "reviewed",
    ]);
    assert.deepStrictEqual(Object.keys(added[0]), [
      "id", "category", "type", "difficulty", "question", "answers", "explanation", "reviewed",
    ]);
    assert.deepStrictEqual(file.questions.slice(0, basePool.length), basePool);
    added.forEach((q) => assert.deepStrictEqual(validateQuestion(q, categories), []));
    assert.ok(env.out.some((line) => line.includes("database-management: 2")));
    assert.ok(env.out.some((line) => line.includes("New total: 7")));
  } finally {
    env.cleanup();
  }
});

test("import: keeps CRLF line endings", () => {
  const env = setup([draftSingle("collaboration", "CRLF question")], { eol: "\r\n" });
  try {
    assert.strictEqual(env.run(), 0, env.err.join("\n"));
    const text = env.read();
    assert.ok(text.includes("\r\n"));
    assert.ok(!/[^\r]\n/.test(text), "a bare LF slipped in");
  } finally {
    env.cleanup();
  }
});

test("import: --dry-run writes nothing", () => {
  const env = setup([draftSingle("collaboration", "Dry run question")]);
  try {
    const before = env.read();
    assert.strictEqual(env.run({ dryRun: true }), 0);
    assert.strictEqual(env.read(), before);
    assert.ok(env.out.some((line) => line.includes("Would add 1")));
    assert.ok(env.out.some((line) => line.includes("nothing was written")));
  } finally {
    env.cleanup();
  }
});

const errorCases = [
  ["input is not an array", { category: "collaboration" }, "input must be a JSON array"],
  ["item is not an object", [draftSingle("collaboration", "Fine"), "text"], "#1: must be an object"],
  ["unknown category", [draftSingle("no-such-category", "Q")], '#0: unknown category "no-such-category"'],
  ["bad type", [draft("collaboration", { type: "essay" })], "#0: type must be one of"],
  ["bad difficulty", [draft("collaboration", { difficulty: 4 })], "#0: difficulty must be an integer 1-3"],
  ["missing explanation", [draft("collaboration", { explanation: "" })], "#0: explanation must be a non-empty string"],
  ["empty source", [draft("collaboration", { source: "" })], "#0: source must be a non-empty string"],
  ["single with 2 correct", [draft("collaboration", {
    answers: [
      { text: "A", correct: true }, { text: "B", correct: true },
      { text: "C", correct: false }, { text: "D", correct: false },
    ],
  })], "#0: single needs exactly 1 correct answer"],
  ["multiple with 4 answers", [draft("collaboration", {
    type: "multiple",
    answers: [
      { text: "A", correct: true }, { text: "B", correct: true },
      { text: "C", correct: false }, { text: "D", correct: false },
    ],
  })], "#0: multiple needs 5-6 answers"],
  ["truefalse with other texts", [draft("collaboration", {
    type: "truefalse",
    answers: [{ text: "Yes", correct: true }, { text: "No", correct: false }],
  })], '#0: truefalse needs exactly the answers "True" and "False"'],
  ["unknown field", [draft("collaboration", { hint: "x" })], '#0: unknown field "hint"'],
  ["duplicate of the pool", [draftSingle("collaboration", "  MADE-UP   question dbm-001 ")],
    "#0: duplicate question text (same as dbm-001)"],
  ["duplicate within the file", [
    draftSingle("collaboration", "Same text"),
    draftSingle("database-management", "same  TEXT"),
  ], "#1: duplicate question text (same as #0)"],
];

errorCases.forEach(([name, input, expected]) => {
  test(`import error, nothing written: ${name}`, () => {
    const env = setup(input);
    try {
      const before = env.read();
      assert.strictEqual(env.run(), 1);
      assert.strictEqual(env.read(), before);
      assert.ok(
        env.err.some((line) => line.includes(expected)),
        `expected "${expected}" in:\n${env.err.join("\n")}`
      );
    } finally {
      env.cleanup();
    }
  });
});

test("import: every problem is printed, valid items are not written either", () => {
  const input = [
    draftSingle("collaboration", "Valid one"),
    draft("collaboration", { difficulty: 0 }),
    draft("bad-category"),
  ];
  const env = setup(input);
  try {
    const before = env.read();
    assert.strictEqual(env.run(), 1);
    assert.strictEqual(env.read(), before);
    assert.ok(env.err.some((line) => line.startsWith("  #1:")));
    assert.ok(env.err.some((line) => line.startsWith("  #2:")));
    assert.ok(!env.err.some((line) => line.startsWith("  #0:")));
  } finally {
    env.cleanup();
  }
});

test("import: refuses a questions file in another format", () => {
  const env = setup([draftSingle("collaboration", "Q")], { rawQuestions: JSON.stringify(basePool) });
  try {
    const before = env.read();
    assert.strictEqual(env.run(), 1);
    assert.strictEqual(env.read(), before);
    assert.ok(env.err.some((line) => line.includes("would change formatting")));
  } finally {
    env.cleanup();
  }
});

test("normalizeText: case and whitespace", () => {
  assert.strictEqual(normalizeText("  What  IS\ta\nTable? "), "what is a table?");
  assert.strictEqual(normalizeText(undefined), "");
});

let failed = 0;
tests.forEach(({ name, fn }) => {
  try {
    fn();
    console.log(`ok    ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL  ${name}`);
    console.log(`      ${error.message.split("\n").join("\n      ")}`);
  }
});

console.log(`\n${tests.length - failed}/${tests.length} tests passed.`);
if (failed > 0) {
  process.exit(1);
}
