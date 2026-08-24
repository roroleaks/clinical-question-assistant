"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KB, type Analysis, type Clarification, type Formulation } from "@/lib/kb";
import { sget, sset, KEYS } from "@/lib/session";

export default function QuestionPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [answered, setAnswered] = useState<Record<string, string>>({});
  const [clarification, setClarification] = useState<Clarification | null>(null);
  const [chatLog, setChatLog] = useState<{ q?: string; a?: string }[]>([]);
  const [freeText, setFreeText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>("intent");
  const analysisRef = useRef<Analysis | null>(null);

  useEffect(() => { analysisRef.current = analysis; }, [analysis]);

  const normalizeClarify = (c: any, a: Analysis): Clarification => {
    const done = c?.done === true || String(c?.done ?? "").toLowerCase() === "true";
    const field = typeof c?.field === "string" && c.field ? c.field : "outcome";
    let options = Array.isArray(c?.options) ? c.options.filter((o: unknown) => typeof o === "string" && o.trim()) : [];
    if (!options.length && !done) {
      const spec = a.specialty ? KB[a.specialty] : null;
      options = spec ? spec.outcomesRanked.slice(0, 6) : ["live birth rate", "symptom relief"];
    }
    return {
      done,
      field: done ? null : field,
      questionText: typeof c?.questionText === "string" && c.questionText ? c.questionText : "Please specify:",
      options,
      allowFreeText: true,
      source: c?.source === "ai" ? "ai" : "rules"
    };
  };

  const finishAndGo = (f: Formulation, ans: Record<string, string>) => {
    f.scores = Array.isArray(f.scores) ? f.scores : [{ name: "Overall", value: 15 }];
    f.elements = Array.isArray(f.elements) ? f.elements : [];
    f.advisories = Array.isArray(f.advisories) ? f.advisories : [];
    if (f.variants && !Array.isArray(f.variants)) delete (f as any).variants;
    sset(KEYS.formulation, f);
    sset("cq_outcome", ans.outcome || "");
    router.push("/paper");
  };

  const formulate = async (a: Analysis, ans: Record<string, string>) => {
    setBusy("formulate");
    let f: Formulation | null = null;
    try {
      try {
        const res = await fetch("/api/engine", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: "formulate", analysis: a, answered: ans })
        });
        const parsed = await res.json();
        if (parsed && parsed.finalQuestion && !parsed.error) f = parsed;
      } catch {}
      if (!f) {
        const { ruleFormulate } = await import("@/lib/rule-engine");
        f = ruleFormulate(a, ans);
      }
      finishAndGo(f, ans);
    } catch {
      const { ruleFormulate } = await import("@/lib/rule-engine");
      finishAndGo(ruleFormulate(a, ans), ans);
    }
  };

  const runClarifyLoop = async (a: Analysis, ans: Record<string, string>, log: { q?: string; a?: string }[]) => {
    setBusy("clarify");
    let raw: any = null;
    try {
      const res = await fetch("/api/engine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "clarify", analysis: a, answered: ans })
      });
      raw = await res.json();
    } catch {}
    if (!raw) {
      const { ruleClarify } = await import("@/lib/rule-engine");
      raw = ruleClarify(a, ans);
      setNotice("AI is busy — continuing in offline mode.");
    }
    const nc = normalizeClarify(raw, a);
    if (log.length >= 3) { nc.done = true; nc.field = null; }
    if (nc.done && log.length === 0) {
      const spec = a.specialty ? KB[a.specialty] : null;
      nc.done = false;
      nc.field = "outcome";
      nc.questionText = "What is your primary clinical outcome of interest?";
      nc.options = spec ? spec.outcomesRanked.slice(0, 6) : ["live birth rate", "ongoing pregnancy rate", "symptom relief"];
      nc.source = "rules";
    }
    setClarification(nc);
    setBusy(null);
    if (nc.done) {
      await formulate(a, ans);
    } else {
      setChatLog([...log, { q: nc.questionText }]);
    }
  };

  const answer = async (field: string, value: string) => {
    try {
      if (!field || !value) return;
      const base = analysisRef.current;
      if (!base) { setNotice("Session lost — please go back to Step 1."); return; }
      const ans = { ...answered, [field]: value };
      setAnswered(ans);
      setChatLog(log => {
        const copy = [...log];
        if (copy.length) copy[copy.length - 1] = { ...copy[copy.length - 1], a: value };
        return copy;
      });
      await runClarifyLoop(base, ans, chatLog);
    } catch (e: any) {
      setNotice(`Answer failed: ${e?.message || e}`);
    }
  };

  useEffect(() => {
    const question = sget<string>(KEYS.question);
    const input = sget<string>(KEYS.input);
    const text = question || input;
    if (!text) { router.replace("/"); return; }
    (async () => {
      let a: Analysis | null = null;
      try {
        const res = await fetch("/api/engine", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: "intent", input: text })
        });
        a = await res.json();
      } catch {}
      if (!a || !a.specialty) {
        const { ruleAnalyze } = await import("@/lib/rule-engine");
        a = ruleAnalyze(text);
        if (!a.specialty) {
          setNotice("This could not be mapped to OB/GYN or Infertility. Go back and rephrase.");
          setBusy(null);
          return;
        }
        setNotice("AI busy — offline mode.");
      }
      setAnalysis(a);
      analysisRef.current = a;
      await runClarifyLoop(a, {}, []);
    })();
  }, [router]);

  return (
    <div className="wrap">
      <header className="hdr">
        <h1>💬 Step 3 · Interactive Clarification</h1>
        <p>A few targeted questions turn uncertainty into an answerable PICO</p>
      </header>

      <main className="solo">
        {analysis && (
          <section className="card">
            <span className="pill">🧠 Intent Recognition {analysis.source === "ai" ? "(AI)" : "(offline)"}</span>
            <p><b>Specialty:</b> <span className="tag">{analysis.specialtyLabel}</span>
              &nbsp;<b>Type:</b> <span className="tag">{analysis.questionType}</span> → <span className="tag">{analysis.framework}</span></p>
            <p style={{ marginTop: 4 }}><b>Reading:</b> {analysis.interpretation}</p>
          </section>
        )}

        {notice && (
          <section className="card"><div className="advisory">⚠️ {notice}</div></section>
        )}

        {chatLog.length > 0 && (
          <section className="card">
            {chatLog.map((m, i) => (
              <div key={i} className="turn">
                {m.q && <div className="bubble ai">{m.q}</div>}
                {m.a && <div className="bubble user">{m.a}</div>}
              </div>
            ))}
            {clarification && !clarification.done && busy !== "clarify" && (
              <>
                <div className="chips">
                  {clarification.options.map(o => (
                    <button key={o} className="chip" onClick={() => clarification.field && answer(clarification.field, o)}>{o}</button>
                  ))}
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <input
                    className="free-input"
                    value={freeText}
                    onChange={e => setFreeText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && freeText.trim() && clarification.field) answer(clarification.field, freeText.trim()); }}
                    placeholder="Or type your own answer…"
                  />
                  <button className="primary" disabled={!freeText.trim()}
                    onClick={() => clarification.field && answer(clarification.field, freeText.trim())}>
                    Answer ➜
                  </button>
                </div>
              </>
            )}
            {busy === "clarify" && <p className="hint">⏳ Thinking…</p>}
          </section>
        )}

        {busy === "intent" && <section className="card"><p className="hint">⏳ Analyzing your clinical scenario…</p></section>}
        {busy === "formulate" && <section className="card"><p className="hint">⏳ Formulating your clinical questions…</p></section>}

        <div className="row"><button className="link" onClick={() => router.push("/")}>← Start over</button></div>
      </main>
      <footer>Version 3.0 · Copyright©RaoufRoshdy2026</footer>
    </div>
  );
}
