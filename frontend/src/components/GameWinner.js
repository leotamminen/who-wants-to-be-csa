// GameWinner.js
import React from "react";

// Classic win by default. Practice mode passes a title, the score and the
// total, and gets the play-again link from GameOver.
function GameWinner({
  className,
  title = "Congrats! You are CSA certified!",
  score,
  total,
}) {
  const refreshPage = () => {
    window.location.reload();
  };

  return (
    <div className={`game-over ${className}`}>
      <h1>{title}</h1>
      {score !== undefined && (
        <>
          <h2>
            Score: {score} / {total}
          </h2>
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
        </>
      )}
    </div>
  );
}

export default GameWinner;
