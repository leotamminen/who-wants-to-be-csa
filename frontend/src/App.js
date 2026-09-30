import React, { useEffect, useState } from "react";
import "./App.css";
import GameOver from "./components/GameOver";
import GameWinner from "./components/GameWinner";
import Quiz from "./components/Quiz";
import Timer from "./components/Timer";
import Start from "./components/Start";
import {
  buildRun,
  DEFAULT_RUN_LENGTH,
  getQuestionPool,
} from "./lib/runBuilder";

// Ladder: question numbers, highest on top
const LADDER = Array.from(
  { length: DEFAULT_RUN_LENGTH },
  (_, index) => DEFAULT_RUN_LENGTH - index
);

// Temporary until the Phase 7 settings: ?practice=off turns practice mode off
const readPracticeMode = () =>
  new URLSearchParams(window.location.search).get("practice") !== "off";

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
  const [answersLocked, setAnswersLocked] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [practiceMode] = useState(readPracticeMode);
  const [score, setScore] = useState(0);
  const [runStatus, setRunStatus] = useState("loading");
  const [run, setRun] = useState([]);

  const question = run[questionNumber - 1] || null;

  // Build the run once. The cancel flag ignores the first of the two
  // StrictMode effect runs in development.
  useEffect(() => {
    let cancelled = false;
    loadRun({})
      .then((result) => {
        if (!cancelled) {
          console.log(
            `Run built (${result.status}): ${result.run.length} questions, per category:`,
            result.counts
          );
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
  }, []);

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
            <div className="timer-container">
              <div className="timer">
                <Timer
                  setTimeOut={setTimeOut}
                  questionNumber={questionNumber}
                  answersLocked={answersLocked}
                />
              </div>
            </div>
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
                  questionNumber={questionNumber}
                  setQuestionNumber={setQuestionNumber}
                  setTimeOut={setTimeOut}
                  setAnswersLocked={setAnswersLocked}
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
        />
      )}
    </div>
  );
}

export default App;
