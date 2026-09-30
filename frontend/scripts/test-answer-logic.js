// Tests for src/lib/answerLogic.js. Plain Node, no dependencies.
// Usage: npm run test:logic
const assert = require("node:assert");
const {
  getCorrectIndexes,
  getRequiredCount,
  toggleSelection,
  canLock,
  isCorrect,
  getAnswerStates,
} = require("../src/lib/answerLogic");

const single = {
  type: "single",
  answers: [
    { text: "A", correct: false },
    { text: "B", correct: true },
    { text: "C", correct: false },
    { text: "D", correct: false },
  ],
};

const truefalse = {
  type: "truefalse",
  answers: [
    { text: "True", correct: false },
    { text: "False", correct: true },
  ],
};

// Correct: 0, 2, 4. Wrong: 1, 3, 5.
const multiple = {
  type: "multiple",
  answers: [
    { text: "A", correct: true },
    { text: "B", correct: false },
    { text: "C", correct: true },
    { text: "D", correct: false },
    { text: "E", correct: true },
    { text: "F", correct: false },
  ],
};

// Applies clicks in order, starting from an empty selection
const clickAll = (question, indexes) =>
  indexes.reduce((selected, index) => toggleSelection(question, selected, index), []);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("correct indexes and required count", () => {
  assert.deepStrictEqual(getCorrectIndexes(single), [1]);
  assert.deepStrictEqual(getCorrectIndexes(truefalse), [1]);
  assert.deepStrictEqual(getCorrectIndexes(multiple), [0, 2, 4]);
  assert.strictEqual(getRequiredCount(single), 1);
  assert.strictEqual(getRequiredCount(truefalse), 1);
  assert.strictEqual(getRequiredCount(multiple), 3);
});

test("single and truefalse: a click replaces the selection", () => {
  assert.deepStrictEqual(toggleSelection(single, [], 2), [2]);
  assert.deepStrictEqual(toggleSelection(single, [2], 0), [0]);
  assert.deepStrictEqual(toggleSelection(single, [2], 2), [2]);
  assert.deepStrictEqual(clickAll(single, [0, 3, 1]), [1]);
  assert.deepStrictEqual(toggleSelection(truefalse, [], 0), [0]);
  assert.deepStrictEqual(toggleSelection(truefalse, [0], 1), [1]);
});

test("multiple: toggle on and off", () => {
  assert.deepStrictEqual(clickAll(multiple, [1]), [1]);
  assert.deepStrictEqual(clickAll(multiple, [1, 3]), [1, 3]);
  assert.deepStrictEqual(clickAll(multiple, [1, 3, 1]), [3]);
  assert.deepStrictEqual(clickAll(multiple, [1, 1]), []);
});

test("multiple: no more than N selected", () => {
  assert.deepStrictEqual(clickAll(multiple, [0, 1, 2]), [0, 1, 2]);
  assert.deepStrictEqual(clickAll(multiple, [0, 1, 2, 3]), [0, 1, 2]);
  assert.deepStrictEqual(clickAll(multiple, [0, 1, 2, 3, 1, 3]), [0, 2, 3]);
});

test("out-of-range and invalid indexes are ignored", () => {
  [-1, 4, 99, 1.5, "1", undefined, null].forEach((index) => {
    assert.deepStrictEqual(toggleSelection(single, [2], index), [2]);
    assert.deepStrictEqual(toggleSelection(multiple, [0], index === 4 ? 6 : index), [0]);
  });
  assert.deepStrictEqual(toggleSelection(truefalse, [], 2), []);
});

test("toggleSelection always returns a new array", () => {
  const selected = [0, 1, 2];
  assert.notStrictEqual(toggleSelection(multiple, selected, 3), selected);
  assert.notStrictEqual(toggleSelection(single, selected, 9), selected);
});

test("canLock only with a complete selection", () => {
  assert.strictEqual(canLock(single, []), false);
  assert.strictEqual(canLock(single, [0]), true);
  assert.strictEqual(canLock(truefalse, []), false);
  assert.strictEqual(canLock(truefalse, [1]), true);
  assert.strictEqual(canLock(multiple, []), false);
  assert.strictEqual(canLock(multiple, [0, 1]), false);
  assert.strictEqual(canLock(multiple, [1, 3, 5]), true);
  assert.strictEqual(canLock(multiple, [0, 1, 2, 3]), false);
  assert.strictEqual(canLock(multiple, undefined), false);
});

test("isCorrect: single and truefalse", () => {
  assert.strictEqual(isCorrect(single, [1]), true);
  assert.strictEqual(isCorrect(single, [0]), false);
  assert.strictEqual(isCorrect(single, []), false);
  assert.strictEqual(isCorrect(truefalse, [1]), true);
  assert.strictEqual(isCorrect(truefalse, [0]), false);
});

test("isCorrect: multiple exact set vs subset vs superset vs different set", () => {
  assert.strictEqual(isCorrect(multiple, [0, 2, 4]), true);
  assert.strictEqual(isCorrect(multiple, [4, 0, 2]), true, "order must not matter");
  assert.strictEqual(isCorrect(multiple, [0, 2]), false, "subset");
  assert.strictEqual(isCorrect(multiple, [0, 2, 4, 1]), false, "superset");
  assert.strictEqual(isCorrect(multiple, [0, 2, 5]), false, "different set");
  assert.strictEqual(isCorrect(multiple, [1, 3, 5]), false, "all wrong");
  assert.strictEqual(isCorrect(multiple, [0, 0, 2]), false, "duplicates");
  assert.strictEqual(isCorrect(multiple, []), false);
  assert.strictEqual(isCorrect(multiple, undefined), false);
});

test("reveal states, including missed correct answers", () => {
  assert.deepStrictEqual(getAnswerStates(single, [1]), [
    "neutral", "correct", "neutral", "neutral",
  ]);
  assert.deepStrictEqual(getAnswerStates(single, [3]), [
    "neutral", "correct", "neutral", "wrong",
  ]);
  assert.deepStrictEqual(getAnswerStates(truefalse, [0]), ["wrong", "correct"]);
  assert.deepStrictEqual(getAnswerStates(multiple, [0, 2, 4]), [
    "correct", "neutral", "correct", "neutral", "correct", "neutral",
  ]);
  // 0 selected and correct, 1 and 3 selected and wrong, 2 and 4 missed
  assert.deepStrictEqual(getAnswerStates(multiple, [0, 1, 3]), [
    "correct", "wrong", "correct", "wrong", "correct", "neutral",
  ]);
  assert.deepStrictEqual(getAnswerStates(multiple, []), [
    "correct", "neutral", "correct", "neutral", "correct", "neutral",
  ]);
});

test("inputs are not mutated", () => {
  const questions = [single, truefalse, multiple];
  const before = structuredClone(questions);
  const selections = [[], [0], [1, 3], [0, 1, 2]];
  const selectionsBefore = structuredClone(selections);
  questions.forEach((question) => {
    selections.forEach((selected) => {
      [0, 1, 2, 3, 5, 9].forEach((index) => toggleSelection(question, selected, index));
      canLock(question, selected);
      isCorrect(question, selected);
      getAnswerStates(question, selected);
      getCorrectIndexes(question);
    });
  });
  assert.deepStrictEqual(questions, before);
  assert.deepStrictEqual(selections, selectionsBefore);
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
