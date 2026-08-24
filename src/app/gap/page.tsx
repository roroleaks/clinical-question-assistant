"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sget, sset, KEYS } from "@/lib/session";

interface Reference { pmid: string; title: string; authors: string; year: string; journal: string; doi?: string; url: string }
interface PointWithRefs { point: string; references: Reference[] }
interface GapResult {
  topic: string; specialty?: string;
  known: PointWithRefs[]; uncertain: PointWithRefs[];
  gaps: { gap: string; why: string }[];
  suggestedQuestions: { question: string; rationale: string }[];
  note?: string;
}

export default function GapPage() {
  const router = useRouter();
  const [gap, setGap] = useState<GapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const input = sget<string>(KEYS.input);
    if (!input) { router.replace("/"); return; }
    (async () => {
      try {
        const res = await fetch("/api/engine", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: "gap", input })
        });
        setGap(await res.json());
      } catch {
        setError("The evidence mapping service did not respond. Please go back and retry.");
      }
    })();
  }, [router]);

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const cleanMd = (s: string) =>
    esc(s.replace(/\\n/g, " "))
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^#{1,6}\s+(.+)$/gm, "<h3>$1</h3>")
      .replace(/[*_#`~\\]/g, "");

  const chicagoRefHtml = (r: Reference) => {
    const bits = [
      r.authors ? `${esc(r.authors)}.` : "",
      r.year ? `${r.year}.` : "",
      `"${esc(r.title.replace(/\.$/, ""))}."`,
      r.journal ? `<em>${esc(r.journal)}</em>.` : "",
      r.doi ? `doi:${esc(r.doi)}` : ""
    ].filter(Boolean);
    return `${bits.join(" ")} <a href="https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/">https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/</a>`;
  };

  const printHTML = (bodyHtml: string, title: string) => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { alert("Please allow pop-ups to export PDF."); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
@page { size: A4; margin: 22mm 20mm; }
body { font-family: Georgia, 'Times New Roman', serif; color:#1c2430; font-size:11.5pt; line-height:1.65; margin:0; }
h1 { font-family:'Segoe UI',Arial,sans-serif; color:#0f6b6b; font-size:19pt; text-align:center; margin:0 0 6pt; }
h2 { font-family:'Segoe UI',Arial,sans-serif; color:#0f6b6b; font-size:13pt; border-bottom:1.5px solid #0f6b6b; padding-bottom:3pt; margin:20pt 0 8pt; }
.doc-type { text-align:center; font-family:'Segoe UI',Arial,sans-serif; letter-spacing:2px; text-transform:uppercase; font-size:9pt; color:#8a95a0; margin-top:14pt; }
.meta { text-align:center; color:#6a7580; font-size:9.5pt; font-style:italic; margin-bottom:18pt; }
p { text-align: justify; margin:0 0 9pt; }
.item { margin-bottom:16pt; page-break-inside:avoid; }
.refs-mini { margin:6pt 0 0; padding-left:14pt; }
.refs-mini li { font-size:9.5pt; color:#444d58; margin-bottom:4pt; line-height:1.45; }
.refs-mini li a { color:#0f6b6b; word-break:break-all; }
footer { margin-top:30pt; border-top:1px solid #ccd3da; padding-top:8pt; display:flex; justify-content:space-between; color:#8a95a0; font-size:8.5pt; font-style:italic; }
@media print { footer { position:fixed; bottom:0; left:0; right:0; } }
</style></head><body>${bodyHtml}
<footer><span>Clinical Question Assistant — Copyright©RaoufRoshdy2026</span><span>${new Date().toLocaleDateString()}</span></footer>
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const exportEvidencePDF = (section: "known" | "uncertain") => {
    if (!gap) return;
    const isKnown = section === "known";
    const items: PointWithRefs[] = (isKnown ? gap.known : gap.uncertain) || [];
    const title = isKnown ? "Established Knowledge" : "Conflicting / Low-Quality Evidence";
    const body = `
<h1>${esc(gap.topic)}</h1>
<div class="doc-type">${title} · Evidence Map</div>
<div class="meta">Generated ${new Date().toLocaleDateString()} · Obstetrics, Gynecology &amp; Infertility</div>
${items.map((item, idx) => `
<div class="item">
<h2>${idx + 1}. ${isKnown ? "Established point" : "Contested area"}</h2>
<p>${cleanMd(item.point)}</p>
${item.references.length ? `<p style="margin-bottom:4pt;"><strong>Supporting literature:</strong></p>
<ol class="refs-mini">${item.references.map(r => `<li>${chicagoRefHtml(r)}</li>`).join("")}</ol>` : ""}
</div>`).join("")}`;
    printHTML(body, title);
  };

  const refine = (q: string) => {
    if (gap) sset(KEYS.gap, gap);
    sset(KEYS.question, q);
    router.push("/question");
  };

  return (
    <div className="wrap">
      <header className="hdr">
        <h1>🕳️ Step 2 · Evidence Map</h1>
        <p>What is established, what is contested, and where the real gaps are</p>
      </header>

      <main className="solo">
        {!gap && !error && (
          <section className="card"><p className="hint">⏳ Mapping the evidence — this usually takes 20–60 seconds…</p></section>
        )}
        {error && (
          <section className="card"><div className="advisory">⚠️ {error}</div>
            <button className="primary" onClick={() => router.push("/")}>← Back to start</button></section>
        )}

        {gap && (
          <section className="card" ref={mapRef}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span className="pill">🗺️ Evidence Map · {gap.topic}</span>
              <div className="row">
                <button className="secondary" onClick={() => exportEvidencePDF("known")}>📄 Established Knowledge (PDF)</button>
                <button className="secondary" onClick={() => exportEvidencePDF("uncertain")}>📄 Conflicting Evidence (PDF)</button>
              </div>
            </div>
            {gap.note && <div className="advisory">⚠️ {gap.note}</div>}

            {!!gap.known?.length && (
              <>
                <h3 className="sec-h">✅ Established knowledge</h3>
                <ul className="gap-list">
                  {gap.known.map((k, i) => (
                    <li key={`k${i}`}>
                      {k.point}
                      {!!k.references?.length && (
                        <div className="refs">{k.references.map((r, j) => (
                          <a key={j} href={r.url} target="_blank" rel="noopener noreferrer" className="ref-link">
                            [{r.year}] {r.authors}. {r.title}. {r.journal}. {r.doi ? `DOI: ${r.doi}` : `PMID: ${r.pmid}`}
                          </a>))}</div>
                      )}
                    </li>))}
                </ul>
              </>
            )}
            {!!gap.uncertain?.length && (
              <>
                <h3 className="sec-h">⚖️ Conflicting / low-quality evidence</h3>
                <ul className="gap-list">
                  {gap.uncertain.map((u, i) => (
                    <li key={`u${i}`}>
                      {u.point}
                      {!!u.references?.length && (
                        <div className="refs">{u.references.map((r, j) => (
                          <a key={j} href={r.url} target="_blank" rel="noopener noreferrer" className="ref-link">
                            [{r.year}] {r.authors}. {r.title}. {r.journal}. {r.doi ? `DOI: ${r.doi}` : `PMID: ${r.pmid}`}
                          </a>))}</div>
                      )}
                    </li>))}
                </ul>
              </>
            )}
            {!!gap.gaps?.length && (
              <>
                <h3 className="sec-h">🕳️ Research gaps</h3>
                <ul className="gap-list">
                  {gap.gaps.map((g, i) => <li key={`g${i}`}><strong>{g.gap}</strong> — {g.why}</li>)}
                </ul>
              </>
            )}
            {!!gap.suggestedQuestions?.length && (
              <>
                <h3 className="sec-h">💡 Questions that would fill these gaps — pick one to continue</h3>
                <div className="variants">
                  {gap.suggestedQuestions.map((s, i) => (
                    <div key={i} className="variant-card">
                      <span className="v-q">{s.question}</span>
                      <span className="v-r">{s.rationale}</span>
                      <button className="mini-btn" onClick={() => refine(s.question)}>→ Refine into PICO (Step 3)</button>
                    </div>))}
                </div>
              </>
            )}
            <div className="row">
              <button className="link" onClick={() => router.push("/")}>← Start over</button>
            </div>
          </section>
        )}
      </main>
      <footer>Version 3.0 · Copyright©RaoufRoshdy2026</footer>
    </div>
  );
}
