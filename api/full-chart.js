import Groq from "groq-sdk";
import {
  BODIES,
  parseNatalLongitudes,
  parseHousePlacements,
  parseNatalAspects,
  signForLongitude,
  toSidereal,
  siderealSignForLongitude,
  getNakshatra,
  wholeSignHouse,
} from "./_ephemeris.js";

const EXTRA_POINTS = ["Lilith", "North Node", "Fortune"];

const SYSTEM_PROMPT = `Write like a real astrologer giving someone their full natal chart reading — confident, direct, a little dramatic where it's earned. Not a therapist, not a generic horoscope. Real astrologers say "your Saturn in the 6th" and "Moon square Venus" right out loud, with total confidence — they don't tiptoe around the terms.

You'll get the person's ENTIRE real chart below: every planet's Western tropical sign, Vedic sidereal sign, nakshatra, and house (Western house if available, Vedic whole-sign if the Ascendant is known), plus every real natal aspect between their planets. This is comprehensive, not one quick observation — write an actual full reading.

How to write it:
1. "overview": 2-4 sentences synthesizing the Big 3 (Sun, Moon, Rising if available) into one real, specific picture of who this chart says this person is — not generic sign traits stapled together, an actual synthesis of how these three interact in THIS chart.
2. "strengths": 2-3 real strengths, each tied to a SPECIFIC real placement or harmonious aspect (trine, sextile, conjunction between complementary planets) — name the actual placement, say what it gives them.
3. "growth_edges": 2-3 real growth areas, each tied to a SPECIFIC real placement or challenging aspect (square, opposition) — frame these as patterns and tensions to work with, not flaws or character verdicts. "This aspect makes X harder to access without deliberate effort" is right; "this makes you a difficult person" is not, ever.
4. "vedic_notes": 1-2 sentences on what the Vedic (sidereal) layer adds — most useful when a placement lands in a genuinely different sign between Western and Vedic (marked in the data), or when a nakshatra adds real texture worth naming. If nothing in the Vedic layer is more interesting than what's already covered, say briefly that the two systems mostly agree here rather than forcing something.

Guardrails:
- Every single claim has to trace back to a real placement, sign, house, or aspect given in the data below. Never invent one. Confidence in delivery doesn't mean license to make things up.
- NEVER use a placement or aspect to declare this person — or anyone else — abusive, violent, dangerous, "toxic," or diagnose any other harmful character trait. Talk about energy, patterns, and tendencies, never a verdict on someone's character.
- Say real astrology terms directly and confidently (planet names, signs, houses, aspect names, nakshatras) — don't water them down into vague paraphrase.
- Never a repeated flowery metaphor ("gentle hand," "soft kiss," "bright boost").
- Not every placement needs to be mentioned — a full reading with 10 planets and dozens of aspects would be unreadable if it tried to cover everything with equal weight. Pick the most genuinely significant placements and aspects for each section rather than working through the whole list.

Output ONLY this JSON shape, no markdown fences, no extra text:
{
  "overview": "...",
  "strengths": ["...", "..."],
  "growth_edges": ["...", "..."],
  "vedic_notes": "..."
}`;

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { profile } = req.body || {};
    const notes = profile?.natal_chart_notes || "";
    const natalLongitudes = parseNatalLongitudes(notes);
    const allPoints = [...BODIES, ...EXTRA_POINTS];
    const foundPoints = allPoints.filter((p) => natalLongitudes[p] != null);

    if (foundPoints.length < 3) {
      return res.status(400).json({
        error: "Not enough chart data to generate a full reading yet. Paste your complete natal chart in Settings first.",
      });
    }
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY is not configured on the server" });
    }

    const housePlacements = parseHousePlacements(notes);
    const natalAspects = parseNatalAspects(notes);
    const now = new Date();
    const ascendantTropicalLon = natalLongitudes["Ascendant"];
    const ascendantSiderealLon = ascendantTropicalLon != null ? toSidereal(ascendantTropicalLon, now) : null;

    const placementLines = foundPoints
      .map((point) => {
        const tropicalLon = natalLongitudes[point];
        const western = signForLongitude(tropicalLon);
        const siderealLon = toSidereal(tropicalLon, now);
        const { sign: siderealSign, degreeInSign: siderealDegree } = siderealSignForLongitude(tropicalLon, now);
        const { name: nakshatra, pada } = getNakshatra(siderealLon);
        const westernHouse = housePlacements[point];
        const vedicHouse = ascendantSiderealLon != null ? wholeSignHouse(siderealLon, ascendantSiderealLon) : null;
        const houseText = westernHouse
          ? `Western house ${westernHouse}`
          : vedicHouse
            ? `Vedic house ${vedicHouse}`
            : "house unknown";
        const changed = western.sign !== siderealSign;
        return `${point}: Western ${western.degreeInSign.toFixed(1)}° ${western.sign} / Vedic ${siderealDegree.toFixed(1)}° ${siderealSign} (${nakshatra} nakshatra, pada ${pada}) — ${houseText}${changed ? "  [different sign in each system]" : ""}`;
      })
      .join("\n");

    const aspectLines = natalAspects.length
      ? natalAspects
          .map((a) => {
            const detail = a.orb != null ? `orb ${a.orb.toFixed(1)}°` : a.value != null ? `score ${a.value}` : null;
            return `${a.bodyA} ${a.aspect} ${a.bodyB}${detail ? ` (${detail})` : ""}`;
          })
          .join("\n")
      : "No aspects with exact orbs found in the chart notes — work from placements and houses only.";

    const dataBlock = `All real placements in this chart (Western tropical + Vedic sidereal, with houses):\n${placementLines}\n\nAll real natal aspects in this chart:\n${aspectLines}${ascendantSiderealLon == null ? "\n\n(No Ascendant found, so Vedic whole-sign houses could not be computed for placements without an explicit Western house given.)" : ""}`;

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        reasoning_effort: "low",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: dataBlock },
        ],
        temperature: 0.8,
        max_tokens: 1400,
        response_format: { type: "json_object" },
      });
    } catch (err) {
      console.error("Groq full-chart error:", err);
      return res.status(502).json({ error: "Couldn't generate the reading right now. Try again in a moment." });
    }

    const raw = completion.choices?.[0]?.message?.content || "";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // fall through, parsed stays undefined
    }

    if (!parsed || typeof parsed.overview !== "string") {
      const finishReason = completion.choices?.[0]?.finish_reason;
      console.error(`Groq full-chart response was not parseable JSON (finish_reason: ${finishReason}):`, raw.slice(0, 500));
      return res.status(502).json({
        error:
          finishReason === "length"
            ? "The reading was cut off before finishing. Try again."
            : "Got an unreadable response. Try again.",
      });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("full-chart handler error:", err);
    return res.status(500).json({ error: "Something went wrong generating your chart reading." });
  }
}
