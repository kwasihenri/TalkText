import React, { useState, useEffect, useRef } from "react";
import { parseTtsScript } from "../services/ttsParser";
import { storage } from "../services/storage";
import { useToast } from "../context/useToast";
import Modal from "../components/Modal";

export default function TextToSpeechPage() {
  const toast = useToast();

  const [presets, setPresets] = useState(() => storage.getTtsPresets());
  const [text, setText] = useState(presets[0]?.text || "");
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [langFilter, setLangFilter] = useState("all");

  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [currentTagAlert, setCurrentTagAlert] = useState("");

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newPresetTitle, setNewPresetTitle] = useState("");
  const [newPresetDesc, setNewPresetDesc] = useState("");

  const textareaRef = useRef(null);
  const stopRequestedRef = useRef(false);
  const currentStepIndexRef = useRef(0);
  const stepsRef = useRef([]);

  useEffect(() => {
    function refreshVoices() {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
      if (available.length > 0 && !selectedVoiceURI) {
        const preferred = available.find((v) => v.lang.startsWith("en") && !v.name.includes("Google")) || available[0];
        setSelectedVoiceURI(preferred.voiceURI);
      }
    }

    refreshVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = refreshVoices;
    }
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [selectedVoiceURI]);

  const parsedData = parseTtsScript(text, { rate, pitch, volume });

  const insertTagAtCursor = (tagText) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setText((prev) => prev + " " + tagText);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const updated = `${before} ${tagText} ${after}`;

    setText(updated);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + tagText.length + 2;
      textarea.setSelectionRange(newPos, newPos);
    }, 50);

    toast.info(`Inserted tag: ${tagText}`);
  };

  const stopPlayback = () => {
    stopRequestedRef.current = true;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setActiveStepIndex(-1);
    setCurrentTagAlert("");
  };

  const playScript = async () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Speech Synthesis is not supported in this browser.");
      return;
    }

    if (!text.trim()) {
      toast.info("Please enter text or choose a preset script.");
      return;
    }

    stopPlayback();
    stopRequestedRef.current = false;
    setIsPlaying(true);
    setIsPaused(false);

    const { steps } = parseTtsScript(text, { rate, pitch, volume });
    stepsRef.current = steps;

    if (steps.length === 0) {
      setIsPlaying(false);
      return;
    }

    const selectedVoice = voices.find((v) => v.voiceURI === selectedVoiceURI) || null;

    for (let i = 0; i < steps.length; i++) {
      if (stopRequestedRef.current) break;

      currentStepIndexRef.current = i;
      setActiveStepIndex(i);
      const step = steps[i];

      if (step.type === "pause") {
        setCurrentTagAlert(`Pausing: ${step.label}`);
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, step.duration);
          const checkStop = setInterval(() => {
            if (stopRequestedRef.current) {
              clearTimeout(timer);
              clearInterval(checkStop);
              resolve();
            }
          }, 50);
        });
        setCurrentTagAlert("");
      } else if (step.type === "modifier") {
        setCurrentTagAlert(`Modifying Voice: ${step.label}`);
        await new Promise((resolve) => setTimeout(resolve, 150));
        setCurrentTagAlert("");
      } else if (step.type === "speech") {
        await new Promise((resolve) => {
          const utterance = new SpeechSynthesisUtterance(step.text);
          if (selectedVoice) utterance.voice = selectedVoice;
          utterance.rate = step.rate || rate;
          utterance.pitch = step.pitch || pitch;
          utterance.volume = step.volume || volume;

          utterance.onboundary = (event) => {
            if (event.name === "word") {
              setActiveTokenIndex(event.charIndex);
            }
          };

          utterance.onend = () => resolve();
          utterance.onerror = (e) => {
            console.error("[TalkText][TTS] Utterance error:", e);
            resolve();
          };

          window.speechSynthesis.speak(utterance);
        });
      }
    }

    if (!stopRequestedRef.current) {
      setIsPlaying(false);
      setActiveStepIndex(-1);
      setCurrentTagAlert("");
      toast.success("Playback completed.");
    }
  };

  const handlePauseResume = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      toast.info("Resumed speech playback.");
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
      toast.info("Speech playback paused.");
    }
  };

  const handleSavePreset = (e) => {
    e.preventDefault();
    if (!newPresetTitle.trim()) {
      toast.error("Please enter a title for this preset.");
      return;
    }
    const created = {
      id: `preset-${Date.now()}`,
      title: newPresetTitle.trim(),
      description: newPresetDesc.trim() || "User saved script preset",
      text
    };
    const updated = [created, ...presets];
    setPresets(updated);
    storage.saveTtsPresets(updated);
    setSaveModalOpen(false);
    setNewPresetTitle("");
    setNewPresetDesc("");
    toast.success(`Preset "${created.title}" saved!`);
  };

  const filteredVoices = voices.filter((v) => {
    if (langFilter === "all") return true;
    return v.lang.toLowerCase().startsWith(langFilter.toLowerCase());
  });

  return (
    <div className="tts-app-container">
      {/* Main Studio Grid */}
      <div className="studio-layout full-height-studio">
        {/* Left Column: Script Editor & Playback */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Script Editor Panel */}
          <div className="card-panel">
            <div className="card-header">
              <div className="card-title-group">
                <div className="card-icon-bubble">
                  <i className="fa-solid fa-terminal"></i>
                </div>
                <div>
                  <h2 className="card-title">Interactive Script Editor</h2>
                  <span className="card-subtitle">Use inline tags to command pacing & pitch</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(text);
                    toast.success("Script copied to clipboard!");
                  }}
                  title="Copy script"
                >
                  <i className="fa-solid fa-copy"></i>
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setSaveModalOpen(true)}
                  title="Save script preset"
                >
                  <i className="fa-solid fa-bookmark"></i> Save Preset
                </button>
              </div>
            </div>

            <div className="card-body" style={{ padding: "1.25rem" }}>
              {/* Dynamic Tag Insertion Toolbar */}
              <div className="tts-tag-toolbar">
                <span className="tag-toolbar-label">
                  <i className="fa-solid fa-wand-magic-sparkles"></i> Insert Tag:
                </span>
                <button
                  className="tag-insert-btn"
                  onClick={() => insertTagAtCursor("(rpause)")}
                  title="Insert rapid micro-pause (~450ms)"
                >
                  <i className="fa-solid fa-pause"></i> (rpause)
                </button>
                <button
                  className="tag-insert-btn"
                  onClick={() => insertTagAtCursor("(lpause)")}
                  title="Insert long dramatic pause (~1400ms)"
                >
                  <i className="fa-solid fa-hourglass-half"></i> (lpause)
                </button>
                <button
                  className="tag-insert-btn"
                  onClick={() => insertTagAtCursor("(pause:800ms)")}
                  title="Insert custom 800ms pause"
                >
                  <i className="fa-solid fa-clock"></i> (pause:800ms)
                </button>
                <button
                  className="tag-insert-btn"
                  onClick={() => insertTagAtCursor("(speed:1.3)")}
                  title="Speed up speech to 1.3x"
                >
                  <i className="fa-solid fa-gauge-high"></i> (speed:1.3)
                </button>
                <button
                  className="tag-insert-btn"
                  onClick={() => insertTagAtCursor("(speed:0.85)")}
                  title="Slow down speech to 0.85x"
                >
                  <i className="fa-solid fa-gauge"></i> (speed:0.85)
                </button>
                <button
                  className="tag-insert-btn"
                  onClick={() => insertTagAtCursor("(pitch:1.25)")}
                  title="Higher pitch"
                >
                  <i className="fa-solid fa-arrow-trend-up"></i> (pitch:1.25)
                </button>
                <button
                  className="tag-insert-btn"
                  onClick={() => insertTagAtCursor("(whisper)")}
                  title="Whisper mode"
                >
                  <i className="fa-solid fa-volume-xmark"></i> (whisper)
                </button>
                <button
                  className="tag-insert-btn"
                  onClick={() => insertTagAtCursor("(spell:TalkText)")}
                  title="Spells out letters"
                >
                  <i className="fa-solid fa-font"></i> (spell:word)
                </button>
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                className="tts-editor-box"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter any text here. Use tags like (rpause), (lpause), or (speed:1.2) to orchestrate pauses and pace..."
                rows={9}
              ></textarea>

              {/* Live Status Alert while speaking */}
              {currentTagAlert && (
                <div
                  className="animate-pop-in"
                  style={{
                    marginTop: "0.75rem",
                    padding: "0.5rem 0.85rem",
                    borderRadius: "var(--radius-md)",
                    background: "var(--brand-accent)",
                    border: "1px solid var(--brand-secondary)",
                    color: "var(--brand-primary)",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                  }}
                >
                  <i className="fa-solid fa-circle-dot fa-fade"></i>
                  <span>{currentTagAlert}</span>
                </div>
              )}

              {/* Live Karaoke Token Viewer */}
              <div className="karaoke-display">
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--brand-muted)", marginBottom: "0.4rem" }}>
                  <i className="fa-solid fa-microphone-lines"></i> Dynamic Sequence Visualization:
                </div>
                {parsedData.tokens.map((token) => {
                  const stepIndex = parsedData.steps.findIndex((s) => s.id === token.stepId);
                  const isStepActive = isPlaying && stepIndex === activeStepIndex;

                  if (token.type === "tag") {
                    return (
                      <span
                        key={token.id}
                        className={`karaoke-tag ${isStepActive ? "active animate-pulse-glow" : ""}`}
                        title={`Tag step #${stepIndex + 1}`}
                      >
                        {token.raw}
                      </span>
                    );
                  }

                  return (
                    <span
                      key={token.id}
                      className={`karaoke-token ${isStepActive ? "active" : ""}`}
                    >
                      {token.raw}
                    </span>
                  );
                })}
              </div>

              {/* Playback Action Bar */}
              <div className="tts-playback-bar">
                <div className="playback-buttons">
                  <button
                    className={`btn-play-hero ${isPlaying && !isPaused ? "speaking" : ""}`}
                    onClick={isPlaying ? handlePauseResume : playScript}
                  >
                    <i
                      className={`fa-solid ${
                        isPlaying && !isPaused ? "fa-pause" : isPaused ? "fa-play" : "fa-play"
                      }`}
                    ></i>
                    <span>{isPlaying && !isPaused ? "Pause" : isPaused ? "Resume" : "Synthesize & Play"}</span>
                  </button>

                  {isPlaying && (
                    <button
                      className="btn btn-outline"
                      onClick={stopPlayback}
                      title="Stop playback"
                    >
                      <i className="fa-solid fa-stop"></i> Stop
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span className={`badge ${isPlaying ? "badge-success" : "badge-neutral"}`}>
                    <i className={`fa-solid fa-circle ${isPlaying ? "fa-fade" : ""}`}></i>
                    {isPlaying ? (isPaused ? "Paused" : "Speaking...") : "Idle"}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setText("")}
                    title="Clear text"
                  >
                    <i className="fa-solid fa-eraser"></i> Clear
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Voice Selection, Parameter Sliders & Presets */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Voice Tuning Panel */}
          <div className="card-panel">
            <div className="card-header">
              <div className="card-title-group">
                <div className="card-icon-bubble">
                  <i className="fa-solid fa-sliders"></i>
                </div>
                <div>
                  <h2 className="card-title">Voice & Modulation</h2>
                  <span className="card-subtitle">Select voice and base parameters</span>
                </div>
              </div>
            </div>

            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Language Filter */}
              <div className="form-group">
                <label className="label">Language Filter</label>
                <select
                  className="select"
                  value={langFilter}
                  onChange={(e) => setLangFilter(e.target.value)}
                >
                  <option value="all">All Languages ({voices.length})</option>
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="ja">Japanese</option>
                </select>
              </div>

              {/* Voice Selector */}
              <div className="form-group">
                <label className="label">Synthesis Voice</label>
                <select
                  className="select"
                  value={selectedVoiceURI}
                  onChange={(e) => setSelectedVoiceURI(e.target.value)}
                >
                  {filteredVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang}) {v.default ? "— Default" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rate Slider */}
              <div className="slider-group">
                <div className="slider-header">
                  <span>Base Rate (Speed)</span>
                  <span className="slider-val">{rate.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  className="range-slider"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                />
              </div>

              {/* Pitch Slider */}
              <div className="slider-group">
                <div className="slider-header">
                  <span>Base Pitch</span>
                  <span className="slider-val">{pitch.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.8"
                  step="0.05"
                  className="range-slider"
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                />
              </div>

              {/* Volume Slider */}
              <div className="slider-group">
                <div className="slider-header">
                  <span>Volume</span>
                  <span className="slider-val">{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  className="range-slider"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="card-footer">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setRate(1);
                  setPitch(1);
                  setVolume(1);
                  toast.info("Reset voice parameters to normal.");
                }}
              >
                Reset Sliders
              </button>
            </div>
          </div>

          {/* Script Presets Panel */}
          <div className="card-panel">
            <div className="card-header">
              <div className="card-title-group">
                <div className="card-icon-bubble">
                  <i className="fa-solid fa-book-bookmark"></i>
                </div>
                <div>
                  <h2 className="card-title">Presets & Examples</h2>
                  <span className="card-subtitle">Click any script to test pauses</span>
                </div>
              </div>
            </div>

            <div className="card-body" style={{ maxHeight: "380px", overflowY: "auto", padding: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {presets.map((p) => (
                  <div
                    key={p.id}
                    className="preset-card"
                    onClick={() => {
                      stopPlayback();
                      setText(p.text);
                      toast.info(`Loaded preset: "${p.title}"`);
                    }}
                  >
                    <div className="preset-title">
                      <i className="fa-solid fa-play" style={{ color: "var(--brand-primary)", fontSize: "0.75rem" }}></i>
                      <span>{p.title}</span>
                    </div>
                    <p className="preset-desc">{p.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Save Preset */}
      <Modal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Save Script Preset"
        footer={
          <>
            <button className="btn btn-outline btn-sm" onClick={() => setSaveModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSavePreset}>
              Save Script
            </button>
          </>
        }
      >
        <form onSubmit={handleSavePreset} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="form-group">
            <label className="label">Preset Title</label>
            <input
              type="text"
              className="input"
              placeholder="e.g., Intro Audio With Pause"
              value={newPresetTitle}
              onChange={(e) => setNewPresetTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="label">Description (Optional)</label>
            <input
              type="text"
              className="input"
              placeholder="Brief note about the voice style or pacing"
              value={newPresetDesc}
              onChange={(e) => setNewPresetDesc(e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
