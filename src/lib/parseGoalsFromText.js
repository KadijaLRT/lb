// Turns lines from the freeform Core Goals text into structured goal
// suggestions — best-effort classification, never destructive (nothing
// gets created until the user reviews and confirms each one).
export function parseGoalsFromText(text) {
  if (!text) return [];
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.map((line) => {
    // Only treat a number as a dollar amount if it's actually preceded by
    // $ — otherwise "2015 Honda" or "2 bedroom" would misparse as amounts.
    const amountMatch = line.match(/\$\s?([\d,]+)/);
    const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : null;

    let type = "savings";
    if (/debt|credit card|collections|loan/i.test(line)) {
      type = "debt";
    } else if (/degree|certificat|diploma|\bcourse\b/i.test(line)) {
      type = "education";
    } else if (amount && /salary|job|income|\bpay\b/i.test(line)) {
      type = "salary";
    }

    return {
      title: line.replace(/[.,]$/, ""),
      type,
      target_amount: amount,
    };
  });
}
