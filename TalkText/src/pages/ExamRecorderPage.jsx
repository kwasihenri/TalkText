import React, { useState, useEffect, useRef, useCallback } from "react";
import { storage } from "../services/storage";
import { parseExamInput, parseRapidStreamTokens } from "../services/examInputParser";
import { useToast } from "../context/useToast";
import Modal from "../components/Modal";

function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

function createStudentRecord(finalDraft) {
  return {
    id: `rec-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...finalDraft
  };
}

function reorderFieldsWithLocks(fieldList) {
  if (!Array.isArray(fieldList)) return [];
  const unlocked = fieldList.filter((f) => !f.autoSkip);
  const locked = fieldList.filter((f) => f.autoSkip);
  return [...unlocked, ...locked];
}

export default function ExamRecorderPage() {
  const toast = useToast();

  const [fields, setFields] = useState(() => reorderFieldsWithLocks(storage.getExamFields()));
  const [records, setRecords] = useState(() => storage.getExamRecords());
  const [settings] = useState(() => storage.getExamSettings());

  const [recordingMode, setRecordingMode] = useState("rapid");
  const [isRunning, setIsRunning] = useState(false);
  const [currentFieldIdx, setCurrentFieldIdx] = useState(0);
  const [currentDraft, setCurrentDraft] = useState({});
  const [stageStatus, setStageStatus] = useState("idle");
  const [hearingText, setHearingText] = useState("");

  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);

  const [lockConfirmModalOpen, setLockConfirmModalOpen] = useState(false);
  const [lockConfirmField, setLockConfirmField] = useState(null);
  const [lockDefaultValue, setLockDefaultValue] = useState("");
  const [justMovedFieldId, setJustMovedFieldId] = useState(null);

  const [manageFieldsModalOpen, setManageFieldsModalOpen] = useState(false);

  const [editRecordModalOpen, setEditRecordModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editRecordForm, setEditRecordForm] = useState({});

  const [draftEditModalOpen, setDraftEditModalOpen] = useState(false);
  const [draftEditForm, setDraftEditForm] = useState({});
  const [draftEditFocusKey, setDraftEditFocusKey] = useState("");

  const [fieldForm, setFieldForm] = useState({
    label: "",
    voicePrompt: "",
    type: "text",
    prefix: "",
    padDigits: 0,
    hasDefault: false,
    defaultValue: "",
    autoSkip: false
  });

  const getInitialDraft = useCallback((fieldsList) => {
    const draft = {};
    for (const f of fieldsList) {
      if (f.autoSkip && f.hasDefault && f.defaultValue) {
        draft[f.key] = f.defaultValue;
      }
    }
    return draft;
  }, []);

  const getNextActiveIndex = useCallback((fromIdx, fieldsList) => {
    for (let i = fromIdx; i < fieldsList.length; i++) {
      if (!fieldsList[i].autoSkip) {
        return i;
      }
    }
    return fieldsList.length;
  }, []);

  const recognitionRef = useRef(null);
  const isRunningRef = useRef(false);
  const recordingModeRef = useRef("conversational");
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
    recordingModeRef.current = recordingMode;
  }, [recordingMode]);

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
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
  }

  function commitStudentRecord(finalDraft, isStream = false) {
    const newRecord = createStudentRecord(finalDraft);

    setRecords((prev) => {
      const updated = [newRecord, ...prev];
      storage.saveExamRecords(updated);
      return updated;
    });

    const studentIdVal = finalDraft.studentId || "Student";
    const marksVal = finalDraft.marks || "0";
    toast.success(`Recorded: ${studentIdVal} (${marksVal} marks)`);
    playChime();

    if (isStream) {
      const freshDraft = getInitialDraft(fieldsRef.current);
      const nextIdx = getNextActiveIndex(0, fieldsRef.current);
      setCurrentDraft(freshDraft);
      setCurrentFieldIdx(nextIdx >= fieldsRef.current.length ? 0 : nextIdx);
      currentDraftRef.current = freshDraft;
      currentFieldIdxRef.current = nextIdx >= fieldsRef.current.length ? 0 : nextIdx;
    } else {
      setStageStatus("confirming");
      const recapText = `Recorded ${studentIdVal}. Marks ${marksVal}. Next person.`;
      speak(recapText, () => {
        if (isRunningRef.current) {
          const freshDraft = getInitialDraft(fieldsRef.current);
          const nextIdx = getNextActiveIndex(0, fieldsRef.current);
          setCurrentDraft(freshDraft);
          setCurrentFieldIdx(nextIdx >= fieldsRef.current.length ? 0 : nextIdx);
          currentDraftRef.current = freshDraft;
          currentFieldIdxRef.current = nextIdx >= fieldsRef.current.length ? 0 : nextIdx;
          setTimeout(() => {
            askFieldAtIndex(nextIdx >= fieldsRef.current.length ? 0 : nextIdx);
          }, 700);
        }
      });
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
        listenForConversationalInput();
      }
    });
  }

  function askCurrentField() {
    askFieldAtIndex(currentFieldIdxRef.current);
  }

  function handleConversationalInput(rawSpoken) {
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
      let prevIdx = idx - 1;
      while (prevIdx >= 0 && currentFields[prevIdx].autoSkip) {
        prevIdx--;
      }
      if (prevIdx >= 0) {
        setCurrentFieldIdx(prevIdx);
        setTimeout(() => askCurrentField(), 300);
      } else {
        toast.info("Already at first question.");
        askCurrentField();
      }
      return;
    }

    const updatedDraft = {
      ...currentDraftRef.current,
      [field.key]: value || field.defaultValue || ""
    };
    setCurrentDraft(updatedDraft);

    const nextIdx = getNextActiveIndex(idx + 1, currentFields);
    if (nextIdx < currentFields.length) {
      setCurrentFieldIdx(nextIdx);
      setTimeout(() => {
        askFieldAtIndex(nextIdx);
      }, 400);
    } else {
      commitStudentRecord(updatedDraft, false);
    }
  }

  function handleRapidStreamInput(rawSpoken) {
    if (!rawSpoken || !isRunningRef.current) return;

    setHearingText(rawSpoken);
    const normalized = rawSpoken.trim().toLowerCase();

    if (normalized === "stop" || normalized === "pause" || normalized === "stop stream") {
      stopSession();
      toast.info("Rapid stream paused.");
      return;
    }

    if (normalized === "clear draft" || normalized === "reset current" || normalized === "cancel student") {
      setCurrentDraft({});
      setCurrentFieldIdx(0);
      currentDraftRef.current = {};
      currentFieldIdxRef.current = 0;
      toast.info("Current student draft cleared.");
      return;
    }

    const { action, updates, newIndex } = parseRapidStreamTokens(
      rawSpoken,
      fieldsRef.current,
      currentFieldIdxRef.current
    );

    if (action === "stop") {
      stopSession();
      toast.info("Stream paused.");
      return;
    }

    const updatedDraft = {
      ...currentDraftRef.current,
      ...updates
    };

    currentDraftRef.current = updatedDraft;
    setCurrentDraft({ ...updatedDraft });

    const currentFields = fieldsRef.current;
    if (newIndex >= currentFields.length) {
      commitStudentRecord(updatedDraft, true);
    } else {
      currentFieldIdxRef.current = newIndex;
      setCurrentFieldIdx(newIndex);
    }
  }

  function listenForConversationalInput() {
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
          handleConversationalInput(transcript);
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
            listenForConversationalInput();
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

  function startRapidStreamRecognition() {
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
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          handleRapidStreamInput(transcript);
        } else {
          interim += transcript;
        }
      }
      if (interim) setHearingText(interim);
    };

    recognition.onerror = (event) => {
      console.error("[TalkText][ExamRecorder] Stream error:", event.error);
    };

    recognition.onend = () => {
      if (isRunningRef.current && recordingModeRef.current === "rapid") {
        try {
          recognition.start();
        } catch {
          setIsRunning(false);
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setIsRunning(false);
    }
  }

  const handleSlotCardClick = (field) => {
    if (isRunningRef.current) {
      stopSession();
      toast.info(`Voice input paused to edit ${field.label}.`);
    }

    const formValues = { ...currentDraftRef.current };
    for (const f of fieldsRef.current) {
      if (formValues[f.key] === undefined) {
        formValues[f.key] = f.autoSkip && f.defaultValue ? f.defaultValue : (f.hasDefault ? f.defaultValue : "");
      }
    }

    setDraftEditForm(formValues);
    setDraftEditFocusKey(field.key);
    setDraftEditModalOpen(true);
  };

  const handleSaveDraftEdit = (shouldResumeVoice = false) => {
    const updatedDraft = { ...draftEditForm };
    setCurrentDraft(updatedDraft);
    currentDraftRef.current = updatedDraft;
    setDraftEditModalOpen(false);

    const allFilled = fields.every((f) => {
      const val = updatedDraft[f.key];
      return val !== undefined && val !== "";
    });

    if (allFilled) {
      commitStudentRecord(updatedDraft, recordingMode === "rapid");
      toast.success("Draft completed and record saved!");
      return;
    }

    let nextIdx = 0;
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (!updatedDraft[f.key] && !f.autoSkip) {
        nextIdx = i;
        break;
      }
    }
    setCurrentFieldIdx(nextIdx);
    currentFieldIdxRef.current = nextIdx;

    toast.success("Draft updated!");

    if (shouldResumeVoice) {
      setIsRunning(true);
      isRunningRef.current = true;
      if (recordingMode === "rapid") {
        setStageStatus("listening");
        startRapidStreamRecognition();
      } else {
        askFieldAtIndex(nextIdx);
      }
    }
  };

  const handleOpenLockConfirm = (field) => {
    setLockConfirmField(field);
    setLockDefaultValue(field.defaultValue || currentDraft[field.key] || "");
    setLockConfirmModalOpen(true);
  };

  const handleConfirmLock = (fieldId, confirmedVal) => {
    const val = (confirmedVal || "").trim();
    if (!val) {
      toast.error("Please enter or select a default value before locking.");
      return;
    }

    const updated = fields.map((f) => {
      if (f.id === fieldId) {
        return {
          ...f,
          hasDefault: true,
          defaultValue: val,
          autoSkip: true
        };
      }
      return f;
    });

    const reordered = reorderFieldsWithLocks(updated);
    setFields(reordered);
    fieldsRef.current = reordered;
    storage.saveExamFields(reordered);

    const targetField = updated.find((f) => f.id === fieldId);
    if (targetField) {
      const updatedDraft = {
        ...currentDraftRef.current,
        [targetField.key]: val
      };
      setCurrentDraft(updatedDraft);
      currentDraftRef.current = updatedDraft;
    }

    setJustMovedFieldId(fieldId);
    setTimeout(() => setJustMovedFieldId(null), 700);

    setLockConfirmModalOpen(false);
    toast.success(`Locked ${targetField?.label} to "${val}". Moved to batch defaults.`);
  };

  const handleUnlockField = (fieldId) => {
    const updated = fields.map((f) => {
      if (f.id === fieldId) {
        return {
          ...f,
          autoSkip: false
        };
      }
      return f;
    });

    const reordered = reorderFieldsWithLocks(updated);
    setFields(reordered);
    fieldsRef.current = reordered;
    storage.saveExamFields(reordered);

    const targetField = updated.find((f) => f.id === fieldId);
    if (targetField && currentDraftRef.current[targetField.key] === targetField.defaultValue) {
      const updatedDraft = { ...currentDraftRef.current };
      delete updatedDraft[targetField.key];
      setCurrentDraft(updatedDraft);
      currentDraftRef.current = updatedDraft;
    }

    setJustMovedFieldId(fieldId);
    setTimeout(() => setJustMovedFieldId(null), 700);

    setLockConfirmModalOpen(false);
    toast.info(`Unlocked ${targetField?.label}. Moved to active inputs.`);
  };

  const startSession = () => {
    if (fields.length === 0) {
      toast.error("Please add at least one field to start recording.");
      return;
    }

    const initDraft = getInitialDraft(fields);
    const startIdx = getNextActiveIndex(0, fields);

    setIsRunning(true);
    isRunningRef.current = true;
    setCurrentFieldIdx(startIdx >= fields.length ? 0 : startIdx);
    setCurrentDraft(initDraft);
    currentFieldIdxRef.current = startIdx >= fields.length ? 0 : startIdx;
    currentDraftRef.current = initDraft;

    if (recordingMode === "rapid") {
      setStageStatus("listening");
      toast.info("Continuous Stream active. Speak sequence with natural pauses.");
      startRapidStreamRecognition();
    } else {
      setStageStatus("speaking");
      toast.info("Exam recording assistant started.");
      const activeField = fields[startIdx] || fields[0];
      const promptToSpeak = activeField.voicePrompt || `Please say the ${activeField.label}`;
      speak("Exam recording started. " + promptToSpeak, () => {
        if (isRunningRef.current) {
          listenForConversationalInput();
        }
      });
    }
  };

  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if (e.code === "Space" || e.key === " ") {
        const activeEl = document.activeElement;
        const isInputField =
          activeEl &&
          (activeEl.tagName === "INPUT" ||
            activeEl.tagName === "TEXTAREA" ||
            activeEl.tagName === "SELECT" ||
            activeEl.isContentEditable);

        if (isInputField) return;

        if (
          fieldModalOpen ||
          clearModalOpen ||
          editRecordModalOpen ||
          draftEditModalOpen ||
          lockConfirmModalOpen ||
          manageFieldsModalOpen
        ) {
          return;
        }

        e.preventDefault();
        if (isRunningRef.current) {
          stopSession();
          toast.info("Recording paused (Spacebar).");
        } else {
          startSession();
          toast.info("Recording started (Spacebar).");
        }
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [fieldModalOpen, clearModalOpen, editRecordModalOpen, draftEditModalOpen, lockConfirmModalOpen, manageFieldsModalOpen]);

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
      defaultValue: "",
      autoSkip: false
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
      defaultValue: f.defaultValue || "",
      autoSkip: !!f.autoSkip
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
      defaultValue: fieldForm.defaultValue.trim(),
      autoSkip: fieldForm.hasDefault ? Boolean(fieldForm.autoSkip) : false
    };

    let updated;
    if (editingField) {
      updated = fields.map((f) => (f.id === editingField.id ? newFieldObj : f));
      toast.success("Field configuration updated.");
    } else {
      updated = [...fields, newFieldObj];
      toast.success("New field added.");
    }

    const reordered = reorderFieldsWithLocks(updated);
    setFields(reordered);
    fieldsRef.current = reordered;
    storage.saveExamFields(reordered);
    setFieldModalOpen(false);
  };

  const handleDeleteField = (id) => {
    if (fields.length <= 1) {
      toast.error("You must have at least one field.");
      return;
    }
    const target = fields.find((f) => f.id === id);
    const updated = fields.filter((f) => f.id !== id);
    const reordered = reorderFieldsWithLocks(updated);
    setFields(reordered);
    fieldsRef.current = reordered;
    storage.saveExamFields(reordered);

    const updatedDraft = { ...currentDraftRef.current };
    if (target) {
      delete updatedDraft[target.key];
      setCurrentDraft(updatedDraft);
      currentDraftRef.current = updatedDraft;
    }

    if (currentFieldIdxRef.current >= reordered.length) {
      const newIdx = Math.max(0, reordered.length - 1);
      setCurrentFieldIdx(newIdx);
      currentFieldIdxRef.current = newIdx;
    }

    toast.info(`Field "${target?.label || "Field"}" removed.`);
  };

  const handleResetFields = () => {
    const reset = storage.resetExamFields();
    const reordered = reorderFieldsWithLocks(reset);
    setFields(reordered);
    fieldsRef.current = reordered;
    toast.info("Fields reset to defaults.");
  };

  const handleOpenEditRecord = (record) => {
    setEditingRecord(record);
    setEditRecordForm({ ...record });
    setEditRecordModalOpen(true);
  };

  const handleSaveRecordEdit = (e) => {
    e.preventDefault();
    if (!editingRecord) return;
    const updated = records.map((r) =>
      r.id === editingRecord.id ? { ...editRecordForm } : r
    );
    setRecords(updated);
    storage.saveExamRecords(updated);
    setEditRecordModalOpen(false);
    setEditingRecord(null);
    toast.success(`Updated entry for ${editRecordForm.studentId || "Student"}`);
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
    <div className="exam-app-container">
      {/* Compact Native App Toolbar */}
      <div className="exam-top-toolbar">
        {/* Left: Mode Toggle & Live Status */}
        <div className="toolbar-left-group">
          <div className="exam-mode-pills">
            <button
              className={`mode-pill-btn ${recordingMode === "rapid" ? "active" : ""}`}
              onClick={() => {
                if (isRunning) stopSession();
                setRecordingMode("rapid");
              }}
              title="Continuous rapid dictation stream"
            >
              <i className="fa-solid fa-bolt"></i>
              <span>Rapid Stream</span>
            </button>
            <button
              className={`mode-pill-btn ${recordingMode === "conversational" ? "active" : ""}`}
              onClick={() => {
                if (isRunning) stopSession();
                setRecordingMode("conversational");
              }}
              title="Conversational question-and-answer"
            >
              <i className="fa-solid fa-comments"></i>
              <span>Q&A</span>
            </button>
          </div>

          <span
            className={`badge badge-sm ${
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
            <span>
              {stageStatus === "listening"
                ? `Slot ${currentFieldIdx + 1}/${fields.length}: ${currentField?.label}`
                : stageStatus === "speaking"
                ? "Speaking..."
                : stageStatus === "confirming"
                ? "Saving..."
                : "Ready"}
            </span>
          </span>

          {hearingText && (
            <span className="hearing-chip" title="Live recognized speech">
              <i className="fa-solid fa-ear-listen"></i>
              <span>"{hearingText}"</span>
            </span>
          )}
        </div>

        {/* Right: Controls & Actions */}
        <div className="toolbar-right-group">
          <button
            className={`btn btn-sm ${isRunning ? "btn-danger" : "btn-primary"} stream-toggle-btn`}
            onClick={isRunning ? stopSession : startSession}
            title="Press Spacebar to toggle recording"
          >
            <i className={`fa-solid ${isRunning ? "fa-circle-pause" : "fa-circle-play"}`}></i>
            <span>{isRunning ? "Pause" : "Start"}</span>
            <span className="keyboard-kbd">Space</span>
          </button>

          {isRunning && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                if (recordingMode === "rapid") {
                  handleRapidStreamInput(currentField?.defaultValue || "skip");
                } else {
                  handleConversationalInput(currentField?.defaultValue || "skip");
                }
              }}
              title="Skip to next field"
            >
              <i className="fa-solid fa-forward-step"></i>
              <span>Next</span>
            </button>
          )}

          <button
            className="btn btn-outline btn-sm"
            onClick={() => setManageFieldsModalOpen(true)}
            title="Manage, reorder or remove exam fields"
          >
            <i className="fa-solid fa-sliders"></i>
            <span className="btn-label-desktop">Fields ({fields.length})</span>
          </button>

          <button
            className="btn btn-outline btn-sm"
            onClick={handleOpenAddField}
            title="Add custom exam field"
          >
            <i className="fa-solid fa-plus"></i>
            <span className="btn-label-desktop">Add</span>
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={handleExportCSV}
            title="Export CSV spreadsheet"
          >
            <i className="fa-solid fa-file-csv"></i>
            <span className="btn-label-desktop">CSV</span>
          </button>

          <button
            className="btn btn-outline btn-sm"
            onClick={() => setClearModalOpen(true)}
            style={{ color: "var(--brand-danger)" }}
            disabled={records.length === 0}
            title="Clear recorded entries"
          >
            <i className="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>

      {/* Stream Slot Small Rectangles - All on One Line */}
      <div className="stream-slots-row" role="region" aria-label="Exam Fields Stream Slots">
        {fields.map((f, i) => {
          const isCurrent = isRunning && i === currentFieldIdx;
          const isFilled = currentDraft[f.key] !== undefined && currentDraft[f.key] !== "";
          const val = isFilled ? currentDraft[f.key] : f.defaultValue || "—";
          const isJustMoved = justMovedFieldId === f.id;
          const isFirstLocked = f.autoSkip && (i === 0 || !fields[i - 1]?.autoSkip);

          return (
            <React.Fragment key={f.id}>
              {isFirstLocked && (
                <div className="stream-slots-divider" title="Locked Batch Defaults">
                  <i className="fa-solid fa-lock"></i>
                  <span>Batch Defaults</span>
                </div>
              )}
              <div
                className={`stream-slot-rect ${isCurrent ? "active animate-pulse-glow" : ""} ${isFilled ? "filled" : ""} ${f.autoSkip ? "locked" : ""} ${isJustMoved ? "slot-animating" : ""}`}
                onClick={() => handleSlotCardClick(f)}
                title={`Slot #${i + 1}: ${f.label} (${f.autoSkip ? "Locked Default" : "Active Input"}) — click to edit current value`}
              >
                <span className="slot-rect-idx">#{i + 1}</span>
                <span className="slot-rect-label">{f.label}:</span>
                <span className="slot-rect-val">{val}</span>

                <button
                  type="button"
                  className={`slot-lock-toggle ${f.autoSkip ? "locked" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenLockConfirm(f);
                  }}
                  title={f.autoSkip ? `Locked default "${f.defaultValue}". Click to change default or unlock.` : `Click to confirm default & lock for this batch`}
                >
                  <i className={`fa-solid ${f.autoSkip ? "fa-lock" : "fa-lock-open"}`}></i>
                </button>

                <button
                  type="button"
                  className="slot-edit-prompt-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSlotCardClick(f);
                  }}
                  title={`Edit current value for ${f.label}`}
                >
                  <i className="fa-solid fa-pen"></i>
                </button>
              </div>
            </React.Fragment>
          );
        })}
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
              <span className="card-subtitle">{records.length} students recorded &bull; Click any cell to edit</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleExportCSV}
              title="Download CSV spreadsheet"
            >
              <i className="fa-solid fa-file-csv"></i>
              <span className="btn-label-desktop">Download CSV</span>
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setClearModalOpen(true)}
              style={{ color: "var(--brand-danger)" }}
              disabled={records.length === 0}
              title="Clear all recorded entries"
            >
              <i className="fa-solid fa-trash-can"></i>
              <span className="btn-label-desktop">Clear Table</span>
            </button>
          </div>
        </div>

        <div className="table-scroll-container" style={{ overflowX: "auto" }}>
          {records.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--brand-muted)" }}>
              <i className="fa-solid fa-clipboard-user" style={{ fontSize: "2rem", color: "var(--brand-muted-light)", marginBottom: "0.75rem" }}></i>
              <p style={{ fontSize: "0.9rem" }}>No students recorded yet. Press "Start" to begin recording.</p>
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
                      <td
                        key={f.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => handleOpenEditRecord(r)}
                        title="Click to edit cell data"
                      >
                        {f.type === "id" ? (
                          <span className="badge-id">{r[f.key] || "—"}</span>
                        ) : f.type === "number" ? (
                          <span className="badge-marks">{r[f.key] || "0"}</span>
                        ) : (
                          <span>{r[f.key] || "—"}</span>
                        )}
                      </td>
                    ))}
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", gap: "0.25rem" }}>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => handleOpenEditRecord(r)}
                          title="Edit student record"
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => handleDeleteRecord(r.id)}
                          title="Delete entry"
                          style={{ color: "var(--brand-danger)" }}
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
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
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
            {editingField ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ color: "var(--brand-danger)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                onClick={() => {
                  handleDeleteField(editingField.id);
                  setFieldModalOpen(false);
                }}
                disabled={fields.length <= 1}
                title={fields.length <= 1 ? "Cannot delete the only field" : "Remove this field from exam recorder"}
              >
                <i className="fa-solid fa-trash-can"></i> Delete Field
              </button>
            ) : (
              <div></div>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setFieldModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" onClick={handleSaveFieldForm}>
                {editingField ? "Update Field" : "Create Field"}
              </button>
            </div>
          </div>
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
              The exact question the voice assistant will speak aloud in Conversational mode.
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
              <>
                <div className="form-group" style={{ marginTop: "0.5rem" }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. BSc Computer Science, Group A, Morning Session"
                    value={fieldForm.defaultValue}
                    onChange={(e) => setFieldForm({ ...fieldForm, defaultValue: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ marginTop: "0.5rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.85rem", color: "var(--brand-primary)" }}>
                    <input
                      type="checkbox"
                      checked={fieldForm.autoSkip || false}
                      onChange={(e) => setFieldForm({ ...fieldForm, autoSkip: e.target.checked })}
                    />
                    <span><strong>Auto-skip & lock with default</strong> during batch entry (skip asking every student)</span>
                  </label>
                </div>
              </>
            )}
          </div>
        </form>
      </Modal>

      {/* Modal: Confirm Default & Lock Field */}
      <Modal
        isOpen={lockConfirmModalOpen}
        onClose={() => setLockConfirmModalOpen(false)}
        title={lockConfirmField?.autoSkip ? `Batch Default: ${lockConfirmField?.label}` : `Lock Default: ${lockConfirmField?.label}`}
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
            {lockConfirmField?.autoSkip ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ color: "var(--brand-danger)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                onClick={() => handleUnlockField(lockConfirmField.id)}
                title="Unlock and move back to active inputs"
              >
                <i className="fa-solid fa-lock-open"></i> Unlock Field
              </button>
            ) : (
              <div></div>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setLockConfirmModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleConfirmLock(lockConfirmField.id, lockDefaultValue)}
              >
                <i className={`fa-solid ${lockConfirmField?.autoSkip ? "fa-check" : "fa-lock"}`}></i>
                <span>{lockConfirmField?.autoSkip ? "Save Default" : "Confirm & Lock"}</span>
              </button>
            </div>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <p style={{ fontSize: "0.875rem", color: "var(--brand-muted)", margin: 0, lineHeight: 1.5 }}>
            {lockConfirmField?.autoSkip ? (
              <span>This field is currently locked to default value <strong>"{lockConfirmField?.defaultValue}"</strong> and auto-applied at the end of each record.</span>
            ) : (
              <span>Confirm or edit the default value for <strong>{lockConfirmField?.label}</strong>. When locked, this card will move to the end of the stream row so that only changing fields remain in front.</span>
            )}
          </p>

          <div className="form-group">
            <label className="label">Default Value for {lockConfirmField?.label}</label>
            <input
              type="text"
              className="input"
              value={lockDefaultValue}
              onChange={(e) => setLockDefaultValue(e.target.value)}
              placeholder={`Enter default value for ${lockConfirmField?.label}`}
              autoFocus
            />
          </div>

          {/* Quick Preset Buttons for common fields */}
          {(lockConfirmField?.key?.toLowerCase().includes("session") || lockConfirmField?.label?.toLowerCase().includes("session")) && (
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
              {["Morning Session", "Evening Session", "Afternoon Session", "Weekend Session"].map((ses) => (
                <button
                  key={ses}
                  type="button"
                  className="btn btn-sm btn-outline"
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.25rem 0.6rem",
                    background: lockDefaultValue === ses ? "var(--brand-accent)" : "#ffffff",
                    borderColor: lockDefaultValue === ses ? "var(--brand-primary)" : "var(--brand-border)"
                  }}
                  onClick={() => setLockDefaultValue(ses)}
                >
                  {ses}
                </button>
              ))}
            </div>
          )}

          {(lockConfirmField?.key?.toLowerCase().includes("class") || lockConfirmField?.label?.toLowerCase().includes("class")) && (
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
              {["Class A", "Class B", "Class C"].map((cls) => (
                <button
                  key={cls}
                  type="button"
                  className="btn btn-sm btn-outline"
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.25rem 0.6rem",
                    background: lockDefaultValue === cls ? "var(--brand-accent)" : "#ffffff",
                    borderColor: lockDefaultValue === cls ? "var(--brand-primary)" : "var(--brand-border)"
                  }}
                  onClick={() => setLockDefaultValue(cls)}
                >
                  {cls}
                </button>
              ))}
            </div>
          )}

          {(lockConfirmField?.key?.toLowerCase().includes("group") || lockConfirmField?.label?.toLowerCase().includes("group")) && (
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
              {["Group A", "Group B", "Group C"].map((grp) => (
                <button
                  key={grp}
                  type="button"
                  className="btn btn-sm btn-outline"
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.25rem 0.6rem",
                    background: lockDefaultValue === grp ? "var(--brand-accent)" : "#ffffff",
                    borderColor: lockDefaultValue === grp ? "var(--brand-primary)" : "var(--brand-border)"
                  }}
                  onClick={() => setLockDefaultValue(grp)}
                >
                  {grp}
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Manage & Remove Fields */}
      <Modal
        isOpen={manageFieldsModalOpen}
        onClose={() => setManageFieldsModalOpen(false)}
        title={`Manage Exam Fields (${fields.length})`}
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleResetFields}
              title="Reset fields to original defaults"
            >
              Reset to Defaults
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setManageFieldsModalOpen(false)}
            >
              Done
            </button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--brand-muted)" }}>
              Add, configure or remove recorded fields:
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setManageFieldsModalOpen(false);
                handleOpenAddField();
              }}
            >
              <i className="fa-solid fa-plus"></i> Add Field
            </button>
          </div>

          <div className="manage-fields-list">
            {fields.map((f, i) => (
              <div key={f.id} className="manage-field-row">
                <div className="manage-field-info">
                  <span className="slot-rect-idx">#{i + 1}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="manage-field-label">{f.label}</div>
                    <div className="manage-field-meta">
                      <span className="badge badge-neutral" style={{ fontSize: "0.65rem", padding: "0.1rem 0.35rem" }}>
                        {f.type}
                      </span>
                      {f.autoSkip ? (
                        <span className="badge badge-brand" style={{ fontSize: "0.65rem", padding: "0.1rem 0.35rem" }}>
                          <i className="fa-solid fa-lock"></i> Locked: {f.defaultValue}
                        </span>
                      ) : f.hasDefault ? (
                        <span style={{ color: "var(--brand-muted)" }}>Default: {f.defaultValue}</span>
                      ) : (
                        <span style={{ color: "var(--brand-muted)" }}>No default</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="manage-field-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    onClick={() => {
                      setManageFieldsModalOpen(false);
                      handleOpenEditField(f);
                    }}
                    title={`Edit ${f.label} prompt & settings`}
                  >
                    <i className="fa-solid fa-gear"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    onClick={() => handleDeleteField(f.id)}
                    disabled={fields.length <= 1}
                    style={{ color: fields.length <= 1 ? "var(--brand-muted)" : "var(--brand-danger)" }}
                    title={fields.length <= 1 ? "Cannot delete the only field" : `Remove ${f.label} field`}
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
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

      {/* Modal: Edit Student Record */}
      <Modal
        isOpen={editRecordModalOpen}
        onClose={() => {
          setEditRecordModalOpen(false);
          setEditingRecord(null);
        }}
        title={`Edit Record #${editingRecord ? records.findIndex((r) => r.id === editingRecord.id) + 1 : ""}`}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setEditRecordModalOpen(false);
                setEditingRecord(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveRecordEdit}
            >
              Save Changes
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveRecordEdit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {fields.map((f) => {
            const isGroup = f.key?.toLowerCase().includes("group") || f.label?.toLowerCase().includes("group");
            const isClass = f.key?.toLowerCase().includes("class") || f.label?.toLowerCase().includes("class");
            const isSession = f.key?.toLowerCase().includes("session") || f.label?.toLowerCase().includes("session");
            return (
              <div key={f.id} className="form-group">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.4rem" }}>
                  <label className="label">{f.label}</label>
                  <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                    {isGroup && (
                      ["Group A", "Group B", "Group C"].map((grp) => (
                        <button
                          key={grp}
                          type="button"
                          className="btn btn-sm btn-outline"
                          style={{
                            padding: "0.15rem 0.45rem",
                            fontSize: "0.725rem",
                            background: editRecordForm[f.key] === grp ? "var(--brand-accent)" : "#ffffff",
                            borderColor: editRecordForm[f.key] === grp ? "var(--brand-primary)" : "var(--brand-border)"
                          }}
                          onClick={() => setEditRecordForm((prev) => ({ ...prev, [f.key]: grp }))}
                        >
                          {grp}
                        </button>
                      ))
                    )}
                    {isClass && (
                      ["Class A", "Class B", "Class C"].map((cls) => (
                        <button
                          key={cls}
                          type="button"
                          className="btn btn-sm btn-outline"
                          style={{
                            padding: "0.15rem 0.45rem",
                            fontSize: "0.725rem",
                            background: editRecordForm[f.key] === cls ? "var(--brand-accent)" : "#ffffff",
                            borderColor: editRecordForm[f.key] === cls ? "var(--brand-primary)" : "var(--brand-border)"
                          }}
                          onClick={() => setEditRecordForm((prev) => ({ ...prev, [f.key]: cls }))}
                        >
                          {cls}
                        </button>
                      ))
                    )}
                    {isSession && (
                      ["Morning Session", "Evening Session", "Afternoon Session", "Weekend Session"].map((sess) => (
                        <button
                          key={sess}
                          type="button"
                          className="btn btn-sm btn-outline"
                          style={{
                            padding: "0.15rem 0.45rem",
                            fontSize: "0.725rem",
                            background: editRecordForm[f.key] === sess ? "var(--brand-accent)" : "#ffffff",
                            borderColor: editRecordForm[f.key] === sess ? "var(--brand-primary)" : "var(--brand-border)"
                          }}
                          onClick={() => setEditRecordForm((prev) => ({ ...prev, [f.key]: sess }))}
                        >
                          {sess.replace(" Session", "")}
                        </button>
                      ))
                    )}
                    {f.hasDefault && f.defaultValue && (
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        style={{ padding: "0.15rem 0.45rem", fontSize: "0.725rem", color: "var(--brand-primary)" }}
                        onClick={() => setEditRecordForm((prev) => ({ ...prev, [f.key]: f.defaultValue }))}
                        title={`Fill default: "${f.defaultValue}"`}
                      >
                        Default
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type={f.type === "number" ? "number" : "text"}
                  className={`input ${f.type === "id" || f.type === "number" ? "input-mono" : ""}`}
                  value={editRecordForm[f.key] || ""}
                  onChange={(e) =>
                    setEditRecordForm((prev) => ({
                      ...prev,
                      [f.key]: e.target.value
                    }))
                  }
                  placeholder={`Enter ${f.label}`}
                />
              </div>
            );
          })}
        </form>
      </Modal>

      {/* Modal: Tap-to-Edit Current Student Draft */}
      <Modal
        isOpen={draftEditModalOpen}
        onClose={() => setDraftEditModalOpen(false)}
        title="Edit Current Student Draft"
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setDraftEditModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleSaveDraftEdit(false)}
            >
              Save Changes
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => handleSaveDraftEdit(true)}
            >
              <i className="fa-solid fa-play"></i> Save & Resume
            </button>
          </>
        }
      >
        <div style={{ marginBottom: "1rem", fontSize: "0.85rem", color: "var(--brand-muted)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <i className="fa-solid fa-circle-pause" style={{ color: "#eab308", fontSize: "1rem" }}></i>
          <span>Voice recording is paused. Edit values below, click quick pills, and resume when ready.</span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveDraftEdit(false);
          }}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {fields.map((f) => {
            const isGroup = f.key?.toLowerCase().includes("group") || f.label?.toLowerCase().includes("group");
            const isClass = f.key?.toLowerCase().includes("class") || f.label?.toLowerCase().includes("class");
            const isSession = f.key?.toLowerCase().includes("session") || f.label?.toLowerCase().includes("session");
            const isFocusedTarget = draftEditFocusKey === f.key;
            return (
              <div
                key={f.id}
                className="form-group"
                style={{
                  padding: isFocusedTarget ? "0.6rem" : "0",
                  borderRadius: isFocusedTarget ? "var(--radius-sm)" : "0",
                  background: isFocusedTarget ? "var(--brand-accent)" : "transparent",
                  border: isFocusedTarget ? "1px solid var(--brand-secondary)" : "none"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.4rem" }}>
                  <label className="label" style={{ fontWeight: isFocusedTarget ? 800 : 600 }}>
                    {f.label} {f.autoSkip && <span className="badge badge-neutral" style={{ fontSize: "0.65rem", padding: "0.1rem 0.35rem" }}>Auto-skip</span>}
                  </label>
                  <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                    {isGroup && (
                      ["Group A", "Group B", "Group C"].map((grp) => (
                        <button
                          key={grp}
                          type="button"
                          className="btn btn-sm btn-outline"
                          style={{
                            padding: "0.15rem 0.45rem",
                            fontSize: "0.725rem",
                            background: draftEditForm[f.key] === grp ? "var(--brand-accent)" : "#ffffff",
                            borderColor: draftEditForm[f.key] === grp ? "var(--brand-primary)" : "var(--brand-border)"
                          }}
                          onClick={() => setDraftEditForm((prev) => ({ ...prev, [f.key]: grp }))}
                        >
                          {grp}
                        </button>
                      ))
                    )}
                    {isClass && (
                      ["Class A", "Class B", "Class C"].map((cls) => (
                        <button
                          key={cls}
                          type="button"
                          className="btn btn-sm btn-outline"
                          style={{
                            padding: "0.15rem 0.45rem",
                            fontSize: "0.725rem",
                            background: draftEditForm[f.key] === cls ? "var(--brand-accent)" : "#ffffff",
                            borderColor: draftEditForm[f.key] === cls ? "var(--brand-primary)" : "var(--brand-border)"
                          }}
                          onClick={() => setDraftEditForm((prev) => ({ ...prev, [f.key]: cls }))}
                        >
                          {cls}
                        </button>
                      ))
                    )}
                    {isSession && (
                      ["Morning Session", "Evening Session", "Afternoon Session", "Weekend Session"].map((sess) => (
                        <button
                          key={sess}
                          type="button"
                          className="btn btn-sm btn-outline"
                          style={{
                            padding: "0.15rem 0.45rem",
                            fontSize: "0.725rem",
                            background: draftEditForm[f.key] === sess ? "var(--brand-accent)" : "#ffffff",
                            borderColor: draftEditForm[f.key] === sess ? "var(--brand-primary)" : "var(--brand-border)"
                          }}
                          onClick={() => setDraftEditForm((prev) => ({ ...prev, [f.key]: sess }))}
                        >
                          {sess.replace(" Session", "")}
                        </button>
                      ))
                    )}
                    {f.hasDefault && f.defaultValue && (
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        style={{ padding: "0.15rem 0.45rem", fontSize: "0.725rem", color: "var(--brand-primary)" }}
                        onClick={() => setDraftEditForm((prev) => ({ ...prev, [f.key]: f.defaultValue }))}
                        title={`Fill default: "${f.defaultValue}"`}
                      >
                        Default
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type={f.type === "number" ? "number" : "text"}
                  className={`input ${f.type === "id" || f.type === "number" ? "input-mono" : ""}`}
                  value={draftEditForm[f.key] || ""}
                  onChange={(e) =>
                    setDraftEditForm((prev) => ({
                      ...prev,
                      [f.key]: e.target.value
                    }))
                  }
                  autoFocus={isFocusedTarget}
                  placeholder={`Enter ${f.label}`}
                />
              </div>
            );
          })}
        </form>
      </Modal>
    </div>
  );
}
