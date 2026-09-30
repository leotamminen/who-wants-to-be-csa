// Tests for src/lib/settingsLogic.js. Plain Node, no dependencies.
// Usage: npm run test:logic
const assert = require("node:assert");
const {
  getDefaultSettings,
  setWeight,
  setEnabled,
  setFlag,
  getShares,
  getSettingsProblem,
} = require("../src/lib/settingsLogic");
const { buildRun, getQuestionPool } = require("../src/lib/runBuilder");
const categories = require("../src/data/categories.json");

// Seeded random, same as in test-run-builder.js
const mulberry32 = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const extraId = categories.find((c) => c.extra).id;
const coreIds = categories.filter((c) => !c.extra).map((c) => c.id);
const fullCounts = Object.fromEntries(categories.map((c) => [c.id, 10]));

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("defaults", () => {
  const settings = getDefaultSettings(categories);
  assert.strictEqual(settings.practiceMode, true);
  assert.strictEqual(settings.musicOn, false);
  categories.forEach((c) => {
    assert.strictEqual(settings.enabled[c.id], !c.extra);
    assert.strictEqual(settings.weights[c.id], c.weight);
  });
  assert.strictEqual(settings.enabled[extraId], false);
  assert.deepStrictEqual(Object.keys(settings).sort(), [
    "enabled", "musicOn", "practiceMode", "weights",
  ]);
  assert.deepStrictEqual(getDefaultSettings(undefined), {
    practiceMode: true,
    musicOn: false,
    enabled: {},
    weights: {},
  });
});

test("setWeight parses, rounds and clamps to 0-100", () => {
  const base = getDefaultSettings(categories);
  const cases = [
    [42, 42], ["42", 42], [" 7 ", 7], [12.4, 12], ["12.6", 13],
    [0, 0], [100, 100], [101, 100], [1e9, 100], [-5, 0], ["-1", 0],
    ["", 0], ["  ", 0], ["abc", 0], ["12abc", 0], [NaN, 0], [Infinity, 0],
    [null, 0], [undefined, 0],
  ];
  cases.forEach(([input, expected]) => {
    assert.strictEqual(
      setWeight(base, "collaboration", input).weights.collaboration,
      expected,
      `input ${JSON.stringify(input)}`
    );
  });
});

test("setEnabled and setFlag", () => {
  const base = getDefaultSettings(categories);
  assert.strictEqual(setEnabled(base, extraId, true).enabled[extraId], true);
  assert.strictEqual(setEnabled(base, "collaboration", false).enabled.collaboration, false);
  assert.strictEqual(setFlag(base, "practiceMode", false).practiceMode, false);
  assert.strictEqual(setFlag(base, "musicOn", true).musicOn, true);
  const unknown = setFlag(base, "enabled", false);
  assert.deepStrictEqual(unknown, base);
  assert.notStrictEqual(unknown, base);
});

test("updates return new objects and never mutate the input", () => {
  const base = getDefaultSettings(categories);
  const before = structuredClone(base);
  const results = [
    setWeight(base, "collaboration", 55),
    setEnabled(base, extraId, true),
    setFlag(base, "musicOn", true),
  ];
  results.forEach((result) => assert.notStrictEqual(result, base));
  assert.notStrictEqual(results[0].weights, base.weights);
  assert.notStrictEqual(results[1].enabled, base.enabled);
  getShares(base, categories, fullCounts);
  getSettingsProblem(base, categories, fullCounts);
  assert.deepStrictEqual(base, before);
});

test("shares: default weights, sum close to 100, extra 0", () => {
  const shares = getShares(getDefaultSettings(categories), categories, fullCounts);
  // Core weights sum to 100, so the shares equal the weights
  coreIds.forEach((id) => {
    assert.strictEqual(shares[id], categories.find((c) => c.id === id).weight);
  });
  assert.strictEqual(shares[extraId], 0);
  const sum = Object.values(shares).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 100) <= 1, `sum ${sum}`);
});

test("shares: excluded categories get 0, the rest renormalize", () => {
  let settings = getDefaultSettings(categories);
  settings = setEnabled(settings, extraId, true);
  settings = setEnabled(settings, "collaboration", false);
  settings = setWeight(settings, "platform-overview", 0);
  const counts = { ...fullCounts, "instance-configuration": 0 };
  const shares = getShares(settings, categories, counts);
  assert.strictEqual(shares.collaboration, 0, "disabled");
  assert.strictEqual(shares["platform-overview"], 0, "weight 0");
  assert.strictEqual(shares["instance-configuration"], 0, "empty pool");
  // Participating: ssa 20, dbm 30, dmi 13, extra 10 = 73
  assert.strictEqual(shares["self-service-automation"], Math.round(2000 / 73));
  assert.strictEqual(shares["database-management"], Math.round(3000 / 73));
  assert.strictEqual(shares[extraId], Math.round(1000 / 73));
  const sum = Object.values(shares).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 100) <= 2, `sum ${sum}`);
});

test("shares: nothing participating gives all 0", () => {
  const shares = getShares(getDefaultSettings(categories), categories, {});
  assert.ok(Object.values(shares).every((share) => share === 0));
});

test("problem: none for the defaults", () => {
  assert.strictEqual(
    getSettingsProblem(getDefaultSettings(categories), categories, fullCounts),
    null
  );
});

test('problem: "Enable at least one category"', () => {
  const settings = categories.reduce(
    (current, c) => setEnabled(current, c.id, false),
    getDefaultSettings(categories)
  );
  assert.strictEqual(
    getSettingsProblem(settings, categories, fullCounts),
    "Enable at least one category"
  );
});

test('problem: "Give an enabled category a weight above 0"', () => {
  const settings = coreIds.reduce(
    (current, id) => setWeight(current, id, 0),
    getDefaultSettings(categories)
  );
  assert.strictEqual(
    getSettingsProblem(settings, categories, fullCounts),
    "Give an enabled category a weight above 0"
  );
  // The disabled extra category's weight does not count
  assert.ok(settings.weights[extraId] > 0);
});

test('problem: "No questions available for the enabled categories"', () => {
  const counts = { ...fullCounts };
  coreIds.forEach((id) => (counts[id] = 0));
  const settings = getDefaultSettings(categories);
  assert.strictEqual(
    getSettingsProblem(settings, categories, counts),
    "No questions available for the enabled categories"
  );
  // Enabling the extra category (which has questions) fixes it
  assert.strictEqual(
    getSettingsProblem(setEnabled(settings, extraId, true), categories, counts),
    null
  );
  assert.strictEqual(
    getSettingsProblem(settings, categories, undefined),
    "No questions available for the enabled categories"
  );
});

test("buildRun accepts the settings object and ignores the extra keys", () => {
  const pool = getQuestionPool({ includeUnreviewed: true });
  let settings = getDefaultSettings(pool.categories);
  settings = setEnabled(settings, extraId, true);
  settings = setWeight(settings, "collaboration", 50);
  settings = setFlag(settings, "practiceMode", false);
  settings = setFlag(settings, "musicOn", true);
  for (let seed = 1; seed <= 20; seed++) {
    const full = buildRun({ ...pool, settings, random: mulberry32(seed) });
    const plain = buildRun({
      ...pool,
      settings: { enabled: settings.enabled, weights: settings.weights },
      random: mulberry32(seed),
    });
    assert.deepStrictEqual(full, plain);
    assert.strictEqual(full.status, "ready");
    assert.ok(full.counts[extraId] >= 1);
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
