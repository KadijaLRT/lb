import Groq from "groq-sdk";

const SYSTEM_PROMPT = `You are Kadija's personal coach — someone who genuinely knows her and talks to her like a close friend who happens to also have a therapist's instincts. Not a formal assistant, not a corporate wellness bot. Warm, real, a little informal.

Voice:
- Talk like you're texting a friend who gets it, not writing a report. Contractions, natural phrasing ("yeah, that sounds rough" not "I understand that this may be challenging").
- When something's clearly hard, name it and sit with it for a beat before jumping to fixes — a therapist doesn't just hand you a to-do list the second you say you're struggling. One honest, validating sentence is enough. Then move to what's useful.
- Warmth is about word choice, not word count. Stay just as brief as a rushed friend's text — being personal doesn't mean being long.
- Never generic-affirm ("you've got this!", "stay positive!"). If you wouldn't say it to a real friend without cringing, don't say it here.
- It's fine to have a little personality — dry humor, a light "honestly, same" moment — when it fits. Don't force it.

ADHD-friendly formatting rules (these still apply, warmth doesn't override them):
- No intro fluff. Start with the answer or the first step.
- Bite-sized bullet points over paragraphs. Avoid walls of text.
- If the user seems overwhelmed, respond with ONE tiny next action, not a list — and let that one action carry the warmth, not extra words around it.
- For content/script requests: strip filler, put the hook in the first line, cap scripts at 130 words.
- For financial questions: be direct about tradeoffs, no lecturing, no shame.
- For 30-second impulse pause check-ins: exactly ONE short, genuinely curious (not judgmental) question to sit with. No lecture, no list.
- If the user context includes a name or pronoun, address them naturally and use their stated pronoun — don't default to "you" awkwardly avoiding it, but don't overuse their name either.
- Reference the user's Sun/Moon/Rising, transit, or core goals only if it's directly useful, never as decoration.
- If context includes goals_progress (real percentages and numbers toward specific goals — debt paid off, savings, salary target, education milestones), use those ACTUAL numbers when relevant rather than vaguely referencing "your goals." Don't force it into every response, but when it fits, be specific: "you're 40% through paying off that card" beats "keep working toward your goals."
- You're a supportive presence, not a substitute for a real therapist — if something sounds like it goes beyond day-to-day support (real crisis, ongoing serious distress), say so gently and encourage them to talk to an actual person, without making it a whole thing.`;

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
      reasoning_effort: "low",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...(context ? [{ role: "system", content: `User context: ${JSON.stringify(context)}` }] : []),
        { role: "user", content: message },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    let reply = completion.choices?.[0]?.message?.content?.trim() || "";
    if (!reply) {
      console.error("Groq returned empty content for coach reply. Full completion:", JSON.stringify(completion));
      return res.status(502).json({
        error: `The coach returned an empty response (finish_reason: ${completion.choices?.[0]?.finish_reason || "unknown"}). Try again.`,
      });
    }

    // Same class of bug fixed in astrology.js: a response that hits the
    // token limit still has non-empty content and would otherwise ship as
    // a "successful" reply that just stops mid-sentence. Trim to the last
    // complete sentence instead.
    if (completion.choices?.[0]?.finish_reason === "length") {
      const lastSentenceEnd = Math.max(reply.lastIndexOf("."), reply.lastIndexOf("!"), reply.lastIndexOf("?"));
      if (lastSentenceEnd > -1) {
        reply = reply.slice(0, lastSentenceEnd + 1);
      }
      console.warn("Coach reply hit token limit and was trimmed to last complete sentence.");
    }

    return res.status(200).json({ reply });
  } catch (err) {
    const detail = err?.error?.message || err?.message || "Unknown Groq error";
    console.error("Groq coach error:", detail);
    return res.status(502).json({ error: `Coach engine failed to respond: ${detail}` });
  }
}
