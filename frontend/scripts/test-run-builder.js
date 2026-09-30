// Tests for src/lib/runBuilder.js. Plain Node, no dependencies.
// Usage: npm run test:logic
const assert = require("node:assert");
const {
  getDefaultOptions,
  filterPool,
  getQuestionPool,
  buildRun,
} = require("../src/lib/runBuilder");
const categories = require("../src/data/categories.json");

// Seeded random so every run of this script gives the same results
const mulberry32 = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Synthetic questions that pass validateQuestion
const makeQuestion = (category, number, overrides = {}) => {
  const type = ["single", "multiple", "truefalse"][number % 3];
  const answers =
    type === "single"
      ? ["A", "B", "C", "D"].map((t, i) => ({ text: `Answer ${t}`, correct: i === 0 }))
      : type === "multiple"
      ? ["A", "B", "C", "D", "E"].map((t, i) => ({ text: `Answer ${t}`, correct: i < 2 }))
      : [
          { text: "True", correct: number % 2 === 0 },
          { text: "False", correct: number % 2 !== 0 },
        ];
  return {
    id: `${category.prefix}-${String(number).padStart(3, "0")}`,
    category: category.id,
    type,
    difficulty: (number % 3) + 1,
    question: `Synthetic question ${number}`,
    answers,
    explanation: "Synthetic explanation",
    reviewed: true,
    ...overrides,
  };
};

const makePool = (perCategory) =>
  categories.flatMap((category) => {
    const count =
      typeof perCategory === "number" ? perCategory : perCategory[category.id] || 0;
    return Array.from({ length: count }, (_, i) => makeQuestion(category, i + 1));
  });

const coreIds = categories.filter((c) => !c.extra).map((c) => c.id);
const extraId = categories.find((c) => c.extra).id;
const withExtra = { enabled: { [extraId]: true } };

// validateQuestion and filterPool warn about dropped questions. Keep the test
// output readable and count the warnings instead.
const silenceWarnings = (fn) => {
  const original = console.warn;
  let warnings = 0;
  console.warn = () => {
    warnings += 1;
  };
  try {
    return { result: fn(), warnings };
  } finally {
    console.warn = original;
  }
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const realPool = getQuestionPool({ includeUnreviewed: true });
const bigPool = makePool(100);

test("real data: every question passes validation", () => {
  const questions = require("../src/data/questions.json");
  assert.strictEqual(realPool.questions.length, questions.length);
});

test("run has 15 questions with unique ids", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { status, run } = buildRun({ ...realPool, random: mulberry32(seed) });
    assert.strictEqual(status, "ready");
    assert.strictEqual(run.length, 15);
    assert.strictEqual(new Set(run.map((q) => q.id)).size, 15);
  }
});

test("run is sorted by ascending difficulty", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { run } = buildRun({ ...realPool, random: mulberry32(seed) });
    run.slice(1).forEach((q, i) => assert.ok(run[i].difficulty <= q.difficulty));
  }
});

test("every run question is a copy with source hardcoded", () => {
  const { run } = buildRun({ ...realPool, random: mulberry32(7) });
  run.forEach((q) => {
    assert.strictEqual(q.source, "hardcoded");
    assert.ok(!realPool.questions.includes(q));
  });
});

test("extra category absent by default, present when enabled", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const off = buildRun({ ...realPool, random: mulberry32(seed) });
    assert.strictEqual(off.counts[extraId], 0);
    assert.ok(off.run.every((q) => q.category !== extraId));

    const on = buildRun({ ...realPool, settings: withExtra, random: mulberry32(seed) });
    assert.ok(on.counts[extraId] >= 1);
    assert.strictEqual(on.run.filter((q) => q.category === extraId).length, on.counts[extraId]);
  }
});

test("weights respected: mean count per category over 2000 runs", () => {
  const check = (settings, enabledIds) => {
    const weightOf = (id) => {
      const custom = settings.weights && settings.weights[id];
      return custom !== undefined ? custom : categories.find((c) => c.id === id).weight;
    };
    const totalWeight = enabledIds.reduce((sum, id) => sum + weightOf(id), 0);
    const sums = Object.fromEntries(categories.map((c) => [c.id, 0]));
    const random = mulberry32(42);
    const runs = 2000;
    for (let i = 0; i < runs; i++) {
      const { run } = buildRun({ categories, questions: bigPool, settings, random });
      run.forEach((q) => (sums[q.category] += 1));
    }
    categories.forEach((c) => {
      const mean = sums[c.id] / runs;
      const expected = enabledIds.includes(c.id) ? (weightOf(c.id) * 15) / totalWeight : 0;
      assert.ok(
        Math.abs(mean - expected) <= 0.5,
        `${c.id}: mean ${mean.toFixed(2)}, expected ${expected.toFixed(2)}`
      );
    });
  };
  check({}, coreIds);
  check(withExtra, [...coreIds, extraId]);
});

test("custom weights: every count is floor or ceil of its target", () => {
  const settings = { weights: { "platform-overview": 50, "database-management": 0 } };
  const weights = Object.fromEntries(
    coreIds.map((id) => [
      id,
      id in settings.weights ? settings.weights[id] : categories.find((c) => c.id === id).weight,
    ])
  );
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const random = mulberry32(9);
  for (let i = 0; i < 500; i++) {
    const { counts } = buildRun({ categories, questions: bigPool, settings, random });
    coreIds.forEach((id) => {
      const target = (weights[id] * 15) / totalWeight;
      assert.ok(
        counts[id] === Math.floor(target) || counts[id] === Math.ceil(target),
        `${id}: count ${counts[id]}, target ${target.toFixed(2)}`
      );
    });
    assert.strictEqual(counts["database-management"], 0);
  }
});

test("disabled category and weight 0 are left out", () => {
  const { counts } = buildRun({
    categories,
    questions: bigPool,
    settings: {
      enabled: { collaboration: false },
      weights: { "database-management": 0 },
    },
    random: mulberry32(3),
  });
  assert.strictEqual(counts.collaboration, 0);
  assert.strictEqual(counts["database-management"], 0);
});

test("redistribution when one category has only 1 question", () => {
  const pool = makePool(
    Object.fromEntries(
      categories.map((c) => [c.id, c.id === "database-management" ? 1 : 100])
    )
  );
  for (let seed = 1; seed <= 100; seed++) {
    const { status, run, counts } = buildRun({
      categories,
      questions: pool,
      random: mulberry32(seed),
    });
    assert.strictEqual(status, "ready");
    assert.strictEqual(run.length, 15);
    assert.strictEqual(counts["database-management"], 1);
    assert.strictEqual(Object.values(counts).reduce((a, b) => a + b, 0), 15);
  }
});

test('"too-few" when the pool has 10 questions', () => {
  const pool = makePool({ "platform-overview": 5, collaboration: 5 });
  assert.strictEqual(pool.length, 10);
  const { status, run, counts } = buildRun({
    categories,
    questions: pool,
    random: mulberry32(1),
  });
  assert.strictEqual(status, "too-few");
  assert.strictEqual(run.length, 10);
  assert.strictEqual(counts["platform-overview"], 5);
  assert.strictEqual(counts.collaboration, 5);
});

test('empty pool gives "too-few" without throwing', () => {
  const empty = buildRun({ categories, questions: [], random: mulberry32(1) });
  assert.strictEqual(empty.status, "too-few");
  assert.deepStrictEqual(empty.run, []);

  const { result, warnings } = silenceWarnings(() => [
    buildRun(),
    buildRun({ categories: null, questions: null }),
    buildRun({ categories, questions: [null, 42, "x"] }),
  ]);
  result.forEach((r) => {
    assert.strictEqual(r.status, "too-few");
    assert.deepStrictEqual(r.run, []);
  });
  assert.strictEqual(warnings, 0);
});

test("unreviewed excluded when includeUnreviewed is false", () => {
  const pool = [
    makeQuestion(categories[0], 1),
    makeQuestion(categories[0], 2, { reviewed: false }),
  ];
  assert.deepStrictEqual(
    filterPool(pool, categories, { includeUnreviewed: false }).map((q) => q.id),
    ["pon-001"]
  );
  assert.deepStrictEqual(
    filterPool(pool, categories, { includeUnreviewed: true }).map((q) => q.id),
    ["pon-001", "pon-002"]
  );
  const reviewedOnly = getQuestionPool({ includeUnreviewed: false });
  assert.ok(reviewedOnly.questions.every((q) => q.reviewed === true));
});

test("invalid questions and duplicate ids are dropped with a warning", () => {
  const good = makeQuestion(categories[0], 1);
  const pool = [
    good,
    { ...good },
    makeQuestion(categories[0], 2, { id: "dbm-002" }),
    makeQuestion(categories[0], 3, { explanation: "" }),
    null,
  ];
  const { result, warnings } = silenceWarnings(() =>
    filterPool(pool, categories, { includeUnreviewed: true })
  );
  assert.deepStrictEqual(result.map((q) => q.id), ["pon-001"]);
  assert.strictEqual(warnings, 4);
});

test("getDefaultOptions follows NODE_ENV and REACT_APP_ALLOW_UNREVIEWED", () => {
  const saved = {
    NODE_ENV: process.env.NODE_ENV,
    REACT_APP_ALLOW_UNREVIEWED: process.env.REACT_APP_ALLOW_UNREVIEWED,
  };
  const set = (nodeEnv, allow) => {
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
    if (allow === undefined) delete process.env.REACT_APP_ALLOW_UNREVIEWED;
    else process.env.REACT_APP_ALLOW_UNREVIEWED = allow;
    return getDefaultOptions().includeUnreviewed;
  };
  try {
    assert.strictEqual(set("development", undefined), true);
    assert.strictEqual(set(undefined, undefined), true);
    assert.strictEqual(set("production", undefined), false);
    assert.strictEqual(set("production", ""), false);
    assert.strictEqual(set("production", "false"), false);
    assert.strictEqual(set("production", "true"), true);
  } finally {
    set(saved.NODE_ENV, saved.REACT_APP_ALLOW_UNREVIEWED);
  }
});

test("input data unchanged after buildRun", () => {
  const categoriesBefore = structuredClone(categories);
  const realBefore = structuredClone(realPool.questions);
  const bigBefore = structuredClone(bigPool);
  const settings = { enabled: { [extraId]: true }, weights: { collaboration: 40 } };
  const settingsBefore = structuredClone(settings);
  for (let seed = 1; seed <= 50; seed++) {
    buildRun({ ...realPool, settings, random: mulberry32(seed) });
    buildRun({ categories, questions: bigPool, settings, random: mulberry32(seed) });
  }
  assert.deepStrictEqual(categories, categoriesBefore);
  assert.deepStrictEqual(realPool.questions, realBefore);
  assert.deepStrictEqual(bigPool, bigBefore);
  assert.deepStrictEqual(settings, settingsBefore);
});

test("truefalse answers keep their order", () => {
  let seen = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const { run } = buildRun({ ...realPool, settings: withExtra, random: mulberry32(seed) });
    run
      .filter((q) => q.type === "truefalse")
      .forEach((q) => {
        seen += 1;
        const original = realPool.questions.find((o) => o.id === q.id);
        assert.deepStrictEqual(q.answers, original.answers);
        assert.deepStrictEqual(q.answers.map((a) => a.text), ["True", "False"]);
      });
  }
  assert.ok(seen > 0, "no truefalse question was drawn");
});

test("shuffle keeps the set of correct answer texts", () => {
  let reordered = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const { run } = buildRun({ ...realPool, settings: withExtra, random: mulberry32(seed) });
    run.forEach((q) => {
      const original = realPool.questions.find((o) => o.id === q.id);
      const correctTexts = (answers) =>
        answers.filter((a) => a.correct).map((a) => a.text).sort();
      assert.deepStrictEqual(correctTexts(q.answers), correctTexts(original.answers));
      assert.deepStrictEqual(
        q.answers.map((a) => a.text).sort(),
        original.answers.map((a) => a.text).sort()
      );
      if (q.answers.some((a, i) => a.text !== original.answers[i].text)) {
        reordered += 1;
      }
    });
  }
  assert.ok(reordered > 0, "answers were never shuffled");
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
