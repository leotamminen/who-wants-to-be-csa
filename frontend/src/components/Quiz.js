import React, { useState } from "react";
import {
  canLock,
  getAnswerStates,
  getRequiredCount,
  isCorrect,
  toggleSelection,
} from "../lib/answerLogic";

// Reveal state from answerLogic -> existing CSS class
const REVEAL_CLASSES = {
  correct: "answer correct",
  wrong: "answer incorrect",
  neutral: "answer",
};

const Quiz = ({
  question,
  setQuestionNumber,
  setTimeOut,
  practiceMode,
  onResult,
}) => {
  // Indexes of the selected answers
  const [selected, setSelected] = useState([]);
  const [answersLocked, setAnswersLocked] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Delays the execution of a callback function for any given time
  const delay = (duration, callBack) => {
    setTimeout(() => {
      callBack();
    }, duration);
  };

  // Clears the answer state. Called in the same handler that moves to the
  // next question, so the new question never renders with the old state.
  const resetAnswer = () => {
    setSelected([]);
    setAnswersLocked(false);
    setRevealed(false);
  };

  // Handles the click for answers
  const handleClick = (index) => {
    if (!answersLocked) {
      setSelected((prev) => toggleSelection(question, prev, index));
    }
  };

  // Handles the "Lock Answer" button click
  const handleLockIn = () => {
    if (answersLocked || !canLock(question, selected)) {
      return;
    }
    setAnswersLocked(true); // Lock answers to prevent multiple clicks
    const correct = isCorrect(question, selected);
    const texts = selected.map((index) => question.answers[index].text);
    console.log(`Locked: ${JSON.stringify(texts)} -> ${correct ? "correct" : "wrong"}`);

    // Reveal after 3 seconds. Practice mode then waits for Next, the classic
    // game moves on after 1 more second.
    delay(3000, () => {
      setRevealed(true);
      onResult(correct);
      if (practiceMode) {
        return;
      }
      delay(1000, () => {
        if (correct) {
          resetAnswer();
          setQuestionNumber((prev) => prev + 1);
        } else {
          // Set the timeOut state to true to trigger "game over" message
          setTimeOut(true);
        }
      });
    });
  };

  // Practice mode: the Next button after the reveal
  const handleNext = () => {
    resetAnswer();
    setQuestionNumber((prev) => prev + 1);
  };

  const requiredCount = getRequiredCount(question);
  const showExplanation = practiceMode && revealed && question;
  const answerStates = revealed ? getAnswerStates(question, selected) : null;
  const answerClass = (index) =>
    answerStates
      ? REVEAL_CLASSES[answerStates[index]]
      : selected.includes(index)
      ? "answer active"
      : "answer";

  return (
    <div className="quiz">
      <div className="question">{question?.question}</div>
      {question?.type === "multiple" && (
        <p>
          Select {requiredCount} answers. Selected {selected.length}/{requiredCount}
        </p>
      )}
      <div className={`answers ${answersLocked ? "answers-locked" : ""}`}>
        {question?.answers.map((item, index) => (
          <div
            key={index}
            className={answerClass(index)}
            onClick={() => handleClick(index)}
          >
            {item.text}
          </div>
        ))}
      </div>
      {showExplanation ? (
        <>
          <div className="explanation">
            <p>{isCorrect(question, selected) ? "Correct!" : "Wrong."}</p>
            <p>{question.explanation}</p>
          </div>
          <button className="lock-in-button" onClick={handleNext}>
            Next
          </button>
        </>
      ) : (
        <button
          className="lock-in-button"
          onClick={handleLockIn}
          disabled={answersLocked || !canLock(question, selected)}
        >
          Lock Answer
        </button>
      )}
    </div>
  );
};

export default Quiz;
