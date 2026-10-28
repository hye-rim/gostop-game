'use strict';

// 맞고(2인 고스톱): 규칙과 점수와 컴퓨터만 모아 둔 파일 (그리기·입력 없음). 브라우저·서버·테스트(Node)가 같이 쓴다.
//
// - 화투 48장(12달 x 4장). 손패 10장씩, 바닥 8장, 나머지 20장은 더미. 차례마다 ① 손패 한 장을 내서 같은 달 바닥 패와 맞추고 ② 더미 맨 위를 뒤집어 또 맞춘다
// - 같은 달 두 장이 맞으면 가져온다. 바닥에 같은 달이 없으면 그냥 내려놓는다. 바닥에 같은 달이 두 장이면 하나를 고른다
// - 특별한 일: 쪽 · 따닥 · 뻑 · 쓸 · 폭탄 · 흔들기 (아래 설명), 상대의 피를 한 장씩 뺏어 온다. 폭탄은 세 장을 한꺼번에 내므로 폭탄패(빈 패) 두 장을 받는다: 그 사람은 원하는 차례에 폭탄패를 내서 손패 없이 더미만 뒤집을 수 있다(안 써도 되지만 손패가 떨어지면 남은 폭탄패로 더미만 뒤집는다)
// - 총통: 처음 받은 손패에 같은 달 네 장이 있으면 바로 이겨서 10점을 받을 수도 있고, 그냥 계속할 수도 있다 (고르는 것은 그 사람)
// - 점수가 7점 이상이면 고(계속) 또는 스톱(끝내고 점수 받기). 고를 하면 점수가 늘지만 상대가 먼저 나면 고박. 내 손에 패가 없으면 고는 못 하고 바로 스톱
// - 점수: 광(3광 3점 · 비광 포함 2점 · 4광 4점 · 5광 15점) · 열끗(5장 1점, 한 장마다 +1, 고도리 5점) · 띠(5장 1점, 한 장마다 +1, 홍단·청단·초단 각 3점) · 피(10장 1점, 한 장마다 +1, 쌍피는 2장)
// - 박: 피박 · 광박 · 멍박(열끗 7장 이상)은 각 x2
// - 나가리(무승부)가 나면 다음 판 점수에 x2 (또 나가리면 x4, 한도 x8)가 이월된다
const LOGIC_GOSTOP = (() => {
const THRESH = 7;                          // 이 점수 이상이면 고/스톱을 고른다
const SAMPPEOK_POINTS = 10;                 // 3연뻑(내 차례 세 번 연속 뻑)으로 바로 이기면 받는 점수
const CHONGTONG_POINTS = 10;               // 총통으로 바로 이기면 받는 점수
const CARRY_MAX = 8;                       // 나가리가 이어질 때 이월 배수의 한도

// ---------- 카드 ----------
// 카드 번호 = 달 * 4 + 순서. 달 0~11 (1월~12월)
// 종류: gwang 광 · yeol 열끗 · tti 띠 · pi 피. tti 는 hong(홍단)·cho(초단)·cheong(청단)·plain
const DEF = [
  [['gwang'], ['tti', 'hong'], ['pi'], ['pi']],                           // 1월 송학
  [['yeol', null, true], ['tti', 'hong'], ['pi'], ['pi']],                // 2월 매조 (열끗 = 고도리 새)
  [['gwang'], ['tti', 'hong'], ['pi'], ['pi']],                           // 3월 벚꽃
  [['yeol', null, true], ['tti', 'cho'], ['pi'], ['pi']],                 // 4월 흑싸리
  [['yeol'], ['tti', 'cho'], ['pi'], ['pi']],                             // 5월 난초
  [['yeol'], ['tti', 'cheong'], ['pi'], ['pi']],                          // 6월 모란
  [['yeol'], ['tti', 'cho'], ['pi'], ['pi']],                             // 7월 홍싸리
  [['gwang'], ['yeol', null, true], ['pi'], ['pi']],                      // 8월 공산 (열끗 = 기러기)
  [['yeol', null, false, true], ['tti', 'cheong'], ['pi'], ['pi']],       // 9월 국화 (열끗 = 국진, 쌍피로 쳐도 된다)
  [['yeol'], ['tti', 'cheong'], ['pi'], ['pi']],                          // 10월 단풍
  [['gwang'], ['pi', null, false, false, true], ['pi'], ['pi']],          // 11월 오동 (쌍피)
  [['gwang', 'bi'], ['yeol'], ['tti', 'plain'], ['pi', null, false, false, true]],   // 12월 비 (비광 · 쌍피)
];
const CARDS = [];
DEF.forEach((month, m) => month.forEach((d, k) => {
  CARDS.push({ id: m * 4 + k, m, kind: d[0], tti: d[0] === 'tti' ? d[1] : null, bi: d[1] === 'bi', bird: !!d[2], gukjin: !!d[3], ssang: !!d[4] });
}));
const MONTH_NAMES = ['송학', '매조', '벚꽃', '흑싸리', '난초', '모란', '홍싸리', '공산', '국화', '단풍', '오동', '비'];
const monthOf = (id) => id >> 2;
const card = (id) => CARDS[id];

function rng(seed) {                       // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(a, rand) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- 점수 ----------
const HONG = [1, 5, 9], CHO = [13, 17, 25], CHEONG = [21, 33, 37];      // 띠 카드 번호 (1·2·3월 / 4·5·7월 / 6·9·10월)
const BIRDS = [4, 12, 29];                                              // 고도리: 2월 · 4월 새, 8월 기러기
const GUKJIN = 32;                                                      // 9월 열끗 (술잔): 쌍피로 칠 수도 있다
const sumBy = (ids, f) => ids.reduce((a, id) => a + f(card(id)), 0);

// 가져온 카드(번호 목록)의 점수. 국진(9월 열끗)은 얻을 때 고른 쓰임(mode)대로, 안 골랐으면 더 좋은 쪽으로
// mode: 'yeol'(열끗으로) · 'ssang'(쌍피로) · 없으면 점수가 높은 쪽 (국진을 안 가졌으면 상관없음)
function scoreOf(ids, mode) {
  const has = (id) => ids.includes(id);
  const gw = ids.filter((id) => card(id).kind === 'gwang');
  const tti = ids.filter((id) => card(id).kind === 'tti');
  const pis = ids.filter((id) => card(id).kind === 'pi');
  const gukjin = has(GUKJIN);
  const detail = (asPi) => {
    const yeol = ids.filter((id) => card(id).kind === 'yeol' && !(asPi && id === GUKJIN));
    const piCount = sumBy(pis, (c) => (c.ssang ? 2 : 1)) + (asPi ? 2 : 0);
    const p = {};
    p.gwang = gw.length === 5 ? 15 : gw.length === 4 ? 4 : gw.length === 3 ? (gw.some((id) => card(id).bi) ? 2 : 3) : 0;
    p.yeol = (yeol.length >= 5 ? yeol.length - 4 : 0) + (BIRDS.every(has) ? 5 : 0);
    p.tti = (tti.length >= 5 ? tti.length - 4 : 0) + (HONG.every(has) ? 3 : 0) + (CHO.every(has) ? 3 : 0) + (CHEONG.every(has) ? 3 : 0);
    p.pi = piCount >= 10 ? piCount - 9 : 0;
    p.total = p.gwang + p.yeol + p.tti + p.pi;
    p.counts = { gwang: gw.length, yeol: yeol.length, tti: tti.length, pi: piCount };
    p.gukjinAsPi = asPi;
    return p;
  };
  const a = detail(false);
  if (!gukjin || mode === 'yeol') return a;
  const b = detail(true);
  if (mode === 'ssang') return b;
  return b.total > a.total ? b : a;
}

// ---------- 상태 ----------
// 같은 달 네 장이 있는 달(없으면 -1)
function fourOf(list) { const n = new Array(12).fill(0); list.forEach((id) => n[monthOf(id)]++); return n.findIndex((x) => x === 4); }
// carry: 지난 판이 나가리(무승부)였으면 이 판의 점수에 곱하는 이월 배수 (2, 4, 8)
function newGame(rand = Math.random, first = 0, carry = 1) {
  for (let tries = 0; tries < 200; tries++) {
    const deck = shuffle(CARDS.map((c) => c.id), rand);
    const hands = [deck.splice(0, 10), deck.splice(0, 10)];
    const floor = deck.splice(0, 8);
    if (fourOf(floor) >= 0) continue;                                   // 바닥에 같은 달 네 장이 깔리면 다시 섞는다
    hands.forEach((h) => h.sort((a, b) => a - b));
    // 손패에 같은 달 네 장(총통)이 있으면 그 사람이 바로 이길지 계속할지 고른다 (선부터 차례로)
    const chong = [first, 1 - first].filter((p) => fourOf(hands[p]) >= 0);
    return {
      deck, floor, hands, cap: [[], []], turn: chong.length ? chong[0] : first, first, phase: chong.length ? 'chongtong' : 'play', chong, carry: Math.max(1, Math.floor(carry) || 1),
      ctx: null,                                   // 지금 진행 중인 차례의 임시 정보
      goCount: [0, 0], lastGo: [0, 0], shakes: [0, 0], bombs: [0, 0], bombPass: [0, 0],   // bombPass: 폭탄으로 받은 폭탄패(빈 패) 수. 내면 손패 없이 더미만 뒤집는다
      shaken: {}, ppeok: {},                       // 흔들기 한 달 · 뻑이 쌓인 달 (누가 쌓았나)
      ppeokRun: [0, 0],                            // 내 차례에서 이어서 뻑을 한 횟수 (3이면 3연뻑)
      gukjin: [null, null],                        // 국진(9월 열끗)을 가진 사람이 고른 쓰임: 'yeol' | 'ssang'
      events: [], seq: 0, plies: 0, result: null,
    };
  }
  throw new Error('deal failed');
}
function clone(st) {
  return {
    ...st, deck: st.deck.slice(), floor: st.floor.slice(), hands: st.hands.map((h) => h.slice()), cap: st.cap.map((c) => c.slice()),
    ctx: st.ctx ? { ...st.ctx, held: st.ctx.held.slice(), gain: st.ctx.gain.slice(), options: st.ctx.options ? st.ctx.options.slice() : null } : null,
    chong: (st.chong || []).slice(), goCount: st.goCount.slice(), lastGo: st.lastGo.slice(), shakes: st.shakes.slice(), bombs: st.bombs.slice(), bombPass: (st.bombPass || [0, 0]).slice(), shaken: { ...st.shaken }, ppeok: { ...st.ppeok }, ppeokRun: (st.ppeokRun || [0, 0]).slice(), gukjin: (st.gukjin || [null, null]).slice(),
    events: [], result: st.result ? { ...st.result } : null,
  };
}
const emit = (st, ev) => { st.events.push(ev); };
const remove = (arr, id) => { const i = arr.indexOf(id); if (i >= 0) arr.splice(i, 1); return i >= 0; };
const score = (st, p) => scoreOf(st.cap[p], st.gukjin && st.gukjin[p]);

// 상대의 피를 n 장 뺏어 온다 (홑피부터, 없으면 쌍피)
function steal(st, from, to, n, why) {
  const took = [];
  for (let k = 0; k < n; k++) {
    const pool = st.cap[from].filter((id) => card(id).kind === 'pi' || (id === GUKJIN && st.gukjin && st.gukjin[from] === 'ssang'));   // 쌍피로 쓰기로 한 국진도 피다
    const pick = pool.find((id) => !card(id).ssang && id !== GUKJIN) ?? pool.find((id) => id !== GUKJIN) ?? pool[0];
    if (pick === undefined) break;
    remove(st.cap[from], pick); st.cap[to].push(pick); took.push(pick);
  }
  if (took.length) emit(st, { t: 'steal', from, to, cards: took, why });
  return took.length;
}

// ---------- 한 차례 ----------
function startCtx(card0, m) { return { card: card0, m, mode: null, held: [], gain: [], options: null, flip: null, ppeok: false }; }

function playCard(st, id, pick) {
  const p = st.turn;
  remove(st.hands[p], id);
  const m = monthOf(id);
  const ctx = (st.ctx = startCtx(id, m));
  emit(st, { t: 'play', who: p, card: id });
  const fm = st.floor.filter((c) => monthOf(c) === m);
  if (fm.length === 0) { st.floor.push(id); ctx.mode = 'place'; }
  else if (fm.length === 1) { remove(st.floor, fm[0]); ctx.held = [id, fm[0]]; ctx.mode = 'pair'; }
  else if (fm.length === 2) {
    ctx.mode = 'two';
    if (pick !== undefined && fm.includes(pick)) { remove(st.floor, pick); ctx.held = [id, pick]; }      // 바닥 패를 미리 찍었으면 묻지 않는다
    else { ctx.options = fm; st.phase = 'chooseHand'; return; }
  }
  else {                                                  // 바닥에 석 장이 쌓여 있다(뻑): 네 장을 모두 가져온다
    fm.forEach((c) => remove(st.floor, c)); ctx.held = [id, ...fm]; ctx.mode = 'four';
    eatPpeok(st, p, m);
  }
  flipStep(st);
}
function eatPpeok(st, p, m) {
  const who = st.ppeok[m];
  delete st.ppeok[m];
  if (who === undefined) {                                 // 처음부터 바닥에 깔려 있던 석 장: 먹으면 상대 피 1장
    emit(st, { t: 'special', kind: 'firstthree', who: p });
    steal(st, 1 - p, p, 1, 'firstthree');
    return;
  }
  emit(st, { t: 'special', kind: who === p ? 'jappeok' : 'ppeokeat', who: p });
  steal(st, 1 - p, p, who === p ? 2 : 1, who === p ? 'jappeok' : 'ppeokeat');
}

function flipStep(st) {
  const p = st.turn, ctx = st.ctx;
  if (!st.deck.length) { finishTurn(st); return; }
  const f = st.deck.pop();
  ctx.flip = f;
  emit(st, { t: 'flip', who: p, card: f });
  const fmth = monthOf(f);
  if (fmth === ctx.m && ctx.mode !== 'bomb' && ctx.mode !== 'four') {
    if (ctx.mode === 'place') {                            // 쪽: 내려놓은 패에 뒤집은 패가 딱 맞음
      remove(st.floor, ctx.card);
      ctx.held = [ctx.card, f];
      emit(st, { t: 'special', kind: 'jjok', who: p });
      steal(st, 1 - p, p, 1, 'jjok');
      finishTurn(st);
      return;
    }
    if (ctx.mode === 'pair') {                             // 뻑: 석 장이 바닥에 쌓이고 아무것도 못 가져온다
      st.floor.push(...ctx.held, f);
      ctx.held = [];
      ctx.ppeok = true;
      st.ppeok[ctx.m] = p;
      emit(st, { t: 'special', kind: 'ppeok', who: p });
      finishTurn(st);
      return;
    }
    if (ctx.mode === 'two') {                              // 따닥: 바닥에 남은 같은 달 한 장과 뒤집은 패까지 두 쌍
      const other = st.floor.find((c) => monthOf(c) === ctx.m);
      remove(st.floor, other);
      ctx.held.push(f, other);
      emit(st, { t: 'special', kind: 'ddadak', who: p });
      steal(st, 1 - p, p, 1, 'ddadak');
      finishTurn(st);
      return;
    }
  }
  flipMatch(st, f);
}
// 뒤집은 패(f)를 바닥과 맞춘다
function flipMatch(st, f) {
  const p = st.turn, ctx = st.ctx;
  const ff = st.floor.filter((c) => monthOf(c) === monthOf(f));
  if (ff.length === 0) st.floor.push(f);
  else if (ff.length === 1) { remove(st.floor, ff[0]); ctx.gain.push(f, ff[0]); }
  else if (ff.length === 2) { ctx.options = ff; st.phase = 'chooseFlip'; return; }
  else { ff.forEach((c) => remove(st.floor, c)); ctx.gain.push(f, ...ff); eatPpeok(st, p, monthOf(f)); }
  finishTurn(st);
}

// 차례를 마무리한다: 가져온 패를 먹은 패로 옮기고, (국진을 먹었으면 쓰임을 고르고) 쓸 · 점수 · 고/스톱을 따진다
function finishTurn(st) {
  const p = st.turn, ctx = st.ctx;
  const got = [...ctx.held, ...ctx.gain];
  ctx.got = got;
  if (got.length) { st.cap[p].push(...got); emit(st, { t: 'capture', who: p, cards: got }); }
  if (got.includes(GUKJIN)) { st.phase = 'gukjin'; return; }              // 9월 열끗(국진): 열끗으로 쓸지 쌍피로 쓸지 고른 뒤 이어서 (apply 'gukjin')
  finishTurn2(st);
}
function finishTurn2(st) {
  const p = st.turn, ctx = st.ctx, got = ctx.got || [];
  if (got.length && !st.floor.length && st.hands[p].length > 0) {            // 마지막 패로 바닥을 비워도 쓸은 아니다
    emit(st, { t: 'special', kind: 'sseul', who: p });
    steal(st, 1 - p, p, 1, 'sseul');
  }
  st.ctx = null;
  st.plies++;
  st.ppeokRun[p] = ctx.ppeok ? st.ppeokRun[p] + 1 : 0;
  if (st.ppeokRun[p] >= 3) {                                                 // 3연뻑: 내 차례 세 번 연속 뻑이면 바로 이긴다
    emit(st, { t: 'special', kind: 'sampeok', who: p });
    st.phase = 'over';
    const mult = st.carry > 1 ? [`나가리 이월 ×${st.carry}`] : [];
    st.result = { winner: p, reason: 'sampeok', base: SAMPPEOK_POINTS, goAdd: 0, mult, multiplier: st.carry, points: SAMPPEOK_POINTS * st.carry, parts: scoreOf([]), carry: st.carry, nextCarry: 1 };
    emit(st, { t: 'over', winner: p, reason: 'sampeok', points: st.result.points });
    return;
  }
  const s = score(st, p).total;
  if (!ctx.ppeok && s >= THRESH && s > st.lastGo[p]) {
    if (spare(st, p) === 0) { emit(st, { t: 'stop', who: p }); endGame(st, p, 'stop'); return; }   // 내 손에 패(폭탄패 포함)가 없으면 고를 수 없다: 스톱 (상대 손패가 남았어도)
    st.phase = 'gostop';
    return;
  }
  nextTurn(st);
}

// 아직 낼 수 있는 것: 손패 + 폭탄패
const spare = (st, p) => st.hands[p].length + ((st.bombPass && st.bombPass[p]) || 0);
function nextTurn(st) {
  st.phase = 'play';
  st.turn = 1 - st.turn;
  if (!spare(st, 0) && !spare(st, 1)) { exhaust(st); return; }
  // 손패가 없는 쪽(폭탄으로 먼저 비운 경우 등)은 더미만 뒤집고 넘어간다. 폭탄패가 남았으면 한 장 쓴 셈이다
  if (!st.hands[st.turn].length) {
    if (st.bombPass[st.turn] > 0) st.bombPass[st.turn]--;
    st.ctx = startCtx(-1, -1); st.ctx.mode = 'flipOnly';
    emit(st, { t: 'flipOnly', who: st.turn });
    flipStep(st);
  }
}

// 더미 · 손패를 다 쓴 판: 고를 한 사람이 있으면 그 사람이 이기고, 아무도 안 났으면 나가리(무승부)
function exhaust(st) {
  const s = [score(st, 0).total, score(st, 1).total];
  const went = [st.goCount[0] > 0, st.goCount[1] > 0];
  if (went[0] && !went[1]) endGame(st, 0, 'exhaust');
  else if (went[1] && !went[0]) endGame(st, 1, 'exhaust');
  else if (went[0] && went[1]) endGame(st, s[0] > s[1] ? 0 : s[1] > s[0] ? 1 : -1, 'exhaust');
  else endGame(st, -1, 'nagari');
}

// 다음 판의 이월 배수: 나가리(무승부)면 두 배(한도 8), 승부가 났으면 1
const nextCarry = (carry, winner) => (winner < 0 ? Math.min(CARRY_MAX, Math.max(1, carry) * 2) : 1);

// 끝내기: winner(-1 이면 무승부)가 스톱하거나 이긴 것으로 점수를 매긴다
function endGame(st, winner, reason) {
  st.phase = 'over';
  if (winner < 0) { st.result = { winner: -1, reason, points: 0, carry: st.carry, nextCarry: nextCarry(st.carry, -1) }; emit(st, { t: 'over', winner: -1, reason }); return; }
  const l = 1 - winner;
  const w = score(st, winner), lo = score(st, l);
  const goAdd = Math.min(st.goCount[winner], 2);
  const base = w.total + goAdd;
  const mult = [];
  let m = 1;
  const mulBy = (name, k) => { m *= k; mult.push(name); };
  for (let i = 0; i < st.shakes[winner]; i++) mulBy('흔들기', 2);
  for (let i = 0; i < st.bombs[winner]; i++) mulBy('폭탄', 2);
  for (let i = 3; i <= st.goCount[winner]; i++) mulBy(`${i}고`, 2);
  if (w.pi > 0 && lo.counts.pi <= 5) mulBy('피박', 2);
  if (w.gwang > 0 && lo.counts.gwang === 0) mulBy('광박', 2);
  if (w.counts.yeol >= 7) mulBy('멍박', 2);
  if (st.goCount[l] > 0 && reason === 'stop') mulBy('고박', 2);
  if (st.carry > 1) mulBy(`나가리 이월 ×${st.carry}`, st.carry);
  st.result = { winner, reason, base, goAdd, mult, multiplier: m, points: base * m, parts: w, carry: st.carry, nextCarry: 1 };
  emit(st, { t: 'over', winner, reason, points: st.result.points });
}

// ---------- 행동 ----------
const countMonth = (list, m) => list.filter((c) => monthOf(c) === m).length;

function legalActions(st) {
  if (st.phase === 'over') return [];
  const p = st.turn;
  if (st.phase === 'play') {
    const acts = [];
    const h = st.hands[p];
    for (const c of h) acts.push({ type: 'play', card: c });
    if (st.bombPass && st.bombPass[p] > 0) acts.push({ type: 'pass' });
    for (let m = 0; m < 12; m++) {
      const inHand = countMonth(h, m), onFloor = countMonth(st.floor, m);
      if (inHand === 3 && onFloor === 1) acts.push({ type: 'bomb', month: m });
      if (inHand >= 3 && onFloor === 0 && !st.shaken[`${p}:${m}`]) acts.push({ type: 'shake', month: m });
    }
    return acts;
  }
  if (st.phase === 'chooseHand' || st.phase === 'chooseFlip') return st.ctx.options.map((c) => ({ type: 'choose', card: c }));
  if (st.phase === 'gukjin') return [{ type: 'gukjin', as: 'yeol' }, { type: 'gukjin', as: 'ssang' }];
  if (st.phase === 'gostop') return [{ type: 'go' }, { type: 'stop' }];
  if (st.phase === 'chongtong') return [{ type: 'chongtong' }, { type: 'continue' }];
  return [];
}

// 행동을 적용한다. 규칙에 어긋나면 false (상태는 그대로)
function apply(st, act) {
  if (!act || st.phase === 'over') return false;
  const p = st.turn;
  const ok = legalActions(st).some((a) => a.type === act.type && a.card === act.card && a.month === act.month && a.as === act.as);
  if (!ok) return false;
  st.events = [];
  st.seq++;
  switch (act.type) {
    case 'shake':
      st.shaken[`${p}:${act.month}`] = true; st.shakes[p]++;
      emit(st, { t: 'special', kind: 'shake', who: p, month: act.month, cards: st.hands[p].filter((c) => monthOf(c) === act.month) });   // 흔든 패는 상대에게도 보여 준다
      return true;
    case 'play':
      playCard(st, act.card, Number.isInteger(act.pick) ? act.pick : undefined);
      return true;
    case 'pass': {                                               // 폭탄패를 내서 손패 없이 더미만 뒤집는다
      st.bombPass[p]--;
      st.ctx = startCtx(-1, -1); st.ctx.mode = 'flipOnly';
      emit(st, { t: 'flipOnly', who: p, pass: true });
      flipStep(st);
      return true;
    }
    case 'bomb': {
      const m = act.month;
      const mine = st.hands[p].filter((c) => monthOf(c) === m);
      const fl = st.floor.filter((c) => monthOf(c) === m);
      mine.forEach((c) => remove(st.hands[p], c)); fl.forEach((c) => remove(st.floor, c));
      const ctx = (st.ctx = startCtx(mine[0], m)); ctx.mode = 'bomb'; ctx.held = [...mine, ...fl];
      st.bombs[p]++; st.bombPass[p] += 2;                        // 세 장을 한꺼번에 냈으니 폭탄패 두 장을 받는다
      emit(st, { t: 'special', kind: 'bomb', who: p, month: m });
      steal(st, 1 - p, p, 1, 'bomb');
      flipStep(st);
      return true;
    }
    case 'choose': {
      const ctx = st.ctx;
      if (st.phase === 'chooseHand') {
        remove(st.floor, act.card);
        ctx.held = [ctx.card, act.card]; ctx.options = null;
        st.phase = 'play';
        flipStep(st);
      } else {
        const f = ctx.flip;
        remove(st.floor, act.card);
        ctx.gain.push(f, act.card); ctx.options = null;
        st.phase = 'play';
        finishTurn(st);
      }
      return true;
    }
    case 'chongtong': {
      const month = fourOf(st.hands[p]);
      emit(st, { t: 'special', kind: 'chongtong', who: p, month });
      st.phase = 'over';
      const mult = st.carry > 1 ? [`나가리 이월 ×${st.carry}`] : [];
      st.result = { winner: p, reason: 'chongtong', base: CHONGTONG_POINTS, goAdd: 0, mult, multiplier: st.carry, points: CHONGTONG_POINTS * st.carry, parts: scoreOf([]), month, carry: st.carry, nextCarry: 1 };
      emit(st, { t: 'over', winner: p, reason: 'chongtong', points: st.result.points });
      return true;
    }
    case 'continue':
      st.chong.shift();
      if (st.chong.length) st.turn = st.chong[0];
      else { st.phase = 'play'; st.turn = st.first; }
      return true;
    case 'gukjin':
      st.gukjin[p] = act.as;
      emit(st, { t: 'gukjin', who: p, as: act.as });
      finishTurn2(st);
      return true;
    case 'go': {
      st.goCount[p]++;
      st.lastGo[p] = score(st, p).total;
      emit(st, { t: 'go', who: p, n: st.goCount[p] });
      nextTurn(st);
      return true;
    }
    case 'stop':
      emit(st, { t: 'stop', who: p });
      endGame(st, p, 'stop');
      return true;
  }
  return false;
}

// ---------- 컴퓨터 ----------
const CARD_VALUE = (c) => (c.kind === 'gwang' ? (c.bi ? 3.2 : 5) : c.kind === 'yeol' ? (c.bird ? 4 : 2.8) : c.kind === 'tti' ? (c.tti === 'plain' ? 2 : 3) : c.ssang ? 2.2 : 1);

function gainValue(st, p, gained) {
  const mode = st.gukjin && st.gukjin[p];
  const before = scoreOf(st.cap[p], mode).total;
  const after = scoreOf(st.cap[p].concat(gained), mode).total;
  return (after - before) * 3 + gained.reduce((a, id) => a + CARD_VALUE(card(id)), 0);
}

// 한 장을 냈을 때의 대략적인 득실 (더미는 모르는 것으로 치고, 손패 단계만 따진다)
function evalPlay(st, p, id, level) {
  const m = monthOf(id), c = card(id);
  const fm = st.floor.filter((x) => monthOf(x) === m);
  if (fm.length === 0) {
    // 짝이 없으면 내려놓는다: 값진 패를 내려놓을수록 손해, 상대 손에 짝이 있을지(안 보인 같은 달 수)도 조금 본다
    const seen = st.floor.concat(st.cap[0], st.cap[1], st.hands[p]).filter((x) => monthOf(x) === m).length;
    const unseen = 4 - seen;
    return -CARD_VALUE(c) * (level === 'hard' ? 0.9 + 0.25 * Math.min(2, unseen) : 0.6);
  }
  if (fm.length === 1) {
    let v = gainValue(st, p, [id, fm[0]]);
    // 손패에 같은 달이 더 있으면 나중에 3장째를 먹을 수 있으니 지금은 아껴 둔다 (어려움)
    if (level === 'hard' && countMonth(st.hands[p], m) >= 3) v -= 1;
    return v + 1.2;
  }
  if (fm.length === 2) {
    const best = fm.slice().sort((a, b) => CARD_VALUE(card(b)) - CARD_VALUE(card(a)))[0];
    return gainValue(st, p, [id, best]) + 1.4;
  }
  return gainValue(st, p, [id, ...fm]) + 6;
}

// 국진을 열끗으로 쓸지 쌍피로 쓸지: 지금 점수가 더 높은 쪽, 같으면 어느 쪽이 점수 나는 데까지 더 가까워지는지 본다
// (열끗은 5장, 피는 10장이 모여야 점수가 나고, 열끗 5장이 쌍피 2장보다 만들기 어렵다. 이미 가진 고도리 새도 열끗 쪽 점수를 키운다)
function gukjinUse(st, p) {
  const y = scoreOf(st.cap[p], 'yeol'), q = scoreOf(st.cap[p], 'ssang');
  if (q.total !== y.total) return q.total > y.total ? 'ssang' : 'yeol';
  const yeolNeed = Math.max(0, 5 - y.counts.yeol);                 // 열끗으로 쓰고도 5장까지 남은 장수
  const piNeed = Math.max(0, 10 - q.counts.pi);                    // 쌍피로 쓰고도 10장까지 남은 장수
  if (yeolNeed === 0 || piNeed === 0) return yeolNeed === 0 ? 'yeol' : 'ssang';
  const birds = BIRDS.filter((id) => st.cap[p].includes(id)).length;
  const yeolScore = yeolNeed / 5 - (birds >= 2 ? 0.25 : 0);        // 작을수록 가깝다
  const piScore = piNeed / 10;
  return piScore <= yeolScore ? 'ssang' : 'yeol';
}

function aiPick(st, level = 'easy', rand = Math.random) {
  const acts = legalActions(st);
  if (!acts.length) return null;
  const p = st.turn;
  if (st.phase === 'chongtong') return { type: 'chongtong' };           // 바로 이기는 게 이득
  if (st.phase === 'gukjin') return { type: 'gukjin', as: gukjinUse(st, p) };
  if (st.phase === 'gostop') {
    const mine = score(st, p).total, opp = score(st, 1 - p).total;
    const handLeft = st.hands[p].length;
    if (level === 'hard') {
      const oppThreat = opp >= 4 || scoreOf(st.cap[1 - p], st.gukjin && st.gukjin[1 - p]).counts.gwang >= 2;
      const go = handLeft >= 4 && !oppThreat && st.goCount[p] < 2 && mine >= 8;
      return { type: go ? 'go' : 'stop' };
    }
    return { type: rand() < 0.12 && handLeft >= 4 ? 'go' : 'stop' };
  }
  if (st.phase === 'chooseHand' || st.phase === 'chooseFlip') {
    const opts = st.ctx.options.slice().sort((a, b) => CARD_VALUE(card(b)) - CARD_VALUE(card(a)));
    return { type: 'choose', card: level === 'easy' && rand() < 0.3 ? opts[1] : opts[0] };
  }
  // 폭탄은 언제나 이득, 흔들기도 한다
  const bomb = acts.find((a) => a.type === 'bomb');
  if (bomb) return bomb;
  // 폭탄패가 있고 어떤 손패도 바닥 패와 맞지 않으면 패를 버리지 말고 폭탄패로 뒤집기만 한다
  if (acts.some((a) => a.type === 'pass') && !st.hands[p].some((id) => st.floor.some((f) => monthOf(f) === monthOf(id)))) return { type: 'pass' };
  const shake = acts.find((a) => a.type === 'shake');
  if (shake && (level === 'hard' || rand() < 0.5)) return shake;
  const plays = acts.filter((a) => a.type === 'play');
  if (level === 'easy' && rand() < 0.2) return plays[Math.floor(rand() * plays.length)];
  let best = plays[0], bv = -Infinity;
  for (const a of plays) {
    const v = evalPlay(st, p, a.card, level) + (level === 'easy' ? rand() * 2 : rand() * 0.05);
    if (v > bv) { bv = v; best = a; }
  }
  return best;
}

return { THRESH, SAMPPEOK_POINTS, CHONGTONG_POINTS, CARRY_MAX, nextCarry, fourOf, GUKJIN, CARDS, MONTH_NAMES, HONG, CHO, CHEONG, BIRDS, monthOf, card, rng, shuffle, scoreOf, newGame, clone, score, legalActions, apply, aiPick, steal, countMonth };
})();
if (typeof module !== 'undefined') module.exports = LOGIC_GOSTOP;
