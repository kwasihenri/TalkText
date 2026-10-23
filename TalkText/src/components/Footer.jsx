import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div className="footer-copy">
          <strong>TalkText Studio</strong> &bull; Custom Voice Dictation & Programmable TTS Engine.
        </div>
        <div className="footer-links">
          <Link to="/speech-to-text" className="footer-link">
            <i className="fa-solid fa-microphone"></i> Dictation
          </Link>
          <Link to="/text-to-speech" className="footer-link">
            <i className="fa-solid fa-volume-high"></i> TTS Synthesizer
          </Link>
          <Link to="/exam-recorder" className="footer-link">
            <i className="fa-solid fa-graduation-cap"></i> Exam Recorder
          </Link>
          <Link to="/settings" className="footer-link">
            <i className="fa-solid fa-gear"></i> Voice Rules
          </Link>
          <span style={{ fontSize: "0.8rem", color: "var(--brand-muted-light)" }}>
            | Zero telemetry &bull; Browser-local processing
          </span>
        </div>
      </div>
    </footer>
  );
}
