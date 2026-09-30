// Start screen settings: defaults, updates, shares and problems.
// Pure functions, no React. CommonJS so scripts/test-settings-logic.js can
// require it in plain Node. Every update returns a new object.
// The settings object also works as the settings argument of buildRun,
// which reads only enabled and weights.

const MAX_WEIGHT = 100;
const FLAGS = ["practiceMode", "musicOn"];

const categoryList = (categories) => (Array.isArray(categories) ? categories : []);

const getDefaultSettings = (categories) => ({
  practiceMode: true,
  musicOn: false,
  enabled: Object.fromEntries(categoryList(categories).map((c) => [c.id, !c.extra])),
  weights: Object.fromEntries(categoryList(categories).map((c) => [c.id, c.weight])),
});

// Integer 0-100. NaN, empty and other garbage become 0.
const parseWeight = (value) => {
  const text = typeof value === "string" ? value.trim() : value;
  const number = text === "" || text === null ? NaN : Number(text);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.min(MAX_WEIGHT, Math.max(0, Math.round(number)));
};

const setWeight = (settings, id, value) => ({
  ...settings,
  weights: { ...(settings && settings.weights), [id]: parseWeight(value) },
});

const setEnabled = (settings, id, value) => ({
  ...settings,
  enabled: { ...(settings && settings.enabled), [id]: Boolean(value) },
});

// Only practiceMode and musicOn. Other names return an unchanged copy.
const setFlag = (settings, name, value) =>
  FLAGS.includes(name) ? { ...settings, [name]: Boolean(value) } : { ...settings };

// Same fallbacks as buildRun: missing entries come from categories.json
const resolveCategory = (settings, category) => {
  const enabled = settings && settings.enabled && settings.enabled[category.id];
  const weight = settings && settings.weights && settings.weights[category.id];
  return {
    enabled: typeof enabled === "boolean" ? enabled : !category.extra,
    weight:
      typeof weight === "number" && Number.isFinite(weight) && weight >= 0
        ? weight
        : category.weight,
  };
};

const countOf = (poolCounts, id) => (poolCounts && poolCounts[id]) || 0;

// Effective share in whole percent among the participating categories
// (enabled, weight > 0, questions in the pool). 0 for the others.
const getShares = (settings, categories, poolCounts) => {
  const rows = categoryList(categories).map((category) => {
    const { enabled, weight } = resolveCategory(settings, category);
    const participates = enabled && weight > 0 && countOf(poolCounts, category.id) > 0;
    return { id: category.id, weight: participates ? weight : 0 };
  });
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  return Object.fromEntries(
    rows.map((row) => [row.id, total > 0 ? Math.round((row.weight * 100) / total) : 0])
  );
};

// null when the settings can build a run, otherwise a short message
const getSettingsProblem = (settings, categories, poolCounts) => {
  const enabled = categoryList(categories)
    .map((category) => ({ id: category.id, ...resolveCategory(settings, category) }))
    .filter((row) => row.enabled);
  if (enabled.length === 0) {
    return "Enable at least one category";
  }
  const weighted = enabled.filter((row) => row.weight > 0);
  if (weighted.length === 0) {
    return "Give an enabled category a weight above 0";
  }
  if (weighted.every((row) => countOf(poolCounts, row.id) === 0)) {
    return "No questions available for the enabled categories";
  }
  return null;
};

module.exports = {
  MAX_WEIGHT,
  getDefaultSettings,
  setWeight,
  setEnabled,
  setFlag,
  getShares,
  getSettingsProblem,
};
