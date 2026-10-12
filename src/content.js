(function () {
  'use strict';
  if (window.__LINGOSPROUT_INSTANCE__) return;
  const state = { active: false, generation: 0, cardToken: 0, selected: [], popup: null, settings: null, busy: false };
  const demo = document.documentElement.dataset.lingosproutDemo === 'true';
  const ignore = 'script,style,noscript,input,textarea,select,button,nav,header,footer,form,a,code,pre,svg,canvas,h1,h2,h3,[contenteditable],[aria-hidden="true"],[data-lingosprout-ignore],.lingosprout-word,.lingosprout-popover';
  function publish(detail) { document.dispatchEvent(new CustomEvent('lingosprout:status', { detail })); }
  function safePage() {
    if (demo) return true;
    if (!['http:', 'https:'].includes(location.protocol)) return false;
    if (document.querySelector('input[type="password"]')) return false;
    return !/(^|\.)(mail|webmail|banking|onlinebanking|chat)\.|\/(inbox|mail|messages|banking|login)(\/|$)/i.test(location.hostname + location.pathname);
  }
  function extract() {
    const root = document.querySelector('[data-reading-content],article,main,[role="main"]');
    if (!root) throw new Error('No article found. Open a public reading page or the demo article.');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode: n => n.nodeValue.trim() && !n.parentElement?.closest(ignore) && !n.parentElement?.isContentEditable && n.parentElement?.getClientRects().length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT});
    const segments = []; let current; let total = 0;
    const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(state.settings.sourceLanguage, { granularity: 'sentence' }) : null;
    while ((current = walker.nextNode()) && total < 12000) {
      const pieces = segmenter ? [...segmenter.segment(current.nodeValue)] : [{ segment: current.nodeValue, index: 0 }];
      for (const item of pieces) {
        if (!item.segment.trim() || item.segment.length < 12 || total + item.segment.length > 12000) continue;
        segments.push({ id: `s${segments.length + 1}`, text: item.segment, node:current, offset: item.index });total += item.segment.length;
      }
    }
    return segments;
  }
  function closeCard() { state.cardToken++;if(state.popup){if(!demo)state.popup.remove();else{state.popup.className='empty-word';state.popup.textContent='Select a highlighted word to explore its meaning.';}}state.popup = null; }
  function restore() {
    closeCard();const parents = new Set();document.querySelectorAll('.lingosprout-word').forEach(el => { parents.add(el.parentNode);el.replaceWith(document.createTextNode(el.dataset.original)); });parents.forEach(el => el?.normalize());state.selected = [];
  }
  async function refresh() {
    if (!state.active) return;
    const token = ++state.generation;restore();state.busy = true;publish({ phase: 'loading', count: 0 });
    try {
      state.settings = await LingoStore.getSettings();
      if (!safePage()) throw new Error('This page is excluded. Use a public article without private form content.');
      const start = performance.now();const segments = extract();const scanMs = performance.now() - start;
      const result = await LingoEngine.select(segments.map(({ id, text }) => ({ id, text })), state.settings, await LingoStore.getEncounters());
      if (token !== state.generation || !state.active) return;
      const byNode = new Map();
      for (const item of result.candidates.slice(0, Number(state.settings.density))) {
        const seg = segments.find(s => s.id === item.sentenceId);
        if (!seg || !seg.node.isConnected || seg.text.slice(item.start, item.end) !== item.source) continue;
        const candidate = { ...item, originMode: result.mode, context: seg.text.trim(), language: state.settings.targetLanguage, sourceLanguage: state.settings.sourceLanguage };candidate.id = LingoStore.makeId(candidate);
        const list = byNode.get(seg.node) || [];list.push({ candidate, start: seg.offset + item.start, end: seg.offset + item.end });byNode.set(seg.node, list);
      }
      byNode.forEach((list, textNode) => {
        const source = textNode.nodeValue;let cursor = 0;const f = document.createDocumentFragment();
        list.sort((a,b) => a.start - b.start).forEach(({ candidate, start, end }) => {
          if (start < cursor || source.slice(start,end) !== candidate.source) return;
          f.append(document.createTextNode(source.slice(cursor,start)));
          const span = document.createElement('span');span.className = 'lingosprout-word';span.textContent = candidate.target;span.tabIndex = 0;span.setAttribute('role','button');span.setAttribute('aria-label',`${candidate.target}: reveal meaning and give feedback`);span.dataset.original = candidate.source;span.dataset.id = candidate.id;span.__lingo = candidate;f.append(span);cursor = end;state.selected.push(candidate);
        });
        f.append(document.createTextNode(source.slice(cursor)));textNode.replaceWith(f);
      });
      publish({ phase:'ready', count:state.selected.length, mode:result.mode, scanMs, latencyMs:result.latencyMs, totalMs:performance.now()-start });
      return { ok:true, count:state.selected.length };
    } catch (error) { if (token === state.generation) publish({ phase:'error', message:error.message, count:0 }); return {ok:false,error:error.message}; }
    finally { if(token === state.generation) state.busy = false; }
  }
  async function activate() { state.active = true;return refresh(); }
  function disable() { state.active = false;state.generation++;restore();publish({phase:'paused',count:0}); }
  function node(tag, cls, text) { const el = document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el; }
  function button(text, cls, action) { const el=node('button',cls,text);el.type='button';el.addEventListener('click',action);return el; }
  function say(text, language) { if (!window.speechSynthesis) return false;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=language==='zh'?'zh-CN':language==='en'?'en-GB':language==='sk'?'sk-SK':'th-TH';u.rate=.83;speechSynthesis.speak(u);return true; }
  async function openCard(span) {
    closeCard();const cardToken=state.cardToken;const word=span.__lingo;await LingoStore.recordEncounter(word);
    if(cardToken!==state.cardToken||!state.active||!span.isConnected)return;
    const saved=(await LingoStore.getEncounters()).find(x=>x.id===word.id)?.saved;
    if(cardToken!==state.cardToken||!state.active||!span.isConnected)return;
    let card=demo?document.getElementById('word-card'):null;
    if (!card) { card=node('aside','lingosprout-popover');document.body.append(card); }
    card.textContent='';card.classList.remove('empty-word');card.classList.add('ls-card');card.setAttribute('aria-label','Vocabulary card');state.popup=card;
    const top=node('div','ls-card-top');top.append(node('span','ls-label','IN THIS SENTENCE'),button('×','ls-close',closeCard));card.append(top);
    const title=node('div','ls-word-title');title.append(node('h2','',word.target),button('Listen','ls-audio',()=>{if(!say(word.target,word.language))message.textContent='Pronunciation is unavailable in this browser.';}));card.append(title);
    card.append(node('p','ls-pronunciation',word.pronunciation||''));
    const source=node('div','ls-source');source.append(node('span','','Original'),node('strong','',word.source),node('span','ls-level',`${word.level} · estimated`));card.append(source);
    card.append(node('p','ls-meaning',word.meaning||word.explanation||word.sense));if(word.example)card.append(node('p','ls-example',word.example));
    card.append(node('p','ls-reason',word.reason||'Selected for this sentence and learning profile.'));
    const save=button(saved?'Saved to review ✓':'Save to review','ls-save',async()=>{await LingoStore.saveWord(word);save.textContent='Saved to review ✓';save.disabled=true;message.textContent='Word and source sentence saved to your local review deck.';publish({phase:'saved'});});save.disabled=!!saved;card.append(save);
    card.append(node('p','ls-feedback-title','Shape your next encounter'));const controls=node('div','ls-feedback-grid');
    [['Already known','known'],['Too difficult','hard'],['Suitable','suitable'],['Too easy','easy']].forEach(([label,signal])=>controls.append(button(label,'ls-feedback-button',async()=>{
      const updated=await LingoStore.applyFeedback(word,signal);
      const messages={known:'This meaning will be skipped on future pages. Other meanings remain eligible.',hard:'Difficulty noted. Future selection will favour easier vocabulary.',suitable:'Preference recorded for future selection.',easy:'Preference recorded for more challenging vocabulary.'};message.textContent=messages[signal];controls.querySelectorAll('button').forEach(b=>b.disabled=true);
      if(signal==='known') {const parent=span.parentNode;span.replaceWith(document.createTextNode(word.source));parent?.normalize();}publish({phase:'feedback',signal,id:updated?.id||word.id});
    })));
    card.append(controls);card.append(button('Report translation error','ls-report',async()=>{
      await LingoStore.applyFeedback(word,'error');document.querySelectorAll('.lingosprout-word').forEach(el=>{if(el.dataset.id===word.id)el.replaceWith(document.createTextNode(el.dataset.original));});message.textContent='Original restored. This replacement is suppressed pending review; the error label is retained.';controls.querySelectorAll('button').forEach(b=>b.disabled=true);save.disabled=true;publish({phase:'feedback',signal:'error',id:word.id});
    }));
    const message=node('p','ls-message','Revealing a word alone does not mark it as known.');message.setAttribute('role','status');card.append(message);
    if(!demo){card.setAttribute('role','dialog');const r=span.getBoundingClientRect();card.style.top=`${Math.max(12,Math.min(r.bottom+10,innerHeight-card.offsetHeight-12))}px`;card.style.left=`${Math.max(12,Math.min(r.left,innerWidth-370))}px`;}
  }
  document.addEventListener('click',event=>{const word=event.target.closest?.('.lingosprout-word');if(word){event.preventDefault();openCard(word).catch(e=>publish({phase:'error',message:e.message}));}else if(!demo&&state.popup&&!state.popup.contains(event.target))closeCard();});
  document.addEventListener('keydown',event=>{const word=event.target.closest?.('.lingosprout-word');if(word&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openCard(word);}if(event.key==='Escape')closeCard();});
  if(typeof chrome!=='undefined'&&chrome.runtime?.onMessage)chrome.runtime.onMessage.addListener((m,s,respond)=>{if(m?.type==='LINGO_ACTIVATE'||m?.type==='LINGO_REFRESH'){activate().then(result=>respond(result||{ok:false,error:'Activation cancelled.'}));return true;}if(m?.type==='LINGO_DISABLE'){disable();respond({ok:true});}});
  window.__LINGOSPROUT_INSTANCE__={activate,refresh,disable,getState:()=>({active:state.active,busy:state.busy,count:state.selected.length})};
})();
