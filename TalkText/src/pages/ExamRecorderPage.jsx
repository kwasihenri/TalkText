import React, { useState, useEffect, useRef, useCallback } from "react";
import { storage } from "../services/storage";
import { parseExamInput } from "../services/examInputParser";
import { useToast } from "../context/useToast";
import Modal from "../components/Modal";

export default function ExamRecorderPage() {
  const toast = useToast();

  const [fields, setFields] = useState(() => storage.getExamFields());
  const [records, setRecords] = useState(() => storage.getExamRecords());
  const [settings] = useState(() => storage.getExamSettings());

  const [isRunning, setIsRunning] = useState(false);
  const [currentFieldIdx, setCurrentFieldIdx] = useState(0);
  const [currentDraft, setCurrentDraft] = useState({});
  const [stageStatus, setStageStatus] = useState("idle");
  const [hearingText, setHearingText] = useState("");

  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);

  const [fieldForm, setFieldForm] = useState({
    label: "",
    voicePrompt: "",
    type: "text",
    prefix: "",
    padDigits: 0,
    hasDefault: false,
    defaultValue: ""
  });

  const recognitionRef = useRef(null);
  const isRunningRef = useRef(false);
  const currentFieldIdxRef = useRef(0);
  const currentDraftRef = useRef({});
  const fieldsRef = useRef(fields);
  const settingsRef = useRef(settings);

  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    currentFieldIdxRef.current = currentFieldIdx;
  }, [currentFieldIdx]);

  useEffect(() => {
    currentDraftRef.current = currentDraft;
  }, [currentDraft]);

  const speak = useCallback((text, onEnd) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      if (onEnd) onEnd();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = settingsRef.current.speechRate || 1.05;

    const voices = window.speechSynthesis.getVoices();
    if (settingsRef.current.voiceURI) {
      const matched = voices.find((v) => v.voiceURI === settingsRef.current.voiceURI);
      if (matched) utterance.voice = matched;
    }

    utterance.onend = () => {
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.error("[TalkText][ExamRecorder] SpeechSynthesis error:", e);
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  function stopSession() {
    setIsRunning(false);
    setStageStatus("idle");
    setHearingText("");
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
  }

  function askFieldAtIndex(fieldIndex) {
    if (!isRunningRef.current) return;
    const field = fieldsRef.current[fieldIndex];
    if (!field) return;

    setStageStatus("speaking");
    const promptToSpeak = field.voicePrompt || `Please say the ${field.label}`;

    speak(promptToSpeak, () => {
      if (isRunningRef.current) {
        listenForInput();
      }
    });
  }

  function askCurrentField() {
    askFieldAtIndex(currentFieldIdxRef.current);
  }

  function finalizeStudentRecord(finalDraft) {
    setStageStatus("confirming");

    const newRecord = {
      id: `rec-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...finalDraft
    };

    setRecords((prev) => {
      const updated = [newRecord, ...prev];
      storage.saveExamRecords(updated);
      return updated;
    });

    const studentIdVal = finalDraft.studentId || "Student";
    const marksVal = finalDraft.marks || "unmarked";
    const recapText = `Recorded ${studentIdVal}. Marks ${marksVal}. Next person.`;

    toast.success(`Recorded: ${studentIdVal} (${marksVal} marks)`);

    speak(recapText, () => {
      if (isRunningRef.current) {
        setCurrentDraft({});
        setCurrentFieldIdx(0);
        setTimeout(() => {
          askFieldAtIndex(0);
        }, 800);
      }
    });
  }

  function handleInputReceived(rawSpoken) {
    const currentFields = fieldsRef.current;
    const idx = currentFieldIdxRef.current;
    const field = currentFields[idx];

    if (!field) return;

    setHearingText(rawSpoken);

    const { value, action } = parseExamInput(rawSpoken, field);

    if (action === "stop") {
      stopSession();
      toast.info("Session paused by voice command.");
      return;
    }

    if (action === "repeat") {
      askCurrentField();
      return;
    }

    if (action === "undo") {
      if (idx > 0) {
        setCurrentFieldIdx(idx - 1);
        setTimeout(() => askCurrentField(), 300);
      } else {
        toast.info("Already at first field.");
        askCurrentField();
      }
      return;
    }

    const updatedDraft = {
      ...currentDraftRef.current,
      [field.key]: value || field.defaultValue || ""
    };
    setCurrentDraft(updatedDraft);

    if (idx + 1 < currentFields.length) {
      setCurrentFieldIdx(idx + 1);
      setTimeout(() => {
        askFieldAtIndex(idx + 1);
      }, 400);
    } else {
      finalizeStudentRecord(updatedDraft);
    }
  }

  function listenForInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech Recognition is not supported in this browser.");
      setIsRunning(false);
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    setStageStatus("listening");
    setHearingText("");

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          handleInputReceived(transcript);
          return;
        } else {
          interim += transcript;
        }
      }
      setHearingText(interim);
    };

    recognition.onerror = (event) => {
      console.error("[TalkText][ExamRecorder] Recognition error:", event.error);
      if (event.error === "no-speech" && isRunningRef.current) {
        speak("I didn't catch that. " + fieldsRef.current[currentFieldIdxRef.current]?.voicePrompt, () => {
          if (isRunningRef.current) {
            listenForInput();
          }
        });
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setIsRunning(false);
    }
  }

  const startSession = () => {
    if (fields.length === 0) {
      toast.error("Please add at least one field to start recording.");
      return;
    }
    setIsRunning(true);
    setCurrentFieldIdx(0);
    setCurrentDraft({});
    setStageStatus("speaking");
    toast.info("Exam recording assistant started.");

    speak("Exam recording started. " + fields[0].voicePrompt, () => {
      if (isRunningRef.current) {
        listenForInput();
      }
    });
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  const handleOpenAddField = () => {
    setEditingField(null);
    setFieldForm({
      label: "",
      voicePrompt: "",
      type: "text",
      prefix: "",
      padDigits: 0,
      hasDefault: false,
      defaultValue: ""
    });
    setFieldModalOpen(true);
  };

  const handleOpenEditField = (f) => {
    setEditingField(f);
    setFieldForm({
      label: f.label,
      voicePrompt: f.voicePrompt,
      type: f.type || "text",
      prefix: f.prefix || "",
      padDigits: f.padDigits || 0,
      hasDefault: !!f.hasDefault,
      defaultValue: f.defaultValue || ""
    });
    setFieldModalOpen(true);
  };

  const handleSaveFieldForm = (e) => {
    e.preventDefault();
    if (!fieldForm.label.trim()) {
      toast.error("Field label is required.");
      return;
    }

    const key = editingField
      ? editingField.key
      : fieldForm.label.toLowerCase().replace(/[^a-z0-9]/g, "");

    const newFieldObj = {
      id: editingField ? editingField.id : `fld-${Date.now()}`,
      key,
      label: fieldForm.label.trim(),
      voicePrompt: fieldForm.voicePrompt.trim() || `Say the ${fieldForm.label.trim()}`,
      type: fieldForm.type,
      prefix: fieldForm.prefix.trim(),
      padDigits: parseInt(fieldForm.padDigits, 10) || 0,
      hasDefault: fieldForm.hasDefault,
      defaultValue: fieldForm.defaultValue.trim()
    };

    let updated;
    if (editingField) {
      updated = fields.map((f) => (f.id === editingField.id ? newFieldObj : f));
      toast.success("Field configuration updated.");
    } else {
      updated = [...fields, newFieldObj];
      toast.success("New field added.");
    }

    setFields(updated);
    storage.saveExamFields(updated);
    setFieldModalOpen(false);
  };

  const handleDeleteField = (id) => {
    if (fields.length <= 1) {
      toast.error("You must have at least one field.");
      return;
    }
    const updated = fields.filter((f) => f.id !== id);
    setFields(updated);
    storage.saveExamFields(updated);
    toast.info("Field removed.");
  };

  const handleResetFields = () => {
    const reset = storage.resetExamFields();
    setFields(reset);
    toast.info("Fields reset to defaults.");
  };

  const handleDeleteRecord = (id) => {
    const updated = records.filter((r) => r.id !== id);
    setRecords(updated);
    storage.saveExamRecords(updated);
    toast.info("Record deleted.");
  };

  const handleExportCSV = () => {
    if (records.length === 0) {
      toast.info("No records to export.");
      return;
    }

    const headers = ["Timestamp", ...fields.map((f) => f.label)];
    const rows = records.map((r) => {
      const dateStr = new Date(r.timestamp).toLocaleString();
      const vals = fields.map((f) => `"${(r[f.key] || "").toString().replace(/"/g, '""')}"`);
      return `"${dateStr}",${vals.join(",")}`;
    });

    const csvContent = `${headers.map((h) => `"${h}"`).join(",")}\n${rows.join("\n")}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `exam_records_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Exported records as CSV!");
  };

  const currentField = fields[currentFieldIdx] || fields[0];
  const progressPercent = Math.round(((currentFieldIdx + 1) / (fields.length || 1)) * 100);

  return (
    <div className="animate-pop-in">
      {/* Hero Header */}
      <section className="page-hero">
        <div className="hero-content">
          <div className="hero-badge-row">
            <span className="badge badge-brand">
              <i className="fa-solid fa-graduation-cap"></i> Voice-Guided Exam Assistant
            </span>
            <span className="badge badge-neutral">Auto Ask &bull; Listen &bull; Repeat &bull; Next</span>
          </div>
          <h1 className="hero-heading">Exam & Marks Voice Recorder</h1>
          <p className="hero-description">
            Automate data entry entirely hands-free. TalkText asks each question, listens for student ID 
            (with prefix formatting e.g. <code>4231230041</code>), fills default course details, records marks, 
            confirms with speech, and calls next.
          </p>
        </div>

        <div className="hero-stats-banner">
          <div className="hero-stat-card">
            <div className="hero-stat-num">{records.length}</div>
            <div className="hero-stat-label">Students</div>
          </div>
          <div className="hero-stat-card">
            <div className="hero-stat-num">{fields.length}</div>
            <div className="hero-stat-label">Prompts</div>
          </div>
          <button className="btn btn-primary" onClick={handleExportCSV}>
            <i className="fa-solid fa-file-csv"></i> Export CSV
          </button>
        </div>
      </section>

      {/* Main Studio Grid */}
      <div className="studio-layout">
        {/* Left Column: Live Voice Stage & Current Student Progress */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Active Voice Prompt Stage */}
          <div className={`exam-prompt-stage ${stageStatus === "listening" ? "active-listening animate-pulse-glow" : ""}`}>
            <div className="stage-header-row">
              <span className="stage-step-pill">
                <i className="fa-solid fa-clipboard-question"></i>
                Field {currentFieldIdx + 1} of {fields.length}: {currentField?.label}
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  className={`badge ${
                    stageStatus === "listening"
                      ? "badge-danger"
                      : stageStatus === "speaking"
                      ? "badge-brand"
                      : stageStatus === "confirming"
                      ? "badge-success"
                      : "badge-neutral"
                  }`}
                >
                  <i
                    className={`fa-solid ${
                      stageStatus === "listening"
                        ? "fa-microphone fa-fade"
                        : stageStatus === "speaking"
                        ? "fa-volume-high fa-fade"
                        : "fa-circle"
                    }`}
                  ></i>
                  {stageStatus === "listening"
                    ? "Listening for voice..."
                    : stageStatus === "speaking"
                    ? "Speaking prompt..."
                    : stageStatus === "confirming"
                    ? "Saving & Confirming..."
                    : "Session Stopped"}
                </span>
              </div>
            </div>

            {/* Big Question Headline */}
            <div className="stage-voice-bubble">
              {isRunning
                ? currentField?.voicePrompt
                : "Press 'Start Session' to begin automated hands-free exam entry."}
            </div>

            {/* Field Hint */}
            <div style={{ fontSize: "0.85rem", color: "var(--brand-muted)" }}>
              {currentField?.type === "id" && currentField.prefix && (
                <span>
                  Prefix rule: <strong>{currentField.prefix}</strong> + {currentField.padDigits} digits. (Say "41" &rarr; <code>{currentField.prefix}0041</code>).
                </span>
              )}
              {currentField?.hasDefault && (
                <span>
                  Default value: <strong>"{currentField.defaultValue}"</strong> (Say "default" or "same" to use).
                </span>
              )}
            </div>

            {/* Hearing Box */}
            <div className="stage-hearing-box">
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--brand-muted)", display: "block" }}>
                  Hearing:
                </span>
                <span className="hearing-text">
                  {hearingText ? `"${hearingText}"` : isRunning ? "Listening..." : "—"}
                </span>
              </div>

              {isRunning && (
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button className="btn btn-outline btn-sm" onClick={askCurrentField} title="Repeat question">
                    <i className="fa-solid fa-rotate-left"></i> Repeat
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleInputReceived(currentField?.defaultValue || "skip")}
                    title="Skip with default"
                  >
                    <i className="fa-solid fa-forward-step"></i> Skip
                  </button>
                </div>
              )}
            </div>

            {/* Stepper Progress */}
            <div className="stage-progress-bar">
              <div className="stage-progress-fill" style={{ width: `${isRunning ? progressPercent : 0}%` }}></div>
            </div>

            <div className="fields-stepper">
              {fields.map((f, i) => {
                const isCurrent = isRunning && i === currentFieldIdx;
                const isDone = isRunning && i < currentFieldIdx;
                const valueInDraft = currentDraft[f.key];

                return (
                  <div
                    key={f.id}
                    className={`stepper-item ${isCurrent ? "current" : isDone ? "completed" : ""}`}
                  >
                    <span>{f.label}:</span>
                    <strong>{valueInDraft || (f.hasDefault ? f.defaultValue : "...")}</strong>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Session Controller Bar */}
          <div className="exam-session-banner">
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              <button
                className={`btn btn-lg ${isRunning ? "btn-danger" : "btn-primary"}`}
                onClick={isRunning ? stopSession : startSession}
              >
                <i className={`fa-solid ${isRunning ? "fa-circle-pause" : "fa-circle-play"}`}></i>
                <span>{isRunning ? "Pause Assistant" : "Start Voice Assistant"}</span>
              </button>

              {isRunning && (
                <button
                  className="btn btn-outline btn-lg"
                  onClick={() => {
                    handleInputReceived(currentField?.defaultValue || "skip");
                  }}
                >
                  <i className="fa-solid fa-forward-step"></i> Next Field
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn btn-outline btn-sm" onClick={handleOpenAddField}>
                <i className="fa-solid fa-plus"></i> Add Custom Field
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleResetFields} title="Reset to default fields">
                <i className="fa-solid fa-arrow-rotate-left"></i> Reset
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Configured Fields Checklist */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="card-panel">
            <div className="card-header">
              <div className="card-title-group">
                <div className="card-icon-bubble">
                  <i className="fa-solid fa-list-check"></i>
                </div>
                <div>
                  <h2 className="card-title">Prompt Configuration</h2>
                  <span className="card-subtitle">{fields.length} questions in cycle</span>
                </div>
              </div>
            </div>

            <div className="card-body" style={{ maxHeight: "420px", overflowY: "auto", padding: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {fields.map((f, idx) => (
                  <div
                    key={f.id}
                    style={{
                      border: "1px solid var(--brand-border)",
                      borderRadius: "var(--radius-md)",
                      padding: "0.75rem",
                      background: isRunning && idx === currentFieldIdx ? "var(--brand-accent)" : "#ffffff"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                      <strong style={{ fontSize: "0.85rem", color: "var(--brand-primary)" }}>
                        #{idx + 1} &bull; {f.label}
                      </strong>
                      <div style={{ display: "flex", gap: "0.25rem" }}>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => handleOpenEditField(f)}
                          title="Edit question settings"
                        >
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => handleDeleteField(f.id)}
                          title="Remove field"
                          style={{ color: "var(--brand-danger)" }}
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </div>

                    <p style={{ fontSize: "0.775rem", color: "var(--brand-text)", marginBottom: "0.35rem" }}>
                      Prompt: "{f.voicePrompt}"
                    </p>

                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", fontSize: "0.7rem" }}>
                      {f.prefix && (
                        <span className="badge badge-brand">
                          Prefix: {f.prefix} ({f.padDigits} digits)
                        </span>
                      )}
                      {f.hasDefault && (
                        <span className="badge badge-neutral">
                          Default: "{f.defaultValue}"
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-footer">
              <span style={{ fontSize: "0.75rem", color: "var(--brand-muted)" }}>
                Commands: say "default", "repeat", "skip", or "stop".
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recorded Exam Entries Table */}
      <div className="exam-table-card">
        <div className="exam-table-header">
          <div className="card-title-group">
            <div className="card-icon-bubble">
              <i className="fa-solid fa-table-list"></i>
            </div>
            <div>
              <h2 className="card-title">Recorded Exam Entries</h2>
              <span className="card-subtitle">{records.length} students recorded in this session</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-primary btn-sm" onClick={handleExportCSV}>
              <i className="fa-solid fa-file-csv"></i> Download CSV
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setClearModalOpen(true)}
              style={{ color: "var(--brand-danger)" }}
              disabled={records.length === 0}
            >
              <i className="fa-solid fa-trash-can"></i> Clear Table
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          {records.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--brand-muted)" }}>
              <i className="fa-solid fa-clipboard-user" style={{ fontSize: "2rem", color: "var(--brand-muted-light)", marginBottom: "0.75rem" }}></i>
              <p style={{ fontSize: "0.9rem" }}>No students recorded yet. Press "Start Voice Assistant" to begin recording.</p>
            </div>
          ) : (
            <table className="exam-records-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Recorded Time</th>
                  {fields.map((f) => (
                    <th key={f.id}>{f.label}</th>
                  ))}
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={r.id}>
                    <td>{records.length - i}</td>
                    <td style={{ fontSize: "0.8rem", color: "var(--brand-muted)" }}>
                      {new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    {fields.map((f) => (
                      <td key={f.id}>
                        {f.type === "id" ? (
                          <span className="badge-id">{r[f.key] || "—"}</span>
                        ) : f.type === "number" ? (
                          <span className="badge-marks">{r[f.key] || "0"}</span>
                        ) : (
                          <span>{r[f.key] || "—"}</span>
                        )}
                      </td>
                    ))}
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => handleDeleteRecord(r.id)}
                        title="Delete entry"
                        style={{ color: "var(--brand-danger)" }}
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal: Add or Edit Field */}
      <Modal
        isOpen={fieldModalOpen}
        onClose={() => setFieldModalOpen(false)}
        title={editingField ? "Edit Exam Field Prompt" : "Add Custom Exam Field"}
        footer={
          <>
            <button className="btn btn-outline btn-sm" onClick={() => setFieldModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveFieldForm}>
              {editingField ? "Update Field" : "Create Field"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveFieldForm} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="form-group">
            <label className="label">Field Label (Column Name)</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Student ID, Programme, Marks, Seat Number"
              value={fieldForm.label}
              onChange={(e) => setFieldForm({ ...fieldForm, label: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Spoken Voice Prompt</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Please say the student ID number"
              value={fieldForm.voicePrompt}
              onChange={(e) => setFieldForm({ ...fieldForm, voicePrompt: e.target.value })}
              required
            />
            <span style={{ fontSize: "0.75rem", color: "var(--brand-muted)" }}>
              The exact question the voice assistant will speak aloud.
            </span>
          </div>

          <div className="form-group">
            <label className="label">Field Type</label>
            <select
              className="select"
              value={fieldForm.type}
              onChange={(e) => setFieldForm({ ...fieldForm, type: e.target.value })}
            >
              <option value="text">General Text</option>
              <option value="id">ID with Prefix / Zero Padding</option>
              <option value="number">Numeric Marks / Score</option>
            </select>
          </div>

          {fieldForm.type === "id" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div className="form-group">
                <label className="label">ID Prefix</label>
                <input
                  type="text"
                  className="input input-mono"
                  placeholder="e.g. 423123"
                  value={fieldForm.prefix}
                  onChange={(e) => setFieldForm({ ...fieldForm, prefix: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="label">Padding Digits</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  className="input input-mono"
                  placeholder="e.g. 4 (41 -> 0041)"
                  value={fieldForm.padDigits}
                  onChange={(e) => setFieldForm({ ...fieldForm, padDigits: e.target.value })}
                />
              </div>
            </div>
          )}

          <div style={{ borderTop: "1px solid var(--brand-border)", paddingTop: "0.75rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={fieldForm.hasDefault}
                onChange={(e) => setFieldForm({ ...fieldForm, hasDefault: e.target.checked })}
              />
              <span>Enable Default Value (User can say "default" or "same")</span>
            </label>

            {fieldForm.hasDefault && (
              <div className="form-group" style={{ marginTop: "0.5rem" }}>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. BSc Computer Science, Group A, Morning Session"
                  value={fieldForm.defaultValue}
                  onChange={(e) => setFieldForm({ ...fieldForm, defaultValue: e.target.value })}
                />
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Modal: Clear Records Confirm */}
      <Modal
        isOpen={clearModalOpen}
        onClose={() => setClearModalOpen(false)}
        title="Clear All Recorded Exam Entries?"
        footer={
          <>
            <button className="btn btn-outline btn-sm" onClick={() => setClearModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                setRecords([]);
                storage.saveExamRecords([]);
                setClearModalOpen(false);
                toast.info("Exam entries table cleared.");
              }}
            >
              Clear Table
            </button>
          </>
        }
      >
        <p style={{ fontSize: "0.9rem" }}>
          Are you sure you want to delete all <strong>{records.length}</strong> recorded entries? Make sure to download a CSV backup first if you need to keep them.
        </p>
      </Modal>
    </div>
  );
}
