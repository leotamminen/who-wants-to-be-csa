import React, { useState, useEffect, useRef } from "react";
import Background_music from "../assets/Background_music.mp3";
import fiveToEight from "../assets/five-eight.mp3";
import eightToEleven from "../assets/eight-eleven.mp3";
import elevenToThirteen from "../assets/eleven-thirteen.mp3";
import fourteen from "../assets/fourteen.mp3";
import fifteen from "../assets/fifteen.mp3";
import millionaireRave from "../assets/MillionaireRave.mp3";
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
  questionNumber,
  setQuestionNumber,
  setTimeOut,
  practiceMode,
  onResult,
}) => {
  // Indexes of the selected answers
  const [selected, setSelected] = useState([]);
  const [answersLocked, setAnswersLocked] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // refs for various audio tracks
  const audioRefs = {
    backgroundMusic: useRef(new Audio(Background_music)),
    fiveToEight: useRef(new Audio(fiveToEight)),
    eightToEleven: useRef(new Audio(eightToEleven)),
    elevenToThirteen: useRef(new Audio(elevenToThirteen)),
    fourteen: useRef(new Audio(fourteen)),
    fifteen: useRef(new Audio(fifteen)),
    millionaireRave: useRef(new Audio(millionaireRave)),
    // TODO: add correct/incorrect sounds, maybe lock in answer
  };

  const playAudio = (audioRef) => {
    document.addEventListener("click", function playAudioOnInteraction() {
      Object.values(audioRefs).forEach((ref) => {
        if (ref.current !== audioRef.current) {
          ref.current.pause();
          ref.current.currentTime = 0;
        }
      });

      audioRef.current.loop = true;
      audioRef.current.play();

      document.removeEventListener("click", playAudioOnInteraction);
    });
  };

  useEffect(() => {
    const {
      backgroundMusic,
      fiveToEight,
      eightToEleven,
      elevenToThirteen,
      fourteen,
      fifteen,
      millionaireRave,
    } = audioRefs;

    // Play specific songs for question numbers. Works fine for different rounds
    if (questionNumber < 6) {
      playAudio(backgroundMusic);
    } else if (questionNumber < 9) {
      playAudio(fiveToEight);
    } else if (questionNumber < 12) {
      playAudio(eightToEleven);
    } else if (questionNumber < 14) {
      playAudio(elevenToThirteen);
    } else if (questionNumber === 14) {
      playAudio(fourteen);
    } else if (questionNumber === 15) {
      playAudio(fifteen);
    } else if (questionNumber === 16) {
      playAudio(millionaireRave);
    }
    // Audio is rewritten in Phase 7, until then it runs once per question
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionNumber]);

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
