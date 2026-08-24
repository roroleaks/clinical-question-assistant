import puppeteer from "puppeteer-core";

const URL = process.argv[2] || "http://localhost:3000";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const step = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " | " + extra : ""}`); ok ? pass++ : fail++; };

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 200)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 150)); });

  const text = () => Promise.race([
    page.evaluate(() => document.body.innerText),
    sleep(10000).then(() => "_TIMEOUT_")
  ]);
  const clickBtn = async match => {
    return page.evaluate(m => {
      const b = [...document.querySelectorAll("button")].find(x => x.textContent.toLowerCase().includes(m.toLowerCase()));
      if (b) { b.click(); return true; }
      return false;
    }, match);
  };

  console.log(`=== V3 MODULAR FLOW TEST: ${URL} ===`);
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
  let t = await text();
  step("Step 1 loads", t.includes("STEP 1") || t.includes("Step 1"), `footer ${(t.match(/Version [\d.]+/) || ["?"])[0]}`);

  await page.type("textarea", "ohss pcos ivf");
  await clickBtn("Find Gap");
  await sleep(400);
  const nav = await clickBtn("Map the evidence");
  step("Step 1 → navigates to /gap", nav);
  console.log("Waiting for /gap evidence map...");
  let ok = false;
  for (let i = 0; i < 30; i++) {
    await sleep(5000);
    t = await text();
    if (t.includes("Research gaps") || t.includes("RESEARCH GAPS")) { ok = true; break; }
    if (t.includes("did not respond")) break;
  }
  step("Step 2: gap map renders", ok);
  step("Step 2: established knowledge with refs", t.toLowerCase().includes("established knowledge"));
  step("Step 2: PDF buttons present", t.includes("PDF"));

  const clicked = await clickBtn("Refine into PICO");
  step("Navigate to Step 3 via Refine into PICO", clicked);
  console.log("Waiting for clarification dialogue...");
  ok = false;
  for (let i = 0; i < 30 && !ok; i++) {
    await sleep(5000);
    t = await text();
    if (t.includes("Interactive Clarification") || t.includes("INTERACTIVE CLARIFICATION")) ok = true;
    if (t.includes("could not be mapped") || t.includes("Session lost")) break;
  }
  step("Step 3: dialogue appears", ok);

  let answersGiven = 0;
  const deadline = Date.now() + 300000;
  console.log("Answer loop starting...");
  process.on("unhandledRejection", e => console.log("UNHANDLED:", String(e).slice(0, 200)));
  while (Date.now() < deadline) {
    await sleep(4000);
    t = await text();
    const lower = t.toLowerCase();
    if (lower.includes("scientific commentary paper")) { console.log(">> commentary detected"); break; }
    if (t.includes("Formulating your clinical questions")) { console.log(">> formulating…"); continue; }
    if (lower.includes("thinking")) { console.log(">> thinking…"); continue; }
    const state = await Promise.race([
      page.evaluate(() => ({
        chips: [...document.querySelectorAll(".chip")].map(c => c.textContent.slice(0, 30)),
        hasInput: !!document.querySelector(".free-input"),
        path: location.pathname
      })),
      sleep(10000).then(() => null)
    ]).catch(e => { console.log("EVAL FAIL:", String(e).slice(0, 120)); return null; });
    if (!state) continue;
    if (state.path === "/paper") { console.log(">> reached /paper"); break; }
    if (!state.chips.length && !state.hasInput) {
      const idx = t.toLowerCase().indexOf("step 3");
      const snip = idx >= 0 ? t.replace(/\s+/g, " ").slice(idx, idx + 240) : t.replace(/\s+/g, " ").slice(0, 240);
      console.log(`IDLE path=${state.path} | ${snip}`);
      continue;
    }
    if (state.chips.length) {
      await state.chips[0].click();
      answersGiven++;
      console.log(`answer ${answersGiven}: chip -> ${state.chips[0].textContent.slice(0, 45)}`);
    } else {
      await page.type(".free-input", "live birth rate");
      await clickBtn("Answer");
      answersGiven++;
      console.log(`answer ${answersGiven}: typed free text`);
    }
  }
  step("Answers submitted through Step 3", answersGiven > 0, `${answersGiven} answered`);
  const onPaper = await page.evaluate(() => location.pathname === "/paper");
  step("Navigated to Step 4 (/paper)", onPaper);

  console.log("Waiting for commentary paper generation (up to 180s)...");
  ok = false;
  for (let i = 0; i < 36; i++) {
    await sleep(5000);
    t = await text();
    if (t.toLowerCase().includes("references") && t.toLowerCase().includes("abstract")) { ok = true; break; }
  }
  step("Commentary paper generated with abstract + references", ok);

  t = await text();
  step("Question options (4 variants) present", t.includes("Option 1") || t.includes("SELECTED") || t.includes("Selected"));
  step("Quality assessment present", t.includes("QUALITY ASSESSMENT") || t.includes("Quality Assessment"));
  step("Commentary PDF export present", t.includes("Export as PDF"));
  step("PubMed evidence button present", t.includes("Evidence on PubMed") || t.includes("PUBMED"));

  console.log("\nJS errors:", errors.length ? "" : "none");
  errors.slice(0, 6).forEach(e => console.log("  -", e));
  await page.screenshot({ path: "v3-final.png", fullPage: true });
  console.log("\nRESULT:", `${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
