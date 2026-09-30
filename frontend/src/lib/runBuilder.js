// Builds the question set for one run from the hard coded pool.
// Pure functions, no React. CommonJS so scripts/test-run-builder.js can
// require it in plain Node.

const questionsData = require("../data/questions.json");
const categoriesData = require("../data/categories.json");
const { validateQuestion } = require("./validateQuestion");

const DEFAULT_RUN_LENGTH = 15;
const TIE_EPSILON = 1e-9;

// Unreviewed questions are allowed outside production builds, or when
// REACT_APP_ALLOW_UNREVIEWED is "true" (see Review rule in CLAUDE.md).
const getDefaultOptions = () => ({
  includeUnreviewed:
    process.env.NODE_ENV !== "production" ||
    process.env.REACT_APP_ALLOW_UNREVIEWED === "true",
});

// Drops invalid questions, duplicate ids and (unless includeUnreviewed)
// unreviewed questions. Returns new arrays, the input is not changed.
const filterPool = (questions, categories, { includeUnreviewed }) => {
  const pool = [];
  const seenIds = new Set();
  (Array.isArray(questions) ? questions : []).forEach((q, index) => {
    const errors = validateQuestion(q, categories);
    const label = q && typeof q.id === "string" ? q.id : `#${index + 1}`;
    if (errors.length > 0) {
      console.warn(`Question ${label} dropped:`, errors);
      return;
    }
    if (seenIds.has(q.id)) {
      console.warn(`Question ${label} dropped: duplicate id`);
      return;
    }
    seenIds.add(q.id);
    if (q.reviewed || includeUnreviewed) {
      pool.push(q);
    }
  });
  return pool;
};

// The hard coded source: questions.json filtered for this build.
const getQuestionPool = ({ includeUnreviewed } = getDefaultOptions()) => ({
  categories: categoriesData,
  questions: filterPool(questionsData, categoriesData, { includeUnreviewed }),
});

// Fisher-Yates on a copy
const shuffle = (items, random) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const isValidWeight = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

// Enabled flag and weight per category. Missing or invalid settings fall
// back to categories.json (enabled = !extra, weight = its weight).
const resolveSettings = (categories, settings) => {
  const enabled = (settings && settings.enabled) || {};
  const weights = (settings && settings.weights) || {};
  return categories.map((category) => ({
    id: category.id,
    enabled:
      typeof enabled[category.id] === "boolean"
        ? enabled[category.id]
        : !category.extra,
    weight: isValidWeight(weights[category.id])
      ? weights[category.id]
      : isValidWeight(category.weight)
      ? category.weight
      : 0,
  }));
};

// Assigns slots one at a time to the participating category with questions
// left and the largest (target - assigned). Same result as largest remainder
// rounding, and slots move to other categories when one runs out.
const allocate = (participants, runLength, random) => {
  const totalWeight = participants.reduce((sum, p) => sum + p.weight, 0);
  const assigned = participants.map(() => 0);
  const targets = participants.map((p) => (runLength * p.weight) / totalWeight);

  for (let slot = 0; slot < runLength; slot++) {
    let best = -Infinity;
    let candidates = [];
    participants.forEach((p, index) => {
      if (assigned[index] >= p.available) {
        return;
      }
      const deficit = targets[index] - assigned[index];
      if (deficit > best + TIE_EPSILON) {
        best = deficit;
        candidates = [index];
      } else if (Math.abs(deficit - best) <= TIE_EPSILON) {
        candidates.push(index);
      }
    });
    if (candidates.length === 0) {
      break;
    }
    const pick = candidates[Math.floor(random() * candidates.length)];
    assigned[pick] += 1;
  }
  return assigned;
};

// Copy of a question for the run: answers copied and shuffled (truefalse
// keeps its order), source added.
const prepareQuestion = (q, random) => {
  const answers = q.answers.map((answer) => ({ ...answer }));
  return {
    ...q,
    answers: q.type === "truefalse" ? answers : shuffle(answers, random),
    source: q.source || "hardcoded",
  };
};

// Returns { status: "ready" | "too-few", run, counts }. Never throws.
const buildRun = ({
  categories,
  questions,
  settings,
  runLength = DEFAULT_RUN_LENGTH,
  random = Math.random,
} = {}) => {
  try {
    const categoryList = Array.isArray(categories) ? categories : [];
    const questionList = Array.isArray(questions) ? questions : [];

    const byCategory = {};
    questionList.forEach((q) => {
      if (q && typeof q.category === "string") {
        (byCategory[q.category] = byCategory[q.category] || []).push(q);
      }
    });

    const participants = resolveSettings(categoryList, settings)
      .map((c) => ({ ...c, available: (byCategory[c.id] || []).length }))
      .filter((c) => c.enabled && c.weight > 0 && c.available > 0);

    const counts = Object.fromEntries(categoryList.map((c) => [c.id, 0]));
    let picked = [];
    if (participants.length > 0) {
      const assigned = allocate(participants, runLength, random);
      participants.forEach((p, index) => {
        counts[p.id] = assigned[index];
        picked = picked.concat(
          shuffle(byCategory[p.id], random).slice(0, assigned[index])
        );
      });
    }

    // Shuffle first so the stable sort breaks difficulty ties randomly
    const run = shuffle(picked, random)
      .sort((a, b) => a.difficulty - b.difficulty)
      .map((q) => prepareQuestion(q, random));

    return {
      status: run.length === runLength ? "ready" : "too-few",
      run,
      counts,
    };
  } catch (error) {
    console.warn("Building the run failed:", error);
    return { status: "too-few", run: [], counts: {} };
  }
};

module.exports = {
  DEFAULT_RUN_LENGTH,
  getDefaultOptions,
  filterPool,
  getQuestionPool,
  buildRun,
};
