import React from "react";

// Function for refreshing the page when clicked "here".
function GameOver({ className, questionNumber }) {
  const refreshPage = () => {
    window.location.reload();
  };

  return (
    <div className={className}>
      <h1 className="gameover-h1">Game Over</h1>
      <h2>You reached question {questionNumber}</h2>

      <p>
        You can try again by pressing{" "}
        <span
          style={{ textDecoration: "underline", cursor: "pointer" }}
          onClick={refreshPage}
        >
          here
        </span>{" "}
        or by refreshing the page.
      </p>
    </div>
  );
}

export default GameOver;
