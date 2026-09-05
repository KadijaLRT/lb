// The coach's system prompt asks for bite-sized bullet points over
// paragraphs, so most replies already look like a list — this pulls those
// lines out as addable task candidates. Falls back to treating the whole
// reply as one candidate when it's short and unstructured (e.g. the
// single-tiny-action replies used for "I'm overwhelmed").
const BULLET_LINE = /^\s*(?:[-*•‣]|\d+[.)])\s+(.*\S)\s*$/;
const MAX_TASK_LENGTH = 90;

export function extractStepsFromReply(text) {
  if (!text) return [];

  const lines = text.split(/\n+/);
  const bulletSteps = lines
    .map((line) => {
      const match = line.match(BULLET_LINE);
      return match ? match[1].trim() : null;
    })
    .filter(Boolean);

  if (bulletSteps.length > 0) {
    return dedupe(bulletSteps).filter((s) => s.length <= MAX_TASK_LENGTH * 2).slice(0, 5);
  }

  // No bullets found — if the whole reply is short enough to work as a
  // single task, offer it as one candidate.
  const trimmed = text.trim();
  if (trimmed && trimmed.length <= MAX_TASK_LENGTH * 2 && !trimmed.includes("\n\n")) {
    return [trimmed];
  }

  return [];
}

function dedupe(arr) {
  return [...new Set(arr)];
}
