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
        <div className="hdr-inner">
          <div className="hdr-left">
            <svg className="lens-icon" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <span className="title-main">AI PICO</span>
          </div>
          <div className="hdr-center">
            <h1>From Clinical Uncertainty to Answerable Questions</h1>
            <p>AI-Assisted Clinical Question Formulation \u2014 Obstetrics, Gynecology & Infertility</p>
          </div>
          <div className="hdr-right">
            <span className="author-name">
              <img src="/dr-raouf.jpg" alt="Dr Raouf Roshdy" className="author-photo" />
              Dr Raouf Roshdy
            </span>
          </div>
        </div>
      </header>

      <main className="solo">
        <section className="card">
          <div className="modes">
            <button className={`mode-tab ${mode === "formulate" ? "active" : ""}`} onClick={() => setMode("formulate")}>
              <svg className="mode-icon" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 17v4" />
                <path d="M9 20h6" />
                <path d="M14 11V3" />
                <path d="M11 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
                <path d="M16 8h-5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h5a1 1 0 0 1 1 1v3" />
              </svg>
              <span>Formulate Question</span>
            </button>
            <button className={`mode-tab ${mode === "gap" ? "active" : ""}`} onClick={() => setMode("gap")}>
              <svg className="mode-icon" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
                <path d="M11 8v6" />
                <path d="M11 16h.01" />
              </svg>
              <span>Find Gap</span>
            </button>
          </div>

          {mode === "formulate" ? (
            <>
              <span className="pill">📝 Step 1 \u00B7 Clinical Input</span>
              <p className="hint">Type a clinical uncertainty exactly as it comes to mind.</p>
              <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g., recurrent implantation failure aspirin IVF" rows={4} />
            </>
          ) : (
            <>
              <span className="pill">🕳️ Find Gap \u00B7 Evidence Mapping</span>
              <p className="hint">Enter a topic \u2014 the AI maps established knowledge, contested evidence, and true research gaps.</p>
              <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g., coenzyme Q10 and endometriosis" rows={4} />
            </>
          )}

          <div className="row">
            <button className="primary" onClick={start} disabled={!input.trim()}>
              {mode === "formulate" ? "🔍 Start formulation \u2192" : "\u{1F5FA} Map the evidence \u2192"}
            </button>
          </div>
        </section>
      </main>

      <footer>Version 3.0 \u2014 modular steps \u00B7 Educational tool: always verify formulated questions clinically.<br />Copyright\u00A9RaoufRoshdy2026</footer>
    </div>
  );
}