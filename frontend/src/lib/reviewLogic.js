// Review helpers for scripts/review-questions.js.
// Pure functions, CommonJS, no dependencies. Never mutates its inputs.

// Phase 10 target pool sizes (CLAUDE.md). Extra: Leo decides, no target.
const PHASE10_TARGETS = {
  "platform-overview": 10,
  "instance-configuration": 15,
  collaboration: 30,
  "self-service-automation": 30,
  "database-management": 45,
  "data-migration-integration": 20,
};

const listUnreviewed = (questions, categoryId) =>
  questions.filter(
    (q) => q.reviewed !== true && (!categoryId || q.category === categoryId)
  );

// Compact text block for one question, + marks correct answers
const formatQuestion = (q) => {
  const lines = [
    `${q.id}  ${q.type}  difficulty ${q.difficulty}  (${q.category})`,
    `  Q: ${q.question}`,
    ...(Array.isArray(q.answers) ? q.answers : []).map(
      (answer) => `    ${answer.correct ? "+" : "-"} ${answer.text}`
    ),
    `  Explanation: ${q.explanation}`,
  ];
  if (q.source) {
    lines.push(`  Source: ${q.source}`);
  }
  return lines.join("\n");
};

// Returns { errors } for unknown ids (nothing changed), otherwise
// { questions, changed, unchanged } with copies of the changed questions
const setReviewed = (questions, ids, value) => {
  const known = new Set(questions.map((q) => q.id));
  const unknown = ids.filter((id) => !known.has(id));
  if (ids.length === 0) {
    return { errors: ["give at least one question id"] };
  }
  if (unknown.length > 0) {
    return { errors: unknown.map((id) => `unknown id "${id}"`) };
  }
  const wanted = new Set(ids);
  const changed = [];
  const unchanged = [];
  const updated = questions.map((q) => {
    if (!wanted.has(q.id)) {
      return q;
    }
    if (q.reviewed === value) {
      unchanged.push(q.id);
      return q;
    }
    changed.push(q.id);
    return { ...q, reviewed: value };
  });
  return { questions: updated, changed, unchanged };
};

// One row per category: total, reviewed, unreviewed, target and gap.
// The gap is the number of reviewed questions still missing to reach the
// target (null when the category has no target).
const getStatus = (questions, categories) =>
  categories.map((category) => {
    const inCategory = questions.filter((q) => q.category === category.id);
    const reviewed = inCategory.filter((q) => q.reviewed === true).length;
    const target = category.id in PHASE10_TARGETS ? PHASE10_TARGETS[category.id] : null;
    return {
      category: category.id,
      total: inCategory.length,
      reviewed,
      unreviewed: inCategory.length - reviewed,
      target,
      gap: target === null ? null : Math.max(0, target - reviewed),
    };
  });

const formatStatus = (rows) => {
  const columns = ["category", "total", "reviewed", "unreviewed", "target", "gap"];
  const cell = (row, column) =>
    row[column] === null || row[column] === undefined ? "-" : String(row[column]);
  const sum = (column) =>
    rows.reduce((total, row) => total + (typeof row[column] === "number" ? row[column] : 0), 0);
  const totalRow = Object.fromEntries(
    columns.map((column) => [column, column === "category" ? "total" : sum(column)])
  );
  const header = Object.fromEntries(columns.map((column) => [column, column]));
  const all = [header, ...rows, totalRow];
  const widths = columns.map((column) => Math.max(...all.map((row) => cell(row, column).length)));
  const format = (row) =>
    columns
      .map((column, index) =>
        index === 0
          ? cell(row, column).padEnd(widths[index])
          : cell(row, column).padStart(widths[index])
      )
      .join("  ");
  const separator = widths.map((width) => "-".repeat(width)).join("  ");
  return [format(header), separator, ...rows.map(format), separator, format(totalRow)].join("\n");
};

module.exports = {
  PHASE10_TARGETS,
  listUnreviewed,
  formatQuestion,
  setReviewed,
  getStatus,
  formatStatus,
};
