// Tests for src/lib/reviewLogic.js and scripts/review-questions.js.
// Plain Node, no dependencies. Works only on made-up data in temp folders,
// never on the real questions.json.
// Usage: npm run test:logic
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  PHASE10_TARGETS,
  listUnreviewed,
  formatQuestion,
  setReviewed,
  getStatus,
  formatStatus,
} = require("../src/lib/reviewLogic");
const { serializeQuestions, readQuestionsFile } = require("../src/lib/questionsFile");
const { runReview } = require("./review-questions");
const categories = require("../src/data/categories.json");

const fake = (id, category, reviewed = false, extra = {}) => ({
  id,
  category,
  type: "single",
  difficulty: 2,
  question: `Made-up question ${id}`,
  answers: [
    { text: "Right", correct: true },
    { text: "Wrong 1", correct: false },
    { text: "Wrong 2", correct: false },
    { text: "Wrong 3", correct: false },
  ],
  explanation: `Made-up explanation ${id}.`,
  ...extra,
  reviewed,
});

const pool = [
  fake("dbm-001", "database-management", true),
  fake("dbm-002", "database-management"),
  fake("col-001", "collaboration", false, { source: "https://example.invalid/col" }),
  fake("ext-001", "extra"),
];

const setup = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "csa-review-test-"));
  const questionsPath = path.join(dir, "questions.json");
  const categoriesPath = path.join(dir, "categories.json");
  fs.writeFileSync(questionsPath, serializeQuestions(pool));
  fs.writeFileSync(categoriesPath, JSON.stringify(categories));
  const out = [];
  const err = [];
  const run = (...args) =>
    runReview(args, {
      questionsPath,
      categoriesPath,
      log: (line) => out.push(line),
      error: (line) => err.push(line),
    });
  const read = () => fs.readFileSync(questionsPath, "utf8");
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  return { run, read, out, err, cleanup, questionsPath };
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("listUnreviewed with and without category", () => {
  assert.deepStrictEqual(listUnreviewed(pool).map((q) => q.id), ["dbm-002", "col-001", "ext-001"]);
  assert.deepStrictEqual(
    listUnreviewed(pool, "database-management").map((q) => q.id),
    ["dbm-002"]
  );
});

test("formatQuestion marks correct answers and shows the source", () => {
  const text = formatQuestion(pool[2]);
  assert.ok(text.startsWith("col-001  single  difficulty 2"));
  assert.ok(text.includes("    + Right"));
  assert.ok(text.includes("    - Wrong 1"));
  assert.ok(text.includes("  Explanation: Made-up explanation col-001."));
  assert.ok(text.includes("  Source: https://example.invalid/col"));
  assert.ok(!formatQuestion(pool[1]).includes("Source:"));
});

test("setReviewed: mark, unmark, unchanged, no mutation", () => {
  const before = structuredClone(pool);
  const marked = setReviewed(pool, ["dbm-002", "dbm-001"], true);
  assert.deepStrictEqual(marked.changed, ["dbm-002"]);
  assert.deepStrictEqual(marked.unchanged, ["dbm-001"]);
  assert.strictEqual(marked.questions[1].reviewed, true);
  assert.strictEqual(marked.questions[2], pool[2], "untouched questions keep their identity");
  const unmarked = setReviewed(marked.questions, ["dbm-001"], false);
  assert.strictEqual(unmarked.questions[0].reviewed, false);
  assert.deepStrictEqual(pool, before);
});

test("setReviewed: unknown or missing ids give errors", () => {
  assert.deepStrictEqual(setReviewed(pool, ["dbm-002", "nope-1"], true), {
    errors: ['unknown id "nope-1"'],
  });
  assert.deepStrictEqual(setReviewed(pool, [], true), {
    errors: ["give at least one question id"],
  });
});

test("getStatus: counts, targets and gap", () => {
  const rows = getStatus(pool, categories);
  const dbm = rows.find((row) => row.category === "database-management");
  assert.deepStrictEqual(dbm, {
    category: "database-management",
    total: 2,
    reviewed: 1,
    unreviewed: 1,
    target: 45,
    gap: 44,
  });
  const extra = rows.find((row) => row.category === "extra");
  assert.strictEqual(extra.target, null);
  assert.strictEqual(extra.gap, null);
  assert.strictEqual(rows.length, categories.length);
  assert.strictEqual(PHASE10_TARGETS.collaboration, 30);
  const text = formatStatus(rows);
  assert.ok(text.split("\n")[0].startsWith("category"));
  assert.ok(text.includes("total"));
});

test("runReview mark: writes reviewed true and keeps the format", () => {
  const env = setup();
  try {
    assert.strictEqual(env.run("mark", "dbm-002", "col-001"), 0, env.err.join("\n"));
    const file = readQuestionsFile(env.questionsPath);
    assert.strictEqual(file.roundTrip, true);
    assert.deepStrictEqual(
      file.questions.filter((q) => q.reviewed).map((q) => q.id),
      ["dbm-001", "dbm-002", "col-001"]
    );
    assert.ok(env.out[0].includes("2 question(s) set to reviewed"));
  } finally {
    env.cleanup();
  }
});

test("runReview mark: an unknown id writes nothing", () => {
  const env = setup();
  try {
    const before = env.read();
    assert.strictEqual(env.run("mark", "dbm-002", "dbm-999"), 1);
    assert.strictEqual(env.read(), before);
    assert.ok(env.err.some((line) => line.includes('unknown id "dbm-999"')));
  } finally {
    env.cleanup();
  }
});

test("runReview unmark", () => {
  const env = setup();
  try {
    assert.strictEqual(env.run("unmark", "dbm-001"), 0);
    const file = readQuestionsFile(env.questionsPath);
    assert.ok(file.questions.every((q) => q.reviewed === false));
  } finally {
    env.cleanup();
  }
});

test("runReview list and status do not write", () => {
  const env = setup();
  try {
    const before = env.read();
    assert.strictEqual(env.run("list"), 0);
    assert.ok(env.out.some((line) => line.includes("3 unreviewed question(s).")));
    assert.strictEqual(env.run("list", "collaboration"), 0);
    assert.ok(env.out.some((line) => line.includes("1 unreviewed question(s) in collaboration.")));
    assert.strictEqual(env.run("status"), 0);
    assert.ok(env.out.some((line) => line.includes("database-management")));
    assert.strictEqual(env.read(), before);
  } finally {
    env.cleanup();
  }
});

test("runReview: unknown category or command", () => {
  const env = setup();
  try {
    assert.strictEqual(env.run("list", "no-such-category"), 1);
    assert.strictEqual(env.run("approve", "dbm-001"), 1);
    assert.strictEqual(env.run(), 1);
  } finally {
    env.cleanup();
  }
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
