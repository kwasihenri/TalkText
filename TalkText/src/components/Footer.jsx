import React from "react";

export default function Footer() {
  const hasRecognition =
    typeof window !== "undefined" &&
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  const hasSynthesis =
    typeof window !== "undefined" && "speechSynthesis" in window;

  return (
    <footer className="app-footer" aria-label="Application Status Bar">
      <div className="footer-inner">
        <div className="footer-status-left">
          <span className="footer-status-item">
            <span className="status-indicator-dot online"></span>
            <strong>TalkText Studio</strong>
            <span className="app-ver-pill">v2.0</span>
          </span>
          <span className="footer-status-divider">&bull;</span>
          <span className="footer-status-item privacy-pill">
            <i className="fa-solid fa-shield-halved"></i> Local Browser Engine &bull; Zero Cloud Telemetry
          </span>
        </div>
        <div className="footer-status-right">
          <span className="footer-engine-badge">
            <i className="fa-solid fa-microphone"></i>
            STT {hasRecognition ? "Online" : "Off"}
          </span>
          <span className="footer-engine-badge">
            <i className="fa-solid fa-volume-high"></i>
            TTS {hasSynthesis ? "Online" : "Off"}
          </span>
        </div>
      </div>
    </footer>
  );
}
