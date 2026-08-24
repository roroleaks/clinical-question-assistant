"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sset, KEYS } from "@/lib/session";

export default function Home() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"formulate" | "gap">("formulate");

  const start = () => {
    if (!input.trim()) return;
    sset(KEYS.input, input.trim());
    sset(KEYS.mode, mode);
    router.push(mode === "gap" ? "/gap" : "/question");
  };

  return (
    <div className="wrap">
      <header className="hdr">
        <h1>From Clinical Uncertainty to Answerable Questions</h1>
        <p>AI-Assisted Clinical Question Formulation — Obstetrics, Gynecology &amp; Infertility</p>
      </header>

      <main className="solo">
        <section className="card">
          <div className="modes">
            <button className={`mode-tab ${mode === "formulate" ? "active" : ""}`} onClick={() => setMode("formulate")}>🎯 Formulate Question</button>
            <button className={`mode-tab ${mode === "gap" ? "active" : ""}`} onClick={() => setMode("gap")}>🕳️ Find Gap</button>
          </div>

          {mode === "formulate" ? (
            <>
              <span className="pill">📝 Step 1 · Clinical Input</span>
              <p className="hint">Type a clinical uncertainty exactly as it comes to mind.</p>
              <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="e.g., recurrent implantation failure aspirin IVF" rows={4} />
            </>
          ) : (
            <>
              <span className="pill">🕳️ Find Gap · Evidence Mapping</span>
              <p className="hint">Enter a topic — the AI maps established knowledge, contested evidence, and true research gaps.</p>
              <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="e.g., coenzyme Q10 and endometriosis" rows={4} />
            </>
          )}

          <div className="row">
            <button className="primary" onClick={start} disabled={!input.trim()}>
              {mode === "formulate" ? "🔍 Start formulation →" : "🗺️ Map the evidence →"}
            </button>
          </div>
        </section>
      </main>

      <footer>Version 3.0 — modular steps · Educational tool: always verify formulated questions clinically.<br />Copyright©RaoufRoshdy2026</footer>
    </div>
  );
}
