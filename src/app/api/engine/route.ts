import { NextRequest, NextResponse } from "next/server";
import { KB, QUESTION_TYPES, type Analysis, type Clarification, type Formulation } from "@/lib/kb";
import { ruleAnalyze, ruleClarify, ruleFormulate } from "@/lib/rule-engine";

export const maxDuration = 60;

const MODEL = process.env.LLM_MODEL || "gemini-flash-latest";
const KEY = process.env.GEMINI_API_KEY;

async function callLLM(system: string, payload: unknown): Promise<Record<string, unknown>> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": KEY || "" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: JSON.stringify(payload) }] }],
            generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
          })
        }
      );
      if (res.status === 503 || res.status === 429) throw new Error(`Transient ${res.status}`);
      if (!res.ok) throw new Error(`LLM API error ${res.status}`);
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty LLM response");
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 3000 * Math.pow(1.7, attempt)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("LLM failed");
}

function kbContext() {
  return {
    specialties: KB,
    questionTypes: QUESTION_TYPES
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const stage = body.stage as "intent" | "clarify" | "formulate" | "gap";
  try {
    if (stage === "gap") {
      const topic = String(body.input || "").slice(0, 2000);
      if (!KEY) {
        return NextResponse.json({
          topic,
          known: [], uncertain: [], gaps: [], suggestedQuestions: [],
          note: "Gap analysis requires the AI engine (API key not configured)."
        });
      }
      const out = await callLLM(
        `You are an evidence-mapping engine for Obstetrics, Gynecology and Infertility.
Given a clinical topic, map the current evidence landscape:
- specialty: one of ${Object.keys(KB).join(", ")}
- known: 4-6 points well supported by RCTs/systematic reviews (established knowledge)
- uncertain: 2-4 areas where evidence is conflicting, low-quality, or inconclusive
- gaps: 4-6 genuine research gaps, each {gap, why} where why explains briefly why the gap matters clinically
- suggestedQuestions: exactly 4 answerable PICO-format research questions targeting the most important gaps, each {question, rationale}
Be rigorous: only claim a gap if high-quality evidence is genuinely lacking. Respond ONLY with JSON.`,
        { topic }
      );
      return NextResponse.json({ ...out, topic });
    }

    if (stage === "intent") {
      const input = String(body.input || "").slice(0, 2000);
      if (KEY) {
        const out = await callLLM(
          `You are a clinical intent recognition engine for Obstetrics, Gynecology and Infertility.
Given a clinician's raw, vague clinical uncertainty, identify:
- specialty: one of ${Object.keys(KB).join(", ")} (or null)
- condition: the clinical problem/population (empty string if unclear)
- intervention: treatment/test/exposure mentioned (empty string if none)
- comparator: comparison mentioned (empty string if none)
- questionType and framework chosen from: ${JSON.stringify(QUESTION_TYPES)}
- missing: list of missing PICO elements from ["condition","intervention","comparator","outcome"]
- interpretation: one sentence explaining your reading of the uncertainty.
Respond ONLY with JSON.`, { input, knowledgeBase: kbContext() });
        const r = out as unknown as Analysis;
        return NextResponse.json({ ...r, source: "ai", specialtyLabel: r.specialty ? KB[r.specialty].label : "Unknown" });
      }
      return NextResponse.json(ruleAnalyze(input));
    }

    if (stage === "clarify") {
      const { analysis, answered } = body as { analysis: Analysis; answered: Record<string, string> };
      if (KEY && analysis.specialty) {
        const out = await callLLM(
          `You are an interactive clinical clarification assistant for ${KB[analysis.specialty].label}.
The clinician's original uncertainty and the current analysis are given. Ask the SINGLE most important next clarification question needed to formulate an answerable clinical question.
Prefer asking about: outcome specificity first (e.g. live birth vs pregnancy), then population details, then comparator.
Clinically meaningful outcomes for this specialty in order of preference: ${JSON.stringify(KB[analysis.specialty].outcomesRanked)}.
Provide 8 to 10 diverse, clinically relevant options covering different angles (different outcomes, populations, comparators, or timeframes) so the clinician has real choices.
Respond ONLY with JSON:
{"done": false, "field": "<condition|intervention|comparator|outcome>", "questionText": "...", "options": ["...", "..."], "allowFreeText": true}
Set done=true with empty strings when everything essential is known.`,
          { analysis, answered, specialtyOutcomes: KB[analysis.specialty].outcomesRanked }
        );
        return NextResponse.json({ ...out, source: "ai" });
      }
      return NextResponse.json(ruleClarify(analysis, answered));
    }

    if (stage === "formulate") {
      const { analysis, answered } = body as { analysis: Analysis; answered: Record<string, string> };
      if (KEY) {
        const out = await callLLM(
          `You are a clinical question formulation engine for evidence-based medicine in Obstetrics, Gynecology and Infertility.
Using the analysis and clarified answers, produce:
- framework: the question framework name
- elements: array of {label, value} for each framework element (PICO/PICOT/PECO/diagnostic)
- finalQuestion: ONE polished, answerable clinical question sentence (the recommended default)
- variants: EXACTLY 4 alternative formulations of the question, each {question, rationale} where rationale (one short sentence) explains the different clinical angle — vary by primary outcome (e.g. live birth vs ongoing pregnancy vs cumulative live birth), population detail, or comparator. Variant 1 may equal finalQuestion.
- scores: array of {name, value} scoring each element 0-20 plus Specificity (max total = number of items x 20)
- advisories: array of short warnings, e.g. if an outcome like "pregnancy" is not patient-centered suggest live birth; flag vague comparators or populations
- searchTerms: {population, intervention, outcome} optimized for PubMed searching.
Respond ONLY with JSON.`,
          { analysis, answered, specialtyKnowledge: analysis.specialty ? KB[analysis.specialty] : null }
        );
        return NextResponse.json({ ...out, source: "ai" });
      }
      return NextResponse.json(ruleFormulate(analysis, answered));
    }

    return NextResponse.json({ error: "Unknown stage" }, { status: 400 });
  } catch (e) {
    if (stage === "intent") return NextResponse.json(ruleAnalyze(String(body.input || "")));
    if (stage === "clarify") return NextResponse.json(ruleClarify(body.analysis, body.answered || {}));
    return NextResponse.json(ruleFormulate(body.analysis, body.answered || {}));
  }
}
