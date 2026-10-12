(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const engine = window.__LINGOSPROUT_INSTANCE__;
  const original = $('article-body').innerHTML;
  const originals = { title: $('article-title').innerHTML, deck: $('article-deck').textContent };
  const empty = $('word-card').innerHTML;
  const samples = {
    'sk-en': {title:'Malé projekty,<br>silnejšia komunita.',deck:'Spoločné miesto môže spojiť ľudí, nápady a nové príležitosti.',paragraphs:['Miestna komunita vytvorila nový projekt. Tento projekt podporuje učenie.','Naše mesto má novú knižnicu. Budúcnosť závisí od spolupráce.','Ľudia získavajú praktické zručnosti.']},
    'th-zh': {title:'โครงการเล็ก ๆ<br>ชุมชนที่เข้มแข็ง',deck:'พื้นที่เล็ก ๆ ที่เชื่อมโยงผู้คน ความคิด และโอกาสใหม่ ๆ',paragraphs:['ชุมชนของเรามีพื้นที่สำหรับการเรียนรู้','การเรียนรู้เปิดโอกาสใหม่ ทุกคนมีโอกาสเรียนรู้','เราฝึกทักษะใหม่ร่วมกัน อนาคตเริ่มต้นจากวันนี้','เราควรเคารพความเป็นส่วนตัว']}
  };
  let active = false;
  function setArticle(pair) {
    engine.disable(); active = false; resetCard();
    if (pair === 'en-zh') { $('article-title').innerHTML = originals.title; $('article-deck').textContent = originals.deck; $('article-body').innerHTML = original; }
    else { const article = samples[pair]; $('article-title').innerHTML = article.title; $('article-deck').textContent = article.deck; $('article-body').replaceChildren(...article.paragraphs.map(text => { const p = document.createElement('p'); p.textContent = text; return p; })); }
    $('article-body').lang = pair.split('-')[0];
  }
  function resetCard() { $('word-card').className='empty-word'; $('word-card').innerHTML=empty; }
  async function paintSettings() {
    const settings = await LingoStore.getSettings();
    $('pair').value = `${settings.sourceLanguage}-${settings.targetLanguage}`;
    if (!$('pair').value) $('pair').value='en-zh';
    $('level').value = settings.level; $('goal').value = settings.goal;
    $('density').value = String(settings.density);
    if (!$('density').value) {const option=document.createElement('option');option.value=settings.density;option.textContent=`Up to ${settings.density}`;$('density').append(option);$('density').value=String(settings.density);}
    $('density-lock').checked = settings.densityLocked;
    $('mode-badge').textContent = settings.mode === 'live' ? 'Live AI · opt-in' : 'Demo examples';
    $('mode-note').textContent = settings.mode === 'live' ? 'Live AI is on. On activation, selected article sentences and your minimal learning profile go to the configured model provider.' : 'Demo mode uses curated examples. No page text leaves this device.';
  }
  async function preferences(event) {
    const [sourceLanguage,targetLanguage] = $('pair').value.split('-');
    const patch = {sourceLanguage,targetLanguage,level:$('level').value,goal:$('goal').value,densityLocked:$('density-lock').checked};
    if(event.target.id==='density')patch.density=Number($('density').value);
    await LingoStore.saveSettings(patch);
    if(event.target.id==='pair')setArticle($('pair').value);
    else if(active)await engine.refresh();
  }
  for(const id of ['pair','level','goal','density','density-lock'])$(id).addEventListener('change',preferences);
  $('activate').addEventListener('click',async()=>{active=true;await engine.activate();});
  $('restore').addEventListener('click',()=>{engine.disable();active=false;resetCard();});
  document.addEventListener('lingosprout:status',event=>{
    const d=event.detail; $('activate').disabled=d.phase==='loading'; $('restore').disabled=!active;
    if(d.phase==='loading') { $('reading-status').textContent='Finding useful words for this context…'; $('activate').textContent='Selecting…'; }
    else if(d.phase==='ready') { $('activate').textContent='Refresh selection'; $('reading-status').textContent=`${d.count} words selected · ${d.mode==='live'?'Live AI':'Curated demo'} · ${Math.round(d.totalMs)} ms`; }
    else if(d.phase==='error') { $('reading-status').textContent=d.message; $('activate').textContent='Try again'; }
    else if(d.phase==='paused') { $('reading-status').textContent='Original text restored. Activate this article to begin again.'; $('activate').textContent='Start learning'; $('restore').disabled=true; }
    else if(d.phase==='saved') $('reading-status').textContent='Saved with this sentence. Your review card is ready in My learning space.';
    else if(d.phase==='feedback') $('reading-status').textContent=d.signal==='error'?'Error recorded. This word sense is paused pending review.':'Feedback saved. Future selection will respect it.';
  });
  paintSettings().then(()=>{setArticle($('pair').value);$('reading-status').textContent='Activate this article to begin. You choose when learning starts.';});
})();
