import { useEffect } from "react";
import Background_music from "../assets/Background_music.mp3";
import fiveToEight from "../assets/five-eight.mp3";
import eightToEleven from "../assets/eight-eleven.mp3";
import elevenToThirteen from "../assets/eleven-thirteen.mp3";
import fourteen from "../assets/fourteen.mp3";
import fifteen from "../assets/fifteen.mp3";
import millionaireRave from "../assets/MillionaireRave.mp3";
import { getTrackKey, WIN_TRACK_KEY } from "../lib/musicTracks";

const TRACK_FILES = {
  backgroundMusic: Background_music,
  fiveToEight,
  eightToEleven,
  elevenToThirteen,
  fourteen,
  fifteen,
  millionaireRave,
};

// One Audio object per track, created on first use and never again
let tracks = null;
const getTracks = () => {
  if (!tracks) {
    tracks = Object.fromEntries(
      Object.entries(TRACK_FILES).map(([key, file]) => {
        const audio = new Audio(file);
        audio.loop = true;
        return [key, audio];
      })
    );
  }
  return tracks;
};

// Pauses and rewinds every track except keepKey
const stopAll = (keepKey = null) => {
  if (!tracks) {
    return;
  }
  Object.entries(tracks).forEach(([key, audio]) => {
    if (key !== keepKey) {
      audio.pause();
      audio.currentTime = 0;
    }
  });
};

const playTrack = (key) => {
  const audio = getTracks()[key];
  stopAll(key);
  if (!audio || !audio.paused) {
    return;
  }
  // The browser may refuse to play before a user gesture (autoplay policy).
  // The Start click is that gesture, so a refusal is ignored silently.
  const playing = audio.play();
  if (playing && typeof playing.catch === "function") {
    playing.catch(() => {});
  }
};

// phase: "idle" | "playing" | "won" | "over"
const useBackgroundMusic = ({ enabled, questionNumber, phase }) => {
  const trackKey = !enabled
    ? null
    : phase === "playing"
    ? getTrackKey(questionNumber)
    : phase === "won"
    ? WIN_TRACK_KEY
    : null;

  // Switches as soon as the track for the current state changes
  useEffect(() => {
    if (trackKey) {
      playTrack(trackKey);
    } else {
      stopAll();
    }
  }, [trackKey]);

  // Silence on unmount
  useEffect(() => () => stopAll(), []);
};

export default useBackgroundMusic;
