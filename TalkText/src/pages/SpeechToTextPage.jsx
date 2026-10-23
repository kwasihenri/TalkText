import React, { useState, useEffect, useRef, useCallback } from "react";
import { storage } from "../services/storage";
import { applySpeechRules, formatTranscriptWithChunk } from "../services/ruleEngine";
import { useToast } from "../context/useToast";
import Modal from "../components/Modal";

export default function SpeechToTextPage() {
  const toast = useToast();

  const [rules, setRules] = useState(() => storage.getRules());
  const [transcripts, setTranscripts] = useState(() => storage.getTranscripts());
  const [text, setText] = useState("");
  const [historyStack, setHistoryStack] = useState([]);
  const [interimText, setInterimText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");

  const [newRule, setNewRule] = useState({
    name: "",
    trigger: "",
    replacement: "",
    category: "Custom"
  });

  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const timerIntervalRef = useRef(null);

  const rulesRef = useRef(rules);
  useEffect(() => {
    rulesRef.current = rules;
  }, [rules]);

  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const setupVisualizer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      drawVisualizer();
    } catch (err) {
      console.error("[TalkText][STT] Visualizer audio input error:", err);
    }
  };

  const drawVisualizer = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, "#1d3d8f");
        gradient.addColorStop(1, "#4a6cb3");

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);

        x += barWidth;
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
  };

  const stopVisualizer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Your browser does not support Speech Recognition. Use Chrome or Edge.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsRecording(true);
        setRecordingSeconds(0);
        setupVisualizer();
        timerIntervalRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
        toast.info("Microphone active. Speak naturally...");
      };

      recognition.onresult = (event) => {
        let currentInterim = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptChunk = event.results[i][0].transcript;

          if (event.results[i].isFinal) {
            const { text: processedChunk, triggered, actions } = applySpeechRules(
              transcriptChunk,
              rulesRef.current,
              textRef.current
            );

            if (triggered.length > 0) {
              setTriggeredAlerts((prev) => [...triggered, ...prev].slice(0, 5));
            }

            if (actions.includes("clear")) {
              setHistoryStack((prev) => [...prev, textRef.current]);
              setText("");
              toast.info("Voice command executed: Transcript cleared");
            } else if (actions.includes("undo")) {
              setHistoryStack((prev) => {
                if (prev.length > 0) {
                  const last = prev[prev.length - 1];
                  setText(last);
                  return prev.slice(0, -1);
                }
                return prev;
              });
              toast.info("Voice command executed: Last segment undone");
            } else {
              setHistoryStack((prev) => [...prev, textRef.current]);
              setText((prev) => formatTranscriptWithChunk(prev, processedChunk));
            }
          } else {
            currentInterim += transcriptChunk;
          }
        }

        setInterimText(currentInterim);
      };

      recognition.onerror = (event) => {
        console.error("[TalkText][STT] Recognition error:", event.error);
        if (event.error !== "no-speech") {
          toast.error(`Recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        if (isRecording) {
          try {
            recognition.start();
          } catch {
            setIsRecording(false);
            stopVisualizer();
            clearInterval(timerIntervalRef.current);
          }
        } else {
          setIsRecording(false);
          stopVisualizer();
          clearInterval(timerIntervalRef.current);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("[TalkText][STT] Start error:", err);
      toast.error("Could not activate microphone recognition.");
    }
  };

  const stopListening = useCallback((notify = false) => {
    setIsRecording(false);
    clearInterval(timerIntervalRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    stopVisualizer();
    setInterimText("");
    if (notify) {
      toast.info("Dictation paused.");
    }
  }, [toast]);

  useEffect(() => {
    return () => {
      stopListening(false);
    };
  }, [stopListening]);

  const handleToggleRecord = () => {
    if (isRecording) {
      stopListening(true);
    } else {
      startListening();
    }
  };

  const handleUndo = () => {
    if (historyStack.length > 0) {
      const prev = historyStack[historyStack.length - 1];
      setText(prev);
      setHistoryStack((old) => old.slice(0, -1));
      toast.info("Undone last text modification.");
    } else {
      toast.info("Nothing to undo.");
    }
  };

  const handleCopy = () => {
    if (!text.trim()) {
      toast.info("Transcript is empty.");
      return;
    }
    navigator.clipboard.writeText(text);
    toast.success("Transcript copied to clipboard!");
  };

  const handleDownload = (format = "txt") => {
    if (!text.trim()) {
      toast.info("Transcript is empty.");
      return;
    }
    const blob = new Blob([text], {
      type: format === "json" ? "application/json" : "text/plain;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `talktext_transcript_${Date.now()}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported as .${format}`);
  };

  const handleSaveTranscript = () => {
    if (!text.trim()) {
      toast.info("Cannot save an empty transcript.");
      return;
    }
    const title = docTitle.trim() || `Dictation ${new Date().toLocaleDateString()}`;
    const newEntry = {
      id: `doc-${Date.now()}`,
      title,
      text,
      wordCount: text.trim().split(/\s+/).filter(Boolean).length,
      createdAt: new Date().toISOString()
    };
    const updated = [newEntry, ...transcripts];
    setTranscripts(updated);
    storage.saveTranscripts(updated);
    setSaveModalOpen(false);
    setDocTitle("");
    toast.success(`Saved transcript: "${title}"`);
  };

  const handleDeleteTranscript = (id) => {
    const updated = transcripts.filter((t) => t.id !== id);
    setTranscripts(updated);
    storage.saveTranscripts(updated);
    toast.info("Transcript removed from library.");
  };

  const handleToggleRule = (id) => {
    const updated = rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r));
    setRules(updated);
    storage.saveRules(updated);
  };

  const handleCreateRule = (e) => {
    e.preventDefault();
    if (!newRule.trigger.trim()) {
      toast.error("Trigger phrase cannot be empty.");
      return;
    }

    let actualReplacement = newRule.replacement;
    if (newRule.replacement === "\\n") {
      actualReplacement = "\n";
    } else if (newRule.replacement === "\\n\\n") {
      actualReplacement = "\n\n";
    }

    const created = {
      id: `rule-${Date.now()}`,
      name: newRule.name.trim() || newRule.trigger.trim(),
      trigger: newRule.trigger.trim().toLowerCase(),
      replacement: actualReplacement,
      category: newRule.category || "Custom",
      active: true
    };

    const updated = [created, ...rules];
    setRules(updated);
    storage.saveRules(updated);
    setRuleModalOpen(false);
    setNewRule({ name: "", trigger: "", replacement: "", category: "Custom" });
    toast.success(`Rule "${created.name}" created!`);
  };

  const handleResetRules = () => {
    const reset = storage.resetRules();
    setRules(reset);
    toast.info("Custom rules reset to defaults.");
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = text.length;
  const minutes = Math.floor(recordingSeconds / 60);
  const seconds = recordingSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="animate-pop-in">
      {/* Hero Section */}
      <section className="page-hero">
        <div className="hero-content">
          <div className="hero-badge-row">
            <span className="badge badge-brand">
              <i className="fa-solid fa-microphone-lines"></i> Voice Dictation Studio
            </span>
            <span className="badge badge-neutral">Continuous Web Speech</span>
          </div>
          <h1 className="hero-heading">Listen & Transcribe with Custom Voice Rules</h1>
          <p className="hero-description">
            Dictate freely with full macro support. Say words like <code>newline</code>, <code>comma</code>, 
            or custom phrases to format your text instantly in real time.
          </p>
        </div>

        <div className="hero-stats-banner">
          <div className="hero-stat-card">
            <div className="hero-stat-num">{rules.filter((r) => r.active).length}</div>
            <div className="hero-stat-label">Active Rules</div>
          </div>
          <div className="hero-stat-card">
            <div className="hero-stat-num">{wordCount}</div>
            <div className="hero-stat-label">Words</div>
          </div>
          <div className="hero-stat-card">
            <div className="hero-stat-num">{timeFormatted}</div>
            <div className="hero-stat-label">Duration</div>
          </div>
        </div>
      </section>

      {/* Main Studio Grid */}
      <div className="studio-layout">
        {/* Left Column: Recording Controls & Main Editor */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Recording Control Bar */}
          <div className="stt-record-bar">
            <button
              className={`mic-toggle-btn ${isRecording ? "recording" : ""}`}
              onClick={handleToggleRecord}
              aria-label={isRecording ? "Stop listening" : "Start listening"}
            >
              <div className="mic-icon-circle">
                <i className={`fa-solid ${isRecording ? "fa-stop" : "fa-microphone"}`}></i>
              </div>
              <span>{isRecording ? "Stop Recording" : "Start Dictation"}</span>
            </button>

            <div className="visualizer-container">
              <canvas
                ref={canvasRef}
                className="visualizer-canvas"
                width="360"
                height="44"
              ></canvas>
            </div>

            <div className="stt-controls-group">
              <span className={`badge ${isRecording ? "badge-danger" : "badge-neutral"}`}>
                <i className={`fa-solid fa-circle ${isRecording ? "fa-fade" : ""}`}></i>
                {isRecording ? `Listening (${timeFormatted})` : "Microphone Idle"}
              </span>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setRuleModalOpen(true)}
              >
                <i className="fa-solid fa-plus"></i> New Rule
              </button>
            </div>
          </div>

          {/* Trigger Alert Chips Banner */}
          {triggeredAlerts.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--brand-muted)" }}>
                Recent Voice Triggers:
              </span>
              {triggeredAlerts.map((t, idx) => (
                <span key={`${t.id}-${idx}`} className="badge badge-brand animate-pop-in">
                  <i className="fa-solid fa-bolt"></i>
                  "{t.trigger}" &rarr; {t.replacement === "\n" ? "↵ newline" : t.replacement}
                </span>
              ))}
            </div>
          )}

          {/* Dictation Editor Panel */}
          <div className="card-panel">
            <div className="card-header">
              <div className="card-title-group">
                <div className="card-icon-bubble">
                  <i className="fa-solid fa-file-lines"></i>
                </div>
                <div>
                  <h2 className="card-title">Live Dictation Transcript</h2>
                  <span className="card-subtitle">Real-time macro parsing & formatting</span>
                </div>
              </div>

              <div className="editor-action-buttons">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleUndo}
                  title="Undo last text change"
                  disabled={historyStack.length === 0}
                >
                  <i className="fa-solid fa-rotate-left"></i> Undo
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleCopy}
                  title="Copy transcript"
                >
                  <i className="fa-solid fa-copy"></i> Copy
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setSaveModalOpen(true)}
                  title="Save transcript to history"
                >
                  <i className="fa-solid fa-floppy-disk"></i> Save
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setClearConfirmOpen(true)}
                  title="Clear transcript"
                  style={{ color: "var(--brand-danger)" }}
                >
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>

            <div className="card-body" style={{ padding: "1.25rem" }}>
              <div className="transcript-wrapper">
                <textarea
                  className="transcript-area"
                  value={text}
                  onChange={(e) => {
                    setHistoryStack((prev) => [...prev, text]);
                    setText(e.target.value);
                  }}
                  placeholder="Click 'Start Dictation' and begin speaking. Words like 'newline', 'comma', 'period', or 'smiley face' will automatically format your text..."
                  rows={12}
                ></textarea>

                {interimText && (
                  <div className="interim-preview-pill">
                    <i className="fa-solid fa-waveform-lines fa-fade"></i>
                    <span>Hearing: "{interimText}"</span>
                  </div>
                )}
              </div>

              <div className="editor-status-bar">
                <div className="stats-group">
                  <div className="stat-item">
                    <span>Words:</span>
                    <strong>{wordCount}</strong>
                  </div>
                  <div className="stat-item">
                    <span>Characters:</span>
                    <strong>{charCount}</strong>
                  </div>
                  <div className="stat-item">
                    <span>Status:</span>
                    <strong>{isRecording ? "Recording" : "Ready"}</strong>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleDownload("txt")}
                  >
                    <i className="fa-solid fa-download"></i> .TXT
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleDownload("md")}
                  >
                    <i className="fa-solid fa-file-code"></i> .MD
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleDownload("json")}
                  >
                    <i className="fa-solid fa-code"></i> .JSON
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Custom Voice Rules & Saved History */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Custom Voice Rules Panel */}
          <div className="card-panel">
            <div className="card-header">
              <div className="card-title-group">
                <div className="card-icon-bubble">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                </div>
                <div>
                  <h2 className="card-title">Custom Voice Rules</h2>
                  <span className="card-subtitle">Speech triggers & substitutions</span>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleResetRules}
                title="Reset rules to default"
              >
                <i className="fa-solid fa-arrow-rotate-left"></i>
              </button>
            </div>

            <div className="card-body" style={{ maxHeight: "360px", overflowY: "auto", padding: "1rem" }}>
              <div className="rules-container">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.5rem 0.65rem",
                      background: rule.active ? "#ffffff" : "#f8fafc",
                      border: "1px solid var(--brand-border)",
                      borderRadius: "var(--radius-sm)",
                      opacity: rule.active ? 1 : 0.65
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--brand-primary)" }}>
                          "{rule.trigger}"
                        </span>
                        <i className="fa-solid fa-arrow-right" style={{ fontSize: "0.65rem", color: "var(--brand-muted-light)" }}></i>
                        <span
                          style={{
                            fontSize: "0.8rem",
                            fontFamily: "var(--font-mono)",
                            color: "var(--brand-success)",
                            fontWeight: 600
                          }}
                        >
                          {rule.replacement === "\n" ? "↵ [newline]" : rule.replacement === "\n\n" ? "↵↵ [paragraph]" : rule.replacement}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.7rem", color: "var(--brand-muted)" }}>
                        {rule.name} &bull; {rule.category}
                      </span>
                    </div>

                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={rule.active}
                        onChange={() => handleToggleRule(rule.id)}
                      />
                      <span className="slider-toggle"></span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-footer">
              <span style={{ fontSize: "0.75rem", color: "var(--brand-muted)" }}>
                {rules.filter((r) => r.active).length} of {rules.length} rules enabled
              </span>
              <button
                className="btn btn-accent btn-sm"
                onClick={() => setRuleModalOpen(true)}
              >
                <i className="fa-solid fa-plus"></i> Add Rule
              </button>
            </div>
          </div>

          {/* Saved Transcripts History */}
          <div className="card-panel">
            <div className="card-header">
              <div className="card-title-group">
                <div className="card-icon-bubble">
                  <i className="fa-solid fa-clock-rotate-left"></i>
                </div>
                <div>
                  <h2 className="card-title">Saved Library</h2>
                  <span className="card-subtitle">{transcripts.length} documents saved</span>
                </div>
              </div>
            </div>

            <div className="card-body" style={{ padding: "1rem" }}>
              {transcripts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "1.5rem 0.5rem", color: "var(--brand-muted)" }}>
                  <i className="fa-regular fa-folder-open" style={{ fontSize: "1.75rem", marginBottom: "0.5rem", color: "var(--brand-muted-light)" }}></i>
                  <p style={{ fontSize: "0.825rem" }}>No saved dictations yet.</p>
                </div>
              ) : (
                <div className="history-list">
                  {transcripts.map((item) => (
                    <div
                      key={item.id}
                      className="history-card"
                      onClick={() => {
                        setText(item.text);
                        toast.info(`Loaded: "${item.title}"`);
                      }}
                    >
                      <div className="history-card-header">
                        <strong>{item.title}</strong>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTranscript(item.id);
                          }}
                          title="Delete from history"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                      <p className="history-snippet">{item.text}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--brand-muted-light)" }}>
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        <span>{item.wordCount} words</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Create Custom Voice Rule */}
      <Modal
        isOpen={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        title="Add Custom Speech Rule"
        footer={
          <>
            <button className="btn btn-outline btn-sm" onClick={() => setRuleModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleCreateRule}>
              Save Rule
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateRule} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="form-group">
            <label className="label">Rule Name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g., Next Paragraph, Smile Emoji, Enter Key"
              value={newRule.name}
              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="label">When TalkText Hears (Trigger Phrase)</label>
            <input
              type="text"
              className="input input-mono"
              placeholder="e.g. newline, bullet point, semicolon, smiley"
              value={newRule.trigger}
              onChange={(e) => setNewRule({ ...newRule, trigger: e.target.value })}
              required
            />
            <span style={{ fontSize: "0.75rem", color: "var(--brand-muted)" }}>
              Case-insensitive speech match. TalkText will listen for this exact spoken phrase.
            </span>
          </div>

          <div className="form-group">
            <label className="label">Insert As Text (Replacement)</label>
            <input
              type="text"
              className="input input-mono"
              placeholder="e.g. \n (for Enter/newline), \n\n (for paragraph), 😊, --"
              value={newRule.replacement}
              onChange={(e) => setNewRule({ ...newRule, replacement: e.target.value })}
              required
            />
            <span style={{ fontSize: "0.75rem", color: "var(--brand-muted)" }}>
              Tip: Use <code>\n</code> to insert a line break / enter, or any symbol, word or emoji.
            </span>
          </div>

          <div className="form-group">
            <label className="label">Category</label>
            <select
              className="select"
              value={newRule.category}
              onChange={(e) => setNewRule({ ...newRule, category: e.target.value })}
            >
              <option value="Formatting">Formatting (Enter, Indent, New Line)</option>
              <option value="Punctuation">Punctuation</option>
              <option value="Emojis">Emojis & Symbols</option>
              <option value="Snippets">Snippets & Macros</option>
              <option value="Custom">Custom Phrase</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* Modal: Save Document */}
      <Modal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Save Transcript"
        footer={
          <>
            <button className="btn btn-outline btn-sm" onClick={() => setSaveModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveTranscript}>
              Save to Library
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="label">Document Title</label>
          <input
            type="text"
            className="input"
            placeholder="e.g., Weekly Team Voice Note"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      {/* Modal: Clear Confirmation (No native confirm dialog!) */}
      <Modal
        isOpen={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title="Clear Transcript?"
        footer={
          <>
            <button className="btn btn-outline btn-sm" onClick={() => setClearConfirmOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                setHistoryStack((prev) => [...prev, text]);
                setText("");
                setClearConfirmOpen(false);
                toast.info("Transcript cleared. Use 'Undo' to restore.");
              }}
            >
              Clear All
            </button>
          </>
        }
      >
        <p style={{ fontSize: "0.9rem" }}>
          Are you sure you want to clear your current dictation? You can recover it anytime by clicking <strong>Undo</strong>.
        </p>
      </Modal>
    </div>
  );
}
