import React, { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import Modal from "./Modal";
import { useToast } from "../context/useToast";

export default function Header() {
  const toast = useToast();
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testingSpeaker, setTestingSpeaker] = useState(false);

  const hasRecognition = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  const hasSynthesis = typeof window !== "undefined" && "speechSynthesis" in window;

  const runSpeakerTest = () => {
    if (!hasSynthesis) {
      toast.error("Speech Synthesis is not supported in this browser.");
      return;
    }
    setTestingSpeaker(true);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("TalkText audio output is working crisp and clear!");
    utterance.rate = 1.0;
    utterance.onend = () => setTestingSpeaker(false);
    utterance.onerror = () => setTestingSpeaker(false);
    window.speechSynthesis.speak(utterance);
    toast.info("Playing speaker test sound...");
  };

  return (
    <>
      <header className="app-header">
        <div className="header-container">
          <Link to="/" className="brand-block">
            <img src="/logo.jpg" alt="TalkText Logo" className="brand-avatar" />
            <div className="brand-text-group">
              <span className="brand-title">
                TalkText
                <span className="badge badge-brand brand-ver-tag">v2.0</span>
              </span>
              <span className="brand-tagline">Speech & Audio Studio</span>
            </div>
          </Link>

          <nav className="nav-tabs desktop-only-nav" aria-label="Main Navigation">
            <NavLink
              to="/speech-to-text"
              className={({ isActive }) => `nav-tab-btn ${isActive ? "active" : ""}`}
            >
              <i className="fa-solid fa-microphone-lines"></i>
              <span>Dictate</span>
            </NavLink>
            <NavLink
              to="/text-to-speech"
              className={({ isActive }) => `nav-tab-btn ${isActive ? "active" : ""}`}
            >
              <i className="fa-solid fa-volume-high"></i>
              <span>Speech</span>
            </NavLink>
            <NavLink
              to="/exam-recorder"
              className={({ isActive }) => `nav-tab-btn ${isActive ? "active" : ""}`}
            >
              <i className="fa-solid fa-graduation-cap"></i>
              <span>Exam Recorder</span>
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) => `nav-tab-btn ${isActive ? "active" : ""}`}
            >
              <i className="fa-solid fa-sliders"></i>
              <span>Rules</span>
            </NavLink>
          </nav>

          <div className="header-actions">
            <div className="header-status-pills">
              <span
                className={`badge badge-sm ${hasRecognition ? "badge-success" : "badge-danger"}`}
                title={hasRecognition ? "Speech Recognition API Supported" : "Speech Recognition Not Supported"}
              >
                <i className="fa-solid fa-microphone"></i>
                <span className="status-badge-text">STT</span>
              </span>
              <span
                className={`badge badge-sm ${hasSynthesis ? "badge-brand" : "badge-danger"}`}
                title={hasSynthesis ? "Speech Synthesis API Supported" : "Speech Synthesis Not Supported"}
              >
                <i className="fa-solid fa-headphones"></i>
                <span className="status-badge-text">TTS</span>
              </span>
            </div>

            <button
              className="btn btn-outline btn-sm diagnostics-header-btn"
              onClick={() => setTestModalOpen(true)}
              title="Open audio diagnostics modal"
            >
              <i className="fa-solid fa-wrench"></i>
              <span className="diagnostics-btn-label">Diagnostics</span>
            </button>
          </div>
        </div>
      </header>

      <Modal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        title="Audio Engine Diagnostics"
        footer={
          <button className="btn btn-primary btn-sm" onClick={() => setTestModalOpen(false)}>
            Close Diagnostics
          </button>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <p style={{ fontSize: "0.9rem" }}>
            Verify that your browser microphone permissions and sound output drivers are operational.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="card-panel" style={{ padding: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <i className="fa-solid fa-microphone" style={{ color: "var(--brand-primary)" }}></i>
                <strong>Voice Recognition</strong>
              </div>
              <p style={{ fontSize: "0.8rem", marginBottom: "0.75rem" }}>
                Status: {hasRecognition ? "Native Web Speech API Detected" : "Unsupported browser"}
              </p>
              <span className={`badge ${hasRecognition ? "badge-success" : "badge-danger"}`}>
                {hasRecognition ? "Operational" : "Unavailable"}
              </span>
            </div>

            <div className="card-panel" style={{ padding: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <i className="fa-solid fa-volume-high" style={{ color: "var(--brand-primary)" }}></i>
                <strong>Speech Synthesis</strong>
              </div>
              <p style={{ fontSize: "0.8rem", marginBottom: "0.75rem" }}>
                Status: {hasSynthesis ? "Native SpeechSynthesis Detected" : "Unsupported browser"}
              </p>
              <button
                className="btn btn-accent btn-sm"
                onClick={runSpeakerTest}
                disabled={testingSpeaker}
              >
                <i className={`fa-solid ${testingSpeaker ? "fa-spinner fa-spin" : "fa-play"}`}></i>
                <span>{testingSpeaker ? "Playing..." : "Test Speaker"}</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
