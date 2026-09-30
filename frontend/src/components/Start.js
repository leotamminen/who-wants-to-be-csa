// TODO:
// language en/fi select (?)
// darkmode switch (?)
// scoreboard (?)
// about page (?)
// difficulty select(?)
import React, { useRef } from "react";
import {
  getDefaultSettings,
  getShares,
  MAX_WEIGHT,
  setEnabled,
  setFlag,
  setWeight,
} from "../lib/settingsLogic";

const Start = ({
  setName,
  setTimeOut,
  runStatus,
  message,
  settings,
  setSettings,
  categories,
  poolCounts,
}) => {
  const inputRef = useRef();
  const isReady = runStatus === "ready" && !message;
  const shares = getShares(settings, categories, poolCounts);

  const handleClick = () => {
    // Start only once the whole question set for the run is built
    if (!isReady) {
      return;
    }
    setTimeOut(false);
    const nameInput = inputRef.current.value.trim(); // Trim any extra spaces from name
    if (!nameInput) {
      alert("Please input a name first");
      inputRef.current.value = ""; // Clear input box if it is empty or just spaces
    } else {
      setName(nameInput);
      console.log("Name is:", nameInput, {
        practiceMode: settings.practiceMode,
        musicOn: settings.musicOn,
      });
    }
  };

  // Function for enter key press
  const handleKeyPress = (event) => {
    if (event.key === "Enter") {
      handleClick();
    }
  };

  return (
    <div className="username-container">
      <div className="input-button-container">
        <h1 className="start-h1">Who wants to be CSA certified</h1>
        <input
          type="text"
          placeholder="Your name"
          ref={inputRef}
          className="username-box"
          onKeyDown={handleKeyPress} // This makes sure enter key works also
        />
        <button
          className="username-button"
          onClick={handleClick}
          disabled={!isReady}
        >
          {runStatus === "loading" ? "Loading questions..." : "Let's start!"}
        </button>
        {message && <p>{message}</p>}
        <details className="settings">
          <summary>Settings</summary>
          <label className="settings-flag">
            <input
              type="checkbox"
              checked={settings.practiceMode}
              onChange={(event) =>
                setSettings((prev) =>
                  setFlag(prev, "practiceMode", event.target.checked)
                )
              }
            />{" "}
            Practice mode
          </label>
          <label className="settings-flag">
            <input
              type="checkbox"
              checked={settings.musicOn}
              onChange={(event) =>
                setSettings((prev) =>
                  setFlag(prev, "musicOn", event.target.checked)
                )
              }
            />{" "}
            Music
          </label>
          <table className="settings-table">
            <thead>
              <tr>
                <th>On</th>
                <th>Category</th>
                <th>Weight</th>
                <th>Share</th>
                <th>Questions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Use ${category.name}`}
                      checked={Boolean(settings.enabled[category.id])}
                      onChange={(event) =>
                        setSettings((prev) =>
                          setEnabled(prev, category.id, event.target.checked)
                        )
                      }
                    />
                  </td>
                  <td>{category.name}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max={MAX_WEIGHT}
                      step="1"
                      aria-label={`Weight for ${category.name}`}
                      value={settings.weights[category.id]}
                      onChange={(event) =>
                        setSettings((prev) =>
                          setWeight(prev, category.id, event.target.value)
                        )
                      }
                    />
                  </td>
                  <td>{shares[category.id]}%</td>
                  <td>{poolCounts[category.id] || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="username-button"
            onClick={() => setSettings(getDefaultSettings(categories))}
          >
            Reset to defaults
          </button>
        </details>
      </div>
    </div>
  );
};

export default Start;
