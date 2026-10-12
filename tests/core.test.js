const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const http = require("node:http");
const { pathToFileURL } = require("node:url");
const ROOT = path.resolve(__dirname, "..");
const json = value => JSON.parse(JSON.stringify(value));
function core(overrides = {}) {
  const saved = new Map();
  const context = vm.createContext({ console, URL, AbortController, performance, setTimeout, clearTimeout,
    localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) }, ...overrides });
  for (const file of ["vocabulary.js", "storage.js", "engine.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, "src", file), "utf8"), context, { filename: file });
  return { ...context, persisted: saved };
}
const ARTICLE = [
  { id: "a", text: "A community project can begin with a simple question: what would make this neighbourhood a better place to live?" },
  { id: "b", text: "A local bank offered a small loan to turn an empty riverside building into a shared workshop." },
  { id: "c", text: "On the river bank, volunteers planted trees and created a quiet place to meet." },
  { id: "d", text: "The workshop gives residents an opportunity to learn practical skills, exchange ideas and build confidence." },
  { id: "e", text: "Its future depends on the people who use it. The project respects privacy and learning." }
];
const bank = (ctx, sense = "financial-institution") => ({ ...ctx.LINGO_VOCABULARY.find(item => item.source === "bank" && item.sense === sense), context: "A local bank offered a small loan." });
const settingsFor = ctx => ({ ...ctx.LingoStore.DEFAULT_SETTINGS });

test("fresh profile is paused; reveal alone neither saves context nor claims mastery", async () => {
  const ctx = core(); const store = ctx.LingoStore;
  assert.equal((await store.getSettings()).enabled, false);
  assert.equal((await store.getSettings()).density, 6);
  const revealed = await store.recordEncounter(bank(ctx));
  assert.equal(revealed.saved, false); assert.equal(revealed.known, false);
  assert.equal(revealed.context, ""); assert.equal(revealed.example, ""); assert.equal(revealed.dueAt, null);
  const stats = store.computeStats(await store.getEncounters());
  assert.equal(stats.total, 0); assert.equal(stats.due, 0); assert.equal(stats.mastered, 0);
  assert.equal([...ctx.persisted.values()].some(value => value.includes("A local bank offered")), false);
});

test("explicit save retains a sentence; repeated reveal preserves its saved state", async () => {
  const ctx = core(); const store = ctx.LingoStore; const item = bank(ctx);
  await store.recordEncounter(item);
  const saved = await store.saveWord(item);
  assert.equal(saved.saved, true); assert.equal(saved.context, item.context); assert.ok(saved.dueAt);
  const again = await store.recordEncounter({ ...item, context: "" });
  assert.equal(again.saved, true); assert.equal(again.context, item.context);
  const newPage = { ...item, context: "A NEW PRIVATE PAGE SENTENCE", meaning: "NEW PRIVATE EXPLANATION", example: "NEW PRIVATE EXAMPLE" };
  const observed = await store.recordEncounter(newPage);
  assert.equal(observed.context, saved.context); assert.equal(observed.explanation, saved.explanation); assert.equal(observed.example, saved.example);
  const feedback = await store.applyFeedback(newPage, "hard");
  assert.equal(feedback.context, saved.context); assert.equal([...ctx.persisted.values()].some(value => value.includes("NEW PRIVATE")), false);
  const explicitlyUpdated = await store.saveWord(newPage);
  assert.equal(explicitlyUpdated.context, newPage.context);
  assert.equal((await store.getEncounters()).length, 1);
});

test("known feedback excludes only that sense; translation errors remain visibly blocked", async () => {
  const ctx = core(); const store = ctx.LingoStore;
  await store.applyFeedback(bank(ctx), "known");
  const result = await ctx.LingoEngine.select(ARTICLE, settingsFor(ctx), await store.getEncounters());
  assert.equal(result.candidates.some(item => item.sense === "financial-institution"), false);
  assert.equal(result.candidates.some(item => item.sense === "river-edge"), true);
  let blocked = await store.applyFeedback(bank(ctx, "river-edge"), "error");
  blocked = await store.saveWord(blocked);
  assert.equal(blocked.blocked, true); assert.equal(blocked.blockedReason, "Reported translation error");
  const later = await ctx.LingoEngine.select(ARTICLE, settingsFor(ctx), await store.getEncounters());
  assert.equal(later.candidates.some(item => item.source.toLowerCase() === "bank"), false);
  assert.equal(await store.gradeEncounter(blocked.id, "good"), null);
});

test("difficulty feedback respects a locked cap, adapting only when unlocked", async () => {
  const ctx = core(); const store = ctx.LingoStore; const item = bank(ctx);
  await store.applyFeedback(item, "hard"); await store.applyFeedback(item, "hard");
  assert.equal((await store.getSettings()).adaptiveDensity, 6);
  await store.saveSettings({ densityLocked: false });
  await store.applyFeedback(item, "hard");
  let settings = await store.getSettings();
  assert.equal(settings.density, 6); assert.equal(settings.adaptiveDensity, 5);
  assert.equal(ctx.LingoEngine.effectiveCap(settings), 5);
  await store.saveSettings({ densityLocked: true });
  assert.equal(ctx.LingoEngine.effectiveCap(await store.getSettings()), 6);
  await store.saveSettings({ density: 3 });
  assert.equal((await store.getSettings()).adaptiveDensity, 3);
});

test("reviews schedule saved cards without automatically asserting known or mastered", async () => {
  const ctx = core(); const store = ctx.LingoStore; const raw = await store.recordEncounter(bank(ctx));
  assert.equal(await store.gradeEncounter(raw.id, "good"), null);
  let record = await store.saveWord(bank(ctx));
  for (let i = 0; i < 5; i++) record = await store.gradeEncounter(record.id, "easy");
  assert.equal(record.repetitions, 5); assert.equal(record.known, false);
  assert.ok(record.dueAt > Date.now()); assert.equal(store.computeStats([record]).mastered, 0);
  record = await store.gradeEncounter(record.id, "hard");
  assert.equal(record.repetitions, 0); assert.ok(record.dueAt > Date.now() + 590000);
  assert.ok(record.dueAt <= Date.now() + 600000);
});

test("settings cannot retain API keys or redirect the gateway; reset preserves preferences", async () => {
  const ctx = core(); const store = ctx.LingoStore;
  const settings = await store.saveSettings({ apiKey: "secret", key: "secret", gatewayUrl: "https://external.example", density: 99, goal: "interest" });
  assert.equal(settings.apiKey, undefined); assert.equal(settings.key, undefined);
  assert.equal(settings.gatewayUrl, "http://127.0.0.1:8765"); assert.equal(settings.density, 10);
  await store.saveWord(bank(ctx)); await store.saveGrammarProgress({ lesson: { completed: true } });
  await store.resetLearningData();
  assert.equal((await store.getEncounters()).length, 0); assert.deepEqual(json(await store.getGrammarProgress()), {});
  assert.equal((await store.getSettings()).goal, "interest");
});

test("explicit demo seeds follow the current pair, remain labelled and do not overwrite a real save", async () => {
  const ctx = core(); const store = ctx.LingoStore;
  assert.equal((await store.getEncounters()).length, 0);
  await store.saveSettings({ sourceLanguage: "sk", targetLanguage: "en" });
  await store.seedDemoDeck("en");
  const records = await store.getEncounters();
  assert.equal(records.length, 6); assert.ok(records.every(item => item.sourceLanguage === "sk" && item.language === "en" && item.demoSeed && item.saved));
  await store.resetLearningData();
  const real = await store.saveWord({ ...ctx.LINGO_VOCABULARY.find(item => item.sourceLanguage === "sk"), context: "A sentence the learner explicitly saved." });
  await store.seedDemoDeck("en");
  const preserved = (await store.getEncounters()).find(item => item.id === real.id);
  assert.equal(preserved.demoSeed, false); assert.equal(preserved.context, real.context);
});

test("curated selection resolves both bank senses and obeys article caps and provisional levels", async () => {
  const ctx = core(); const settings = settingsFor(ctx);
  const result = await ctx.LingoEngine.select(ARTICLE, settings, []);
  assert.equal(result.mode, "demo"); assert.equal(result.candidates.length, 6);
  assert.deepEqual(json(result.candidates.filter(item => item.source === "bank").map(item => item.target).sort()), ["河岸", "银行"].sort());
  for (const item of result.candidates) assert.equal(ARTICLE.find(sentence => sentence.id === item.sentenceId).text.slice(item.start, item.end), item.source);
  assert.ok(result.candidates.every(item => item.reason.includes("no model inference")));
  const beginner = await ctx.LingoEngine.select(ARTICLE, { ...settings, level: "A1", density: 3 }, []);
  assert.ok(beginner.candidates.length <= 3); assert.ok(beginner.candidates.every(item => item.level === "A1"));
  const unknownBank = await ctx.LingoEngine.select([{ id: "x", text: "I visited the bank." }], settings, []);
  assert.equal(unknownBank.candidates.length, 0);
});

test("curated goals can alter ranking, and unsupported pairs report a useful error", async () => {
  const ctx = core(); const settings = { ...settingsFor(ctx), level: "B2", density: 1 };
  const sentences = [{ id: 1, text: "We need evidence and collaboration." }];
  const exam = await ctx.LingoEngine.select(sentences, { ...settings, goal: "exam" }, []);
  const career = await ctx.LingoEngine.select(sentences, { ...settings, goal: "career" }, []);
  assert.equal(exam.candidates[0].source, "evidence"); assert.equal(career.candidates[0].source, "collaboration");
  await assert.rejects(() => ctx.LingoEngine.select(sentences, { ...settings, targetLanguage: "es" }, []), /supports/);
});

test("supporting Slovak and Thai pairs use exact source spans, including Thai without spaces", async () => {
  const ctx = core(); const base = settingsFor(ctx);
  const slovak = [{ id: "sk", text: "Miestna komunita vytvorila nový projekt. Tento projekt podporuje učenie. Naše mesto má novú knižnicu. Budúcnosť závisí od spolupráce. Ľudia získavajú praktické zručnosti." }];
  const thai = [{ id: "th", text: "ชุมชนของเรามีพื้นที่สำหรับการเรียนรู้ ทุกคนมีโอกาสเรียนรู้ เราฝึกทักษะใหม่ร่วมกัน อนาคตเริ่มต้นจากวันนี้ เราควรเคารพความเป็นส่วนตัว" }];
  for (const [sentences, sourceLanguage, targetLanguage] of [[slovak, "sk", "en"], [thai, "th", "zh"]]) {
    const result = await ctx.LingoEngine.select(sentences, { ...base, sourceLanguage, targetLanguage }, []);
    assert.equal(result.candidates.length, 6);
    assert.ok(result.candidates.every(item => sentences[0].text.slice(item.start, item.end) === item.source));
  }
});

test("response validation rejects mismatches, partial words, overlaps, mid-sentence names, above-level and over-cap entries", () => {
  const ctx = core(); const engine = ctx.LingoEngine;
  const sentence = { id: "v", text: "Practical skills and learning improve privacy, and Ada visits a bank." };
  const candidate = (source, extra = {}) => ({ sentenceId: "v", source, start: sentence.text.indexOf(source), end: sentence.text.indexOf(source) + source.length, target: "译文", sense: source, level: "A1", ...extra });
  const raw = [candidate("skills"), candidate("skills", { sense: "overlap" }), candidate("learning", { source: "changed" }), candidate("privacy", { level: "C2" }), candidate("Ada"), candidate("bank", { start: -1 }), candidate("skill"), candidate("learning"), candidate("improve")];
  const result = engine.validateCandidates(raw, [sentence], { ...settingsFor(ctx), density: 2 });
  assert.deepEqual(json(result.candidates.map(item => item.source)), ["skills", "learning"]);
  assert.equal(result.rejected.length, 7);
  assert.ok(result.rejected.some(item => item.reason === "Overlapping span"));
  assert.ok(result.rejected.some(item => item.reason === "Replacement cap"));
  assert.throws(() => engine.validateCandidates({}, [sentence], settingsFor(ctx)), /candidates array/);
});

test("live relay sends only minimal learner data, validates model output and never silently falls back", async () => {
  let sent; const ctx = core({ chrome: { runtime: { id: "a".repeat(32), sendMessage: async message => { sent = message; return { ok: true, data: { mode: "live", candidates: [{ sentenceId: "b", source: "bank", start: 8, end: 12, target: "银行", sense: "financial-institution", level: "A2" }] } }; } } } });
  const settings = { ...settingsFor(ctx), mode: "live" };
  const profile = [{ ...bank(ctx), saved: true, context: "PRIVATE SENTENCE", url: "https://private.example" }];
  const result = await ctx.LingoEngine.select(ARTICLE, settings, profile);
  assert.equal(result.mode, "live"); assert.equal(result.candidates.length, 1);
  assert.equal(sent.type, "LINGOSPROUT_GATEWAY"); assert.equal(sent.path, "/select");
  assert.equal(JSON.stringify(sent).includes("PRIVATE SENTENCE"), false); assert.equal(JSON.stringify(sent).includes("private.example"), false);
  ctx.chrome.runtime.sendMessage = async () => ({ ok: false, error: "Gateway unavailable" });
  await assert.rejects(() => ctx.LingoEngine.select(ARTICLE, settings, []), /Gateway unavailable/);
});

test("demo chat is explicitly guided, and does not claim to assess the user's sentence", async () => {
  const ctx = core(); const reply = await ctx.LingoEngine.chat([{ role: "user", content: "A sentence to practise." }], settingsFor(ctx), []);
  assert.equal(reply.mode, "demo"); assert.match(reply.reply, /fixed prompt, not an AI assessment/);
  assert.match(reply.reply, /Try a short sentence/);
});

test("subscriptions receive changes and grammar updates preserve existing lessons", async () => {
  const ctx = core(); const store = ctx.LingoStore; let changes;
  const unsubscribe = store.subscribe(value => { changes = value; });
  await store.saveGrammarProgress({ a: { completed: true } });
  await store.saveGrammarProgress({ b: { attempts: 1 } });
  assert.ok(changes.grammarProgress.newValue.a.completed); assert.equal(changes.grammarProgress.newValue.b.attempts, 1);
  unsubscribe(); changes = null; await store.saveSettings({ goal: "exam" }); assert.equal(changes, null);
});

const PROVIDER_ENV = { LINGOSPROUT_API_KEY: "test-key-not-real", LINGOSPROUT_BASE_URL: "https://provider.invalid/v1", LINGOSPROUT_MODEL: "test-model", LINGOSPROUT_EXTENSION_ID: "a".repeat(32) };
async function withGateway(t, options) {
  const { createGateway } = await import(pathToFileURL(path.join(ROOT, "gateway/server.mjs")));
  const server = createGateway(options);
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}
function gatewayRequest(body, headers = {}) {
  return { method: "POST", headers: { "Content-Type": "application/json", "X-LingoSprout-Client": "v4", Origin: "http://127.0.0.1:8766", ...headers }, body: JSON.stringify(body) };
}
function selectionBody() { return { settings: { sourceLanguage: "en", targetLanguage: "zh", level: "B1", goal: "career", density: 6 }, sentences: ARTICLE, profile: [] }; }

test("gateway enforces exact browser origins, loopback Host and a custom JSON header", async t => {
  let calls = 0; const url = await withGateway(t, { env: {}, fetchImpl: async () => { calls++; throw new Error("Must not be called"); } });
  const foreign = await fetch(url + "/select", gatewayRequest(selectionBody(), { Origin: "https://unrelated.example" }));
  assert.equal(foreign.status, 403); assert.equal(foreign.headers.get("access-control-allow-origin"), null);
  // Use the low-level HTTP client: Node's Fetch implementation can normalise Host.
  const forgedHostRequest = gatewayRequest(selectionBody(), { Host: "attacker.example" });
  const rebindingStatus = await new Promise((resolve, reject) => {
    const request = http.request(url + "/select", { method: forgedHostRequest.method, headers: forgedHostRequest.headers }, response => { response.resume(); response.on("end", () => resolve(response.statusCode)); });
    request.on("error", reject); request.end(forgedHostRequest.body);
  });
  assert.equal(rebindingStatus, 403);
  const missingHeader = gatewayRequest(selectionBody()); delete missingHeader.headers["X-LingoSprout-Client"];
  assert.equal((await fetch(url + "/select", missingHeader)).status, 403);
  const preflight = await fetch(url + "/select", { method: "OPTIONS", headers: { Origin: "http://127.0.0.1:8766", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,x-lingosprout-client" } });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get("access-control-allow-origin"), "http://127.0.0.1:8766");
  const unconfigured = await fetch(url + "/select", gatewayRequest(selectionBody())); assert.equal(unconfigured.status, 503);
  assert.match((await unconfigured.json()).error, /not configured/); assert.equal(calls, 0);
});

test("gateway calls a configured provider, strips private profile fields and rejects invalid returned spans", async t => {
  let upstream;
  const url = await withGateway(t, { env: PROVIDER_ENV, fetchImpl: async (endpoint, options) => {
    upstream = { endpoint, options };
    return Response.json({ choices: [{ message: { content: JSON.stringify({ candidates: [
      { sentenceId: "b", source: "bank", start: 8, end: 12, target: "银行", sense: "financial-institution", level: "A2" },
      { sentenceId: "c", source: "bank", start: 13, end: 17, target: "河岸", sense: "river-edge", level: "A2" },
      { sentenceId: "a", source: "fabricated", start: 0, end: 4, target: "错误", sense: "invalid", level: "A1" }
    ] }) } }] });
  } });
  const body = selectionBody(); body.profile = [{ source: "bank", target: "银行", language: "zh", sourceLanguage: "en", sense: "financial-institution", known: true, context: "PRIVATE SENTENCE", url: "https://private.example" }];
  const response = await fetch(url + "/select", gatewayRequest(body)); assert.equal(response.status, 200);
  const data = await response.json(); assert.equal(data.mode, "live"); assert.equal(data.candidates.length, 1); assert.equal(data.candidates[0].target, "河岸");
  assert.equal(upstream.endpoint, "https://provider.invalid/v1/chat/completions");
  assert.equal(upstream.options.headers.Authorization, "Bearer test-key-not-real");
  assert.equal(upstream.options.body.includes("PRIVATE SENTENCE"), false); assert.equal(upstream.options.body.includes("private.example"), false);
  assert.equal(JSON.stringify(data).includes("test-key-not-real"), false);
});

test("gateway rejects malformed provider JSON without turning it into a successful demo", async t => {
  const url = await withGateway(t, { env: PROVIDER_ENV, fetchImpl: async () => Response.json({ choices: [{ message: { content: "not JSON" } }] }) });
  const response = await fetch(url + "/select", gatewayRequest(selectionBody())); assert.equal(response.status, 502);
  const data = await response.json(); assert.equal(data.mode, undefined); assert.match(data.error, /No replacements/);
});

test("gateway conversation forwards bounded user messages and returns a plain live reply", async t => {
  let upstream;
  const url = await withGateway(t, { env: PROVIDER_ENV, fetchImpl: async (_, options) => { upstream = JSON.parse(options.body); return Response.json({ choices: [{ message: { content: "这是一个好机会。请再写一句。" } }] }); } });
  const body = { settings: selectionBody().settings, profile: [], messages: [{ role: "user", content: "这是学习的机会。" }] };
  const response = await fetch(url + "/chat", gatewayRequest(body)); assert.equal(response.status, 200);
  const data = await response.json(); assert.equal(data.mode, "live"); assert.match(data.reply, /机会/);
  assert.equal(upstream.messages.at(-1).role, "user"); assert.equal(upstream.response_format, undefined);
  body.messages[0].content = "x".repeat(1201);
  assert.equal((await fetch(url + "/chat", gatewayRequest(body))).status, 400);
});
