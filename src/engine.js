(function (root) {
  "use strict";
  const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const PAIRS = ["en:zh", "sk:en", "th:zh"];
  const now = () => typeof performance !== "undefined" ? performance.now() : Date.now();
  const norm = text => String(text || "").normalize("NFKC").trim().toLocaleLowerCase();
  const textField = (text, max) => typeof text === "string" ? text.trim().slice(0, max) : "";
  function cap(settings) {
    const maximum = Math.min(10, Math.max(1, Math.floor(Number(settings.density) || 6)));
    return settings.densityLocked === false ? Math.min(maximum, Math.max(1, Math.floor(Number(settings.adaptiveDensity) || maximum))) : maximum;
  }
  function normalizeSentences(input) {
    if (!Array.isArray(input)) throw new Error("Provide numbered sentences.");
    const ids = new Set();
    let total = 0;
    return input.slice(0, 50).filter(item => {
      if (!item || !["string", "number"].includes(typeof item.id) || typeof item.text !== "string" || !item.text.trim()) return false;
      if (ids.has(String(item.id))) throw new Error("Sentence identifiers must be unique.");
      ids.add(String(item.id));
      total += item.text.length;
      if (item.text.length > 2000 || total > 20000) throw new Error("Select a shorter article section (20,000 characters maximum).");
      return true;
    }).map(item => ({ id: item.id, text: item.text }));
  }
  function compactProfile(profile, settings) {
    return (Array.isArray(profile) ? profile : []).filter(item => item && item.language === settings.targetLanguage && (item.sourceLanguage || "en") === settings.sourceLanguage)
      .slice(0, 100).map(item => ({
        source: textField(item.source, 80), target: textField(item.target, 100), sense: textField(item.sense, 80),
        language: item.language, sourceLanguage: item.sourceLanguage || "en", level: item.level,
        known: item.known === true, blocked: item.blocked === true, difficult: item.difficult === true,
        easy: item.easy === true, saved: item.saved === true, repetitions: Number(item.repetitions) || 0
      }));
  }
  function suppressed(candidate, profile, settings) {
    return profile.some(item => {
      if (!item || (!item.known && !item.blocked)) return false;
      if (item.language !== settings.targetLanguage || (item.sourceLanguage || "en") !== settings.sourceLanguage) return false;
      return norm(item.sense) === norm(candidate.sense) && (norm(item.source) === norm(candidate.source) || norm(item.target) === norm(candidate.target));
    });
  }
  function sameWord(a, b) { return norm(a.sense) === norm(b.sense) && (norm(a.source) === norm(b.source) || norm(a.target) === norm(b.target)); }
  function protectedSpan(sentence, start, end, settings) {
    const before = sentence.slice(0, start);
    const source = sentence.slice(start, end);
    if (settings.sourceLanguage !== "th") {
      if (/[\p{L}\p{M}\p{N}_]$/u.test(before) || /^[\p{L}\p{M}\p{N}_]/u.test(sentence.slice(end))) return true;
      // Mid-sentence capitalized terms may be names. Conservative prototype exclusion.
      if (/^[A-ZÀ-Ý]/u.test(source) && before.trim() && !/[.!?]\s*$/u.test(before)) return true;
    }
    return /[@<>\n\r]|https?:/i.test(source) || /^(the|a|an|and|or|but|to|of|in|on|at|is|are|was|were|it)$/i.test(source);
  }
  function validateCandidates(raw, inputSentences, settings, inputProfile = []) {
    const sentences = normalizeSentences(inputSentences);
    const lookup = new Map(sentences.map(item => [String(item.id), item]));
    const profile = Array.isArray(inputProfile) ? inputProfile : [];
    const proposed = Array.isArray(raw) ? raw : raw && Array.isArray(raw.candidates) ? raw.candidates : null;
    if (!proposed) throw new Error("The model response must contain a candidates array.");
    const candidates = [];
    const rejected = [];
    for (const item of proposed.slice(0, 100)) {
      const sentence = item && lookup.get(String(item.sentenceId));
      let reason = "";
      if (!sentence || !Number.isInteger(item.start) || !Number.isInteger(item.end) || item.start < 0 || item.end <= item.start || item.end > sentence.text.length) reason = "Invalid source span";
      else if (typeof item.source !== "string" || item.source !== sentence.text.slice(item.start, item.end)) reason = "Source text does not match the page";
      else if (!textField(item.target, 100) || !textField(item.sense, 80) || !LEVELS.includes(item.level) || item.source.length > 80 || item.target.length > 100) reason = "Missing or invalid candidate fields";
      else if (LEVELS.indexOf(item.level) > LEVELS.indexOf(settings.level || "B1")) reason = "Above the selected provisional level";
      else if (protectedSpan(sentence.text, item.start, item.end, settings)) reason = "Excluded source span";
      else if (suppressed(item, profile, settings)) reason = "Known or reported word sense";
      else if (candidates.some(other => String(other.sentenceId) === String(item.sentenceId) && item.start < other.end && item.end > other.start)) reason = "Overlapping span";
      else if (candidates.some(other => sameWord(other, item))) reason = "Repeated word sense";
      else if (candidates.length >= cap(settings)) reason = "Replacement cap";
      if (reason) { rejected.push({ reason }); continue; }
      candidates.push({
        sentenceId: sentence.id, source: item.source, start: item.start, end: item.end,
        target: textField(item.target, 100), sense: textField(item.sense, 80), level: item.level,
        meaning: textField(item.meaning || item.explanation, 500), reason: textField(item.reason, 300),
        pronunciation: textField(item.pronunciation, 160), example: textField(item.example, 400),
        sourceLanguage: settings.sourceLanguage, language: settings.targetLanguage,
        targetLanguage: settings.targetLanguage
      });
    }
    return { candidates, rejected };
  }
  function bankSense(text, start) {
    const before = text.slice(Math.max(0, start - 45), start).toLowerCase();
    const after = text.slice(start + 4, start + 75).toLowerCase();
    if (/(river|stream|canal)\s+$/.test(before) || /^\s+of (?:the )?(river|stream|canal)/.test(after)) return "river-edge";
    const local = before + " bank " + after;
    if (/\b(loan|money|account|financial|credit|approved|lend|deposit)\b/.test(local)) return "financial-institution";
    if (/\b(river|stream|water|bridge|shore|fishing)\b/.test(local)) return "river-edge";
    return null;
  }
  function offlineCandidates(sentences, settings, profile) {
    const level = LEVELS.indexOf(settings.level || "B1");
    const relevant = compactProfile(profile, settings);
    const hard = relevant.filter(item => item.difficult).length;
    const easy = relevant.filter(item => item.easy).length;
    const pool = [];
    for (const entry of root.LINGO_VOCABULARY || []) {
      if (entry.sourceLanguage !== settings.sourceLanguage || entry.targetLanguage !== settings.targetLanguage || LEVELS.indexOf(entry.level) > level) continue;
      for (const sentence of sentences) {
        let start = 0;
        const lower = sentence.text.toLocaleLowerCase();
        const needle = entry.source.toLocaleLowerCase();
        while ((start = lower.indexOf(needle, start)) >= 0) {
          const end = start + entry.source.length;
          const source = sentence.text.slice(start, end);
          if (!protectedSpan(sentence.text, start, end, settings) && (entry.source !== "bank" || bankSense(sentence.text, start) === entry.sense)) {
            const candidate = { ...entry, source, start, end, sentenceId: sentence.id,
              reason: `Curated demo: ${entry.source === "bank" ? "sentence cues distinguish this sense" : "level and goal rules select this item"}; no model inference.` };
            if (!suppressed(candidate, relevant, settings)) {
              const history = relevant.find(item => sameWord(item, candidate));
              candidate.score = entry.priority + (entry.goals.includes(settings.goal) ? 12 : 0) + LEVELS.indexOf(entry.level) * (hard > easy ? -12 : easy ? 9 : 3) - (history?.difficult ? 25 : 0);
              pool.push(candidate);
            }
          }
          start = end;
        }
      }
    }
    // Limit repeated concentration in one sentence while preserving ranked usefulness.
    const selected = [], perSentence = new Map();
    while (pool.length && selected.length < cap(settings)) {
      pool.sort((a, b) => (b.score - (perSentence.get(String(b.sentenceId)) || 0) * 20) - (a.score - (perSentence.get(String(a.sentenceId)) || 0) * 20));
      const next = pool.shift();
      if (selected.some(item => sameWord(item, next))) continue;
      selected.push(next);
      perSentence.set(String(next.sentenceId), (perSentence.get(String(next.sentenceId)) || 0) + 1);
    }
    return selected;
  }
  async function request(path, payload, settings) {
    const url = new URL(settings.gatewayUrl || "http://127.0.0.1:8765");
    if (url.origin !== "http://127.0.0.1:8765" || url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) throw new Error("Use the local gateway at http://127.0.0.1:8765.");
    if (typeof chrome !== "undefined" && chrome.runtime?.id && chrome.runtime.sendMessage) {
      const response = await chrome.runtime.sendMessage({ type: "LINGOSPROUT_GATEWAY", path, payload, gatewayUrl: url.origin });
      if (!response?.ok) throw new Error(response?.error || "The local AI gateway could not be reached.");
      return response.data;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(url.origin + path, { method: "POST", headers: { "Content-Type": "application/json", "X-LingoSprout-Client": "v4" }, body: JSON.stringify(payload), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The local gateway rejected this request.");
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("The AI request timed out. The page has not been changed.");
      throw error;
    } finally { clearTimeout(timeout); }
  }
  function requestSettings(settings) {
    return { sourceLanguage: settings.sourceLanguage, targetLanguage: settings.targetLanguage, level: settings.level || "B1", goal: settings.goal || "career", density: cap(settings), densityLocked: true };
  }
  async function select(inputSentences, settings, profile = []) {
    const started = now();
    const sentences = normalizeSentences(inputSentences);
    if (!PAIRS.includes(`${settings.sourceLanguage}:${settings.targetLanguage}`)) throw new Error("This prototype supports English → Chinese, Slovak → English and Thai → Chinese.");
    const mode = settings.mode === "live" ? "live" : "demo";
    let raw;
    if (mode === "live") {
      const response = await request("/select", { sentences, settings: requestSettings(settings), profile: compactProfile(profile, settings) }, settings);
      if (response.mode !== "live") throw new Error("The gateway did not identify a live-model response.");
      raw = response;
    } else raw = offlineCandidates(sentences, settings, profile);
    const validated = validateCandidates(raw, sentences, settings, profile);
    return { ...validated, mode, latencyMs: Math.round(now() - started) };
  }
  async function chat(messages, settings, profile = []) {
    const started = now();
    const cleaned = (Array.isArray(messages) ? messages : []).filter(item => ["user", "assistant"].includes(item.role) && typeof item.content === "string")
      .slice(-12).map(item => ({ role: item.role, content: item.content.slice(0, 1200) }));
    if (!cleaned.length || cleaned.at(-1).role !== "user") throw new Error("Write a message to begin practice.");
    const compact = compactProfile(profile, settings);
    if (settings.mode === "live") {
      const response = await request("/chat", { messages: cleaned, settings: requestSettings(settings), profile: compact }, settings);
      if (response.mode !== "live" || typeof response.reply !== "string" || !response.reply.trim()) throw new Error("The model returned no practice reply.");
      return { reply: response.reply.slice(0, 4000), mode: "live", latencyMs: Math.round(now() - started) };
    }
    const saved = compact.filter(item => item.saved && !item.known && !item.blocked);
    const index = cleaned.filter(item => item.role === "user").length - 1;
    const word = saved[index % (saved.length || 1)] || { target: settings.targetLanguage === "zh" ? "机会" : "opportunity", source: "opportunity" };
    const examples = (root.LINGO_VOCABULARY || []).find(item => item.target === word.target && item.targetLanguage === settings.targetLanguage);
    const example = examples?.example || (settings.targetLanguage === "zh" ? "这是一个学习的机会。" : "This is an opportunity to learn.");
    const prompts = settings.targetLanguage === "zh"
      ? [`Try a short sentence with ${word.target} (${word.source}). Example: ${example}`, `Add a person, place or time to a sentence using ${word.target}. Example: ${example}`, `Read your sentence aloud. Can you make a new sentence with ${word.target}? Example: ${example}`]
      : [`Try a short sentence with “${word.target}”. Example: ${example}`, `Add a person, place or time to a sentence using “${word.target}”. Example: ${example}`, `Read it aloud, then create another sentence with “${word.target}”. Example: ${example}`];
    return { reply: "Guided demo practice — a fixed prompt, not an AI assessment.\n\n" + prompts[index % prompts.length], mode: "demo", latencyMs: Math.round(now() - started) };
  }
  root.LingoEngine = { select, chat, validateCandidates, compactProfile, effectiveCap: cap, normalizeSentences };
})(typeof window !== "undefined" ? window : globalThis);
