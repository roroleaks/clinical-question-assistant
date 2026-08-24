"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Formulation } from "@/lib/kb";
import { sget, sset, KEYS } from "@/lib/session";

interface ReferenceItem { pmid: string; title: string; authors: string; year: string; journal: string; doi?: string; url: string }
interface CommentaryPaper {
  title: string; abstract: string; keywords: string[];
  introduction: string; discussion: string; conclusion: string;
  references: string[]; fetchedReferences?: ReferenceItem[];
}

export default function PaperPage() {
  const router = useRouter();
  const [formulation] = useState<Formulation | null>(() => sget<Formulation>(KEYS.formulation));
  const [gapTopic] = useState<string | null>(() => {
    const g = sget<any>(KEYS.gap);
    return g?.topic || sget<string>(KEYS.question) || sget<string>(KEYS.input) || "";
  });
  const [outcome] = useState<string>(() => sget<string>("cq_outcome") || "");
  const [variantIdx, setVariantIdx] = useState(0);
  const [commentary, setCommentary] = useState<CommentaryPaper | null>(() => sget<CommentaryPaper>(KEYS.commentary));
  const [commentaryLoading, setCommentaryLoading] = useState(false);
  const [pubmed, setPubmed] = useState<any[] | null>(null);
  const [pubmedLoading, setPubmedLoading] = useState(false);
  const commentaryRef = useRef<HTMLDivElement>(null);

  const activeQuestion = formulation?.variants?.[variantIdx]?.question ?? formulation?.finalQuestion ?? "";

  const generateCommentary = useCallback(async () => {
    if (!formulation?.finalQuestion) return;
    setCommentaryLoading(true);
    try {
      const res = await fetch("/api/engine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "commentary",
          topic: gapTopic || formulation.finalQuestion,
          gapAnalysis: sget<any>(KEYS.gap),
          selectedQuestion: activeQuestion || formulation.finalQuestion,
          outcome
        })
      });
      const data: CommentaryPaper = await res.json();
      if (data && data.title) {
        sset(KEYS.commentary, data);
        setCommentary(data);
      }
    } catch {}
    finally { setCommentaryLoading(false); }
  }, [formulation, gapTopic, activeQuestion, outcome]);

  useEffect(() => {
    if (!formulation) { router.replace("/"); return; }
    if (!commentary && !commentaryLoading) generateCommentary();
  }, []);

  const searchPubMed = async () => {
    if (!formulation) return;
    setPubmedLoading(true);
    try {
      const res = await fetch("/api/pubmed", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formulation.searchTerms)
      });
      setPubmed((await res.json()).results || []);
    } finally { setPubmedLoading(false); }
  };

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const cleanMd = (s: string) =>
    esc(s.replace(/\\n/g, " "))
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^#{1,6}\s+(.+)$/gm, "<h3>$1</h3>")
      .replace(/[*_#`~\\]/g, "");

  const printHTML = (bodyHtml: string, title: string) => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { alert("Please allow pop-ups to export PDF."); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
@page { size:A4; margin:22mm 20mm; }
body { font-family:Georgia,'Times New Roman',serif; color:#1c2430; font-size:11.5pt; line-height:1.65; margin:0; }
h1 { font-family:'Segoe UI',Arial,sans-serif; color:#0f6b6b; font-size:19pt; text-align:center; margin:0 0 6pt; line-height:1.3; }
h2 { font-family:'Segoe UI',Arial,sans-serif; color:#0f6b6b; font-size:13pt; border-bottom:1.5px solid #0f6b6b; padding-bottom:3pt; margin:20pt 0 8pt; }
h3 { font-family:'Segoe UI',Arial,sans-serif; color:#14535a; font-size:11.5pt; margin:14pt 0 5pt; }
.doc-type { text-align:center; font-family:'Segoe UI',Arial,sans-serif; letter-spacing:2px; text-transform:uppercase; font-size:9pt; color:#8a95a0; margin-top:14pt; }
.meta { text-align:center; color:#6a7580; font-size:9.5pt; font-style:italic; margin-bottom:18pt; }
p { text-align:justify; margin:0 0 9pt; }
.kw { color:#444d58; font-style:italic; }
ol.refs { padding-left:22pt; margin:0; }
ol.refs li { margin-bottom:7pt; font-size:10pt; line-height:1.5; padding-left:4pt; }
ol.refs li a { color:#0f6b6b; word-break:break-all; }
table.pico { width:100%; border-collapse:collapse; margin:8pt 0; }
table.pico td { border:1px solid #b9c2cc; padding:7pt 9pt; font-size:10pt; vertical-align:top; text-align:left; }
table.pico td:first-child { width:34mm; font-weight:bold; background:#e3f2f2; color:#0f6b6b; }
footer { margin-top:30pt; border-top:1px solid #ccd3da; padding-top:8pt; display:flex; justify-content:space-between; color:#8a95a0; font-size:8.5pt; font-style:italic; }
@media print { footer { position:fixed; bottom:0; left:0; right:0; } }
</style></head><body>${bodyHtml}
<footer><span>Clinical Question Assistant — Copyright©RaoufRoshdy2026</span><span>${new Date().toLocaleDateString()}</span></footer>
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const exportQuestionPDF = () => {
    if (!formulation) return;
    const body = `
<h1>${esc(activeQuestion)}</h1>
<div class="doc-type">Structured Clinical Question · ${esc(formulation.framework)}</div>
<div class="meta">Generated ${new Date().toLocaleDateString()} · Obstetrics, Gynecology &amp; Infertility</div>
<table class="pico">
${formulation.elements.map(e => `<tr><td>${esc(e.label)}</td><td>${cleanMd(e.value)}</td></tr>`).join("")}
</table>`;
    printHTML(body, "Clinical Question");
  };

  const exportWord = () => {
    if (!formulation) return;
    const html = `<html><head><meta charset="utf-8"></head><body>
<h1>${activeQuestion}</h1>
<h2>Framework: ${formulation.framework}</h2>
<table border="1" cellpadding="6" style="border-collapse:collapse">
${formulation.elements.map(e => `<tr><td><b>${e.label}</b></td><td>${e.value}</td></tr>`).join("")}
</table>
<p>Generated by Clinical Question Assistant — ${new Date().toLocaleDateString()}</p>
</body></html>`;
    const blob = new Blob(["\ufeff" + html], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "clinical-question.doc";
    a.click();
  };

  const exportCommentaryToPDF = () => {
    if (!commentary) return;
    const paras = (t: string) => t.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
      .map(p => /^#{1,6}\s/.test(p) ? cleanMd(p) : `<p>${cleanMd(p)}</p>`).join("");
    const discussionHtml = commentary.discussion.split(/\n{1,}/).map(b => b.trim()).filter(Boolean).map(b => {
      const clean = b.replace(/\*\*/g, "").replace(/[*_#`]/g, "");
      if (clean.length < 70 && !clean.endsWith(".")) return `<h3>${esc(clean)}</h3>`;
      return `<p>${cleanMd(clean)}</p>`;
    }).join("");
    const body = `
<h1>${esc(commentary.title)}</h1>
<div class="doc-type">Scientific Commentary</div>
<div class="meta">Clinical Question Assistant · Copyright©RaoufRoshdy2026 · ${new Date().toLocaleDateString()}</div>
<h2>Abstract</h2><p>${cleanMd(commentary.abstract)}</p>
${commentary.keywords?.length ? `<p class="kw"><strong>Keywords:</strong> ${esc(commentary.keywords.join("; "))}</p>` : ""}
<h2>Introduction</h2>${paras(commentary.introduction)}
<h2>Discussion</h2>${discussionHtml}
<h2>Conclusion</h2><p>${cleanMd(commentary.conclusion)}</p>
${commentary.references?.length ? `<h2>References (Chicago Style)</h2>
<ol class="refs">${commentary.references.map(r => `<li>${esc(r.replace(/^\[?\d+\]?[\.\)]?\s*/, "")).replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1">$1</a>')}</li>`).join("")}</ol>` : ""}`;
    printHTML(body, commentary.title);
  };

  const total = formulation ? formulation.scores.reduce((x, s) => x + (s.value || 0), 0) : 0;
  const maxTotal = formulation ? formulation.scores.length * 20 : 100;

  if (!formulation) {
    return (
      <div className="wrap"><header className="hdr"><h1>📝 Step 4</h1></header>
        <main className="solo"><section className="card">
          <p className="hint">No formulated question found in this session.</p>
          <button className="primary" onClick={() => router.push("/")}>← Start from Step 1</button>
        </section></main></div>
    );
  }

  return (
    <div className="wrap">
      <header className="hdr">
        <h1>📝 Step 4 · Your Scientific Commentary & Question Package</h1>
        <p>The commentary generates automatically — choose your preferred question below</p>
      </header>

      <main className="solo">
        {(commentary || commentaryLoading) && (
          <section className="card" ref={commentaryRef}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span className="pill">📄 Scientific Commentary Paper</span>
              {commentary && <button className="secondary" onClick={exportCommentaryToPDF}>🖨️ Export as PDF</button>}
            </div>
            {!commentary && <p className="hint">⏳ Writing your scientific commentary — abstract, keywords, discussion, conclusion and Chicago-style references…</p>}
            {commentary && (
              <>
                <h2 style={{ marginBottom: 12 }}>{commentary.title}</h2>
                <p style={{ fontSize: ".9rem", color: "var(--muted)", marginBottom: 16 }}>Keywords: {commentary.keywords.join(", ")}</p>
                <h3 className="sec-h">Abstract</h3><p>{commentary.abstract}</p>
                <h3 className="sec-h">Introduction</h3><p>{commentary.introduction}</p>
                <h3 className="sec-h">Discussion</h3><div>{commentary.discussion}</div>
                <h3 className="sec-h">Conclusion</h3><p>{commentary.conclusion}</p>
                {!!commentary.references.length && (
                  <><h3 className="sec-h">References (Chicago Style)</h3>
                    <ol className="refs-numbered">{commentary.references.map((ref, i) => <li key={i}>{ref}</li>)}</ol></>
                )}
                <div className="row"><button className="secondary" onClick={() => generateCommentary()}>🔄 Regenerate</button></div>
              </>
            )}
          </section>
        )}

        <section className="card">
          <span className="pill">🎯 Your Answerable Question — pick one of the options</span>
          <table className="pico"><tbody>
            {formulation.elements.map(e => <tr key={e.label}><td>{e.label}</td><td>{e.value}</td></tr>)}
          </tbody></table>
          {formulation.variants && formulation.variants.length > 1 && (
            <>
              <p className="hint" style={{ marginTop: 12 }}>Four ways to ask it — select your favourite:</p>
              <div className="variants">
                {formulation.variants.map((v, i) => (
                  <button key={i} className={`variant-card ${variantIdx === i ? "selected" : ""}`} onClick={() => setVariantIdx(i)}>
                    <span className="v-num">{variantIdx === i ? "✓ Selected" : `Option ${i + 1}`}</span>
                    <span className="v-q">{v.question}</span>
                    <span className="v-r">{v.rationale}</span>
                  </button>))}
              </div>
            </>
          )}
          <div className="final-q"><strong>{activeQuestion}</strong></div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="secondary" onClick={searchPubMed} disabled={pubmedLoading}>
              {pubmedLoading ? "⏳ Searching…" : "📚 Evidence on PubMed"}
            </button>
            <button className="secondary" onClick={exportQuestionPDF}>🖨️ Question as PDF</button>
            <button className="secondary" onClick={exportWord}>📄 Word</button>
            <button className="secondary" onClick={() => navigator.clipboard.writeText(activeQuestion)}>📋 Copy</button>
          </div>
        </section>

        <section className="card">
          <span className="pill">📊 Quality Assessment ({total}/{maxTotal})</span>
          {formulation.scores.map(s => (
            <div key={s.name} className="score-row">
              <span className="score-name">{s.name}</span>
              <div className="bar-bg"><div className="bar" style={{ width: `${(s.value / 20) * 100}%` }} /></div>
              <span className="score-val">{s.value}/20</span>
            </div>))}
          {formulation.advisories.map((adv, i) => <div key={i} className="advisory">⚠️ {adv}</div>)}
          {!formulation.advisories.length && <div className="good-note">✔ Well-formulated answerable question.</div>}
        </section>

        {pubmed && (
          <section className="card">
            <span className="pill">📚 Evidence from PubMed</span>
            {pubmed.length === 0 && <p className="hint">No results found.</p>}
            {pubmed.map(r => (
              <a key={r.pmid} className="result" href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`} target="_blank" rel="noopener">
                <div className="r-title">{r.title}</div>
                <div className="r-meta">{r.authors} · {r.journal} · {r.year}</div>
              </a>))}
          </section>
        )}

        <div className="row"><button className="link" onClick={() => router.push("/")}>← Start a new question</button></div>
      </main>
      <footer>Version 3.0 · Copyright©RaoufRoshdy2026</footer>
    </div>
  );
}
