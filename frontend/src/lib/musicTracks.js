// Background track per question number, the same mapping as the old Quiz.js.
// CommonJS so scripts/test-music-tracks.js can require it in plain Node.

const WIN_TRACK_KEY = "millionaireRave";

// Returns the track key for a question number, or null (no track)
const getTrackKey = (questionNumber) => {
  if (questionNumber < 6) {
    return "backgroundMusic";
  } else if (questionNumber < 9) {
    return "fiveToEight";
  } else if (questionNumber < 12) {
    return "eightToEleven";
  } else if (questionNumber < 14) {
    return "elevenToThirteen";
  } else if (questionNumber === 14) {
    return "fourteen";
  } else if (questionNumber === 15) {
    return "fifteen";
  } else if (questionNumber === 16) {
    return WIN_TRACK_KEY;
  }
  return null;
};

module.exports = { WIN_TRACK_KEY, getTrackKey };
