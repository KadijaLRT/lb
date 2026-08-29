import Groq from "groq-sdk";
import { currentPlacements, parseNatalLongitudes, parseHousePlacements, parseNatalAspects, currentTransitAspects, computeLifeCycles } from "./_ephemeris.js";

const SYSTEM_PROMPT = `You are a professional-grade natal chart reader talking directly to this person — warm, direct, plain language, ADHD-friendly (one idea per sentence, no jargon left unexplained). You'll be given real computed data: their natal placements, real life-cycle return dates (actual astronomical events calculated from their exact birth data), current active aspects, and developing aspects over the coming months.

CRITICAL HONESTY RULE: You are describing real astronomical cycles and their traditional thematic meanings — not predicting specific guaranteed events. Never state a specific future event as a certainty ("you will get married," "you'll lose your job," "financial windfall coming"). Instead describe the THEME/ENERGY a period tends to bring and let them connect it to their own life. This is exactly how legitimate professional astrologers actually work — real practitioners describe themes and let the client interpret, they don't claim fortune-telling certainty. Say this framing once, briefly, near the start — not as a disclaimer paragraph, just naturally, then move on to real substance.

Sections to produce:

1. identity_summary: Synthesize their Sun/Moon/Rising/Mercury/Venus/Mars into ONE cohesive picture of who they are — not six separate paragraphs bolted together, an actual synthesis showing how these placements interact. If house placements are given alongside a planet, use them — a real chart's Sun in the 11th house tells a genuinely different story than the same Sun in the 1st or 10th, don't default to generic sign-only description when house data is available. You'll also be given this chart's own permanent natal aspects (aspects between their own planets, e.g. "Sun conjunct Moon") — use these too, they're real core-personality data, not optional extras. Don't leave out real given data in favor of a generic assumption. Plain language. ~120-150 words.

2. life_cycles_narrative: You're given real computed dates for their Saturn and Jupiter returns (past and upcoming). For EACH date given, write 1-2 plain-language sentences on what that real astronomical marker traditionally represents (Saturn return = a real ~29.5-year cycle marking a shift into greater responsibility/maturity; Jupiter return = a real ~12-year cycle marking a growth/opportunity chapter) and what it might mean given THIS chart specifically. Use the exact dates given — never invent or adjust them. If a cycle is "past," frame it as a chapter that already happened (something they can look back on); if "upcoming," frame it as a chapter forming ahead. ~150-200 words total across all cycles given.

3. current_chapter: Using the real current aspects given (across their whole chart, not just one life area), describe what's genuinely active for them right now — plain language, specific to the actual aspects, not generic. ~100 words.

4. upcoming_months: Using the real longer-range aspects given (developing over roughly the next several months), describe the themes forming ahead — plain language, tied to the actual data. ~100 words.

5. action_ideas: 3-4 concrete, doable ideas spanning the different sections above — plain language, no jargon, understandable at a glance, things they could actually act on.

Hard rules throughout:
- Use ONLY the real data given — natal placements, the exact life-cycle dates, the exact current/upcoming aspects. Never invent a placement, aspect, or date not explicitly provided.
- No astrology jargon left unexplained — no bare "orb," "transiting," "natal," "applying/separating." Name planets and aspects freely, just explain what they mean in the same breath.
- Never state a specific concrete future life event as guaranteed fact. Themes and tendencies, not fortune-telling.

Output ONLY this JSON shape, no markdown fences, no extra text:
{
  "identity_summary": "...",
  "life_cycles_narrative": "...",
  "current_chapter": "...",
  "upcoming_months": "...",
  "action_ideas": ["...", "...", "..."]
}`;

function extractJson(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { profile } = req.body || {};
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY is not configured on the server" });
    }

    const natalLongitudes = parseNatalLongitudes(profile?.natal_chart_notes || "");
    if (Object.keys(natalLongitudes).length === 0) {
      return res.status(400).json({
        error: "This needs your full natal chart (not just Sun/Moon/Rising signs) to compute real life-cycle dates. Paste it in Settings first.",
      });
    }

    const now = new Date();

    // Real placements, plain text for the model to synthesize.
    const houses = parseHousePlacements(profile?.natal_chart_notes || "");
    const placementLines = Object.entries(natalLongitudes)
      .map(([body, lon]) => {
        const norm = ((lon % 360) + 360) % 360;
        const signIdx = Math.floor(norm / 30);
        const signs = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
        const houseNote = houses[body] ? ` (house ${houses[body]})` : "";
        return `${body}: ${signs[signIdx]} ${(norm - signIdx * 30).toFixed(1)}°${houseNote}`;
      })
      .join(", ");

    // Real computed life-cycle return dates — the whole point of this feature.
    let lifeCycles = [];
    if (profile?.birth_date) {
      const time = profile.birth_time || "12:00";
      const timeMatch = String(time).match(/^(\d{1,2}):(\d{2})/);
      const cleanTime = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : "12:00";
      const localDate = new Date(`${profile.birth_date}T${cleanTime}:00`);
      if (!Number.isNaN(localDate.getTime())) {
        const offset = profile.birth_utc_offset != null ? Number(profile.birth_utc_offset) : 0;
        const birthUTC = new Date(localDate.getTime() - offset * 60 * 60 * 1000);
        lifeCycles = computeLifeCycles(natalLongitudes, birthUTC, now);
      }
    }

    // Current whole-chart aspects (not filtered to one life area) and a
    // longer-range look for developing themes over the coming months.
    const currentAspects = currentTransitAspects(natalLongitudes, now, 5).slice(0, 6);
    const upcomingAspects = currentTransitAspects(natalLongitudes, now, 150)
      .filter((a) => a.trend.startsWith("applying"))
      .slice(0, 6);

    // The full permanent natal aspect list — real data the user provided
    // that was previously parsed nowhere in the app.
    const natalAspects = parseNatalAspects(profile?.natal_chart_notes || "");
    const natalAspectLines = natalAspects.length
      ? natalAspects.map((a) => `${a.bodyA} ${a.aspect} ${a.bodyB}`).join(", ")
      : "None found in the chart data given.";

    const dataBlock = `Natal placements: ${placementLines}

This chart's own permanent natal aspects (core wiring, use these for the identity summary especially):
${natalAspectLines}

Real computed life-cycle return dates:
${lifeCycles.length ? lifeCycles.map((c) => `${c.label}: ${c.date} (${c.status})`).join("\n") : "None computable — natal Saturn/Jupiter positions not found in the chart data."}

Current active aspects (whole chart, real computed data):
${currentAspects.length ? currentAspects.map((a) => `Transiting ${a.transitBody} ${a.aspect} natal ${a.natalBody} — ${a.trend}`).join("\n") : "None within standard range right now."}

Developing aspects over the coming months (real computed data, still building):
${upcomingAspects.length ? upcomingAspects.map((a) => `Transiting ${a.transitBody} ${a.aspect} natal ${a.natalBody} — ${a.trend}`).join("\n") : "Nothing significant building in this window."}`;

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      reasoning_effort: "low",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: dataBlock },
      ],
      temperature: 0.7,
      max_tokens: 1800,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    const finishReason = completion.choices?.[0]?.finish_reason;

    if (!raw) {
      return res.status(502).json({
        error: `The model returned an empty response (finish_reason: ${finishReason || "unknown"}). Try again.`,
      });
    }

    const parsed = extractJson(raw);
    if (!parsed?.identity_summary) {
      console.error(`Full chart response not parseable (finish_reason: ${finishReason}):`, raw.slice(0, 500));
      return res.status(502).json({
        error: finishReason === "length" ? "The reading was cut off before finishing. Try again." : "Couldn't parse the reading. Try again.",
      });
    }

    return res.status(200).json({
      identity_summary: parsed.identity_summary,
      life_cycles_narrative: parsed.life_cycles_narrative || "",
      life_cycles: lifeCycles,
      current_chapter: parsed.current_chapter || "",
      upcoming_months: parsed.upcoming_months || "",
      action_ideas: Array.isArray(parsed.action_ideas) ? parsed.action_ideas.filter(Boolean).slice(0, 4) : [],
      generated_at: now.toISOString(),
    });
  } catch (err) {
    const detail = err?.error?.message || err?.message || "Unknown server error";
    console.error("Full chart endpoint crashed:", err);
    return res.status(500).json({ error: `Reading failed: ${detail}` });
  }
}
