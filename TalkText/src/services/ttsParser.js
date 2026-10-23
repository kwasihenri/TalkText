export function parseTtsScript(rawScript, baseSettings = {}) {
  const defaultRate = baseSettings.rate || 1;
  const defaultPitch = baseSettings.pitch || 1;
  const defaultVolume = baseSettings.volume || 1;

  if (!rawScript || typeof rawScript !== "string") {
    return { steps: [], tokens: [] };
  }

  const tagRegex = /(\((?:rpause|lpause|pause:[^)]+|speed:[^)]+|rate:[^)]+|pitch:[^)]+|vol:[^)]+|volume:[^)]+|whisper|shout|spell:[^)]+)\))/gi;

  const rawTokens = rawScript.split(tagRegex).filter(Boolean);

  let currentRate = defaultRate;
  let currentPitch = defaultPitch;
  let currentVolume = defaultVolume;

  const steps = [];
  const tokens = [];

  for (let i = 0; i < rawTokens.length; i++) {
    const item = rawTokens[i];
    const match = item.match(/^\((.*)\)$/);

    if (match) {
      const tagContent = match[1].trim().toLowerCase();
      let step = null;

      if (tagContent === "rpause") {
        step = {
          id: `step-${i}`,
          type: "pause",
          duration: 450,
          rawTag: item,
          label: "Rapid Pause (450ms)"
        };
      } else if (tagContent === "lpause") {
        step = {
          id: `step-${i}`,
          type: "pause",
          duration: 1400,
          rawTag: item,
          label: "Long Pause (1.4s)"
        };
      } else if (tagContent.startsWith("pause:")) {
        const valStr = tagContent.replace("pause:", "").trim();
        let ms = 500;
        if (valStr.endsWith("ms")) {
          ms = parseInt(valStr.replace("ms", ""), 10) || 500;
        } else if (valStr.endsWith("s")) {
          ms = Math.round((parseFloat(valStr.replace("s", "")) || 1) * 1000);
        } else {
          ms = parseInt(valStr, 10) || 500;
        }
        ms = Math.max(50, Math.min(ms, 10000));
        step = {
          id: `step-${i}`,
          type: "pause",
          duration: ms,
          rawTag: item,
          label: `Custom Pause (${ms}ms)`
        };
      } else if (tagContent.startsWith("speed:") || tagContent.startsWith("rate:")) {
        const val = parseFloat(tagContent.replace(/(?:speed|rate):/, "").trim()) || defaultRate;
        currentRate = Math.max(0.25, Math.min(val, 2.0));
        step = {
          id: `step-${i}`,
          type: "modifier",
          rawTag: item,
          rate: currentRate,
          label: `Rate: ${currentRate}x`
        };
      } else if (tagContent.startsWith("pitch:")) {
        const val = parseFloat(tagContent.replace("pitch:", "").trim()) || defaultPitch;
        currentPitch = Math.max(0.1, Math.min(val, 2.0));
        step = {
          id: `step-${i}`,
          type: "modifier",
          rawTag: item,
          pitch: currentPitch,
          label: `Pitch: ${currentPitch}`
        };
      } else if (tagContent.startsWith("vol:") || tagContent.startsWith("volume:")) {
        const val = parseFloat(tagContent.replace(/(?:vol|volume):/, "").trim()) || defaultVolume;
        currentVolume = Math.max(0, Math.min(val, 1.0));
        step = {
          id: `step-${i}`,
          type: "modifier",
          rawTag: item,
          volume: currentVolume,
          label: `Volume: ${Math.round(currentVolume * 100)}%`
        };
      } else if (tagContent === "whisper") {
        currentRate = 0.85;
        currentPitch = 0.8;
        currentVolume = 0.35;
        step = {
          id: `step-${i}`,
          type: "modifier",
          rawTag: item,
          rate: currentRate,
          pitch: currentPitch,
          volume: currentVolume,
          label: "Whisper Preset"
        };
      } else if (tagContent === "shout") {
        currentRate = 1.15;
        currentPitch = 1.35;
        currentVolume = 1.0;
        step = {
          id: `step-${i}`,
          type: "modifier",
          rawTag: item,
          rate: currentRate,
          pitch: currentPitch,
          volume: currentVolume,
          label: "Shout Preset"
        };
      } else if (tagContent.startsWith("spell:")) {
        const word = item.replace(/^\(spell:/i, "").replace(/\)$/, "").trim();
        const spelled = word.split("").join(" - ");
        step = {
          id: `step-${i}`,
          type: "speech",
          text: spelled,
          rawTag: item,
          rate: Math.min(currentRate, 0.9),
          pitch: currentPitch,
          volume: currentVolume,
          label: `Spelling: ${word}`
        };
      }

      if (step) {
        steps.push(step);
      }

      tokens.push({
        id: `token-${i}`,
        type: "tag",
        raw: item,
        tagType: tagContent.split(":")[0],
        stepId: step ? step.id : null
      });
    } else {
      const trimmed = item.trim();
      if (trimmed.length > 0) {
        const step = {
          id: `step-${i}`,
          type: "speech",
          text: item,
          rawTag: null,
          rate: currentRate,
          pitch: currentPitch,
          volume: currentVolume
        };
        steps.push(step);

        const words = item.split(/(\s+)/);
        words.forEach((w, wIdx) => {
          if (w.length > 0) {
            tokens.push({
              id: `token-${i}-${wIdx}`,
              type: w.trim().length > 0 ? "word" : "space",
              raw: w,
              stepId: step.id
            });
          }
        });
      }
    }
  }

  return { steps, tokens };
}
