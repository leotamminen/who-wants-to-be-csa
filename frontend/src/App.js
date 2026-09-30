import React, { useEffect, useState } from "react";
import "./App.css";
import GameOver from "./components/GameOver";
import GameWinner from "./components/GameWinner";
import Quiz from "./components/Quiz";
import Timer from "./components/Timer";
import { prizeSums } from "./questions";
import Start from "./components/Start";
import { buildRun, getQuestionPool } from "./lib/runBuilder";

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
  const [isMillionaire, setIsMillionaire] = useState(false);
  const [earnedMoney, setEarnedMoney] = useState("0 €");
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

  // Update earned money when the question number changes
  useEffect(() => {
    // only start tracking after player got through first question
    questionNumber > 1 &&
      setEarnedMoney(
        prizeSums.find((item) => item.id === questionNumber - 1).amount
      );
  }, [questionNumber]);

  // The run is won once the question number passes the last question.
  // Handled in an effect, never during render.
  useEffect(() => {
    if (run.length > 0 && questionNumber > run.length) {
      setIsMillionaire(true);
    }
  }, [questionNumber, run.length]);

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
                  earnedMoney={earnedMoney}
                  name={name}
                />
              ) : isMillionaire ? (
                <GameWinner className="game-over" />
              ) : (
                <Quiz
                  question={question}
                  questionNumber={questionNumber}
                  setQuestionNumber={setQuestionNumber}
                  setTimeOut={setTimeOut}
                  setAnswersLocked={setAnswersLocked}
                />
              )}
            </div>
          </div>
          <div className="money-container">
            <ul className="money-list">
              {prizeSums.map((item) => (
                <li
                  key={item.id}
                  className={
                    questionNumber === item.id ? "item active" : "item"
                  }
                >
                  <h5 className="amount">{item.amount}</h5>
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
