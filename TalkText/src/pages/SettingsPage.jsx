import { useState } from "react";
import { storage } from "../services/storage";
import { useToast } from "../context/useToast";
import Modal from "../components/Modal";

export default function SettingsPage() {
  const toast = useToast();

  const [rules, setRules] = useState(() => storage.getRules());
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  const [ruleForm, setRuleForm] = useState({
    name: "",
    trigger: "",
    replacement: "",
    category: "Formatting"
  });

  const handleToggleRule = (id) => {
    const updated = rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r));
    setRules(updated);
    storage.saveRules(updated);
  };

  const handleDeleteRule = (id) => {
    const updated = rules.filter((r) => r.id !== id);
    setRules(updated);
    storage.saveRules(updated);
    toast.info("Rule deleted.");
  };

  const handleOpenAddModal = () => {
    setEditingRule(null);
    setRuleForm({ name: "", trigger: "", replacement: "", category: "Formatting" });
    setRuleModalOpen(true);
  };

  const handleOpenEditModal = (rule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      trigger: rule.trigger,
      replacement: rule.replacement === "\n" ? "\\n" : rule.replacement === "\n\n" ? "\\n\\n" : rule.replacement,
      category: rule.category
    });
    setRuleModalOpen(true);
  };

  const handleSaveRule = (e) => {
    e.preventDefault();
    if (!ruleForm.trigger.trim()) {
      toast.error("Trigger phrase cannot be empty.");
      return;
    }

    let actualReplacement = ruleForm.replacement;
    if (ruleForm.replacement === "\\n") actualReplacement = "\n";
    if (ruleForm.replacement === "\\n\\n") actualReplacement = "\n\n";

    if (editingRule) {
      const updated = rules.map((r) =>
        r.id === editingRule.id
          ? {
              ...r,
              name: ruleForm.name.trim() || ruleForm.trigger.trim(),
              trigger: ruleForm.trigger.trim().toLowerCase(),
              replacement: actualReplacement,
              category: ruleForm.category
            }
          : r
      );
      setRules(updated);
      storage.saveRules(updated);
      toast.success("Rule updated successfully.");
    } else {
      const created = {
        id: `rule-${Date.now()}`,
        name: ruleForm.name.trim() || ruleForm.trigger.trim(),
        trigger: ruleForm.trigger.trim().toLowerCase(),
        replacement: actualReplacement,
        category: ruleForm.category,
        active: true
      };
      const updated = [created, ...rules];
      setRules(updated);
      storage.saveRules(updated);
      toast.success("New rule added.");
    }
    setRuleModalOpen(false);
  };

  const handleExportData = () => {
    const bundle = {
      talktext_export_version: "2.0",
      timestamp: new Date().toISOString(),
      rules,
      transcripts: storage.getTranscripts(),
      presets: storage.getTtsPresets()
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `talktext_backup_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("All rules & transcripts exported to JSON!");
  };

  const handleImportData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.rules && Array.isArray(parsed.rules)) {
          setRules(parsed.rules);
          storage.saveRules(parsed.rules);
        }
        if (parsed.transcripts && Array.isArray(parsed.transcripts)) {
          storage.saveTranscripts(parsed.transcripts);
        }
        if (parsed.presets && Array.isArray(parsed.presets)) {
          storage.saveTtsPresets(parsed.presets);
        }
        toast.success("Data imported successfully!");
      } catch (err) {
        console.error("[TalkText][Settings] Import error:", err);
        toast.error("Failed to parse JSON backup file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleConfirmReset = () => {
    const defaultRules = storage.resetRules();
    setRules(defaultRules);
    setResetModalOpen(false);
    toast.info("Rules restored to default factory state.");
  };

  return (
    <div className="settings-app-container">
      <div className="settings-grid full-height-settings">
        {/* Left Column: Full Rules Manager */}
        <div className="card-panel rules-main-card">
          <div className="card-header">
            <div className="card-title-group">
              <div className="card-icon-bubble">
                <i className="fa-solid fa-sliders"></i>
              </div>
              <div>
                <h2 className="card-title">Voice Rules Engine</h2>
                <span className="card-subtitle">{rules.length} custom macro rules loaded</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              <button className="btn btn-primary btn-sm" onClick={handleOpenAddModal}>
                <i className="fa-solid fa-plus"></i> Add Rule
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setResetModalOpen(true)}
                title="Reset all rules to default"
              >
                <i className="fa-solid fa-rotate-left"></i> Reset
              </button>
              <button className="btn btn-outline btn-sm" onClick={handleExportData} title="Backup data to JSON">
                <i className="fa-solid fa-download"></i> Backup
              </button>
              <label className="btn btn-outline btn-sm" style={{ cursor: "pointer", margin: 0 }} title="Restore data from JSON">
                <i className="fa-solid fa-upload"></i> Restore
                <input
                  type="file"
                  accept=".json"
                  style={{ display: "none" }}
                  onChange={handleImportData}
                />
              </label>
            </div>
          </div>

          <div className="card-body" style={{ padding: "1.25rem" }}>
            <div className="rule-table-container">
              <table className="rule-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Spoken Trigger</th>
                    <th>Replaced Output</th>
                    <th>Category</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id}>
                      <td>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={rule.active}
                            onChange={() => handleToggleRule(rule.id)}
                          />
                          <span className="slider-toggle"></span>
                        </label>
                      </td>
                      <td>
                        <code style={{ color: "var(--brand-primary)", fontWeight: 700 }}>
                          "{rule.trigger}"
                        </code>
                      </td>
                      <td>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            background: "var(--brand-accent)",
                            padding: "0.15rem 0.4rem",
                            borderRadius: "4px",
                            color: "var(--brand-success)",
                            fontWeight: 600
                          }}
                        >
                          {rule.replacement === "\n"
                            ? "↵ [newline]"
                            : rule.replacement === "\n\n"
                            ? "↵↵ [new paragraph]"
                            : rule.replacement}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-neutral">{rule.category}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => handleOpenEditModal(rule)}
                            title="Edit rule"
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                          </button>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => handleDeleteRule(rule.id)}
                            title="Delete rule"
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
            </div>
          </div>
        </div>

        {/* Right Column: TTS Tag Syntax Reference Cheat Sheet */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="card-panel">
            <div className="card-header">
              <div className="card-title-group">
                <div className="card-icon-bubble">
                  <i className="fa-solid fa-code"></i>
                </div>
                <div>
                  <h2 className="card-title">TTS Tag Cheat Sheet</h2>
                  <span className="card-subtitle">Micro-pause & voice modifiers</span>
                </div>
              </div>
            </div>

            <div className="card-body" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <code style={{ color: "var(--brand-primary)", fontWeight: 700 }}>(rpause)</code>
                  <span className="badge badge-brand">Rapid Pause</span>
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--brand-muted)" }}>
                  Pauses speech for ~450ms. Ideal for quick commas, breaths, and natural sentence flow.
                </p>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid var(--brand-border)" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <code style={{ color: "var(--brand-primary)", fontWeight: 700 }}>(lpause)</code>
                  <span className="badge badge-brand">Long Pause</span>
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--brand-muted)" }}>
                  Pauses speech for ~1400ms (1.4 seconds). Excellent for dramatic pauses and paragraph boundaries.
                </p>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid var(--brand-border)" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <code style={{ color: "var(--brand-primary)", fontWeight: 700 }}>(pause:800ms)</code>
                  <span className="badge badge-neutral">Custom Duration</span>
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--brand-muted)" }}>
                  Customizable wait time. Supports <code>(pause:500ms)</code> or <code>(pause:2s)</code>.
                </p>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid var(--brand-border)" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <code style={{ color: "var(--brand-primary)", fontWeight: 700 }}>(speed:1.3)</code>
                  <span className="badge badge-neutral">Rate Shift</span>
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--brand-muted)" }}>
                  Accelerates or slows down speech speed dynamically (range 0.25x to 2.0x).
                </p>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid var(--brand-border)" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <code style={{ color: "var(--brand-primary)", fontWeight: 700 }}>(whisper) / (shout)</code>
                  <span className="badge badge-neutral">Volume Presets</span>
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--brand-muted)" }}>
                  Adjusts tone, volume, and pacing for subtle whispering or loud callouts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Add or Edit Rule */}
      <Modal
        isOpen={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        title={editingRule ? "Edit Voice Rule" : "Add New Speech Rule"}
        footer={
          <>
            <button className="btn btn-outline btn-sm" onClick={() => setRuleModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveRule}>
              {editingRule ? "Update Rule" : "Create Rule"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveRule} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="form-group">
            <label className="label">Rule Label</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Next Line, Colon Symbol, Exclamation"
              value={ruleForm.name}
              onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="label">Trigger Phrase (Spoken Word)</label>
            <input
              type="text"
              className="input input-mono"
              placeholder="e.g. newline, full stop, exclamation"
              value={ruleForm.trigger}
              onChange={(e) => setRuleForm({ ...ruleForm, trigger: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Output Text (Replacement)</label>
            <input
              type="text"
              className="input input-mono"
              placeholder="e.g. \n (for Enter key), \n\n, ., :, 😊"
              value={ruleForm.replacement}
              onChange={(e) => setRuleForm({ ...ruleForm, replacement: e.target.value })}
              required
            />
            <span style={{ fontSize: "0.75rem", color: "var(--brand-muted)" }}>
              Tip: Use <code>\n</code> to produce an Enter / newline, or <code>__ACTION_CLEAR__</code> to clear transcript.
            </span>
          </div>

          <div className="form-group">
            <label className="label">Category</label>
            <select
              className="select"
              value={ruleForm.category}
              onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })}
            >
              <option value="Formatting">Formatting</option>
              <option value="Punctuation">Punctuation</option>
              <option value="Emojis">Emojis</option>
              <option value="Snippets">Snippets</option>
              <option value="Voice Actions">Voice Actions</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* Modal: Confirm Reset */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Restore Default Rules?"
        footer={
          <>
            <button className="btn btn-outline btn-sm" onClick={() => setResetModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleConfirmReset}>
              Reset to Defaults
            </button>
          </>
        }
      >
        <p style={{ fontSize: "0.9rem" }}>
          This will restore the standard suite of voice rules (including <code>newline</code>, <code>comma</code>, <code>period</code>, etc.). Any custom triggers you created can be exported to JSON first if you want to keep them.
        </p>
      </Modal>
    </div>
  );
}
