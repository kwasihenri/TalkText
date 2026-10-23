const NUMBER_WORDS = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100
};

const PHONETIC_LETTER_MAP = {
  sea: "C",
  see: "C",
  si: "C",
  cee: "C",
  c: "C",
  charlie: "C",
  she: "C",
  scene: "C",
  sink: "C",
  bee: "B",
  be: "B",
  b: "B",
  bravo: "B",
  beat: "B",
  bean: "B",
  ay: "A",
  hey: "A",
  eh: "A",
  a: "A",
  alpha: "A",
  apple: "A",
  ace: "A",
  dee: "D",
  de: "D",
  d: "D",
  delta: "D",
  day: "D",
  deep: "D",
  e: "E",
  echo: "E",
  ef: "F",
  f: "F",
  foxtrot: "F",
  gee: "G",
  g: "G",
  golf: "G"
};

const PHONETIC_SESSION_MAP = {
  evening: "Evening Session",
  evenings: "Evening Session",
  evning: "Evening Session",
  ivning: "Evening Session",
  even: "Evening Session",
  eve: "Evening Session",
  eves: "Evening Session",
  night: "Evening Session",
  nights: "Evening Session",
  nighttime: "Evening Session",
  pm: "Evening Session",
  "p m": "Evening Session",
  "p.m.": "Evening Session",
  late: "Evening Session",
  dark: "Evening Session",
  dusk: "Evening Session",
  leaving: "Evening Session",
  eating: "Evening Session",
  meaning: "Evening Session",
  meeting: "Evening Session",
  giving: "Evening Session",
  living: "Evening Session",
  feeling: "Evening Session",
  heating: "Evening Session",
  feeding: "Evening Session",
  kneeling: "Evening Session",
  dealing: "Evening Session",
  healing: "Evening Session",
  believing: "Evening Session",
  receiving: "Evening Session",
  event: "Evening Session",
  events: "Evening Session",
  "even in": "Evening Session",
  "even ink": "Evening Session",
  evelyn: "Evening Session",
  eveling: "Evening Session",
  having: "Evening Session",
  heavy: "Evening Session",
  heavening: "Evening Session",
  "evening session": "Evening Session",
  "evening class": "Evening Session",
  tonight: "Evening Session",
  "night session": "Evening Session",
  "late session": "Evening Session",

  morning: "Morning Session",
  mornings: "Morning Session",
  morn: "Morning Session",
  mourning: "Morning Session",
  mourn: "Morning Session",
  am: "Morning Session",
  "a m": "Morning Session",
  "a.m.": "Morning Session",
  day: "Morning Session",
  daytime: "Morning Session",
  early: "Morning Session",
  dawn: "Morning Session",
  money: "Morning Session",
  warning: "Morning Session",
  learning: "Morning Session",
  moaning: "Morning Session",
  yawning: "Morning Session",
  "morning session": "Morning Session",
  "morning class": "Morning Session",
  regular: "Morning Session",
  "regular session": "Morning Session",
  "first session": "Morning Session",
  "am session": "Morning Session",

  afternoon: "Afternoon Session",
  afternoons: "Afternoon Session",
  "after noon": "Afternoon Session",
  after: "Afternoon Session",
  noon: "Afternoon Session",
  midday: "Afternoon Session",
  "mid day": "Afternoon Session",
  lunch: "Afternoon Session",
  "afternoon session": "Afternoon Session",
  "afternoon class": "Afternoon Session",
  "second session": "Afternoon Session",

  weekend: "Weekend Session",
  weekends: "Weekend Session",
  "week end": "Weekend Session",
  saturday: "Weekend Session",
  saturdays: "Weekend Session",
  sunday: "Weekend Session",
  sundays: "Weekend Session",
  sat: "Weekend Session",
  sun: "Weekend Session",
  "weekend session": "Weekend Session"
};

const DEFAULT_KEYWORDS = new Set([
  "default",
  "defaults",
  "defaulted",
  "difference",
  "differences",
  "different",
  "difficult",
  "definitely",
  "definition",
  "differ",
  "differs",
  "differing",
  "differently",
  "deferred",
  "deference",
  "defence",
  "defense",
  "def",
  "diff",
  "deft",
  "same",
  "same thing",
  "as before",
  "keep",
  "keep same",
  "yes",
  "okay",
  "fine",
  "normal",
  "standard",
  "the fault",
  "de fault",
  "that fault",
  "to fault",
  "a fault",
  "dip vault",
  "deep vault",
  "the volt",
  "the vault",
  "the fold",
  "the fall",
  "the force",
  "fault",
  "vault",
  "use default",
  "take default",
  "set default",
  "put default",
  "by default",
  "as default",
  "it's default",
  "its default",
  "say default",
  "go with default",
  "standard default",
  "skip",
  "next"
]);

export function cleanSpoken(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .toLowerCase()
    .replace(/[.,!?;:'"()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordsToNumber(str) {
  if (!str) return null;
  const direct = str.replace(/[^0-9.]/g, "");
  if (direct.length > 0) {
    return direct;
  }

  const clean = cleanSpoken(str).replace(/-/g, " ");
  const tokens = clean.split(/\s+/);
  let total = 0;
  let current = 0;
  let foundNumber = false;

  for (const token of tokens) {
    if (NUMBER_WORDS[token] !== undefined) {
      foundNumber = true;
      const val = NUMBER_WORDS[token];
      if (val === 100) {
        current = (current === 0 ? 1 : current) * 100;
      } else {
        current += val;
      }
    } else {
      total += current;
      current = 0;
    }
  }
  total += current;

  return foundNumber ? String(total) : null;
}

export function isSpokenDefault(spokenText, field) {
  if (!field) return false;
  const hasDef = field.hasDefault || Boolean(field.defaultValue);
  if (!hasDef) return false;

  const clean = cleanSpoken(spokenText);
  if (!clean) return false;

  if (DEFAULT_KEYWORDS.has(clean)) {
    return true;
  }

  if (
    clean.startsWith("def") ||
    clean.startsWith("diff") ||
    clean.startsWith("de f") ||
    clean.startsWith("the f") ||
    clean.startsWith("dip") ||
    clean.startsWith("deep") ||
    clean.startsWith("that f") ||
    clean.startsWith("to f")
  ) {
    return true;
  }

  if (
    clean.includes("default") ||
    clean.includes("difference") ||
    clean.includes("different") ||
    clean.includes("difficult") ||
    clean.includes("fault") ||
    clean.includes("vault") ||
    clean.includes("same") ||
    clean.includes("standard")
  ) {
    return true;
  }

  const words = clean.split(" ");
  for (const w of words) {
    if (DEFAULT_KEYWORDS.has(w) || w.startsWith("def") || w.startsWith("diff")) {
      return true;
    }
  }

  return false;
}

export function resolveLetterOrGroup(spokenText, field) {
  if (!spokenText) return null;
  const clean = cleanSpoken(spokenText);
  if (!clean) return null;

  const isGroupField =
    (field.key && field.key.toLowerCase().includes("group")) ||
    (field.label && field.label.toLowerCase().includes("group")) ||
    (field.defaultValue && field.defaultValue.toLowerCase().startsWith("group"));

  const groupMatch = clean.match(/^group\s+([a-z]+)$/i);
  if (groupMatch) {
    const letterKey = groupMatch[1].toLowerCase();
    const mappedLetter = PHONETIC_LETTER_MAP[letterKey] || groupMatch[1].toUpperCase();
    return `Group ${mappedLetter}`;
  }

  if (PHONETIC_LETTER_MAP[clean]) {
    const letter = PHONETIC_LETTER_MAP[clean];
    return isGroupField ? `Group ${letter}` : letter;
  }

  if (isGroupField) {
    if (clean.includes("sea") || clean.includes("see") || clean === "c" || clean === "charlie") {
      return "Group C";
    }
    if (clean.includes("bee") || clean.includes("be") || clean === "b" || clean === "bravo") {
      return "Group B";
    }
    if (clean.includes("ay") || clean === "a" || clean === "alpha") {
      return "Group A";
    }
    if (clean.includes("dee") || clean === "d" || clean === "delta") {
      return "Group D";
    }
    if (isSpokenDefault(clean, field)) {
      return field.defaultValue || "Group A";
    }
    return field.defaultValue || "Group A";
  }

  return null;
}

export function resolveSession(spokenText, field) {
  const isSessionField =
    (field.key && field.key.toLowerCase().includes("session")) ||
    (field.label && field.label.toLowerCase().includes("session")) ||
    (field.defaultValue && field.defaultValue.toLowerCase().includes("session"));

  if (!isSessionField) return null;

  const clean = cleanSpoken(spokenText);
  if (!clean) return field.defaultValue || "Morning Session";

  if (isSpokenDefault(clean, field)) {
    return field.defaultValue || "Morning Session";
  }

  if (PHONETIC_SESSION_MAP[clean]) {
    return PHONETIC_SESSION_MAP[clean];
  }

  const sessionMatch = clean.match(/^(morning|evening|afternoon|weekend)\s*(session|class)?$/);
  if (sessionMatch) {
    const sType = sessionMatch[1].toLowerCase();
    return `${sType.charAt(0).toUpperCase() + sType.slice(1)} Session`;
  }

  if (
    clean.startsWith("ev") ||
    clean.startsWith("iv") ||
    clean.startsWith("leav") ||
    clean.startsWith("eat") ||
    clean.startsWith("mean") ||
    clean.startsWith("meet") ||
    clean.startsWith("giv") ||
    clean.startsWith("liv") ||
    clean.startsWith("feel") ||
    clean.startsWith("heat") ||
    clean.startsWith("feed") ||
    clean.startsWith("heav") ||
    clean.includes("even") ||
    clean.includes("night") ||
    clean.includes("pm") ||
    clean.includes("late")
  ) {
    return "Evening Session";
  }

  if (
    clean.startsWith("mor") ||
    clean.startsWith("mour") ||
    clean.startsWith("am") ||
    clean.startsWith("dawn") ||
    clean.startsWith("earl") ||
    clean.startsWith("warn") ||
    clean.startsWith("learn") ||
    clean.startsWith("money") ||
    clean.startsWith("moan") ||
    clean.includes("morn") ||
    clean.includes("mourn") ||
    clean.includes("am") ||
    clean.includes("day")
  ) {
    return "Morning Session";
  }

  if (
    clean.startsWith("aft") ||
    clean.startsWith("noon") ||
    clean.startsWith("midday") ||
    clean.includes("after") ||
    clean.includes("noon") ||
    clean.includes("midday") ||
    clean.includes("lunch")
  ) {
    return "Afternoon Session";
  }

  if (
    clean.startsWith("week") ||
    clean.startsWith("sat") ||
    clean.startsWith("sun") ||
    clean.includes("weekend") ||
    clean.includes("sat") ||
    clean.includes("sun")
  ) {
    return "Weekend Session";
  }

  return field.defaultValue || "Morning Session";
}

export function parseExamInput(spokenText, field) {
  if (!spokenText || typeof spokenText !== "string") {
    return { value: field?.defaultValue || "", action: null };
  }

  const clean = cleanSpoken(spokenText);

  if (clean === "stop" || clean === "pause" || clean === "cancel" || clean === "stop stream") {
    return { value: null, action: "stop" };
  }
  if (clean === "repeat" || clean === "again" || clean === "what") {
    return { value: null, action: "repeat" };
  }
  if (clean === "undo" || clean === "back") {
    return { value: null, action: "undo" };
  }
  if (clean === "skip" || clean === "next") {
    return { value: field.defaultValue || "", action: "skip" };
  }

  const isSessionField =
    (field.key && field.key.toLowerCase().includes("session")) ||
    (field.label && field.label.toLowerCase().includes("session")) ||
    (field.defaultValue && field.defaultValue.toLowerCase().includes("session"));

  if (isSessionField) {
    const sessionVal = resolveSession(spokenText, field);
    return { value: sessionVal, action: null };
  }

  const isGroupField =
    (field.key && field.key.toLowerCase().includes("group")) ||
    (field.label && field.label.toLowerCase().includes("group")) ||
    (field.defaultValue && field.defaultValue.toLowerCase().startsWith("group"));

  if (isGroupField) {
    const groupVal = resolveLetterOrGroup(spokenText, field);
    return { value: groupVal, action: null };
  }

  if (isSpokenDefault(spokenText, field)) {
    return { value: field.defaultValue || "", action: null };
  }

  if (field.type === "id") {
    const numericStr = wordsToNumber(spokenText) || spokenText.replace(/[^0-9]/g, "");
    if (!numericStr) {
      return { value: spokenText.trim(), action: null };
    }

    if (field.prefix && numericStr.startsWith(field.prefix)) {
      return { value: numericStr, action: null };
    }

    let dynamicPart = numericStr;
    if (field.padDigits > 0) {
      dynamicPart = dynamicPart.padStart(field.padDigits, "0");
    }

    const finalId = field.prefix ? `${field.prefix}${dynamicPart}` : dynamicPart;
    return { value: finalId, action: null };
  }

  if (field.type === "number") {
    const num = wordsToNumber(spokenText);
    return { value: num !== null ? num : spokenText.replace(/[^0-9.]/g, ""), action: null };
  }

  return { value: spokenText.trim(), action: null };
}

export function parseRapidStreamTokens(rawSpoken, currentFields, currentIdx) {
  if (!rawSpoken || typeof rawSpoken !== "string") {
    return { parsedCount: 0, updates: {} };
  }

  let rawChunks = rawSpoken.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);

  if (rawChunks.length === 1 && currentIdx < currentFields.length) {
    const singleChunk = rawChunks[0];
    const words = cleanSpoken(singleChunk).split(" ").filter(Boolean);
    const remainingCount = currentFields.length - currentIdx;

    if (words.length > 1 && remainingCount > 1) {
      const tokens = [];
      let wIdx = 0;

      for (let fIdx = currentIdx; fIdx < currentFields.length && wIdx < words.length; fIdx++) {
        const field = currentFields[fIdx];
        const isGroup =
          (field.key && field.key.toLowerCase().includes("group")) ||
          (field.label && field.label.toLowerCase().includes("group"));
        const isSession =
          (field.key && field.key.toLowerCase().includes("session")) ||
          (field.label && field.label.toLowerCase().includes("session"));

        if (isGroup && words[wIdx] === "group" && wIdx + 1 < words.length) {
          tokens.push(`${words[wIdx]} ${words[wIdx + 1]}`);
          wIdx += 2;
        } else if (
          isSession &&
          (words[wIdx] === "morning" || words[wIdx] === "evening" || words[wIdx] === "afternoon" || words[wIdx] === "weekend") &&
          wIdx + 1 < words.length &&
          words[wIdx + 1] === "session"
        ) {
          tokens.push(`${words[wIdx]} ${words[wIdx + 1]}`);
          wIdx += 2;
        } else {
          tokens.push(words[wIdx]);
          wIdx += 1;
        }
      }

      if (tokens.length > 1) {
        rawChunks = tokens;
      }
    }
  }

  const updates = {};
  let consumedIdx = currentIdx;

  for (const chunk of rawChunks) {
    if (consumedIdx >= currentFields.length) break;
    const field = currentFields[consumedIdx];
    const { value, action } = parseExamInput(chunk, field);

    if (action === "stop") {
      return { action: "stop", updates, consumedIdx };
    }
    if (action === "undo") {
      if (consumedIdx > currentIdx) {
        consumedIdx--;
        delete updates[currentFields[consumedIdx].key];
      }
      continue;
    }
    if (action === "skip") {
      updates[field.key] = field.defaultValue || "";
      consumedIdx++;
      continue;
    }

    updates[field.key] = value || (field.hasDefault ? field.defaultValue : "");
    consumedIdx++;
  }

  return {
    action: null,
    updates,
    newIndex: consumedIdx,
    parsedCount: consumedIdx - currentIdx
  };
}
