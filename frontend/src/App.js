import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import GameOver from "./components/GameOver";
import GameWinner from "./components/GameWinner";
import Quiz from "./components/Quiz";
import Start from "./components/Start";
import useBackgroundMusic from "./hooks/useBackgroundMusic";
import {
  buildRun,
  DEFAULT_RUN_LENGTH,
  getQuestionPool,
} from "./lib/runBuilder";
import {
  getDefaultSettings,
  getSettingsProblem,
  getShares,
} from "./lib/settingsLogic";

// Ladder: question numbers, highest on top
const LADDER = Array.from(
  { length: DEFAULT_RUN_LENGTH },
  (_, index) => DEFAULT_RUN_LENGTH - index
);

// Builds the question set for one run. Async so the optional DB source
// (Phase 9b) can plug in here. For now only the hard coded source exists,
// so it resolves immediately.
const loadRun = async (settings) => {
  const { categories, questions } = getQuestionPool();
  return buildRun({ categories, questions, settings });
};

function App() {
  const [name, setName] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [timeOut, setTimeOut] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [runStatus, setRunStatus] = useState("loading");
  const [run, setRun] = useState([]);

  // Hard coded pool for the settings panel (categories and counts)
  const [pool] = useState(() => getQuestionPool());
  const poolCounts = useMemo(
    () =>
      pool.questions.reduce((counts, q) => {
        counts[q.category] = (counts[q.category] || 0) + 1;
        return counts;
      }, {}),
    [pool]
  );
  const [settings, setSettings] = useState(() =>
    getDefaultSettings(pool.categories)
  );
  const practiceMode = settings.practiceMode;

  const question = run[questionNumber - 1] || null;

  // Build the run on mount and again when the category or weight settings
  // change (not for music or practice mode). The cancel flag drops stale
  // builds, including the first of the two StrictMode effect runs.
  useEffect(() => {
    let cancelled = false;
    const runSettings = { enabled: settings.enabled, weights: settings.weights };
    setRunStatus("loading");
    loadRun(runSettings)
      .then((result) => {
        if (!cancelled) {
          console.log(
            `Run built (${result.status}): ${result.run.length} questions, per category:`,
            result.counts
          );
          console.log("Settings for this run:", {
            ...runSettings,
            shares: getShares(runSettings, pool.categories, poolCounts),
          });
          setRun(result.run);
          setRunStatus(result.status);
        }
      })
      .catch((error) => {
        console.warn("Loading the run failed:", error);
        if (!cancelled) {
          setRunStatus("too-few");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [settings.enabled, settings.weights, pool, poolCounts]);

  // Background music: off on the start screen and after game over, the win
  // track after a win or practice completion
  const musicPhase = !name
    ? "idle"
    : timeOut
    ? "over"
    : isFinished
    ? "won"
    : "playing";
  useBackgroundMusic({
    enabled: settings.musicOn,
    questionNumber,
    phase: musicPhase,
  });

  // Why Start is disabled, if it is
  const startMessage =
    getSettingsProblem(settings, pool.categories, poolCounts) ||
    (runStatus === "too-few" ? "Not enough questions for these settings" : null);

  // Debug aid: log each question when it is shown
  useEffect(() => {
    if (name && question) {
      console.log(`Question ${questionNumber}:`, {
        id: question.id,
        category: question.category,
        type: question.type,
        correct: question.answers.filter((a) => a.correct).map((a) => a.text),
        source: question.source,
      });
    }
  }, [name, question, questionNumber]);

  // The run is finished once the question number passes the last question.
  // Handled in an effect, never during render.
  useEffect(() => {
    if (run.length > 0 && questionNumber > run.length) {
      setIsFinished(true);
    }
  }, [questionNumber, run.length]);

  // Called by Quiz at the reveal of each answer
  const handleResult = (correct) => {
    if (correct) {
      setScore((prev) => prev + 1);
    }
  };

  // Only render the game content if the name is provided
  return (
    <div className="App">
      {name ? (
        <>
          <div className="game-container">
            {/* Timer circle hidden, the timer is disabled (Timer.js kept) */}
            <div className="timer-container" />
            {/* Replaces the ladder on narrow screens (CSS) */}
            {!timeOut && !isFinished && questionNumber <= run.length && (
              <div className="question-progress">
                Question {questionNumber} / {run.length}
              </div>
            )}
            <div className="game">
              {timeOut ? (
                <GameOver
                  className="game-over"
                  questionNumber={questionNumber}
                />
              ) : isFinished ? (
                practiceMode ? (
                  <GameWinner
                    className="game-over"
                    title="Practice complete"
                    score={score}
                    total={run.length}
                  />
                ) : (
                  <GameWinner className="game-over" />
                )
              ) : (
                <Quiz
                  question={question}
                  setQuestionNumber={setQuestionNumber}
                  setTimeOut={setTimeOut}
                  practiceMode={practiceMode}
                  onResult={handleResult}
                />
              )}
            </div>
          </div>
          <div className="money-container">
            <ul className="money-list">
              {LADDER.map((number) => (
                <li
                  key={number}
                  className={questionNumber === number ? "item active" : "item"}
                >
                  <h5 className="amount">{number}</h5>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <Start
          setName={setName}
          setTimeOut={setTimeOut}
          runStatus={runStatus}
          message={startMessage}
          settings={settings}
          setSettings={setSettings}
          categories={pool.categories}
          poolCounts={poolCounts}
        />
      )}
    </div>
  );
}

export default App;
