"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Analysis, Clarification, Formulation } from "@/lib/kb";

interface HistoryItem {
  id: string;
  input: string;
  question: string;
  framework: string;
  total: number;
  max: number;
  at: string;
}

interface GapResult {
  topic: string;
  specialty?: string;
  known: string[];
  uncertain: string[];
  gaps: { gap: string; why: string }[];
  suggestedQuestions: { question: string; rationale: string }[];
  note?: string;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"formulate" | "gap">("formulate");
  const [gapResult, setGapResult] = useState<GapResult | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [answered, setAnswered] = useState<Record<string, string>>({});
  const [clarification, setClarification] = useState<Clarification | null>(null);
  const [chatLog, setChatLog] = useState<{ q?: string; a?: string }[]>([]);
  const [formulation, setFormulation] = useState<Formulation | null>(null);
  const [variantIdx, setVariantIdx] = useState(0);
  const [pubmed, setPubmed] = useState<any[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem("cq-history") || "[]")); } catch {}
  }, []);

  const saveHistory = (f: Formulation) => {
    const item: HistoryItem = {
      id: crypto.randomUUID(),
      input,
      question: f.finalQuestion,
      framework: f.framework,
      total: f.scores.reduce((a, s) => a + s.value, 0),
      max: f.scores.length * 20,
      at: new Date().toLocaleString()
    };
    const next = [item, ...history].slice(0, 30);
    setHistory(next);
    localStorage.setItem("cq-history", JSON.stringify(next));
  };

  const startOver = () => {
    setInput(""); setAnalysis(null); setAnswered({}); setClarification(null);
    setChatLog([]); setFormulation(null); setPubmed(null); setLoading(null); setGapResult(null);
  };

  const findGaps = async () => {
    if (!input.trim()) return;
    setLoading("gap");
    setGapResult(null); setAnalysis(null); setFormulation(null);
    try {
      const res = await fetch("/api/engine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "gap", input })
      });
      setGapResult(await res.json());
    } finally { setLoading(null); }
  };

  const formulateFromGap = async (q: string) => {
    setInput(q);
    setMode("formulate");
    setLoading("intent");
    setGapResult(null); setAnalysis(null); setClarification(null); setFormulation(null); setPubmed(null);
    setChatLog([]); setAnswered({});
    try {
      const res = await fetch("/api/engine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "intent", input: q })
      });
      const a: Analysis = await res.json();
      if (!a.specialty) {
        setNotice("Could not map this question to the three specialties — please rephrase.");
        return;
      }
      setNotice(null);
      setAnalysis(a);
      await runClarifyLoop(a, {}, []);
    } finally { setLoading(null); }
  };

  const runClarifyLoop = async (a: Analysis, ans: Record<string, string>, log: { q?: string; a?: string }[]) => {
    setLoading("clarify");
    try {
      const res = await fetch("/api/engine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "clarify", analysis: a, answered: ans })
      });
      const c: Clarification = await res.json();
      setClarification(c);
      if (c.done) {
        await formulate(a, ans);
      } else {
        setChatLog([...log, { q: c.questionText }]);
      }
    } finally { setLoading(null); }
  };

  const formulate = async (a: Analysis, ans: Record<string, string>) => {
    setLoading("formulate");
    try {
      const res = await fetch("/api/engine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "formulate", analysis: a, answered: ans })
      });
      const f: Formulation = await res.json();
      setFormulation(f);
      setVariantIdx(0);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      const item: HistoryItem = {
        id: crypto.randomUUID(), input, question: f.finalQuestion,
        framework: f.framework, total: f.scores.reduce((x, s) => x + s.value, 0),
        max: f.scores.length * 20, at: new Date().toLocaleString()
      };
      const next = [item, ...history].slice(0, 30);
      setHistory(next);
      localStorage.setItem("cq-history", JSON.stringify(next));
    } finally { setLoading(null); }
  };

  const analyze = async () => {
    if (!input.trim()) return;
    setLoading("intent");
    setNotice(null);
    setAnalysis(null); setClarification(null); setFormulation(null); setPubmed(null);
    setChatLog([]); setAnswered({});
    try {
      const res = await fetch("/api/engine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "intent", input })
      });
      const a: Analysis = await res.json();
      if (!a.specialty) {
        setAnalysis(null);
        setNotice(
          "This input could not be mapped to Obstetrics, Gynecology or Infertility. Please rephrase including the condition, e.g. \"endometriosis infertility surgery\", or try again in a moment."
        );
        return;
      }
      setNotice(null);
      setAnalysis(a);
      await runClarifyLoop(a, {}, []);
    } finally { setLoading(null); }
  };

  const answer = async (field: string, value: string) => {
    if (!analysis || !clarification) return;
    const ans = { ...answered, [field]: value };
    setAnswered(ans);
    setChatLog(log => [...log.map((m, i) => i === log.length - 1 ? { ...m, a: value } : m)]);
    await runClarifyLoop(analysis, ans, chatLog);
  };

  const searchPubMed = async () => {
    if (!formulation) return;
    setLoading("pubmed");
    try {
      const res = await fetch("/api/pubmed", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formulation.searchTerms)
      });
      const data = await res.json();
      setPubmed(data.results || []);
    } finally { setLoading(null); }
  };

  const exportDoc = () => {
    if (!formulation) return;
    const html = `<html><head><meta charset="utf-8"></head><body>
<h1>Clinical Question</h1>
<p style="font-size:14pt"><b>${activeQuestion}</b></p>
<h2>Framework: ${formulation.framework}</h2>
<table border="1" cellpadding="6" style="border-collapse:collapse">
${formulation.elements.map(e => `<tr><td><b>${e.label}</b></td><td>${e.value}</td></tr>`).join("")}
</table>
<h2>Original clinical uncertainty</h2><p>${input}</p>
<p>Generated by Clinical Question Assistant — ${new Date().toLocaleDateString()}</p>
</body></html>`;
    const blob = new Blob(["\ufeff" + html], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "clinical-question.doc";
    a.click();
  };

  const total = formulation ? formulation.scores.reduce((a, s) => a + s.value, 0) : 0;
  const maxTotal = formulation ? formulation.scores.length * 20 : 100;
  const activeQuestion = formulation?.variants?.[variantIdx]?.question ?? formulation?.finalQuestion ?? "";

  return (
    <div className="wrap">
      <header className="hdr">
        <h1>From Clinical Uncertainty to Answerable Questions</h1>
        <p>AI-Assisted Clinical Question Formulation — Obstetrics, Gynecology &amp; Infertility</p>
      </header>

      <div className="layout">
        <main>
          <section className="card">
            <div className="modes">
              <button className={`mode-tab ${mode === "formulate" ? "active" : ""}`} onClick={() => setMode("formulate")}>🎯 Formulate Question</button>
              <button className={`mode-tab ${mode === "gap" ? "active" : ""}`} onClick={() => setMode("gap")}>🕳️ Find Gap</button>
            </div>
            {mode === "formulate" ? (
              <>
                <span className="pill">📝 Step 1 · Clinical Input</span>
                <p className="hint">Type a clinical uncertainty exactly as it comes to mind.</p>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="e.g., recurrent implantation failure aspirin IVF"
                  rows={3}
                />
                <div className="row">
                  <button className="primary" onClick={analyze} disabled={!!loading}>
                    {loading === "intent" ? "⏳ Analyzing…" : "🔍 Analyze"}
                  </button>
                  {(analysis || formulation) && (
                    <button className="link" onClick={startOver}>Start over</button>
                  )}
                </div>
              </>
            ) : (
              <>
                <span className="pill">🕳️ Find Gap · Evidence Mapping</span>
                <p className="hint">Enter a topic — the AI maps what is established, what is contested, and where the real evidence gaps are.</p>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="e.g., coenzyme Q10 and endometriosis"
                  rows={3}
                />
                <div className="row">
                  <button className="primary" onClick={findGaps} disabled={!!loading}>
                    {loading === "gap" ? "⏳ Mapping the evidence…" : "🕳️ Find research gaps"}
                  </button>
                  {gapResult && (
                    <button className="link" onClick={startOver}>Start over</button>
                  )}
                </div>
              </>
            )}
          </section>

          {gapResult && (
            <section className="card">
              <span className="pill">🗺️ Evidence Map · {gapResult.topic}</span>
              {gapResult.note && <div className="advisory">⚠️ {gapResult.note}</div>}
              {!!gapResult.known?.length && (
                <>
                  <h3 className="sec-h">✅ Established knowledge</h3>
                  <ul className="gap-list">
                    {gapResult.known.map((k, i) => <li key={`k${i}`}>{k}</li>)}
                  </ul>
                </>
              )}
              {!!gapResult.uncertain?.length && (
                <>
                  <h3 className="sec-h">⚖️ Conflicting / low-quality evidence</h3>
                  <ul className="gap-list">
                    {gapResult.uncertain.map((u, i) => <li key={`u${i}`}>{u}</li>)}
                  </ul>
                </>
              )}
              {!!gapResult.gaps?.length && (
                <>
                  <h3 className="sec-h">🕳️ Research gaps</h3>
                  <ul className="gap-list">
                    {gapResult.gaps.map((g, i) => (
                      <li key={`g${i}`}><strong>{g.gap}</strong> — {g.why}</li>
                    ))}
                  </ul>
                </>
              )}
              {!!gapResult.suggestedQuestions?.length && (
                <>
                  <h3 className="sec-h">💡 Questions that would fill these gaps</h3>
                  <div className="variants">
                    {gapResult.suggestedQuestions.map((s, i) => (
                      <div key={i} className="variant-card">
                        <span className="v-q">{s.question}</span>
                        <span className="v-r">{s.rationale}</span>
                        <button className="mini-btn" onClick={() => formulateFromGap(s.question)}>→ Refine into PICO</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {notice && (
            <section className="card">
              <div className="advisory">⚠️ {notice}</div>
            </section>
          )}

          {analysis && (
            <section className="card">
              <span className="pill">🧠 Step 2 · Clinical Intent Recognition {analysis.source === "ai" ? "(AI)" : "(rule-based)"}</span>
              <p><b>Specialty:</b> <span className="tag">{analysis.specialtyLabel}</span></p>
              <p style={{ marginTop: 4 }}><b>Reading:</b> {analysis.interpretation}</p>
              <p style={{ marginTop: 4 }}>
                <b>Question type:</b> <span className="tag">{analysis.questionType}</span>
                → <span className="tag">{analysis.framework}</span>
              </p>
            </section>
          )}

          {analysis && (
            <section className="card">
              <span className="pill">🧩 Draft question skeleton</span>
              <table className="pico">
                <tbody>
                  <tr><td>P — Population</td><td>{analysis.condition || "(to clarify)"}</td></tr>
                  {analysis.framework === "Diagnostic accuracy (PIRD)" ? (
                    <>
                      <tr><td>I — Index test</td><td>{analysis.intervention || "(to clarify)"}</td></tr>
                      <tr><td>R — Reference standard</td><td>(to clarify)</td></tr>
                    </>
                  ) : (
                    <>
                      <tr><td>{analysis.framework.startsWith("PECO") ? "E — Exposure" : "I — Intervention"}</td>
                        <td>{analysis.intervention || "(to clarify)"}</td></tr>
                      <tr><td>C — Comparator</td><td>{analysis.comparator || "(to clarify)"}</td></tr>
                    </>
                  )}
                  <tr><td>O — Outcome</td><td>(to clarify)</td></tr>
                </tbody>
              </table>
              <p className="hint" style={{ marginTop: 8 }}>Provisional structure — refined through the questions below.</p>
            </section>
          )}

          {chatLog.length > 0 && (
            <section className="card">
              <span className="pill">💬 Step 3 · Interactive Clarification</span>
              {chatLog.map((m, i) => (
                <div key={i} className="turn">
                  {m.q && <div className="bubble ai">{m.q}</div>}
                  {m.a && <div className="bubble user">{m.a}</div>}
                </div>
              ))}
              {clarification && !clarification.done && loading !== "clarify" && (
                <div className="chips">
                  {clarification.options.map(o => (
                    <button key={o} className="chip" onClick={() => answer(clarification.field!, o)}>{o}</button>
                  ))}
                </div>
              )}
              {loading === "clarify" && <p className="hint">Thinking…</p>}
            </section>
          )}

          {loading === "formulate" && <section className="card"><p className="hint">Formulating your clinical question…</p></section>}

          {formulation && (
            <section className="card" ref={resultRef}>
              <span className="pill">🎯 Step 4 · Choose Your Clinical Question</span>
              <table className="pico">
                <tbody>
                  {formulation.elements.map(e => (
                    <tr key={e.label}><td>{e.label}</td><td>{e.value}</td></tr>
                  ))}
                </tbody>
              </table>
              {formulation.variants && formulation.variants.length > 1 && (
                <>
                  <p className="hint" style={{ marginTop: 14 }}>Four ways to ask it — select the one that matches your clinical goal:</p>
                  <div className="variants">
                    {formulation.variants.map((v, i) => (
                      <button key={i} className={`variant-card ${variantIdx === i ? "selected" : ""}`} onClick={() => setVariantIdx(i)}>
                        <span className="v-num">{variantIdx === i ? "✓" : `Option ${i + 1}`}</span>
                        <span className="v-q">{v.question}</span>
                        <span className="v-r">{v.rationale}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="final-q"><strong>{activeQuestion}</strong></div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="secondary" onClick={searchPubMed} disabled={loading === "pubmed"}>
                  {loading === "pubmed" ? "⏳ Searching PubMed…" : "📚 Search PubMed for evidence"}
                </button>
                <button className="secondary" onClick={exportDoc}>📄 Export as Word</button>
                <button className="secondary" onClick={() => navigator.clipboard.writeText(activeQuestion)}>📋 Copy question</button>
              </div>
            </section>
          )}

          {formulation && (
            <section className="card">
              <span className="pill">📊 Step 5 · Quality Assessment ({total}/{maxTotal})</span>
              {formulation.scores.map(s => (
                <div key={s.name} className="score-row">
                  <span className="score-name">{s.name}</span>
                  <div className="bar-bg"><div className="bar" style={{ width: `${(s.value / 20) * 100}%` }} /></div>
                  <span className="score-val">{s.value}/20</span>
                </div>
              ))}
              {formulation.advisories.map((adv, i) => (
                <div key={i} className="advisory">⚠️ {adv}</div>
              ))}
              {!formulation.advisories.length && (
                <div className="good-note">✔ Well-formulated answerable question.</div>
              )}
            </section>
          )}

          {pubmed && (
            <section className="card">
              <span className="pill">📚 Step 6 · Evidence from PubMed</span>
              {pubmed.length === 0 && <p className="hint">No results found. Try broadening the outcome term.</p>}
              {pubmed.map(r => (
                <a key={r.pmid} className="result" href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`} target="_blank" rel="noopener">
                  <div className="r-title">{r.title}</div>
                  <div className="r-meta">{r.authors} · {r.journal} · {r.year}</div>
                </a>
              ))}
            </section>
          )}
        </main>

        <aside>
          <div className="card">
            <span className="pill">🕘 History</span>
            {history.length === 0 && <p className="hint">No saved questions yet.</p>}
            {history.map(h => (
              <div key={h.id} className="hist-item" title={h.question}>
                <div className="hist-q">{h.question}</div>
                <div className="hist-meta">{h.at} · {h.total}/{h.max}</div>
              </div>
            ))}
            {history.length > 0 && (
              <button className="link" style={{ marginTop: 8 }}
                onClick={() => { setHistory([]); localStorage.removeItem("cq-history"); }}>
                Clear history
              </button>
            )}
          </div>
        </aside>
      </div>

      <footer>Version 2.0 — AI-powered. Educational tool: always verify formulated questions clinically.</footer>
    </div>
  );
}
