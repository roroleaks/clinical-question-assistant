import { NextRequest, NextResponse } from "next/server";
import { KB, QUESTION_TYPES, type Analysis, type Clarification, type Formulation } from "@/lib/kb";
import { ruleAnalyze, ruleClarify, ruleFormulate } from "@/lib/rule-engine";

export const maxDuration = 120;

const MODEL = process.env.LLM_MODEL || "gemini-flash-latest";
const KEY = process.env.GEMINI_API_KEY;

async function callLLM(system: string, payload: unknown, attempts = 4): Promise<Record<string, unknown>> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
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
      await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("LLM failed");
}

async function fetchPubMedReferences(query: string, maxResults = 3): Promise<Array<{ pmid: string; title: string; authors: string; year: string; journal: string; doi?: string; url: string }>> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const esearch = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=${maxResults}&sort=relevance&term=${encodeURIComponent(query)}`
      );
      if (!esearch.ok) throw new Error(`esearch ${esearch.status}`);
      const ids = (await esearch.json())?.esearchresult?.idlist || [];
      if (!ids.length) return [];

      const esummary = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`
      );
      if (!esummary.ok) throw new Error(`esummary ${esummary.status}`);
      const data = await esummary.json();
      return ids.map((id: string) => {
        const doc = data?.result?.[id];
        return {
          pmid: id,
          title: doc?.title || "Untitled",
          authors: doc?.sortfirstauthor || "",
          year: doc?.pubdate?.slice(0, 4) || "",
          journal: doc?.fulljournalname || doc?.source || "",
          doi: doc?.elocationid?.replace("doi: ", "") || "",
          url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`
        };
      });
    } catch {
      if (attempt === 2) return [];
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return [];
}

const STOPWORDS = new Set(["and", "or", "not", "the", "a", "an", "of", "in", "on", "with", "for", "to", "is", "are", "as", "by", "at", "from"]);

function sanitizeQuery(q: string): string {
  return q
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(w => w && !STOPWORDS.has(w.toLowerCase()))
    .slice(0, 8)
    .join(" ");
}

function buildRefQuery(point: string, topic: string): string {
  return `${sanitizeQuery(topic).split(" ").slice(0, 4).join(" ")} ${sanitizeQuery(point).split(" ").slice(0, 5).join(" ")}`.trim().slice(0, 120);
}

function cleanTopicQuery(topic: string): string {
  return sanitizeQuery(topic);
}

async function fetchReferencesForPoints(points: Array<{ point: string; searchQuery?: string }>, topic: string): Promise<Array<{ point: string; references: Array<{ pmid: string; title: string; authors: string; year: string; journal: string; doi?: string; url: string }> }>> {
  const results = [];
  for (const p of points) {
    const query = p.searchQuery && p.searchQuery.length > 3 ? sanitizeQuery(p.searchQuery) : buildRefQuery(p.point, topic);
    let refs = await fetchPubMedReferences(query, 2);
    if (!refs.length) refs = await fetchPubMedReferences(buildRefQuery(p.point, topic), 2);
    if (!refs.length) refs = await fetchPubMedReferences(cleanTopicQuery(topic), 3);
    results.push({ point: p.point, references: refs });
    await new Promise(r => setTimeout(r, 400));
  }
  return results;
}

function kbContext() {
  return {
    specialties: KB,
    questionTypes: QUESTION_TYPES
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const stage = body.stage as "intent" | "clarify" | "formulate" | "gap" | "commentary";
  try {
    if (stage === "commentary") {
      const { topic, gapAnalysis, selectedQuestion, outcome } = body;
      if (!KEY) {
        return NextResponse.json({ error: "AI engine required for commentary generation." });
      }
      const refPool = await fetchPubMedReferences(cleanTopicQuery(String(topic || "")), 8);
      if (!refPool.length && selectedQuestion) {
        const alt = await fetchPubMedReferences(sanitizeQuery(String(selectedQuestion)), 8);
        refPool.push(...alt);
      }
      const extra = Array.isArray(gapAnalysis?.known) ? gapAnalysis.known : [];
      const extra2 = Array.isArray(gapAnalysis?.uncertain) ? gapAnalysis.uncertain : [];
      for (const p of [...extra, ...extra2]) {
        for (const r of (p?.references || [])) {
          if (r?.pmid && !refPool.some(x => x.pmid === r.pmid)) refPool.push(r);
        }
      }
      const poolForPrompt = refPool.map(r => ({ authors: r.authors, year: r.year, title: r.title, journal: r.journal, doi: r.doi, url: r.url }));
      const commentary = await callLLM(
        `You are an expert medical writer specializing in Obstetrics, Gynecology and Infertility.
Generate a full scientific commentary paper discussing the latest evidence for the given research question.
The paper must include:
- title: concise scientific title
- abstract: structured abstract (Background, Methods, Results, Conclusion) - 250-300 words
- keywords: 5-6 MeSH-aligned keywords
- introduction: background, clinical significance, and rationale (2-3 paragraphs)
- discussion: comprehensive synthesis of current evidence organized by subthemes with short subheaders, covering strengths/limitations of evidence, controversies, and identified research gaps
- conclusion: clear take-home message and implications (1-2 paragraphs)
- references: array of AT LEAST 4 strings in Chicago author-date style built ONLY from the provided referencePool. Format: Surname, First Name. Year. "Title." Journal Volume(Issue). DOI or URL. Cite each reference at least once in the discussion using parenthetical citations like (Author Year).
Respond ONLY with JSON: {title, abstract, keywords, introduction, discussion, conclusion, references}.`,
        { topic, gapAnalysis, selectedQuestion, outcome, referencePool: poolForPrompt },
        2
      );
      if (!Array.isArray(commentary.references) || commentary.references.length === 0) {
        commentary.references = refPool.slice(0, 6).map(r => {
          const bits = [
            r.authors ? `${r.authors}.` : "",
            r.year ? `${r.year}.` : "",
            `"${(r.title || "").replace(/\.$/, "")}."`,
            r.journal ? `${r.journal}.` : "",
            r.doi ? `doi:${r.doi}` : `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`
          ].filter(Boolean);
          return bits.join(" ");
        });
      }
      return NextResponse.json({ ...commentary, fetchedReferences: refPool });
    }

    if (stage === "gap") {
      const topic = String(body.input || "").slice(0, 2000);
      if (!KEY) {
        return NextResponse.json({
          topic,
          known: [], uncertain: [], gaps: [], suggestedQuestions: [],
          note: "Gap analysis requires the AI engine (API key not configured)."
        });
      }
      const gapAnalysis = await callLLM(
        `You are an evidence-mapping engine for Obstetrics, Gynecology and Infertility.
Given a clinical topic, map the current evidence landscape:
- specialty: one of ${Object.keys(KB).join(", ")}
- known: 4-6 points well supported by RCTs/systematic reviews, each {point, searchQuery} where searchQuery is a concise 3-6 word PubMed search string best suited to find key supporting papers for that point
- uncertain: 2-4 areas where evidence is conflicting/low-quality, each {point, searchQuery} same format
- gaps: 4-6 genuine research gaps, each {gap, why} where why explains briefly why the gap matters clinically
- suggestedQuestions: exactly 4 answerable PICO-format research questions targeting the most important gaps, each {question, rationale}
Be rigorous: only claim a gap if high-quality evidence is genuinely lacking. Respond ONLY with JSON.`,
        { topic }
      );

      const normPoints = (arr: unknown): Array<{ point: string; searchQuery?: string }> =>
        Array.isArray(arr) ? arr.map((p: any) => typeof p === "string" ? { point: p } : { point: String(p?.point ?? p?.text ?? ""), searchQuery: p?.searchQuery }).filter((x: any) => x.point) : [];

      if (!Array.isArray(gapAnalysis.suggestedQuestions) || gapAnalysis.suggestedQuestions.length === 0) {
        const spec = gapAnalysis.specialty && KB[gapAnalysis.specialty as keyof typeof KB] ? KB[gapAnalysis.specialty as keyof typeof KB] : null;
        const outcomes = spec ? spec.outcomesRanked.slice(0, 4) : ["live birth rate", "symptom relief", "quality of life", "complication rates"];
        const iv = normPoints(gapAnalysis.known)[0]?.point ?? topic;
        gapAnalysis.suggestedQuestions = outcomes.map(o => ({
          question: `In women affected by ${topic} (P), does the intervention of interest compared with standard care or placebo (C) improve ${o} (O)?`,
          rationale: `Auto-generated question targeting the identified gaps, focused on ${o}.`
        }));
      }
      if (!Array.isArray(gapAnalysis.gaps) || gapAnalysis.gaps.length === 0) {
        gapAnalysis.gaps = [{ gap: "Primary evidence gap under investigation", why: "Confirm specific gaps with a focused literature review." }];
      }

      const knownPts = normPoints(gapAnalysis.known);
      const uncertainPts = normPoints(gapAnalysis.uncertain);

      const [knownWithRefs, uncertainWithRefs] = await Promise.all([
        fetchReferencesForPoints(knownPts, topic),
        fetchReferencesForPoints(uncertainPts, topic)
      ]);
      
      return NextResponse.json({ 
        ...gapAnalysis, 
        topic,
        known: knownWithRefs,
        uncertain: uncertainWithRefs
      });
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
