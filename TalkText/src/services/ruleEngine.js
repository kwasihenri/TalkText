export function applySpeechRules(rawText, rules = [], _currentTranscript = "") {
  if (!rawText) {
    return {
      text: "",
      triggered: [],
      actions: []
    };
  }

  const activeRules = rules.filter(r => r.active);
  const triggered = [];
  const actions = [];
  let result = rawText;

  const sortedRules = [...activeRules].sort((a, b) => b.trigger.length - a.trigger.length);

  for (const rule of sortedRules) {
    if (!rule.trigger) continue;

    const escaped = rule.trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");

    if (regex.test(result)) {
      triggered.push({
        id: rule.id,
        trigger: rule.trigger,
        name: rule.name,
        replacement: rule.replacement,
        category: rule.category
      });

      if (rule.replacement === "__ACTION_CLEAR__") {
        actions.push("clear");
        result = result.replace(regex, "");
      } else if (rule.replacement === "__ACTION_UNDO__") {
        actions.push("undo");
        result = result.replace(regex, "");
      } else {
        result = result.replace(regex, rule.replacement);
      }
    }
  }

  result = result
    .replace(/[ ]+([,.:;?!])/g, "$1")
    .replace(/\n[ ]+/g, "\n");

  return {
    text: result,
    triggered,
    actions
  };
}

export function formatTranscriptWithChunk(prevText, incomingChunk) {
  if (!incomingChunk) return prevText;

  if (incomingChunk.startsWith("\n")) {
    return prevText + incomingChunk;
  }

  if (prevText.endsWith("\n") || prevText.length === 0) {
    const formatted = incomingChunk.trimStart();
    return prevText + formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  if (prevText.endsWith(".") || prevText.endsWith("?") || prevText.endsWith("!")) {
    const formatted = incomingChunk.trimStart();
    return prevText + " " + (formatted.charAt(0).toUpperCase() + formatted.slice(1));
  }

  if (prevText.endsWith(",") || prevText.endsWith(":") || prevText.endsWith(";")) {
    return prevText + " " + incomingChunk.trimStart();
  }

  return prevText + (incomingChunk.startsWith(" ") ? incomingChunk : " " + incomingChunk);
}
