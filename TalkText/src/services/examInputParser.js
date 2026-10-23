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
  c: "C",
  bee: "B",
  be: "B",
  b: "B",
  ay: "A",
  hey: "A",
  eh: "A",
  a: "A",
  dee: "D",
  de: "D",
  d: "D",
  e: "E",
  ef: "F",
  f: "F",
  gee: "G",
  g: "G"
};

export function wordsToNumber(str) {
  if (!str) return null;
  const direct = str.replace(/[^0-9.]/g, "");
  if (direct.length > 0) {
    return direct;
  }

  const clean = str.toLowerCase().replace(/-/g, " ");
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

function resolveLetterOrGroup(spokenText, field) {
  if (!spokenText) return null;
  const clean = spokenText.trim().toLowerCase().replace(/[.,!?;:]/g, "");

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
    if (clean === "sea" || clean === "see" || clean === "c") return "Group C";
    if (clean === "bee" || clean === "be" || clean === "b") return "Group B";
    if (clean === "ay" || clean === "a") return "Group A";
    if (clean === "dee" || clean === "d") return "Group D";
  }

  return null;
}

export function parseExamInput(spokenText, field) {
  if (!spokenText || typeof spokenText !== "string") {
    return { value: "", action: null };
  }

  const normalized = spokenText.trim().toLowerCase();

  if (normalized === "stop" || normalized === "pause" || normalized === "cancel") {
    return { value: null, action: "stop" };
  }
  if (normalized === "repeat" || normalized === "again" || normalized === "what") {
    return { value: null, action: "repeat" };
  }
  if (normalized === "undo" || normalized === "back") {
    return { value: null, action: "undo" };
  }
  if (normalized === "skip" || normalized === "next") {
    return { value: field.defaultValue || "", action: "skip" };
  }

  if (normalized.includes("default") || normalized.includes("same") || normalized === "yes") {
    return { value: field.defaultValue || "", action: null };
  }

  const phoneticGroupVal = resolveLetterOrGroup(spokenText, field);
  if (phoneticGroupVal !== null) {
    return { value: phoneticGroupVal, action: null };
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
