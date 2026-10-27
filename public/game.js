'use strict';
// 오락실 튜토리얼이 '진짜로 일어난 일'을 알아채는 신호 (arcade/public/tutorial.js 가 듣는다. 튜토리얼이 아니면 아무도 안 듣는다)
const tutorialSignal = (type) => window.dispatchEvent(new CustomEvent('arcade:tutorial', { detail: { type } }));

// 맞고: 화면·입력·소리·온라인. 규칙과 컴퓨터는 logic.js (LOGIC_GOSTOP), 방·매칭은 server.js
(() => {
const L = LOGIC_GOSTOP;
const $ = (id) => document.getElementById(id);
const T = { cpu: 900, over: 1300 };                          // 시간(ms). 시험용으로 줄일 수 있다

// ---------- 카드 모양 ----------
// 그림은 cards.js (화투 48장 SVG). 카드 한 장은 그림 한 장이고, 눈이 아닌 사람을 위한 이름만 붙인다
function cd(id, cls = '') {
  const c = L.card(id);
  return `<div class="cd ${c.kind}${c.ssang ? ' ssang' : ''}${cls ? ' ' + cls : ''}" data-id="${id}" role="img" aria-label="${HWATU_ART.label(id)}">${HWATU_ART.use(id)}</div>`;
}
const back = () => '<div class="cd back"></div>';

// ---------- 저장소 ----------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
};
let wins = Number(store.get('gostopWins')) || 0;
const ONLINE_KEY = 'gostopOnline', SESSION_KEY = 'gostopSession';
const loadJson = (k) => { try { return JSON.parse(store.get(k)) || {}; } catch (_) { return {}; } };
function loadSession() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (_) { return null; } }
function saveSession(s) { try { s ? sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) : sessionStorage.removeItem(SESSION_KEY); } catch (_) {} }
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const myName = () => store.get('gostopName') || '';

// ---------- 소리 ----------
let audio = null;
let muted = store.get('gostopMuted') === '1';
function tone(freq, dur, type = 'sine', vol = 0.09, slide = 0) {
  if (muted) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + dur);
  } catch (_) {}
}
const seq = (notes, step, type = 'triangle', vol = 0.09) => notes.forEach((f, i) => setTimeout(() => tone(f, step * 0.0009, type, vol), i * step));
const sfx = {
  select: () => tone(560, 0.04, 'triangle', 0.06),
  play: () => tone(190, 0.07, 'square', 0.07),
  flip: () => tone(260, 0.06, 'triangle', 0.06, 120),
  take: () => seq([523, 659], 70, 'triangle', 0.08),
  special: () => seq([392, 523, 659, 784], 80, 'triangle', 0.1),
  go: () => seq([523, 784, 1047], 90, 'triangle', 0.1),
  stop: () => seq([523, 392], 100, 'triangle', 0.09),
  win: () => seq([523, 659, 784, 1047], 110, 'triangle', 0.1),
  lose: () => seq([392, 330, 262, 196], 150, 'sawtooth', 0.06),
  bad: () => tone(150, 0.1, 'square', 0.05),
};
function toggleMute() { muted = !muted; store.set('gostopMuted', muted ? '1' : '0'); $('muteBtn').textContent = muted ? '🔇' : '🔊'; }
$('muteBtn').onclick = (e) => { e.currentTarget.blur(); toggleMute(); };
$('muteBtn').textContent = muted ? '🔇' : '🔊';

// ---------- 상태 ----------
let mode = 'easy';                  // 'easy' · 'hard' (컴퓨터) · 'online'
let phase = 'title';                // title · play · over
let st = null;                      // 컴퓨터 대전 판 (나는 0번 자리)
let totals = [0, 0];                // 컴퓨터 대전 누적 점수
let room = null, waitingNet = false, netDown = false, deadline = 0, seenSeq = 0, recorded = '';
let cpuTimer = 0, overTimer = 0;
let selCard = null;
let strip = null;                   // { who, play, flip } 방금 일어난 일
let fresh = new Set();              // 방금 가져온(놓인) 카드
let stripUntil = 0, busyUntil = 0;
let firstSeat = 0;
const online = () => mode === 'online';

// 화면이 그리는 모양: { you, turn, phase, hand, handN, deckN, floor, cap, options, legal, goCount, names, total, result, over }
function view() {
  if (online()) {
    if (!room) return null;
    return { you: room.you, turn: room.turn, phase: room.phase, hand: room.hand, handN: room.handN, deckN: room.deckN, floor: room.floor, cap: room.cap, options: room.options,
      legal: room.legal || [], goCount: room.goCount, shakes: room.shakes, bombs: room.bombs, names: [0, 1].map((s) => (s === room.you ? '나' : ((room.players[s] || {}).name || '상대'))),
      total: room.total, result: room.result, over: room.state === 'over', state: room.state, carry: room.carry, nextCarry: room.nextCarry };
  }
  if (!st) return null;
  return { you: 0, turn: st.turn, phase: st.phase, hand: st.hands[0], handN: [st.hands[0].length, st.hands[1].length], deckN: st.deck.length, floor: st.floor, cap: st.cap,
    options: st.ctx && st.ctx.options, legal: st.turn === 0 ? L.legalActions(st) : [], goCount: st.goCount, shakes: st.shakes, bombs: st.bombs, names: ['나', '컴퓨터'],
    total: totals, result: st.result, over: st.phase === 'over', state: st.phase === 'over' ? 'over' : 'playing', carry: st.carry, nextCarry: st.result ? st.result.nextCarry : 1 };
}
const myTurn = (v) => !!v && v.state === 'playing' && v.turn === v.you && !netDown && !waitingNet && performance.now() >= busyUntil;

// ---------- 그리기 ----------
const KINDS = ['gwang', 'yeol', 'tti', 'pi'];
function capHtml(ids, small) {
  const groups = KINDS.map((k) => ids.filter((id) => L.card(id).kind === k).sort((a, b) => a - b));
  return groups.map((g) => (g.length ? `<div class="grp">${g.map((id) => cd(id, fresh.has(id) ? 'fresh' : '')).join('')}</div>` : '')).join('') || (small ? '' : '<span style="color:rgba(255,255,255,.5);font-size:12px">먹은 패가 여기 쌓여요</span>');
}
// 먹은 패는 겹쳐 쌓되, 많이 먹어도 한 줄 안에서 종류마다 첫 장은 온전히 보이고 나머지는 겹친 폭만 줄여서 맞춘다
function fitCap(el, natural) {
  const cds = el.querySelectorAll('.cd');
  if (!cds.length) return;
  const grps = el.querySelectorAll('.grp'), n = cds.length, w = cds[0].offsetWidth || 25;
  const room = el.clientWidth - (grps.length - 1) * 8 - grps.length * w;
  const step = Math.max(5, Math.min(natural, n > grps.length ? room / (n - grps.length) : natural));
  grps.forEach((g) => { g.style.paddingLeft = '0'; g.querySelectorAll('.cd').forEach((c, i) => { c.style.marginLeft = i ? `${step - w}px` : '0'; }); });
}
function scoreText(ids) {
  const s = L.scoreOf(ids);
  return `광${s.counts.gwang} 열${s.counts.yeol} 띠${s.counts.tti} 피${s.counts.pi} <b>${s.total}점</b>`;
}
function render() {
  const v = view();
  if (!v) { renderHud(null); return; }
  const you = v.you, opp = 1 - you;
  // 상대
  const goTxt = (p) => (v.goCount[p] ? ` · ${v.goCount[p]}고` : '');
  $('oppWho').innerHTML = `<span class="nm">${esc(v.names[opp])}</span><span class="sc">${scoreText(v.cap[opp])}${goTxt(opp)}</span><span class="hc">${Array.from({ length: Math.min(10, v.handN[opp]) }, () => '<i></i>').join('')}</span>`;
  $('oppCap').innerHTML = capHtml(v.cap[opp], true);
  fitCap($('oppCap'), 14);
  // 더미 · 바닥
  $('deck').innerHTML = `${v.deckN ? back() : '<div class="cd" style="opacity:.25"></div>'}<span>더미 ${v.deckN}</span>`;
  const canPlay = myTurn(v) && v.phase === 'play';
  const sel = selCard !== null ? L.monthOf(selCard) : -1;
  const opts = new Set(v.phase === 'chooseHand' || v.phase === 'chooseFlip' ? v.options || [] : []);
  $('floor').innerHTML = v.floor.map((id) => cd(id, `${fresh.has(id) ? 'fresh ' : ''}${canPlay && L.monthOf(id) === sel ? 'match' : ''}${myTurn(v) && opts.has(id) ? 'opt' : ''}`)).join('');
  // 방금 일어난 일
  if (strip && performance.now() < stripUntil) {
    $('strip').innerHTML = `<span class="lbl">${strip.who === you ? '내가' : esc(v.names[strip.who]).slice(0, 4)}</span>${strip.play !== undefined ? cd(strip.play) : ''}${strip.flip !== undefined ? '<span class="ar">▼</span>' + cd(strip.flip) : ''}`;
  } else $('strip').innerHTML = '';
  // 나
  $('myCap').innerHTML = capHtml(v.cap[you], false);
  fitCap($('myCap'), 13);
  $('meWho').innerHTML = `<span class="nm">${esc(v.names[you])}</span><span class="sc">${scoreText(v.cap[you])}${goTxt(you)}</span>`;
  $('hand').innerHTML = v.hand.slice().sort((a, b) => a - b).map((id) => cd(id, `${selCard === id ? 'sel' : ''}${v.turn === v.you && v.phase === 'play' ? '' : ' dim'}`)).join('');
  // 흔들기 · 폭탄 버튼
  const acts = canPlay ? v.legal.filter((a) => a.type === 'shake' || a.type === 'bomb') : [];
  $('actions').innerHTML = acts.map((a) => `<button data-t="${a.type}" data-m="${a.month}">${a.type === 'bomb' ? '💣 폭탄' : '🌀 흔들기'} (${a.month + 1}월)</button>`).join('');
  renderHud(v);
  hint(v);
}
function hint(v) {
  let m = '';
  if (v.over) m = '';
  else if (v.turn !== v.you) m = v.phase === 'chongtong' ? '상대가 총통을 확인하는 중…' : online() ? `${v.names[v.turn]}이(가) 생각 중…` : '컴퓨터 차례예요…';
  else if (v.phase === 'play') m = selCard === null ? '내 차례예요. 낼 패를 눌러요' : '같은 패를 다시 누르거나, 빛나는 바닥 패를 눌러 내요';
  else if (v.phase === 'chooseHand' || v.phase === 'chooseFlip') m = '같은 달 패가 두 장이에요. 가져올 패를 눌러요 (분홍 테두리)';
  else if (v.phase === 'gostop') m = '고 · 스톱을 골라요';
  else if (v.phase === 'chongtong') m = '총통이에요! 바로 이길지 고르세요';
  say(m);
}
function renderHud(v = view()) {
  $('total').textContent = v && v.total ? `${v.total[v.you] > 0 ? '+' : ''}${v.total[v.you]}` : '0';
  let text = '맞고';
  if (v && phase === 'play' && v.state === 'playing') {
    const sec = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
    if (online() && netDown) text = '연결 다시 붙이는 중…';
    else if (v.turn === v.you) text = `내 차례${online() ? ` · ${sec}초` : ''}${v.carry > 1 ? ` · 이월×${v.carry}` : ''}`;
    else text = online() ? `${v.names[v.turn]} 차례 · ${sec}초` : '컴퓨터 차례';
  }
  $('turn').textContent = text;
  $('resignBtn').style.display = online() && room && room.state === 'playing' ? '' : 'none';
}
function say(t) { $('msg').textContent = t; }
function toast(text) { const el = $('toast'); el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }

// ---------- 창 ----------
const overlayOpen = () => !$('overlay').classList.contains('hidden');
function showOverlay(html) { $('overlay').innerHTML = html; $('overlay').classList.remove('hidden'); }
function hideOverlay() { $('overlay').classList.add('hidden'); }

// ---------- 일어난 일 처리 (소리 · 알림 · 방금 낸 패) ----------
const SPECIAL = { chongtong: '총통!', jjok: '쪽!', ddadak: '따닥!', ppeok: '뻑!', jappeok: '자뻑!', ppeokeat: '뻑 먹기!', sseul: '쓸!', bomb: '폭탄!', shake: '흔들기!' };
function onEvents(evs, you) {
  if (!evs || !evs.length) return;
  let who = -1, pl, fl;
  const got = new Set();
  let big = '';
  for (const e of evs) {
    if (e.t === 'play') { who = e.who; pl = e.card; sfx.play(); }
    else if (e.t === 'flip') { who = e.who; fl = e.card; sfx.flip(); }
    else if (e.t === 'capture') { e.cards.forEach((c) => got.add(c)); sfx.take(); if (e.who === you) tutorialSignal('capture'); }
    else if (e.t === 'special') { big = SPECIAL[e.kind] || ''; sfx.special(); tutorialSignal('special'); }
    else if (e.t === 'steal') e.cards.forEach((c) => got.add(c));
    else if (e.t === 'go') { big = `${e.n}고!`; sfx.go(); }
    else if (e.t === 'stop') { big = '스톱!'; sfx.stop(); }
  }
  if (who >= 0) { strip = { who, play: pl, flip: fl }; stripUntil = performance.now() + 1600; setTimeout(render, 1650); }
  fresh = got; setTimeout(() => { if (fresh === got) { fresh = new Set(); render(); } }, 900);
  if (big) toast(big);
}

// ---------- 입력 ----------
$('hand').addEventListener('click', (e) => {
  const el = e.target.closest('.cd');
  if (!el) return;
  const v = view();
  if (!myTurn(v) || v.phase !== 'play') { sfx.bad(); return; }
  const id = Number(el.dataset.id);
  if (selCard === id) { doAct({ type: 'play', card: id }); return; }
  selCard = id; sfx.select(); tutorialSignal('select'); render();
});
$('floor').addEventListener('click', (e) => {
  const el = e.target.closest('.cd');
  if (!el) return;
  const v = view();
  if (!myTurn(v)) return;
  const id = Number(el.dataset.id);
  if (v.phase === 'chooseHand' || v.phase === 'chooseFlip') {
    if ((v.options || []).includes(id)) doAct({ type: 'choose', card: id });
    return;
  }
  if (v.phase === 'play' && selCard !== null && L.monthOf(id) === L.monthOf(selCard)) doAct({ type: 'play', card: selCard });
});
$('actions').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  doAct({ type: b.dataset.t, month: Number(b.dataset.m) });
});
addEventListener('keydown', (e) => { if (e.target.tagName !== 'INPUT' && e.code === 'KeyM') toggleMute(); });

function doAct(a) {
  const v = view();
  if (!myTurn(v)) return;
  if (a.type === 'play') tutorialSignal('play');
  if (a.type === 'choose') tutorialSignal('choose');
  if (a.type === 'go') tutorialSignal('go');
  if (a.type === 'stop') tutorialSignal('stop');
  if (a.type === 'chongtong') tutorialSignal('chongtong');
  selCard = null;
  if (online()) { waitingNet = true; net.send('act', { a }); render(); return; }
  if (!L.apply(st, a)) return;
  onEvents(st.events, 0);
  afterLocal();
}

// ---------- 컴퓨터 대전 ----------
function startCpu(level, carry = 1) {
  leaveOnline();
  clearTimeout(cpuTimer); clearTimeout(overTimer);
  mode = level; phase = 'play'; selCard = null; strip = null; fresh = new Set(); busyUntil = 0;
  st = L.newGame(Math.random, firstSeat, carry);
  hideOverlay(); render();
  if (st.carry > 1) toast(`이월 ×${st.carry}!`);
  afterLocal();
}
function afterLocal() {
  render();
  if (st.phase === 'over') { overTimer = setTimeout(showResult, T.over); return; }
  if (st.phase === 'gostop' && st.turn === 0) { showGoStop(); return; }
  if (st.phase === 'chongtong' && st.turn === 0) { showChongtong(); return; }
  if (st.turn === 1) cpuTimer = setTimeout(cpuAct, T.cpu);
}
function cpuAct() {
  if (phase !== 'play' || !st || online() || st.phase === 'over' || st.turn !== 1) return;
  const a = L.aiPick(st, mode === 'hard' ? 'hard' : 'easy');
  if (!L.apply(st, a)) return;
  onEvents(st.events, 0);
  afterLocal();
}
function showTitle() {
  leaveOnline();
  clearTimeout(cpuTimer); clearTimeout(overTimer);
  mode = 'easy'; phase = 'title'; st = L.newGame(Math.random, 0); selCard = null; strip = null; fresh = new Set(); busyUntil = 0;
  render();
  const on = loadJson(ONLINE_KEY);
  showOverlay(`
    <h1>맞고</h1>
    <p><b>화투</b> 두 사람 대결! 점수를 먼저 내요</p>
    <div class="card2" style="font-size:13px">🎴 손패를 내서 같은 달 바닥 패를 <b>가져와요</b>, 더미 한 장도 뒤집어 또 맞춰요<br>⭐ 광·열끗·띠·피로 <b>7점</b>이 나면 <b>고</b>(계속) 또는 <b>스톱</b>(끝내고 점수)<br>💥 쪽·따닥·뻑·쓸·폭탄·흔들기가 있어요</div>
    <div class="col"><button data-act="cpu" data-lv="easy">🤖 컴퓨터랑 · 쉬움</button><button class="sub" data-act="cpu" data-lv="hard">🤖 컴퓨터랑 · 어려움</button><button class="sub" data-act="online">🌐 온라인 대전${on.w || on.l ? ` · ${on.w || 0}승 ${on.l || 0}패` : ''}</button></div>`);
}

// ---------- 고 · 스톱 · 결과 ----------
function showGoStop() {
  const v = view();
  const s = L.scoreOf(v.cap[v.you]);
  const n = v.goCount[v.you];
  showOverlay(`
    <h2>${s.total}점이에요! 🎉</h2>
    <div class="brk">광 ${s.gwang}점 · 열끗 ${s.yeol}점 · 띠 ${s.tti}점 · 피 ${s.pi}점<br>${n ? `지금 ${n}고 중이에요<br>` : ''}<b>고</b>: 계속해요 (점수가 늘어요, 상대가 먼저 나면 고박!)<br><b>스톱</b>: 여기서 끝내고 점수를 받아요</div>
    <div class="row"><button data-act="go">🔥 고</button><button data-act="stop">✋ 스톱</button></div>`);
}
function showChongtong() {
  const v = view();
  const m = L.fourOf(v.hand);
  const four = v.hand.filter((id) => L.monthOf(id) === m);
  showOverlay(`
    <h2>총통이에요! 🎉</h2>
    <div class="row" style="gap:4px">${four.map((id) => cd(id)).join('')}</div>
    <p>손패에 <b>${m + 1}월 ${L.MONTH_NAMES[m]}</b> 네 장이 있어요!</p>
    <div class="brk"><b>총통으로 승리</b>: 바로 끝내고 <b>${L.CHONGTONG_POINTS}점</b>을 받아요<br><b>계속 진행</b>: 그냥 평소처럼 쳐요</div>
    <div class="col"><button data-act="chongtong">🏆 총통으로 승리 (${L.CHONGTONG_POINTS}점)</button><button class="sub" data-act="continue">▶ 계속 진행</button></div>`);
}
function breakdown(r, v) {
  const p = r.parts || {};
  const lines = [];
  if (r.reason === 'chongtong') lines.push(`총통 (${(r.month || 0) + 1}월 네 장) <b>${r.points}점</b>`);
  if (r.reason === 'stop' || r.reason === 'exhaust') {
    lines.push(`광 ${p.gwang || 0} · 열끗 ${p.yeol || 0} · 띠 ${p.tti || 0} · 피 ${p.pi || 0} = ${p.total || 0}점`);
    if (r.goAdd) lines.push(`고 +${r.goAdd}점`);
    if (r.mult && r.mult.length) lines.push(`배수: ${r.mult.join(' · ')} (×${r.multiplier})`);
    lines.push(`<b>총 ${r.points}점</b>`);
  }
  return lines.join('<br>');
}
function showResult() {
  phase = 'over';
  const v = view();
  const r = v.result;
  if (!r) return;
  const won = r.winner === v.you, draw = r.winner < 0;
  const why = {
    stop: won ? '스톱! 내가 점수를 냈어요' : '상대가 스톱했어요',
    chongtong: won ? '총통! 손패 같은 달 네 장으로 바로 이겼어요' : '상대가 총통으로 바로 이겼어요',
    exhaust: won ? '패를 다 썼어요 — 고를 해서 내가 이겼어요' : '패를 다 썼어요 — 상대가 이겼어요',
    nagari: '아무도 못 났어요 (나가리)',
    resign: won ? '상대가 기권했어요' : '기권했어요',
    timeout: won ? '상대가 시간을 넘겼어요' : '시간을 넘겼어요',
    left: won ? '상대가 나갔어요' : '연결이 끊겨 패배했어요',
  }[r.reason] || '';
  if (!online()) {
    if (!draw) { totals[won ? 0 : 1] += r.points; totals[won ? 1 : 0] -= r.points; }
    if (won) { wins++; store.set('gostopWins', String(wins)); sfx.win(); } else if (!draw) sfx.lose(); else sfx.stop();
  }
  const t = online() ? v.total : totals;
  let again;
  if (online()) {
    const opp = room.players[1 - room.you];
    const iVoted = room.rematch.includes(room.you), theyVoted = room.rematch.includes(1 - room.you);
    if (!opp || !opp.name) again = '<p>상대가 방을 나갔어요</p>';
    else if (iVoted) again = '<p>상대를 기다리는 중…</p>';
    else again = `${theyVoted ? '<p>상대가 한 판 더 하고 싶어해요!</p>' : ''}<button data-act="rematch">한 판 더</button>`;
  } else again = '<button data-act="again">한 판 더</button>';
  showOverlay(`
    <h2>${draw ? '🤝 나가리' : won ? '🎉 승리!' : '😵 패배'}</h2>
    <p>${esc(why)}</p>
    ${breakdown(r, v) ? `<div class="brk">${breakdown(r, v)}</div>` : ''}
    ${draw && v.nextCarry > 1 ? `<p>다음 판은 점수 <b>×${v.nextCarry}</b>로 이월돼요! (나가리 이월)</p>` : ''}
    <span class="tag">누적 ${t[v.you] > 0 ? '+' : ''}${t[v.you]}점</span>
    <div class="col">${again}<div class="row"><button class="sub" data-act="view">판 보기</button><button class="sub" data-act="${online() ? 'leave' : 'home'}">${online() ? '나가기' : '처음으로'}</button></div></div>`);
  if (online()) {
    const key = `${room.code}:${room.games}:${r.reason}:${r.winner}`;
    if (recorded !== key) {
      recorded = key;
      const rec = loadJson(ONLINE_KEY);
      if (won) { rec.w = (rec.w || 0) + 1; sfx.win(); } else if (!draw) { rec.l = (rec.l || 0) + 1; sfx.lose(); }
      store.set(ONLINE_KEY, JSON.stringify(rec));
    }
  }
  render();
}

// ---------- 온라인: 연결 ----------
const net = {
  ws: null, pulse: null, outbox: [], retry: 0,
  connect() {
    if (this.ws && this.ws.readyState <= 1) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}${location.pathname}`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.raw('hello', { name: myName() });
      const s = loadSession();
      if (s) this.raw('resume', s);
      for (const [t, p] of this.outbox.splice(0)) this.raw(t, p);
      clearInterval(this.pulse);
      this.pulse = setInterval(() => this.raw('pulse'), 10000);
    };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } onNet(m); };
    ws.onclose = () => {
      clearInterval(this.pulse);
      if (this.ws !== ws) return;
      this.ws = null;
      if (!online()) return;
      if (room || loadSession()) {
        netDown = true; waitingNet = false; render();
        setTimeout(() => { if (online()) this.connect(); }, Math.min(4000, 500 * 2 ** this.retry++));
      } else showOnline('서버와 연결이 끊겼어요. 다시 시도해 주세요.');
    };
  },
  send(t, p = {}) {
    if (this.ws && this.ws.readyState === 1) this.raw(t, p);
    else { this.outbox.push([t, p]); this.connect(); }
  },
  raw(t, p = {}) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ t, ...p })); },
  close() {
    const ws = this.ws;
    this.ws = null; this.outbox = [];
    clearInterval(this.pulse);
    if (ws) ws.close();
  },
};
function onNet(m) {
  if (m.t === 'queued') showQueued();
  else if (m.t === 'room') applyRoom(m);
  else if (m.t === 'error') { room = null; saveSession(null); showOnline(m.msg); }
  else if (m.t === 'resumeFailed') {
    saveSession(null);
    if (room) { room = null; showOnline('대국이 끝나서 이어갈 수 없어요.'); }
    netDown = false; render();
  }
}
function leaveOnline() {
  if (!online()) return;
  net.send('leave'); net.close();
  saveSession(null);
  room = null; netDown = false; waitingNet = false; mode = 'easy'; phase = 'title';
}

// ---------- 온라인: 대국 ----------
function applyRoom(r) {
  const fresh0 = !room || room.code !== r.code;
  const newGame = fresh0 || room.games !== r.games;
  room = r;
  netDown = false; waitingNet = false;
  saveSession({ code: r.code, token: r.token });
  deadline = performance.now() + r.remain;
  if (newGame) { seenSeq = r.seq; selCard = null; strip = null; fresh = new Set(); }
  if (r.state === 'waiting') { phase = 'title'; showWaiting(); render(); return; }
  phase = r.state === 'playing' ? 'play' : 'over';
  if (newGame && r.state === 'playing') { sfx.take(); say(''); if (r.carry > 1) toast(`이월 ×${r.carry}!`); }
  if (!($('overlay').dataset.screen === 'confirm') && r.state !== 'over') {
    if (r.phase === 'gostop' && r.turn === r.you) showGoStop(); else if (r.phase === 'chongtong' && r.turn === r.you) showChongtong(); else hideOverlay();
  }
  if (r.seq > seenSeq && !newGame) { onEvents(r.events, r.you); }
  seenSeq = r.seq;
  render();
  if (r.state === 'over') setTimeout(() => { if (room && room.state === 'over' && phase === 'over') showResult(); }, T.over);
}
function showOnline(error = '') {
  leaveOnline();
  clearTimeout(cpuTimer); clearTimeout(overTimer);
  mode = 'online'; phase = 'title'; room = null; st = null; waitingNet = false; selCard = null;
  showOverlay(`
    <h2>🌐 온라인 대전</h2>
    <input id="nameInput" maxlength="10" placeholder="내 이름 (최대 10자)" value="${esc(myName())}" autocomplete="off">
    <div class="col">
      <button data-act="quick">⚡ 빠른 대전</button>
      <button class="sub" data-act="create">방 만들기</button>
      <div class="row join"><input id="codeInput" maxlength="4" placeholder="방 코드" autocomplete="off" autocapitalize="characters"><button class="sub" data-act="join">들어가기</button></div>
    </div>
    <span class="error">${esc(error)}</span>
    <button class="back" data-act="home">← 처음으로</button>
    <p style="font-size:12.5px">한 번 고를 때마다 45초 · 패는 서버가 섞고 상대 패는 안 보여요</p>`);
  renderHud(null);
}
function showQueued() {
  showOverlay(`
    <h2>상대를 찾는 중…</h2>
    <div class="dots"><span></span><span></span><span></span></div>
    <p>누군가 빠른 대전을 누르면 바로 시작해요</p>
    <button class="sub" data-act="cancel">취소</button>`);
}
const inviteUrl = () => `${location.origin}${location.pathname}?room=${room.code}`;
function showWaiting() {
  showOverlay(`
    <h2>친구를 기다리는 중…</h2>
    <p>방 코드</p>
    <div class="code">${esc(room.code)}</div>
    <p>친구가 <b>온라인 대전 → 들어가기</b>에<br>이 코드를 넣으면 시작해요</p>
    <button data-act="copy">🔗 초대 링크 복사</button>
    <button class="sub" data-act="cancel">취소</button>`);
}
function saveName() {
  const input = $('nameInput');
  if (!input) return;
  const name = input.value.trim().slice(0, 10);
  store.set('gostopName', name);
  net.send('hello', { name });
}
function confirmResign() {
  showOverlay(`<h2>기권할까요?</h2><p>이번 판은 패배로 기록돼요</p>
    <div class="row"><button data-act="close">계속하기</button><button class="sub" data-act="resign">🏳 기권</button></div>`);
  $('overlay').dataset.screen = 'confirm';
}

$('overlay').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  btn.blur();
  $('overlay').dataset.screen = '';
  const act = btn.dataset.act;
  if (act === 'cpu') { lastCpu = btn.dataset.lv; totals = [0, 0]; startCpu(lastCpu, 1); }
  else if (act === 'again') { firstSeat = st && st.result && st.result.winner >= 0 ? st.result.winner : 1 - firstSeat; startCpu(lastCpu, st && st.result ? st.result.nextCarry : 1); }
  else if (act === 'home') showTitle();
  else if (act === 'online') showOnline();
  else if (act === 'quick') { saveName(); net.send('quick'); }
  else if (act === 'create') { saveName(); net.send('create'); }
  else if (act === 'join') {
    const code = ($('codeInput').value || '').trim().toUpperCase();
    if (code.length !== 4) { $('overlay').querySelector('.error').textContent = '방 코드 4자리를 넣어 주세요.'; return; }
    saveName();
    net.send('join', { code });
  } else if (act === 'cancel') { net.send('cancel'); showOnline(); }
  else if (act === 'copy') {
    const url = inviteUrl();
    const done = () => { btn.textContent = '✅ 복사했어요'; setTimeout(() => { btn.textContent = '🔗 초대 링크 복사'; }, 1500); };
    if (navigator.share && matchMedia('(pointer: coarse)').matches) navigator.share({ title: '맞고 한 판 해요!', url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => prompt('링크를 복사하세요', url));
    else prompt('링크를 복사하세요', url);
  } else if (act === 'rematch') net.send('rematch');
  else if (act === 'view') hideOverlay();
  else if (act === 'leave') showOnline();
  else if (act === 'resign') { net.send('resign'); hideOverlay(); }
  else if (act === 'close') hideOverlay();
  else if (act === 'go') { hideOverlay(); doAct({ type: 'go' }); }
  else if (act === 'chongtong') { hideOverlay(); doAct({ type: 'chongtong' }); }
  else if (act === 'continue') { hideOverlay(); doAct({ type: 'continue' }); }
  else if (act === 'stop') { hideOverlay(); doAct({ type: 'stop' }); }
});
let lastCpu = 'easy';
$('overlay').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'codeInput') $('overlay').querySelector('[data-act="join"]').click();
  if (e.target.id === 'nameInput') $('overlay').querySelector('[data-act="quick"]').click();
  e.stopPropagation();
});
$('resignBtn').onclick = (e) => { e.currentTarget.blur(); if (online() && room && room.state === 'playing') confirmResign(); };
setInterval(() => { if (online() && room && room.state === 'playing' && !netDown) renderHud(); }, 500);

// ---------- 시작 ----------
const invite = new URLSearchParams(location.search).get('room');
if (invite) { try { window.history.replaceState(null, '', location.pathname); } catch (_) {} }
function joinInvite(code) { showOnline(); net.send('join', { code: code.toUpperCase() }); }
if (loadSession()) {
  mode = 'online';
  render();
  showOverlay('<h2>대국으로 돌아가는 중…</h2>');
  net.connect();
  const until = setInterval(() => {
    if (room || !loadSession()) { clearInterval(until); if (!room) invite ? joinInvite(invite) : showOnline(); }
  }, 100);
} else if (invite) joinInvite(invite);
else showTitle();

/* @test-hooks:start */
window.addEventListener('resize', () => { fitCap($('oppCap'), 14); fitCap($('myCap'), 13); });
window.__gs = { setState(s) { st = s; mode = 'easy'; phase = 'play'; totals = [0, 0]; hideOverlay(); render(); afterLocal(); }, showResult, get st() { return st; }, get mode() { return mode; }, get phase() { return phase; }, get room() { return room; }, get selCard() { return selCard; }, T, doAct, startCpu, render, view, L };
/* @test-hooks:end */
})();
