const $ = id => document.getElementById(id), clamp = (n, min = 1, max = 7) => Math.max(min, Math.min(max, Number(n) || min));

const SETUP_KEYS = [
  'preloadFront','oilFront','springFront','compFront','extFront',
  'preloadRear','springRear','compRear','extRear','swingarm',
  'g1','g2','g3','g4','g5','g6','final','antiDribble',
  'tcs','aw','ebs','frontRideHeight','rearRideHeight','trail','offset',
  'frontTyre','rearTyre','frontBrake','rearBrake'
];

const LABELS = {
  preloadFront:'Précharge avant', oilFront:'Quantité d’huile avant', springFront:'Dureté ressort avant', compFront:'Compression fourche avant', extFront:'Extension fourche avant',
  preloadRear:'Précharge arrière', springRear:'Dureté ressort arrière', compRear:'Compression mono arrière', extRear:'Extension mono arrière', swingarm:'Bras oscillant arrière / connecteur',
  g1:'1ère vitesse', g2:'2ème vitesse', g3:'3ème vitesse', g4:'4ème vitesse', g5:'5ème vitesse', g6:'6ème vitesse', final:'Rapport final', antiDribble:'Anti-dribble / Engine Brake Slip',
  tcs:'TCS (antipatinage)', aw:'Anti-wheelie', ebs:'EBS (frein moteur)',
  frontRideHeight:'Hauteur avant', rearRideHeight:'Hauteur arrière', trail:'Chasse', offset:'Déport'
};

const base = () => ({
  preloadFront:4, oilFront:4, springFront:4, compFront:4, extFront:4,
  preloadRear:4, springRear:4, compRear:4, extRear:4, swingarm:4,
  g1:4, g2:4, g3:4, g4:4, g5:4, g6:4, final:4, antiDribble:4,
  tcs:3, aw:3, ebs:3,
  frontRideHeight:4, rearRideHeight:4, trail:4, offset:4,
  frontTyre:'Medium', rearTyre:'Soft', frontBrake:'340 mm (standard)', rearBrake:'220 mm (standard)'
});

let state = JSON.parse(localStorage.getItem('vmv_setup_v4') || 'null') || {generated:null, published:[], history:[], fingerprints:[], versions:0};
state.manualSetup = {...base(), ...(state.manualSetup || {})};

function save() { localStorage.setItem('vmv_setup_v4', JSON.stringify(state)); renderAll(); }
function persistState() { localStorage.setItem('vmv_setup_v4', JSON.stringify(state)); }
function ctx() { return { game:$('game').value, bike:$('bike').value, track:$('track').value, weather:$('weather').value, phase:$('phase').value, problem:$('problem').value, comment:$('comment').value.trim() }; }
function escHTML(v) { return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function selectOptions(id, selected) { const el = $(id); return el ? Array.from(el.options).map(o => `<option value="${escHTML(o.value)}" ${o.value === selected ? 'selected' : ''}>${escHTML(o.textContent)}</option>`).join('') : ''; }

function renderContext() {
  const c = ctx();
  const coachCtx = $('coachContext');
  if(!coachCtx) return;
  coachCtx.innerHTML = `
    <div class="context-note">🔧 <b>Tu peux modifier directement le contexte ici.</b> Les changements sont utilisés par le diagnostic et le Coach Expert.</div>
    <div class="coach-controls">
      <div class="coach-field"><label>Jeu</label><select id="coachGame">${selectOptions('game', c.game)}</select></div>
      <div class="coach-field"><label>Moto</label><select id="coachBike">${selectOptions('bike', c.bike)}</select></div>
      <div class="coach-field"><label>🏁 Circuit</label><select id="coachTrack">${selectOptions('track', c.track)}</select></div>
      <div class="coach-field"><label>☁ Météo</label><select id="coachWeather">${selectOptions('weather', c.weather)}</select></div>
      <div class="coach-field"><label>🎯 Phase</label><select id="coachPhase">${selectOptions('phase', c.phase)}</select></div>
      <div class="coach-field"><label>⚠ Problème</label><select id="coachProblem">${selectOptions('problem', c.problem)}</select></div>
      <div class="coach-field full"><label>📝 Commentaire</label><textarea id="coachComment" rows="3">${escHTML(c.comment)}</textarea></div>
    </div>`;
  ['game','bike','track','weather','phase','problem'].forEach(id => {
    const coachId = 'coach' + id.charAt(0).toUpperCase() + id.slice(1);
    const el = $(coachId);
    if(el) el.addEventListener('change', () => { $(id).value = el.value; renderContext(); });
  });
  const cComm = $('coachComment');
  if(cComm) cComm.addEventListener('input', () => { $('comment').value = cComm.value; });
}

const MANUAL_GROUPS = [
  ['Pneumatiques', [['frontTyre','Pneu avant',['Soft','Medium','Hard','Wet']],['rearTyre','Pneu arrière',['Soft','Medium','Hard','Wet']]]],
  ['Suspension Avant', [['preloadFront',LABELS.preloadFront],['oilFront',LABELS.oilFront],['springFront',LABELS.springFront],['compFront',LABELS.compFront],['extFront',LABELS.extFront]]],
  ['Suspension Arrière', [['preloadRear',LABELS.preloadRear],['springRear',LABELS.springRear],['compRear',LABELS.compRear],['extRear',LABELS.extRear],['swingarm',LABELS.swingarm]]],
  ['Boîte de Vitesse', [['g1',LABELS.g1],['g2',LABELS.g2],['g3',LABELS.g3],['g4',LABELS.g4],['g5',LABELS.g5],['g6',LABELS.g6],['final',LABELS.final],['antiDribble',LABELS.antiDribble]]],
  ['Freins & Électronique', [['frontBrake','Disque avant',['320 mm','330 mm','340 mm (standard)','350 mm']],['rearBrake','Disque arrière',['190 mm','200 mm','220 mm (standard)']],['tcs',LABELS.tcs],['aw',LABELS.aw],['ebs',LABELS.ebs]]],
  ['Géométrie', [['frontRideHeight',LABELS.frontRideHeight],['rearRideHeight',LABELS.rearRideHeight],['trail',LABELS.trail],['offset',LABELS.offset]]]
];

function valueOptions(selected) { return Array.from({length:7}, (_, i) => { const v = i + 1; return `<option value="${v}" ${Number(selected) === v ? 'selected' : ''}>${v}</option>`; }).join(''); }
function manualField(item) {
  const [key, label, opts] = item;
  let html = Array.isArray(opts) ? `<select data-manual="${key}">${opts.map(v => `<option value="${escHTML(v)}" ${String(state.manualSetup[key]) === String(v) ? 'selected' : ''}>${escHTML(v)}</option>`).join('')}</select>` : `<select data-manual="${key}">${valueOptions(state.manualSetup[key])}</select>`;
  return `<div class="manual-row"><label>${label}</label>${html}</div>`;
}

function renderManualSetup() {
  const el = $('manualSetup');
  if (!el) return;
  el.innerHTML = `<div class="manual-groups">${MANUAL_GROUPS.map(([title, rows]) => `<div class="manual-group"><h3>${title}</h3>${rows.map(manualField).join('')}</div>`).join('')}</div>`;
  el.querySelectorAll('[data-manual]').forEach(sel => sel.addEventListener('change', () => {
    const k = sel.dataset.manual;
    state.manualSetup[k] = ['frontTyre','rearTyre','frontBrake','rearBrake'].includes(k) ? sel.value : Number(sel.value);
    persistState();
  }));
}

function publishSetup(setup, source = 'saisie', contextOverride = null) {
  const c = contextOverride || ctx();
  const complete = {...base(), ...setup};
  state.published.unshift({id: Date.now(), author: 'Jérémy #83', date: new Date().toLocaleString('fr-FR'), context: c, setup: complete, rating: 5, source});
  persistState();
  renderPublished();
  renderStats();
  showPage('setups');
}

function publishManualSetup() { publishSetup(state.manualSetup, 'saisie manuelle'); }
function apply(s, key, d, reason, changes) { let before = s[key]; s[key] = clamp(before + d); if (s[key] !== before) changes.push({key, before, after: s[key], reason}); }
function fingerprint(s) { return SETUP_KEYS.map(k => s[k]).join('-'); }

function diagnose(startSetup = null) {
  const c = ctx(), changes = [], s = {...base(), ...(startSetup || {})};
  let main = `Analyse basée sur ${c.problem} en phase de ${c.phase}.`, objective = `Optimiser le comportement général de la machine.`;
  if (c.problem === 'rear_lift') { apply(s,'swingarm',1,'Maintien du train arrière',changes); apply(s,'extRear',1,'Contrôle du mono',changes); apply(s,'ebs',-1,'Moins de frein moteur',changes); }
  else if (c.problem === 'understeer') { apply(s,'trail',-1,'Vivacité directionnelle',changes); apply(s,'offset',-1,'Réduire l\'inertie',changes); }
  else { apply(s,'compFront',-1,'Assouplir l\'avant',changes); apply(s,'compRear',1,'Soutien arrière',changes); }
  return {context: c, setup: s, main, objective, changes};
}

function ensureDifferent(s) {
  let fp = fingerprint(s);
  if (state.fingerprints.includes(fp)) {
    for (let k of ['swingarm','trail','compRear','extRear','tcs']) {
      s[k] = clamp(s[k] + 1);
      if (!state.fingerprints.includes(fingerprint(s))) return;
    }
  }
}

function setupHTML(s) {
  const groups = [
    ['Pneumatiques', [['Pneu avant', s.frontTyre || 'Medium'], ['Pneu arrière', s.rearTyre || 'Soft']]],
    ['Suspension Avant', SETUP_KEYS.slice(0, 5).map(k => [LABELS[k], s[k]])],
    ['Suspension Arrière', SETUP_KEYS.slice(5, 10).map(k => [LABELS[k], s[k]])],
    ['Boîte de Vitesse', SETUP_KEYS.slice(10, 17).map(k => [LABELS[k], s[k]]).concat([[LABELS.antiDribble, s.antiDribble]])],
    ['Freins & Électronique', [['Disque avant', s.frontBrake || '340 mm (standard)'], ['Disque arrière', s.rearBrake || '220 mm (standard)'], [LABELS.tcs, s.tcs], [LABELS.aw, s.aw], [LABELS.ebs, s.ebs]]],
    ['Géométrie', SETUP_KEYS.slice(21, 25).map(k => [LABELS[k], s[k]])]
  ];
  return `<div class="result-grid">${groups.map(([title, rows]) => `<div class="setup-block ${title.includes('Arrière') ? 'rear' : ''}"><h3>${title}</h3>${rows.map(([l, v]) => `<div class="value-row ${l.includes('Bras oscillant') ? 'highlight' : ''}"><span>${l}</span><span class="value">${v}</span></div>`).join('')}</div>`).join('')}</div>`;
}

function renderDiagnostic(d) {
  const diagCard = $('diagnosticCard');
  if(!diagCard) return;
  diagCard.innerHTML = `<div class="diag-head">⚙ DIAGNOSTIC MÉCANIQUE</div><div class="warning" style="margin-top:10px">⚠ Problème principal</div><p>${d.main}</p><div class="diag-box"><div class="warning">🔧 Ajustements recommandés</div>${d.changes.map(x => `<div class="change"><span>${LABELS[x.key]} <small class="muted">(${x.reason})</small></span><span class="${x.after > x.before ? 'up' : 'down'}">${x.after > x.before ? '+' : '-'}${Math.abs(x.after - x.before)}</span></div>`).join('')}</div>`;
}

function generate() {
  let d = diagnose(state.manualSetup), s = {...d.setup};
  ensureDifferent(s);
  state.generated = {setup: s, context: d.context, diagnostic: d};
  state.versions++;
  state.history.push({date: new Date().toLocaleString('fr-FR'), type: 'génération', problem: d.context.problem, changes: d.changes.map(x => `${LABELS[x.key]} ${x.before}→${x.after}`)});
  save();
  renderDiagnostic(d);
  renderExpert();
  if($('sessionBox'))$('sessionBox').style.display = 'block';
  if($('expertResult'))$('expertResult').scrollIntoView({behavior: 'smooth'});
}

function renderExpert() {
  const expRes = $('expertResult');
  if (!state.generated) { if(expRes) expRes.innerHTML = '<div class="empty">Aucun setup calculé pour le moment.</div>'; return; }
  let g = state.generated.setup, c = state.generated.context;
  expRes.innerHTML = `<h2>🧠 SETUP EXPERT GÉNÉRÉ</h2><p class="muted">${c.track} · ${c.weather} · ${c.bike}</p>${setupHTML(g)}<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn green" id="publishBtn">👍 Valider / Publier ce setup</button><button class="btn secondary" id="newVersionBtn">↻ Refuser</button></div>`;
  $('publishBtn').onclick = () => publishSetup(state.generated.setup, 'Coach IA', state.generated.context);$('newVersionBtn').onclick = generate;
}

function renderPublished() {
  const pubList = $('publishedList');
  if (!pubList) return;
  let a = state.published;
  if (!a.length) { pubList.innerHTML = '<div class="empty">Aucun setup publié.</div>'; return; }
  pubList.innerHTML = a.map(p => `<div class="card setup-card"><div class="pill">${p.context.bike}</div><h3>${p.context.track}</h3><p class="muted">${p.context.weather} · ${p.context.phase} · ${p.date}</p><div class="badge">✓ Setup complet à 100% · Bras oscillant inclus</div><div style="margin-top:10px">${setupHTML(p.setup).replace('result-grid','published-grid')}</div></div>`).join('');
}

function renderHistory() {
  const hist = $('history');
  if(!hist) return;
  let h = state.history.slice().reverse();
  hist.innerHTML = h.length ? h.map(x => `<div class="history-item"><b>${x.type}</b> · ${x.date}<br><span class="muted">${x.problem || ''}</span><br><small>${(x.changes || []).join(' · ')}</small></div>`).join('') : '<div class="empty">Aucun run enregistré.</div>';
}

function renderStats() {
  if($('statSetups'))$('statSetups').textContent = state.published.length;
  if($('statRuns'))$('statRuns').textContent = state.history.length;
  if($('statVersions'))$('statVersions').textContent = state.versions;
}

function renderAll() {
  renderContext();
  renderManualSetup();
  renderPublished();
  renderHistory();
  renderStats();
  if (state.generated) { renderExpert(); renderDiagnostic(state.generated.diagnostic); }
}

function showPage(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === id));
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.page === id));
  if (id === 'coach') renderAll();
}

// Gestion des clics sur les onglets (Correction de la correspondance des data-page avec les id des sections)
document.querySelectorAll('.tabs button').forEach(b => {
  b.onclick = () => showPage(b.dataset.page);
});

const goCoachBtn = $('goCoach');
if(goCoachBtn) goCoachBtn.onclick = () => showPage('coach');

['game','bike','track','weather','phase','problem'].forEach(id => {
  const el = $(id);
  if(el) el.addEventListener('change', renderContext);
});

const comm = $('comment');
if(comm) comm.addEventListener('input', renderContext);

const diagBtn = $('diagnoseBtn');
if(diagBtn) diagBtn.onclick = () => renderDiagnostic(diagnose(state.manualSetup));

const genBtn = $('generateBtn');
if(genBtn) genBtn.onclick = generate;

const pubManBtn = $('publishManualBtn');
if(pubManBtn) pubManBtn.onclick = publishManualSetup;

const resManBtn = $('resetManualBtn');
if(resManBtn) resManBtn.onclick = () => { state.manualSetup = base(); persistState(); renderManualSetup(); };

const useGenBtn = $('useGeneratedBtn');
if(useGenBtn) useGenBtn.onclick = () => {
  if (!state.generated) return alert('Aucun setup Coach IA à reprendre.');
  state.manualSetup = {...base(), ...state.generated.setup};
  persistState();
  renderManualSetup();
};

const nextRunBtn = $('nextRunBtn');
if(nextRunBtn) {
  nextRunBtn.onclick = () => {
    if (!state.generated) return;
    let s = {...state.generated.setup}, changes = [];
    ensureDifferent(s);
    state.generated.setup = s;
    state.versions++;
    state.history.push({date: new Date().toLocaleString('fr-FR'), type: 'évolution V' + state.versions, problem: state.generated.context.problem, changes: ['Ajustement post-run']});
    save();
    renderExpert();
  };
}

renderAll();
