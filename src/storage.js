(function (root) {
  "use strict";
  const DAY_MS = 86400000;
  const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const DEFAULT_SETTINGS = Object.freeze({
    enabled: false, sourceLanguage: "en", targetLanguage: "zh", level: "B1",
    goal: "career", density: 6, densityLocked: true, adaptiveDensity: 6,
    mode: "demo", gatewayUrl: "http://127.0.0.1:8765"
  });
  const storage = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const listeners = new Set();
  const memory = {};
  let mutation = Promise.resolve();
  const clean = (value, max = 160) => typeof value === "string" ? value.trim().slice(0, max) : "";
  const bounded = (value, fallback = 6) => Number.isFinite(Number(value)) ? Math.min(10, Math.max(1, Math.floor(Number(value)))) : fallback;

  function serial(operation) {
    const next = mutation.then(operation, operation);
    mutation = next.catch(() => {});
    return next;
  }
  async function read(keys) {
    if (storage) return chrome.storage.local.get(keys);
    const result = {};
    for (const key of keys) {
      try {
        const raw = typeof localStorage !== "undefined" ? localStorage.getItem(`lingosprout:v4:${key}`) : memory[key];
        if (raw != null) result[key] = JSON.parse(raw);
      } catch (_) { /* Ignore corrupt optional local records. */ }
    }
    return result;
  }
  async function write(payload) {
    if (storage) return chrome.storage.local.set(payload);
    const previous = await read(Object.keys(payload));
    const changes = {};
    for (const [key, value] of Object.entries(payload)) {
      const raw = JSON.stringify(value);
      if (typeof localStorage !== "undefined") localStorage.setItem(`lingosprout:v4:${key}`, raw);
      else memory[key] = raw;
      changes[key] = { oldValue: previous[key], newValue: value };
    }
    for (const listener of listeners) listener(changes);
  }
  function normalizeSettings(value = {}) {
    const settings = { ...DEFAULT_SETTINGS, ...value };
    if (!["en", "sk", "th"].includes(settings.sourceLanguage)) settings.sourceLanguage = "en";
    if (!["zh", "en"].includes(settings.targetLanguage)) settings.targetLanguage = "zh";
    if (!LEVELS.includes(settings.level)) settings.level = "B1";
    if (!["exam", "career", "settlement", "interest"].includes(settings.goal)) settings.goal = "career";
    settings.enabled = settings.enabled === true;
    settings.density = bounded(settings.density);
    settings.adaptiveDensity = Math.min(settings.density, bounded(settings.adaptiveDensity, settings.density));
    settings.densityLocked = settings.densityLocked !== false;
    settings.mode = settings.mode === "live" ? "live" : "demo";
    try {
      const url = new URL(settings.gatewayUrl);
      if (url.origin !== DEFAULT_SETTINGS.gatewayUrl || url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) throw new Error();
      settings.gatewayUrl = url.origin;
    } catch (_) { settings.gatewayUrl = DEFAULT_SETTINGS.gatewayUrl; }
    delete settings.apiKey;
    delete settings.key;
    return settings;
  }
  async function getSettings() {
    const { settings } = await read(["settings"]);
    return normalizeSettings(settings);
  }
  async function saveSettings(patch = {}) {
    return serial(async () => {
      const merged = { ...(await getSettings()), ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, "density")) merged.adaptiveDensity = bounded(patch.density);
      const settings = normalizeSettings(merged);
      await write({ settings });
      return settings;
    });
  }
  function makeId(record) {
    const sourceLanguage = clean(record.sourceLanguage || "en", 8).toLowerCase();
    const language = clean(record.language || record.targetLanguage || "zh", 8).toLowerCase();
    const source = clean(record.source, 80).normalize("NFKC").toLocaleLowerCase();
    const sense = clean(record.sense || record.target || "general", 80).normalize("NFKC").toLocaleLowerCase();
    return [sourceLanguage, language, source, sense].map(encodeURIComponent).join(":");
  }
  async function getEncounters() {
    const { encounters } = await read(["encounters"]);
    return Array.isArray(encounters) ? encounters.filter(item => item && item.source && item.target && ["en", "zh"].includes(item.language)) : [];
  }
  function normalizeRecord(record, previous, save) {
    if (!record || !clean(record.source) || !clean(record.target)) throw new Error("A vocabulary record needs a source word and target meaning.");
    const now = Date.now();
    const saved = save || previous?.saved === true;
    const sourceLanguage = clean(record.sourceLanguage || previous?.sourceLanguage || "en", 8);
    const language = clean(record.language || record.targetLanguage || previous?.language || "zh", 8);
    const base = {
      source: clean(record.source, 80), target: clean(record.target, 100), sourceLanguage, language,
      sense: clean(record.sense || previous?.sense || record.target, 80),
      level: LEVELS.includes(record.level) ? record.level : previous?.level || "B1",
      saved, known: previous?.known === true, blocked: previous?.blocked === true,
      difficult: previous?.difficult === true, easy: previous?.easy === true,
      firstSeenAt: previous?.firstSeenAt || now, lastSeenAt: now,
      seenCount: (previous?.seenCount || 0) + 1,
      repetitions: previous?.repetitions || 0, intervalDays: previous?.intervalDays || 0,
      easeFactor: previous?.easeFactor || 2.5, dueAt: saved ? (previous?.dueAt || now) : null,
      lastGrade: previous?.lastGrade || null, lastReviewedAt: previous?.lastReviewedAt || null,
      lastFeedback: previous?.lastFeedback || null, lastFeedbackAt: previous?.lastFeedbackAt || null,
      blockedReason: clean(previous?.blockedReason, 160), hardCount: previous?.hardCount || 0,
      demoSeed: previous?.demoSeed === true || record.demoSeed === true,
      originMode: record.originMode === "live" ? "live" : previous?.originMode || "demo"
    };
    base.id = makeId(base);
    // Only an explicit save can retain new page context, including for an existing card.
    base.context = save ? clean(record.context || previous?.context, 700) : clean(previous?.context, 700);
    base.explanation = save ? clean(record.explanation || record.meaning || previous?.explanation, 500) : clean(previous?.explanation, 500);
    base.example = save ? clean(record.example || previous?.example, 400) : clean(previous?.example, 400);
    base.pronunciation = clean(record.pronunciation || previous?.pronunciation, 160);
    return base;
  }
  async function upsert(record, save) {
    const encounters = await getEncounters();
    const id = makeId(record);
    const index = encounters.findIndex(item => item.id === id);
    const normalized = normalizeRecord(record, index >= 0 ? encounters[index] : null, save);
    if (index >= 0) encounters[index] = normalized;
    else encounters.unshift(normalized);
    await write({ encounters: encounters.slice(0, 1500) });
    return normalized;
  }
  const recordEncounter = record => serial(() => upsert(record, false));
  const saveWord = record => serial(() => upsert(record, true));
  async function getFeedback() {
    const { feedback } = await read(["feedback"]);
    return Array.isArray(feedback) ? feedback : [];
  }
  async function applyFeedback(recordOrId, inputSignal) {
    const aliases = { "already-known": "known", "Already known": "known", "too-difficult": "hard", "too-easy": "easy", "just-right": "suitable", good: "suitable", "translation-error": "error", "reveal-only": "reveal" };
    const signal = aliases[inputSignal] || inputSignal;
    if (!["known", "hard", "easy", "suitable", "reveal", "error"].includes(signal)) throw new Error("Unknown feedback signal.");
    return serial(async () => {
      if (typeof recordOrId !== "string") await upsert(recordOrId, false);
      const id = typeof recordOrId === "string" ? recordOrId : makeId(recordOrId);
      const encounters = await getEncounters();
      const record = encounters.find(item => item.id === id);
      if (!record) return null;
      record.lastFeedback = signal;
      record.lastFeedbackAt = Date.now();
      if (signal === "known") record.known = true;
      if (signal === "error") { record.blocked = true; record.blockedReason = "Reported translation error"; }
      if (signal === "hard") { record.difficult = true; record.easy = false; record.hardCount += 1; }
      if (signal === "easy") { record.easy = true; record.difficult = false; }
      if (signal === "suitable") { record.difficult = false; record.easy = false; }
      const feedback = await getFeedback();
      feedback.push({ id, signal, at: record.lastFeedbackAt });
      const payload = { encounters, feedback: feedback.slice(-1000) };
      const settings = await getSettings();
      if (signal === "hard" && !settings.densityLocked && feedback.slice(-6).filter(event => event.signal === "hard").length >= 2) {
        settings.adaptiveDensity = Math.max(1, Math.min(settings.density, settings.adaptiveDensity) - 1);
        payload.settings = settings;
      }
      await write(payload);
      return record;
    });
  }
  async function gradeEncounter(id, inputGrade) {
    const grade = ["good", "suitable", "just-right", "correct"].includes(inputGrade) ? "good" : inputGrade;
    if (!["hard", "easy", "good"].includes(grade)) throw new Error("Choose hard, good or easy for a review.");
    return serial(async () => {
      const encounters = await getEncounters();
      const record = encounters.find(item => item.id === id);
      if (!record || !record.saved || record.known || record.blocked) return null;
      if (grade === "hard") {
        record.repetitions = 0;
        record.intervalDays = 10 / 1440;
        record.easeFactor = Math.max(1.3, record.easeFactor - 0.2);
      } else {
        record.repetitions += 1;
        record.intervalDays = record.repetitions === 1 ? (grade === "easy" ? 3 : 1)
          : record.repetitions === 2 ? (grade === "easy" ? 6 : 3)
          : Math.max(4, Math.round(Math.max(1, record.intervalDays) * record.easeFactor));
        if (grade === "easy") record.easeFactor = Math.min(3.2, record.easeFactor + 0.1);
      }
      record.lastGrade = grade;
      record.lastReviewedAt = Date.now();
      record.dueAt = record.lastReviewedAt + record.intervalDays * DAY_MS;
      // Recall changes a review interval, never self-reported known status.
      await write({ encounters });
      return record;
    });
  }
  async function getGrammarProgress() {
    const { grammarProgress } = await read(["grammarProgress"]);
    return grammarProgress && typeof grammarProgress === "object" && !Array.isArray(grammarProgress) ? grammarProgress : {};
  }
  async function saveGrammarProgress(patch) {
    return serial(async () => {
      const progress = { ...(await getGrammarProgress()), ...(patch || {}) };
      await write({ grammarProgress: progress });
      return progress;
    });
  }
  async function seedDemoDeck(language, sourceLanguage) {
    const settings = await getSettings();
    const target = language || settings.targetLanguage;
    const source = sourceLanguage || settings.sourceLanguage;
    const entries = (root.LINGO_VOCABULARY || []).filter(item => item.sourceLanguage === source && item.targetLanguage === target).slice(0, 6);
    const existing = new Set((await getEncounters()).map(item => item.id));
    for (const item of entries) {
      if (existing.has(makeId(item))) continue;
      await saveWord({ ...item, language: target, context: item.demoContext || item.example, explanation: item.meaning, demoSeed: true });
    }
    return getEncounters();
  }
  async function resetLearningData() {
    return serial(() => write({ encounters: [], feedback: [], grammarProgress: {} }));
  }
  function computeStats(encounters = []) {
    const saved = encounters.filter(item => item.saved);
    const available = saved.filter(item => !item.known && !item.blocked);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return {
      total: saved.length, saved: saved.length, encountered: encounters.length,
      due: available.filter(item => (item.dueAt || 0) <= Date.now()).length,
      known: encounters.filter(item => item.known).length,
      mastered: encounters.filter(item => item.known).length,
      reviewed: saved.filter(item => item.lastReviewedAt).length,
      blocked: encounters.filter(item => item.blocked).length,
      today: encounters.filter(item => item.lastSeenAt >= today.getTime()).length
    };
  }
  function formatDue(timestamp) {
    if (!timestamp) return "Not scheduled";
    const delta = timestamp - Date.now();
    if (delta <= 0) return "Ready now";
    if (delta < 3600000) return `In ${Math.ceil(delta / 60000)} min`;
    if (delta < DAY_MS) return `In ${Math.ceil(delta / 3600000)} hr`;
    const days = Math.ceil(delta / DAY_MS);
    return `In ${days} day${days === 1 ? "" : "s"}`;
  }
  function subscribe(callback) {
    if (storage && chrome.storage.onChanged) {
      const listener = (changes, area) => { if (area === "local") callback(changes); };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
    listeners.add(callback);
    const listener = event => { if (event.key?.startsWith("lingosprout:v4:")) callback({ [event.key.slice(14)]: { newValue: event.newValue ? JSON.parse(event.newValue) : null } }); };
    if (root.addEventListener) root.addEventListener("storage", listener);
    return () => { listeners.delete(callback); if (root.removeEventListener) root.removeEventListener("storage", listener); };
  }
  root.LingoStore = { DEFAULT_SETTINGS, getSettings, saveSettings, makeId, getEncounters, recordEncounter, saveWord, applyFeedback, getFeedback, gradeEncounter, getGrammarProgress, saveGrammarProgress, seedDemoDeck, resetLearningData, computeStats, formatDue, subscribe };
})(typeof window !== "undefined" ? window : globalThis);
