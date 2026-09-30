// Tests for src/lib/musicTracks.js. Plain Node, no dependencies.
// Usage: npm run test:logic
const assert = require("node:assert");
const { getTrackKey, WIN_TRACK_KEY } = require("../src/lib/musicTracks");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("track per question number matches the old Quiz.js mapping", () => {
  const expected = {
    1: "backgroundMusic",
    2: "backgroundMusic",
    3: "backgroundMusic",
    4: "backgroundMusic",
    5: "backgroundMusic",
    6: "fiveToEight",
    7: "fiveToEight",
    8: "fiveToEight",
    9: "eightToEleven",
    10: "eightToEleven",
    11: "eightToEleven",
    12: "elevenToThirteen",
    13: "elevenToThirteen",
    14: "fourteen",
    15: "fifteen",
    16: "millionaireRave",
  };
  Object.entries(expected).forEach(([number, key]) => {
    assert.strictEqual(getTrackKey(Number(number)), key, `question ${number}`);
  });
});

test("win track is the question 16 track", () => {
  assert.strictEqual(WIN_TRACK_KEY, "millionaireRave");
  assert.strictEqual(getTrackKey(16), WIN_TRACK_KEY);
});

test("no track after 16", () => {
  assert.strictEqual(getTrackKey(17), null);
  assert.strictEqual(getTrackKey(100), null);
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
