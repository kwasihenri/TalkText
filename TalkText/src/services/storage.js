const DEFAULT_RULES = [
  {
    id: "rule-newline",
    name: "New Line",
    trigger: "newline",
    replacement: "\n",
    type: "format",
    category: "Formatting",
    active: true
  },
  {
    id: "rule-newline-alt",
    name: "New Line (Spaced)",
    trigger: "new line",
    replacement: "\n",
    type: "format",
    category: "Formatting",
    active: true
  },
  {
    id: "rule-paragraph",
    name: "New Paragraph",
    trigger: "new paragraph",
    replacement: "\n\n",
    type: "format",
    category: "Formatting",
    active: true
  },
  {
    id: "rule-period",
    name: "Period",
    trigger: "period",
    replacement: ".",
    type: "punctuation",
    category: "Punctuation",
    active: true
  },
  {
    id: "rule-fullstop",
    name: "Full Stop",
    trigger: "full stop",
    replacement: ".",
    type: "punctuation",
    category: "Punctuation",
    active: true
  },
  {
    id: "rule-comma",
    name: "Comma",
    trigger: "comma",
    replacement: ",",
    type: "punctuation",
    category: "Punctuation",
    active: true
  },
  {
    id: "rule-question",
    name: "Question Mark",
    trigger: "question mark",
    replacement: "?",
    type: "punctuation",
    category: "Punctuation",
    active: true
  },
  {
    id: "rule-exclamation",
    name: "Exclamation Mark",
    trigger: "exclamation mark",
    replacement: "!",
    type: "punctuation",
    category: "Punctuation",
    active: true
  },
  {
    id: "rule-colon",
    name: "Colon",
    trigger: "colon",
    replacement: ":",
    type: "punctuation",
    category: "Punctuation",
    active: true
  },
  {
    id: "rule-semicolon",
    name: "Semicolon",
    trigger: "semicolon",
    replacement: ";",
    type: "punctuation",
    category: "Punctuation",
    active: true
  },
  {
    id: "rule-dash",
    name: "Hyphen / Dash",
    trigger: "hyphen",
    replacement: " - ",
    type: "punctuation",
    category: "Punctuation",
    active: true
  },
  {
    id: "rule-smiley",
    name: "Smile Emoji",
    trigger: "smiley face",
    replacement: " 😊 ",
    type: "macro",
    category: "Emojis",
    active: true
  },
  {
    id: "rule-thumbsup",
    name: "Thumbs Up",
    trigger: "thumbs up",
    replacement: " 👍 ",
    type: "macro",
    category: "Emojis",
    active: true
  },
  {
    id: "rule-clear",
    name: "Clear Transcript",
    trigger: "clear transcript",
    replacement: "__ACTION_CLEAR__",
    type: "action",
    category: "Voice Actions",
    active: true
  },
  {
    id: "rule-undo",
    name: "Undo Last Voice Input",
    trigger: "undo last",
    replacement: "__ACTION_UNDO__",
    type: "action",
    category: "Voice Actions",
    active: true
  }
];

const DEFAULT_PRESETS = [
  {
    id: "preset-1",
    title: "Smart Audio Guide",
    description: "Demonstrates natural micro-pauses (rpause), longer pauses (lpause), and dynamic speed transitions.",
    text: "Welcome to TalkText (rpause) your programmable voice studio. (lpause) Notice how micro-pauses (pause:450ms) introduce a breath into the sentence. (speed:1.2) We can accelerate seamlessly (speed:0.85) or slow down to emphasize important words. (rpause) Enjoy building with TalkText!"
  },
  {
    id: "preset-2",
    title: "Podcast Intro & Hook",
    description: "Engaging podcast opening with pacing adjustments.",
    text: "Hey everyone, (rpause) welcome back to today's episode! (lpause) Before we get to the main topic, (rpause) make sure you click subscribe and share this with your friends. (speed:1.15) Now, let's jump straight in."
  },
  {
    id: "preset-3",
    title: "Meditation & Mindful Breath",
    description: "Ultra-calm guided breathing script using custom millisecond pause tags.",
    text: "Take a slow, deep breath in through your nose. (pause:2000ms) Hold it gently at the top. (pause:1500ms) And now exhale completely through your mouth. (pause:2500ms) Relax your shoulders and soften your brow."
  },
  {
    id: "preset-4",
    title: "Customer Support Prompt",
    description: "Polite automated phone system with measured pacing.",
    text: "Thank you for contacting customer support. (rpause) To speak with a billing representative, please press one. (rpause) For technical assistance with your software, please press two. (rpause) For all other inquiries, please hold."
  }
];

const STORAGE_KEYS = {
  RULES: "talktext_rules_v1",
  TRANSCRIPTS: "talktext_transcripts_v1",
  TTS_PRESETS: "talktext_tts_presets_v1",
  TTS_SAVED: "talktext_tts_saved_v1",
  LAST_ROUTE: "talktext_last_route_v1",
  SETTINGS: "talktext_settings_v1"
};

export const storage = {
  getRules: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RULES);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("[TalkText][storage.js] Error parsing rules:", e);
    }
    return DEFAULT_RULES;
  },

  saveRules: (rules) => {
    try {
      localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
      return true;
    } catch (e) {
      console.error("[TalkText][storage.js] Error saving rules:", e);
      return false;
    }
  },

  resetRules: () => {
    try {
      localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(DEFAULT_RULES));
      return DEFAULT_RULES;
    } catch (e) {
      console.error("[TalkText][storage.js] Error resetting rules:", e);
      return DEFAULT_RULES;
    }
  },

  getTranscripts: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TRANSCRIPTS);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("[TalkText][storage.js] Error reading transcripts:", e);
      return [];
    }
  },

  saveTranscripts: (transcripts) => {
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSCRIPTS, JSON.stringify(transcripts));
      return true;
    } catch (e) {
      console.error("[TalkText][storage.js] Error saving transcripts:", e);
      return false;
    }
  },

  getTtsPresets: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TTS_PRESETS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("[TalkText][storage.js] Error reading presets:", e);
    }
    return DEFAULT_PRESETS;
  },

  saveTtsPresets: (presets) => {
    try {
      localStorage.setItem(STORAGE_KEYS.TTS_PRESETS, JSON.stringify(presets));
      return true;
    } catch (e) {
      console.error("[TalkText][storage.js] Error saving presets:", e);
      return false;
    }
  },

  getSettings: () => {
    const fallback = {
      language: "en-US",
      autoPunctuation: true,
      soundCues: true,
      lastVoiceURI: "",
      defaultRate: 1,
      defaultPitch: 1,
      defaultVolume: 1
    };
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return stored ? { ...fallback, ...JSON.parse(stored) } : fallback;
    } catch (e) {
      console.error("[TalkText][storage.js] Error reading settings:", e);
      return fallback;
    }
  },

  saveSettings: (settings) => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      return true;
    } catch (e) {
      console.error("[TalkText][storage.js] Error saving settings:", e);
      return false;
    }
  },

  getLastRoute: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.LAST_ROUTE) || "/speech-to-text";
    } catch (e) {
      console.error("[TalkText][storage.js] Error reading last route:", e);
      return "/speech-to-text";
    }
  },

  setLastRoute: (route) => {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_ROUTE, route);
    } catch (e) {
      console.error("[TalkText][storage.js] Error writing last route:", e);
    }
  }
};
