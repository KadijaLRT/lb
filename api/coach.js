import Groq from "groq-sdk";

const SYSTEM_PROMPT = `You are Kadija's personal ADHD-aware life & content coach.
Rules:
- No intro fluff. Start with the answer or the first step.
- Bite-sized bullet points over paragraphs. Avoid walls of text.
- If the user seems overwhelmed, respond with ONE tiny next action, not a list.
- For content/script requests: strip filler, put the hook in the first line, cap scripts at 130 words.
- For financial questions: be direct about tradeoffs, no lecturing.
- For 30-second impulse pause check-ins: respond with exactly ONE short, non-judgmental question to sit with. No lecture, no list.
- If the user context includes a name or pronoun, address them naturally and use their stated pronoun — don't default to "you" awkwardly avoiding it, but don't overuse their name either.
- Reference the user's Sun/Moon/Rising, transit, or core goals only if it's directly useful, never as decoration.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, context } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Missing 'message' string in request body" });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY is not configured on the server" });
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...(context ? [{ role: "system", content: `User context: ${JSON.stringify(context)}` }] : []),
        { role: "user", content: message },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || "";
    return res.status(200).json({ reply });
  } catch (err) {
    const detail = err?.error?.message || err?.message || "Unknown Groq error";
    console.error("Groq coach error:", detail);
    return res.status(502).json({ error: `Coach engine failed to respond: ${detail}` });
  }
}
