const BASE = process.argv[2] || "http://localhost:3000";

const STOP = new Set(["and","or","not","the","a","an","of","in","on","with","for","to","is","are","as","by","at","from"]);
const KB_OUTCOMES = {
  infertility: ["cumulative live birth rate", "live birth rate", "ongoing pregnancy rate", "clinical pregnancy rate", "implantation rate", "miscarriage rate", "OHSS incidence"],
  gynecology: ["patient-reported symptom relief", "quality of life scores", "hemoglobin change", "reoperation rate", "major complications", "patient satisfaction"],
  obstetrics: ["perinatal mortality", "neonatal morbidity composite", "gestational age at delivery", "preterm birth < 37 weeks", "birthweight", "maternal morbidity", "NICU admission"]
};

function normalizeClarify(c, a) {
  const done = c?.done === true || String(c?.done ?? "").toLowerCase() === "true";
  const field = typeof c?.field === "string" && c.field ? c.field : "outcome";
  const rawOptions = Array.isArray(c?.options) ? c.options : [];
  let options = rawOptions.filter(o => typeof o === "string" && o.trim().length > 0);
  if (!options.length && !done) {
    const spec = a.specialty;
    options = spec ? (KB_OUTCOMES[spec] || []).slice(0, 6) : [];
  }
  return {
    done,
    field: done ? null : field,
    questionText: typeof c?.questionText === "string" && c.questionText ? c.questionText : "Please specify:",
    options,
    allowFreeText: true,
    source: c?.source === "ai" ? "ai" : "rules"
  };
}

async function post(stage, payload) {
  const res = await fetch(`${BASE}/api/engine`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stage, ...payload })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${stage}`);
  return res.json();
}

(async () => {
  const input = process.argv[3] || "ohss pcos ivf";
  console.log(`\n=== Testing ${BASE} | input: "${input}" ===`);

  let pass = 0, fail = 0;
  const check = (name, cond, extra = "") => {
    console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " | " + extra : ""}`);
    cond ? pass++ : fail++;
  };

  const a = await post("intent", { input });
  check("Step 2: specialty detected", !!a.specialty, `${a.specialtyLabel} (${a.source})`);

  let ans = {};
  let log = [];
  let step3shown = false;
  let lastQ = null;

  for (let round = 0; round < 6; round++) {
    let raw = null;
    try {
      raw = await post("clarify", { analysis: a, answered: ans });
    } catch {}
    let c;
    if (!raw) {
      c = { done: true };
    } else {
      c = normalizeClarify(raw, a);
    }
    if (c.done && log.length === 0) {
      c = { done: false, field: "outcome", questionText: "What is your primary clinical outcome of interest?", options: (KB_OUTCOMES[a.specialty] || []).slice(0, 6), allowFreeText: true, source: "forced" };
    }
    if (c.done) break;

    step3shown = true;
    lastQ = c.questionText;
    check(`Round ${round + 1}: Step 3 shows question with choices`, c.options.length > 0, `"${c.questionText.slice(0, 60)}" (${c.options.length} options)`);
    ans[c.field || "outcome"] = c.options[0];
  }
  check("Step 3 appeared at least once", step3shown);

  const f = await post("formulate", { analysis: a, answered: ans });
  check("Step 4: finalQuestion produced", !!f.finalQuestion && typeof f.finalQuestion === "string", f.finalQuestion?.slice(0, 80));
  check("Step 4: variants present", Array.isArray(f.variants) && f.variants.length >= 2, `${f.variants?.length ?? 0} variants`);
  check("Step 4: scores present", Array.isArray(f.scores) && f.scores.length > 0, `${f.scores?.length ?? 0}`);

  try {
    const cm = await post("commentary", {
      topic: f.searchTerms?.population ? `${f.searchTerms.population} ${f.searchTerms.intervention}` : input,
      gapAnalysis: null,
      selectedQuestion: f.finalQuestion,
      outcome: ans.outcome || ""
    });
    check("Commentary: title", !!cm.title);
    check("Commentary: abstract length", (cm.abstract || "").length > 300, `${(cm.abstract || "").length} chars`);
    check("Commentary: keywords", (cm.keywords || []).length >= 4, `${cm.keywords?.length ?? 0}`);
    check("Commentary: references Chicago style", (cm.references || []).length >= 3, `${cm.references?.length ?? 0} refs`);
  } catch (e) {
    check("Commentary generated", false, e.message);
  }

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
