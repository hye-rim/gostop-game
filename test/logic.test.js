'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const L = require('../public/logic.js');

const id = (month, k) => (month - 1) * 4 + k;          // month 1~12, k 0~3
// 시험용 판: 손패·바닥·뒤집을 패(flip, 더미 맨 위)·먹은 패를 직접 정한다
function S({ h0 = [], h1 = [], floor = [], flip, cap0 = [], cap1 = [], turn = 0, fill = 4 } = {}) {
  const st = L.newGame(L.rng(1), 0);
  const used = new Set([...h0, ...h1, ...floor, ...cap0, ...cap1, ...(flip === undefined ? [] : [flip])]);
  const rest = L.CARDS.map((c) => c.id).filter((x) => !used.has(x));
  st.hands = [h0.slice(), h1.slice()]; st.floor = floor.slice(); st.cap = [cap0.slice(), cap1.slice()];
  st.deck = rest.slice(0, fill).concat(flip === undefined ? [] : [flip]);
  st.turn = turn; st.phase = 'play'; st.chong = []; st.ctx = null; st.goCount = [0, 0]; st.lastGo = [0, 0]; st.shakes = [0, 0]; st.bombs = [0, 0]; st.shaken = {}; st.ppeok = {}; st.result = null;
  return st;
}
const play = (st, c) => L.apply(st, { type: 'play', card: c });
const kinds = (st) => st.events.filter((e) => e.t === 'special').map((e) => e.kind);

test('the deck has 48 distinct cards with the right mix', () => {
  assert.strictEqual(L.CARDS.length, 48);
  const n = { gwang: 0, yeol: 0, tti: 0, pi: 0 };
  L.CARDS.forEach((c) => { n[c.kind]++; assert.strictEqual(c.id, L.CARDS.indexOf(c)); });
  assert.deepStrictEqual(n, { gwang: 5, yeol: 9, tti: 10, pi: 24 });
  assert.strictEqual(L.CARDS.filter((c) => c.ssang).length, 2);
  assert.strictEqual(L.CARDS.filter((c) => c.bird).length, 3);
  assert.ok(L.card(id(12, 0)).bi && L.card(id(12, 0)).kind === 'gwang');
  assert.ok(L.card(L.GUKJIN).gukjin && L.card(L.GUKJIN).kind === 'yeol');
  for (let m = 0; m < 12; m++) assert.strictEqual(L.CARDS.filter((c) => c.m === m).length, 4);
});

test('a new deal has 10 + 10 + 8 + 20 cards and the floor never starts with four of a month', () => {
  for (let g = 0; g < 200; g++) {
    const st = L.newGame(L.rng(g), g % 2);
    assert.strictEqual(st.hands[0].length, 10); assert.strictEqual(st.hands[1].length, 10);
    assert.strictEqual(st.floor.length, 8); assert.strictEqual(st.deck.length, 20);
    const all = [...st.deck, ...st.floor, ...st.hands[0], ...st.hands[1]];
    assert.strictEqual(new Set(all).size, 48);
    for (let m = 0; m < 12; m++) assert.ok(L.countMonth(st.floor, m) < 4);
    if (st.phase === 'play') assert.strictEqual(st.turn, g % 2);
  }
});

test('scoring: gwang', () => {
  const g = (...ids) => L.scoreOf(ids).gwang;
  assert.strictEqual(g(id(1, 0), id(3, 0), id(8, 0)), 3);
  assert.strictEqual(g(id(1, 0), id(3, 0), id(12, 0)), 2);                 // 비광이 끼면 2점
  assert.strictEqual(g(id(1, 0), id(3, 0), id(8, 0), id(11, 0)), 4);
  assert.strictEqual(g(id(1, 0), id(3, 0), id(8, 0), id(11, 0), id(12, 0)), 15);
  assert.strictEqual(g(id(1, 0), id(3, 0)), 0);
});

test('scoring: yeol, gododori, tti, danji and pi', () => {
  const yeol = [id(2, 0), id(4, 0), id(5, 0), id(6, 0), id(7, 0), id(8, 1)];
  assert.strictEqual(L.scoreOf(yeol.slice(0, 4)).yeol, 0);
  assert.strictEqual(L.scoreOf(yeol.slice(0, 5)).yeol, 1);
  assert.strictEqual(L.scoreOf(yeol).yeol, 2 + 5, 'six yeol and the three birds (2, 4, 8 month)');
  assert.strictEqual(L.scoreOf([id(2, 0), id(4, 0), id(8, 1)]).yeol, 5);
  const tti = [id(1, 1), id(2, 1), id(3, 1)];
  assert.strictEqual(L.scoreOf(tti).tti, 3, 'hongdan');
  assert.strictEqual(L.scoreOf([id(4, 1), id(5, 1), id(7, 1)]).tti, 3, 'chodan');
  assert.strictEqual(L.scoreOf([id(6, 1), id(9, 1), id(10, 1)]).tti, 3, 'cheongdan');
  assert.strictEqual(L.scoreOf([...tti, id(4, 1), id(5, 1)]).tti, 1 + 3, 'five tti plus hongdan');
  const pi = (n) => Array.from({ length: n }, (_, i) => id(Math.floor(i / 2) + 1, 2 + (i % 2)));   // 홑피 n 장 (1~5월)
  assert.strictEqual(L.scoreOf(pi(9)).pi, 0);
  assert.strictEqual(L.scoreOf(pi(10)).pi, 1);
  assert.strictEqual(L.scoreOf([...pi(8), id(11, 1)]).counts.pi, 10);
  assert.strictEqual(L.scoreOf([...pi(8), id(11, 1)]).pi, 1);
});

test('gukjin counts as yeol or ssangpi, whichever is better', () => {
  const four = [id(2, 0), id(4, 0), id(5, 0), id(6, 0)];
  const with9 = L.scoreOf([...four, L.GUKJIN]);
  assert.strictEqual(with9.yeol, 1);                                          // five yeol
  assert.strictEqual(with9.gukjinAsPi, false);
  const pis = Array.from({ length: 8 }, (_, i) => id(Math.floor(i / 2) + 1, 2 + (i % 2)));
  const alt = L.scoreOf([...pis, L.GUKJIN]);                                   // 8 pi + gukjin as ssangpi = 10 pi
  assert.strictEqual(alt.pi, 1);
  assert.strictEqual(alt.gukjinAsPi, true);
});

test('a plain match: the hand card and the floor card are captured', () => {
  const st = S({ h0: [id(1, 2), id(6, 3)], h1: [id(9, 2)], floor: [id(1, 3), id(10, 2)], flip: id(5, 3) });
  assert.ok(play(st, id(1, 2)));
  assert.deepStrictEqual(st.cap[0].sort((a, b) => a - b), [id(1, 2), id(1, 3)]);
  assert.ok(st.floor.includes(id(5, 3)), 'the flipped card without a match is placed on the floor');
  assert.strictEqual(st.turn, 1);
  assert.deepStrictEqual(kinds(st), []);
});

test('no match: the card is placed; the flip can still match something on the floor', () => {
  const st = S({ h0: [id(2, 2), id(6, 3)], h1: [id(9, 2)], floor: [id(10, 2), id(7, 2)], flip: id(7, 3) });
  assert.ok(play(st, id(2, 2)));
  assert.ok(st.floor.includes(id(2, 2)));
  assert.deepStrictEqual(st.cap[0].sort((a, b) => a - b), [id(7, 2), id(7, 3)]);
});

test('two matches on the floor ask which one to take, the other stays', () => {
  const st = S({ h0: [id(3, 2), id(6, 3)], h1: [id(9, 2)], floor: [id(3, 0), id(3, 3), id(10, 2)], flip: id(8, 2) });
  assert.ok(play(st, id(3, 2)));
  assert.strictEqual(st.phase, 'chooseHand');
  assert.deepStrictEqual(L.legalActions(st).map((a) => a.card).sort((a, b) => a - b), [id(3, 0), id(3, 3)]);
  assert.ok(!L.apply(st, { type: 'choose', card: id(10, 2) }), 'must pick one of the offered cards');
  assert.ok(L.apply(st, { type: 'choose', card: id(3, 0) }));
  assert.deepStrictEqual(st.cap[0].sort((a, b) => a - b), [id(3, 0), id(3, 2)]);
  assert.ok(st.floor.includes(id(3, 3)));
  assert.strictEqual(st.turn, 1);
});

test('three on the floor are all taken with the fourth card', () => {
  const st = S({ h0: [id(4, 3), id(6, 3)], h1: [id(9, 2)], floor: [id(4, 0), id(4, 1), id(4, 2), id(10, 2)], flip: id(8, 2), cap1: [id(1, 2), id(1, 3)] });
  assert.ok(play(st, id(4, 3)));
  assert.strictEqual(L.countMonth(st.cap[0], 3), 4);
  assert.strictEqual(L.countMonth(st.floor, 3), 0);
});

test('jjok: a card with no match, then the flip matches that very card', () => {
  const st = S({ h0: [id(2, 3), id(6, 3)], h1: [id(9, 2)], floor: [id(10, 2), id(7, 2)], flip: id(2, 2), cap1: [id(1, 2), id(1, 3)] });
  assert.ok(play(st, id(2, 3)));
  assert.deepStrictEqual(kinds(st), ['jjok']);
  assert.ok(st.cap[0].includes(id(2, 3)) && st.cap[0].includes(id(2, 2)));
  assert.strictEqual(st.cap[1].length, 1, 'one pi taken from the opponent');
  assert.ok(st.cap[0].includes(id(1, 2)) || st.cap[0].includes(id(1, 3)));
});

test('ppeok: hand pairs with the floor, the flip makes a third; nothing is taken', () => {
  const st = S({ h0: [id(2, 3), id(6, 3)], h1: [id(9, 2)], floor: [id(2, 0), id(10, 2)], flip: id(2, 2) });
  assert.ok(play(st, id(2, 3)));
  assert.deepStrictEqual(kinds(st), ['ppeok']);
  assert.strictEqual(L.countMonth(st.floor, 1), 3);
  assert.strictEqual(st.cap[0].length, 0);
  assert.strictEqual(st.ppeok[1], 0);
});

test('eating three of a month that were on the floor from the start steals one pi', () => {
  const mk = () => S({ h0: [id(2, 3), id(6, 3)], h1: [id(9, 2)], floor: [id(2, 0), id(2, 1), id(2, 2), id(10, 2)], flip: id(8, 2), cap1: [id(1, 2), id(1, 3), id(3, 2), id(3, 3)] });
  const st = mk(); play(st, id(2, 3));
  assert.ok(kinds(st).includes('firstthree'));
  assert.strictEqual(st.cap[1].length, 3);
  assert.ok(!kinds(st).includes('ppeokeat'));
});

test('eating your own ppeok steals two pi, eating the opponent ppeok steals one', () => {
  const mk = (who) => { const st = S({ h0: [id(2, 3), id(6, 3)], h1: [id(9, 2)], floor: [id(2, 0), id(2, 1), id(2, 2), id(10, 2)], flip: id(8, 2), cap1: [id(1, 2), id(1, 3), id(3, 2), id(3, 3)] }); st.ppeok[1] = who; return st; };
  const own = mk(0); play(own, id(2, 3));
  assert.ok(kinds(own).includes('jappeok'));
  assert.strictEqual(own.cap[1].length, 2);
  const other = mk(1); play(other, id(2, 3));
  assert.ok(kinds(other).includes('ppeokeat'));
  assert.strictEqual(other.cap[1].length, 3);
});

test('ddadak: two on the floor, the hand card and the flip take both pairs', () => {
  const st = S({ h0: [id(5, 3), id(6, 3)], h1: [id(9, 2)], floor: [id(5, 0), id(5, 1), id(10, 2)], flip: id(5, 2), cap1: [id(1, 2), id(1, 3)] });
  assert.ok(play(st, id(5, 3)));
  assert.strictEqual(st.phase, 'chooseHand');
  assert.ok(L.apply(st, { type: 'choose', card: id(5, 0) }));
  assert.ok(kinds(st).includes('ddadak'));
  assert.strictEqual(L.countMonth(st.cap[0], 4), 4);
  assert.strictEqual(st.cap[1].length, 1);
});

test('sseul: taking the last cards from the floor steals a pi', () => {
  const st = S({ h0: [id(1, 2), id(2, 2)], h1: [id(9, 2)], floor: [id(1, 3)], flip: id(7, 3), cap1: [id(3, 2), id(3, 3)] });   // 손에 다른 패가 남아 있어야 쓸이다
  st.floor = [id(1, 3), id(7, 2)];                                            // flip 7-3 will take 7-2 as well
  assert.ok(play(st, id(1, 2)));
  assert.ok(kinds(st).includes('sseul'));
  assert.strictEqual(st.floor.length, 0);
  assert.strictEqual(st.cap[1].length, 1);
});

test('bomb: three in hand and one on the floor take four at once', () => {
  const st = S({ h0: [id(6, 0), id(6, 1), id(6, 2), id(1, 2)], h1: [id(9, 2)], floor: [id(6, 3), id(10, 2)], flip: id(8, 2), cap1: [id(3, 2), id(3, 3)] });
  const acts = L.legalActions(st);
  assert.ok(acts.some((a) => a.type === 'bomb' && a.month === 5));
  assert.ok(L.apply(st, { type: 'bomb', month: 5 }));
  assert.strictEqual(L.countMonth(st.cap[0], 5), 4);
  assert.strictEqual(st.hands[0].length, 1);
  assert.strictEqual(st.bombs[0], 1);
  assert.strictEqual(st.cap[1].length, 1);
  assert.strictEqual(st.turn, 1);
});

test('shake: three in hand and none on the floor, declared once per month, turn does not pass', () => {
  const st = S({ h0: [id(6, 0), id(6, 1), id(6, 2), id(1, 2)], h1: [id(9, 2)], floor: [id(10, 2)], flip: id(8, 2) });
  assert.ok(L.legalActions(st).some((a) => a.type === 'shake' && a.month === 5));
  assert.ok(L.apply(st, { type: 'shake', month: 5 }));
  assert.strictEqual(st.turn, 0);
  assert.strictEqual(st.shakes[0], 1);
  assert.ok(!L.legalActions(st).some((a) => a.type === 'shake'), 'cannot shake the same month twice');
  assert.strictEqual(st.hands[0].length, 4);
});

test('reaching 7 points asks go or stop; stop pays out the score', () => {
  // 광 3점 + 띠 5장 1점 + 열끗 5장 1점 = 5, 여기에 홍단 3점 = 8 이 되게 한 장을 남긴다
  const cap0 = [id(1, 0), id(3, 0), id(8, 0),                                  // 3광 3점
    id(4, 1), id(5, 1), id(7, 1), id(6, 1), id(9, 1),                           // 띠 5장 (초단 3점 포함) = 1 + 3
    ];
  const st = S({ h0: [id(2, 1), id(12, 2)], h1: [id(10, 2), id(11, 3)], floor: [id(2, 3), id(1, 1)], flip: id(12, 3), cap0 });
  const before = L.score(st, 0).total;
  assert.strictEqual(before, 3 + 1 + 3);
  assert.ok(play(st, id(2, 1)));                                              // 2월 띠(홍단) 를 먹고 1월 홍단 짝 중 일부
  assert.strictEqual(st.phase, 'gostop');
  assert.deepStrictEqual(L.legalActions(st).map((a) => a.type).sort(), ['go', 'stop']);
  const s = L.score(st, 0).total;
  assert.ok(s >= L.THRESH);
  assert.ok(L.apply(st, { type: 'stop' }));
  assert.strictEqual(st.phase, 'over');
  assert.strictEqual(st.result.winner, 0);
  assert.strictEqual(st.result.points, s * st.result.multiplier);
});

test('go raises the bar: you are only asked again when the score grows', () => {
  const cap0 = [id(1, 0), id(3, 0), id(8, 0), id(4, 1), id(5, 1), id(7, 1), id(6, 1), id(9, 1), id(2, 1)];      // 3광 + 띠 6장(초단 3점)
  const st = S({ h0: [id(12, 2), id(11, 3)], h1: [id(10, 2), id(10, 3)], floor: [id(12, 3), id(7, 2)], flip: id(1, 3), cap0 });
  const base = L.score(st, 0).total;
  assert.ok(base >= L.THRESH);
  st.phase = 'gostop';
  assert.ok(L.apply(st, { type: 'go' }));
  assert.strictEqual(st.goCount[0], 1);
  assert.strictEqual(st.lastGo[0], base);
  assert.strictEqual(st.turn, 1);
  assert.strictEqual(st.phase, 'play');
  // 상대가 한 턴 두고 내 차례: 점수가 안 늘었으면 다시 묻지 않는다
  L.apply(st, { type: 'play', card: id(10, 2) });
  L.apply(st, { type: 'play', card: id(11, 3) });
  assert.strictEqual(st.phase, 'play', 'no new points, so no new question');
});

test('final score: go bonus, multipliers and the bak rules', () => {
  const st = S({});
  st.cap[0] = [id(1, 0), id(3, 0), id(8, 0), id(4, 1), id(5, 1), id(7, 1), id(6, 1), id(9, 1), id(2, 1), id(10, 1)];   // 3광 + 띠 7장
  st.cap[1] = [];                                                                // 상대: 광 0, 피 0
  st.goCount = [3, 0]; st.shakes = [1, 0];
  st.phase = 'gostop'; st.turn = 0;
  assert.ok(L.apply(st, { type: 'stop' }));
  const r = st.result;
  const sc = L.scoreOf(st.cap[0]);
  assert.strictEqual(r.base, sc.total + 2, 'go adds up to 2 points');
  // 3고(x2) · 흔들기(x2) · 광박(x2). 피박은 이긴 쪽이 피 10장 이상이어야 하므로 아님
  assert.strictEqual(r.multiplier, 2 * 2 * 2);
  assert.strictEqual(r.points, r.base * 8);
});

test('pibak needs the winner to score with pi and the loser to hold five pi or fewer', () => {
  const pis = Array.from({ length: 10 }, (_, i) => id(Math.floor(i / 2) + 1, 2 + (i % 2)));
  const st = S({});
  st.cap[0] = [...pis, id(1, 0), id(3, 0), id(8, 0)];
  st.cap[1] = [id(5, 2), id(5, 3), id(6, 2)];
  st.phase = 'gostop'; st.turn = 0;
  L.apply(st, { type: 'stop' });
  assert.ok(st.result.mult.includes('피박'));
  assert.ok(st.result.mult.includes('광박'));
  assert.strictEqual(st.result.multiplier, 4);
  const st2 = S({});
  st2.cap[0] = [...pis, id(1, 0), id(3, 0), id(8, 0)];
  st2.cap[1] = Array.from({ length: 6 }, (_, i) => id(6 + Math.floor(i / 2), 2 + (i % 2)));
  st2.cap[1].push(id(10, 0));
  st2.phase = 'gostop'; st2.turn = 0;
  L.apply(st2, { type: 'stop' });
  assert.ok(!st2.result.mult.includes('피박'), 'six pi is enough to avoid pibak');
});

test('gobak: stopping against someone who went doubles the score', () => {
  const st = S({});
  st.cap[0] = [id(1, 0), id(3, 0), id(8, 0), id(4, 1), id(5, 1), id(7, 1), id(6, 1), id(9, 1), id(2, 1)];
  st.cap[1] = [id(1, 2)];
  st.goCount = [0, 1];
  st.phase = 'gostop'; st.turn = 0;
  L.apply(st, { type: 'stop' });
  assert.ok(st.result.mult.includes('고박'));
});

test('running out of cards: a draw (nagari) when nobody went, the one who went wins otherwise', () => {
  const mkEnd = (go) => { const st = S({ h0: [id(1, 2)], h1: [], floor: [id(10, 2)], flip: id(7, 3), fill: 1 }); st.goCount = go; st.turn = 0; return st; };
  const a = mkEnd([0, 0]); play(a, id(1, 2));
  assert.strictEqual(a.phase, 'over');
  assert.strictEqual(a.result.winner, -1);
  assert.strictEqual(a.result.reason, 'nagari');
  const b = mkEnd([0, 1]); play(b, id(1, 2));
  assert.strictEqual(b.result.winner, 1);
});

test('a player with no hand cards only flips the deck (after a bomb)', () => {
  const st = S({ h0: [id(6, 0), id(6, 1), id(6, 2)], h1: [id(9, 2), id(10, 2)], floor: [id(6, 3), id(1, 2)], flip: id(8, 2), fill: 6 });
  L.apply(st, { type: 'bomb', month: 5 });
  assert.strictEqual(st.hands[0].length, 0);
  assert.strictEqual(st.turn, 1);
  const deckBefore = st.deck.length;
  L.apply(st, { type: 'play', card: id(9, 2) });
  assert.strictEqual(st.turn, 1, 'the bomber has no cards, the turn returns to the other player');
  assert.strictEqual(st.deck.length, deckBefore - 2, 'one flip for the player and one flip-only turn for the bomber');
});

test('illegal actions are refused and change nothing', () => {
  const st = S({ h0: [id(1, 2)], h1: [id(9, 2)], floor: [id(10, 2)], flip: id(7, 3) });
  const snap = JSON.stringify(st);
  assert.ok(!L.apply(st, { type: 'play', card: id(9, 2) }), 'not in my hand');
  assert.ok(!L.apply(st, { type: 'go' }));
  assert.ok(!L.apply(st, { type: 'choose', card: id(10, 2) }));
  assert.ok(!L.apply(st, { type: 'bomb', month: 0 }));
  assert.ok(!L.apply(st, null));
  assert.ok(!L.apply(st, { type: 'nonsense' }));
  assert.strictEqual(JSON.stringify(st), snap);
});

test('random games with both computer levels finish legally and never lose a card', () => {
  const kindsSeen = {};
  for (let g = 0; g < 200; g++) {
    const r = L.rng(5000 + g);
    const st = L.newGame(r, g % 2);
    let n = 0;
    while (st.phase !== 'over' && n++ < 500) {
      const a = L.aiPick(st, st.turn === g % 2 ? 'hard' : 'easy', r);
      assert.ok(L.apply(st, a), 'ai move refused: ' + JSON.stringify(a) + ' in ' + st.phase);
      for (const e of st.events) if (e.t === 'special') kindsSeen[e.kind] = true;
      if (st.phase === 'play' || st.phase === 'gostop' || st.phase === 'over') {
        const all = [...st.deck, ...st.floor, ...st.hands[0], ...st.hands[1], ...st.cap[0], ...st.cap[1]];
        assert.strictEqual(all.length, 48);
        assert.strictEqual(new Set(all).size, 48);
      }
    }
    assert.strictEqual(st.phase, 'over', 'game ' + g + ' did not finish');
    assert.ok(st.result.points >= 0);
  }
  for (const k of ['jjok', 'ppeok', 'sseul', 'bomb', 'shake']) assert.ok(kindsSeen[k], 'never saw ' + k);
});

test('the same seed gives the same game', () => {
  const run = () => { const r = L.rng(42); const st = L.newGame(r, 0); while (st.phase !== 'over') L.apply(st, L.aiPick(st, 'hard', r)); return JSON.stringify([st.result, st.cap]); };
  assert.strictEqual(run(), run());
});

test('the hard computer beats the easy one over a seeded series', () => {
  let hard = 0, easy = 0, hp = 0, ep = 0;
  for (let g = 0; g < 160; g++) {
    const r = L.rng(9000 + g), hardSeat = g % 2;
    const st = L.newGame(r, g % 2);
    while (st.phase !== 'over') L.apply(st, L.aiPick(st, st.turn === hardSeat ? 'hard' : 'easy', r));
    const w = st.result.winner;
    if (w === hardSeat) { hard++; hp += st.result.points; } else if (w === 1 - hardSeat) { easy++; ep += st.result.points; }
  }
  assert.ok(hard > easy, `hard ${hard} easy ${easy}`);
  assert.ok(hp - ep > 0, `points hard ${hp} easy ${ep}`);
});

// 손패에 같은 달 네 장(총통)이 있는 판을 찾는다
function dealWithChong(pred) {
  for (let seed = 1; seed < 20000; seed++) {
    const st = L.newGame(L.rng(seed), seed % 2);
    if (pred(st)) return st;
  }
  throw new Error('no such deal');
}

test('chongtong: four of a month in the first hand lets that player choose', () => {
  const st = dealWithChong((x) => x.phase === 'chongtong' && x.chong.length === 1);
  const p = st.chong[0];
  assert.ok(L.fourOf(st.hands[p]) >= 0);
  assert.strictEqual(st.turn, p);
  assert.deepStrictEqual(L.legalActions(st).map((a) => a.type).sort(), ['chongtong', 'continue']);
  assert.ok(!L.apply(st, { type: 'play', card: st.hands[p][0] }), 'nothing else can be done before choosing');
  assert.ok(!L.apply(st, { type: 'go' }));
});

test('chongtong: taking it ends the game at once with ten points and no multipliers', () => {
  const st = dealWithChong((x) => x.phase === 'chongtong' && x.chong.length === 1);
  const p = st.chong[0];
  assert.ok(L.apply(st, { type: 'chongtong' }));
  assert.strictEqual(st.phase, 'over');
  assert.strictEqual(st.result.winner, p);
  assert.strictEqual(st.result.reason, 'chongtong');
  assert.strictEqual(st.result.points, L.CHONGTONG_POINTS);
  assert.ok(st.events.some((e) => e.t === 'special' && e.kind === 'chongtong'));
});

test('chongtong: declining plays on normally, starting with the first player', () => {
  const st = dealWithChong((x) => x.phase === 'chongtong' && x.chong.length === 1);
  const first = st.first;
  assert.ok(L.apply(st, { type: 'continue' }));
  assert.strictEqual(st.phase, 'play');
  assert.strictEqual(st.turn, first);
  assert.strictEqual(st.chong.length, 0);
  assert.strictEqual(st.hands[0].length + st.hands[1].length, 20);
  assert.ok(L.legalActions(st).some((a) => a.type === 'play'));
});

test('chongtong: when both players have it, the first player decides first and the other gets a turn to decide', () => {
  const st = dealWithChong((x) => x.chong.length === 2);
  assert.deepStrictEqual(st.chong, [st.first, 1 - st.first]);
  assert.strictEqual(st.turn, st.first);
  L.apply(st, { type: 'continue' });
  assert.strictEqual(st.phase, 'chongtong');
  assert.strictEqual(st.turn, 1 - st.first);
  L.apply(st, { type: 'continue' });
  assert.strictEqual(st.phase, 'play');
  assert.strictEqual(st.turn, st.first);
});

test('chongtong: the computer always takes it, and it shows up in about 1.3 percent of hands', () => {
  let n = 0, hands = 0;
  for (let seed = 1; seed <= 6000; seed++) {
    const st = L.newGame(L.rng(seed), seed % 2);
    hands += 2;
    n += st.chong.length;
    if (st.phase === 'chongtong') assert.deepStrictEqual(L.aiPick(st, 'easy'), { type: 'chongtong' });
  }
  const rate = n / hands;
  assert.ok(rate > 0.009 && rate < 0.018, 'chongtong rate ' + rate);
});

test('nagari carry-over: the next game is worth double, again double after another nagari, capped at eight', () => {
  assert.strictEqual(L.newGame(L.rng(1), 0).carry, 1);
  assert.strictEqual(L.newGame(L.rng(1), 0, 4).carry, 4);
  assert.strictEqual(L.nextCarry(1, -1), 2);
  assert.strictEqual(L.nextCarry(2, -1), 4);
  assert.strictEqual(L.nextCarry(4, -1), 8);
  assert.strictEqual(L.nextCarry(8, -1), L.CARRY_MAX);
  assert.strictEqual(L.nextCarry(4, 0), 1, 'a decided game resets the carry');
  assert.strictEqual(L.nextCarry(4, 1), 1);
  // a nagari game reports what the next game carries
  const end = (go) => { const st = S({ h0: [id(1, 2)], h1: [], floor: [id(10, 2)], flip: id(7, 3), fill: 1 }); st.goCount = go; st.carry = 2; st.turn = 0; play(st, id(1, 2)); return st.result; };
  const nag = end([0, 0]);
  assert.strictEqual(nag.winner, -1);
  assert.strictEqual(nag.nextCarry, 4);
  assert.strictEqual(end([0, 1]).nextCarry, 1, 'someone won, so nothing is carried');
});

test('nagari carry-over multiplies the winner points and is shown in the multiplier list', () => {
  const st = S({});
  st.carry = 2;
  st.cap[0] = [id(1, 0), id(3, 0), id(8, 0), id(4, 1), id(5, 1), id(7, 1), id(6, 1), id(9, 1), id(2, 1)];
  st.cap[1] = [id(1, 2)];
  st.phase = 'gostop'; st.turn = 0;
  const base = L.score(st, 0).total;
  L.apply(st, { type: 'stop' });
  assert.ok(st.result.mult.includes('나가리 이월 ×2'));
  assert.strictEqual(st.result.points, base * st.result.multiplier);
  assert.ok(st.result.multiplier >= 2);
  // 같은 판인데 이월이 없으면 절반
  const st2 = S({});
  st2.cap[0] = st.cap[0].slice(); st2.cap[1] = st.cap[1].slice(); st2.phase = 'gostop'; st2.turn = 0;
  L.apply(st2, { type: 'stop' });
  assert.strictEqual(st.result.points, st2.result.points * 2);
});

test('chongtong with a carry-over is worth ten times the carry', () => {
  const st = L.newGame(L.rng(201), 0, 4);
  assert.strictEqual(st.phase, 'chongtong');
  const p = st.turn;
  L.apply(st, { type: 'chongtong' });
  assert.strictEqual(st.result.winner, p);
  assert.strictEqual(st.result.points, L.CHONGTONG_POINTS * 4);
  assert.ok(st.result.mult.includes('나가리 이월 ×4'));
});

test('go is not offered when my own hand is empty, even if the opponent still holds cards', () => {
  // 광 5장을 모은 사람이 마지막 손패를 냈다: 상대 손패가 남아 있어도 고는 없고 바로 스톱
  const gwang = [id(1, 0), id(3, 0), id(8, 0), id(11, 0), id(12, 0)];
  const st = S({ h0: [id(5, 2)], h1: [id(9, 2), id(10, 2)], floor: [id(6, 2)], flip: id(7, 2), cap0: gwang });
  assert.ok(play(st, id(5, 2)));
  assert.strictEqual(st.phase, 'over');
  assert.strictEqual(st.result.winner, 0);
  assert.strictEqual(st.result.reason, 'stop');
  assert.ok(!L.legalActions(st).some((a) => a.type === 'go'));
});

test('go is not offered on a flip-only turn after my hand ran out', () => {
  // 손패를 폭탄 등으로 먼저 비운 사람이 더미만 뒤집다 7점이 되어도 고는 없다
  const st = S({ h0: [], h1: [id(5, 3), id(6, 3)], floor: [id(12, 1)], cap0: [id(1, 0), id(3, 0), id(8, 0), id(11, 0)], turn: 1 });
  st.deck = [id(12, 0), id(2, 3)];                       // 맨 위(끝)는 상대가 뒤집고, 그다음 장을 내가 뒤집는다
  assert.ok(play(st, id(5, 3)));
  assert.strictEqual(st.phase, 'over');
  assert.strictEqual(st.result.winner, 0);
  assert.strictEqual(st.result.reason, 'stop');
});

test('go is still offered while my hand has cards', () => {
  const gwang = [id(1, 0), id(3, 0), id(8, 0), id(11, 0), id(12, 0)];
  const st = S({ h0: [id(5, 2), id(5, 3)], h1: [id(9, 2), id(10, 2)], floor: [id(6, 2)], flip: id(7, 2), cap0: gwang });
  assert.ok(play(st, id(5, 2)));
  assert.strictEqual(st.phase, 'gostop');
  assert.deepStrictEqual(L.legalActions(st).map((a) => a.type), ['go', 'stop']);
});

// ---------- 국진(9월 열끗): 얻을 때 열끗으로 쓸지 쌍피로 쓸지 고른다 ----------
const GUK = id(9, 0);
const gukState = (extra = {}) => S({ h0: [id(9, 2), id(1, 2)], h1: [id(3, 2), id(4, 2)], floor: [GUK, id(10, 2)], flip: id(5, 3), ...extra });

test('gukjin: taking the 9-month yeol stops the turn until its use is chosen', () => {
  const st = gukState();
  assert.ok(play(st, id(9, 2)));
  assert.strictEqual(st.phase, 'gukjin');
  assert.strictEqual(st.turn, 0, 'the turn does not pass yet');
  assert.ok(st.cap[0].includes(GUK));
  assert.deepStrictEqual(L.legalActions(st), [{ type: 'gukjin', as: 'yeol' }, { type: 'gukjin', as: 'ssang' }]);
  assert.ok(!L.apply(st, { type: 'play', card: id(1, 2) }), 'nothing else until it is chosen');
  assert.ok(!L.apply(st, { type: 'gukjin', as: 'both' }), 'only yeol or ssang');
});

test('gukjin: the chosen use decides how it scores, and the turn then goes on', () => {
  const asYeol = gukState(); play(asYeol, id(9, 2));
  assert.ok(L.apply(asYeol, { type: 'gukjin', as: 'yeol' }));
  assert.deepStrictEqual(asYeol.gukjin, ['yeol', null]);
  assert.strictEqual(asYeol.phase, 'play'); assert.strictEqual(asYeol.turn, 1);
  assert.strictEqual(L.score(asYeol, 0).counts.yeol, 1);
  const asSsang = gukState(); play(asSsang, id(9, 2));
  assert.ok(L.apply(asSsang, { type: 'gukjin', as: 'ssang' }));
  assert.strictEqual(L.score(asSsang, 0).counts.yeol, 0);
  assert.strictEqual(L.score(asSsang, 0).counts.pi, 3, 'the 9-month hand card is a pi, the gukjin counts as two');
  assert.ok(asSsang.events.some((e) => e.t === 'gukjin' && e.as === 'ssang'));
});

test('gukjin: scoreOf follows the chosen use, and picks the better one when none was chosen', () => {
  const five = [id(2, 0), id(4, 0), id(5, 0), id(6, 0), GUK];                 // 열끗 4장 + 국진
  assert.strictEqual(L.scoreOf(five, 'yeol').counts.yeol, 5);
  assert.strictEqual(L.scoreOf(five, 'yeol').yeol, 1, 'five yeol is one point');
  assert.strictEqual(L.scoreOf(five, 'ssang').counts.yeol, 4);
  assert.strictEqual(L.scoreOf(five).total, 1, 'unchosen: the better one');
  const nine = [id(1, 2), id(1, 3), id(2, 2), id(2, 3), id(3, 2), id(3, 3), id(4, 2), id(4, 3), id(5, 2), GUK];   // 피 9장 + 국진
  assert.strictEqual(L.scoreOf(nine, 'ssang').pi, 2);
  assert.strictEqual(L.scoreOf(nine, 'yeol').pi, 0);
});

test('gukjin: reaching 7 points with it still goes to go/stop afterwards, and the computer picks the better use', () => {
  const gwang = [id(1, 0), id(3, 0), id(8, 0), id(11, 0), id(12, 0)];       // 광 5장 = 15점
  const st = gukState({ cap0: gwang });
  play(st, id(9, 2));
  assert.strictEqual(st.phase, 'gukjin');
  assert.ok(L.apply(st, { type: 'gukjin', as: 'yeol' }));
  assert.strictEqual(st.phase, 'gostop');
  const cpu = S({ h0: [], h1: [], floor: [] });
  cpu.phase = 'gukjin'; cpu.turn = 0;
  cpu.cap[0] = [id(2, 0), id(4, 0), id(5, 0), id(6, 0), GUK];
  assert.deepStrictEqual(L.aiPick(cpu, 'hard'), { type: 'gukjin', as: 'yeol' }, 'five yeol scores, so it stays a yeol');
  cpu.cap[0] = [id(1, 2), id(1, 3), id(2, 2), id(2, 3), id(3, 2), id(3, 3), id(4, 2), id(4, 3), id(5, 2), GUK];
  assert.deepStrictEqual(L.aiPick(cpu, 'easy'), { type: 'gukjin', as: 'ssang' }, 'nine pi + two makes ten pi');
});

test('shake: the shaken cards are shown to everyone in the event', () => {
  const st = S({ h0: [id(6, 0), id(6, 1), id(6, 2), id(1, 2)], h1: [id(9, 2)], floor: [id(10, 2)], flip: id(8, 2) });
  assert.ok(L.apply(st, { type: 'shake', month: 5 }));
  const ev = st.events.find((e) => e.t === 'special' && e.kind === 'shake');
  assert.deepStrictEqual(ev.cards.slice().sort((x, y) => x - y), [id(6, 0), id(6, 1), id(6, 2)]);
  assert.strictEqual(ev.month, 5);
  assert.strictEqual(ev.who, 0);
});

// ---------- 폭탄: 폭탄패 두 장을 받아, 원할 때 손패 없이 더미만 뒤집을 수 있다 ----------
const bombState = () => S({ h0: [id(6, 0), id(6, 1), id(6, 2), id(1, 2), id(2, 2), id(3, 2)], h1: [id(9, 2), id(10, 2), id(11, 2), id(4, 2), id(5, 2), id(7, 2)], floor: [id(6, 3), id(12, 1)], flip: id(8, 2), fill: 14 });

test('bomb: the bomber gets two bomb cards and is never forced to use them', () => {
  const st = bombState();
  assert.ok(L.apply(st, { type: 'bomb', month: 5 }));
  assert.deepStrictEqual(st.bombPass, [2, 0]);
  assert.strictEqual(st.hands[0].length, 3);
  assert.strictEqual(st.turn, 1);
  // 상대가 내도 폭탄 낸 사람의 차례는 저절로 지나가지 않고 내가 고른다
  assert.ok(play(st, st.hands[1][0]));
  assert.strictEqual(st.turn, 0, 'it is the bomber turn again, nothing was skipped');
  assert.ok(!st.events.some((e) => e.t === 'flipOnly' && e.who === 0));
  assert.strictEqual(st.hands[0].length, 3);
  const legal = L.legalActions(st).map((a) => a.type);
  assert.ok(legal.includes('play') && legal.includes('pass'), 'play a card or use a bomb card');
  // 폭탄패를 내면 손패는 그대로, 더미만 뒤집는다
  const deck0 = st.deck.length;
  assert.ok(L.apply(st, { type: 'pass' }));
  assert.ok(st.events.some((e) => e.t === 'flipOnly' && e.who === 0 && e.pass));
  assert.deepStrictEqual(st.bombPass, [1, 0]);
  assert.strictEqual(st.hands[0].length, 3);
  assert.strictEqual(st.deck.length, deck0 - 1);
  assert.strictEqual(st.turn, 1);
});

test('bomb: a pass is only legal while bomb cards are left', () => {
  const st = S({ h0: [id(1, 2)], h1: [id(9, 2)], floor: [id(10, 2)], flip: id(7, 3) });
  assert.ok(!L.legalActions(st).some((a) => a.type === 'pass'));
  assert.ok(!L.apply(st, { type: 'pass' }));
  const b = bombState(); L.apply(b, { type: 'bomb', month: 5 }); play(b, b.hands[1][0]);
  L.apply(b, { type: 'pass' }); play(b, b.hands[1][0]);
  L.apply(b, { type: 'pass' });
  assert.deepStrictEqual(b.bombPass, [0, 0]);
  play(b, b.hands[1][0]);
  assert.ok(!L.legalActions(b).some((a) => a.type === 'pass'), 'both bomb cards are used up');
  assert.ok(!L.apply(b, { type: 'pass' }));
});

test('bomb: when the hand runs out, the leftover bomb cards are used by flipping the deck', () => {
  const st = S({ h0: [id(6, 0), id(6, 1), id(6, 2)], h1: [id(9, 2), id(10, 2), id(11, 2)], floor: [id(6, 3), id(1, 2)], flip: id(8, 2), fill: 10 });
  L.apply(st, { type: 'bomb', month: 5 });
  assert.strictEqual(st.hands[0].length, 0);
  assert.deepStrictEqual(st.bombPass, [2, 0]);
  const deckBefore = st.deck.length;
  assert.ok(play(st, st.hands[1][0]));
  assert.strictEqual(st.turn, 1, 'the bomber had no hand, so it only flipped and the turn came back');
  assert.deepStrictEqual(st.bombPass, [1, 0], 'one bomb card was used up');
  assert.strictEqual(st.deck.length, deckBefore - 2);
});

test('bomb: games with bombs end, and both sides use up their cards', () => {
  let bombs = 0, passes = 0;
  for (let g = 0; g < 400; g++) {
    const r = L.rng(g + 5), st = L.newGame(r, g % 2);
    let guard = 0;
    while (st.phase !== 'over' && guard++ < 250) {
      const acts = L.legalActions(st);
      let a = acts.find((x) => x.type === 'bomb') || acts[Math.floor(r() * acts.length)];
      if (st.phase === 'gostop') a = { type: 'go' };
      if (a.type === 'bomb') bombs++;
      if (a.type === 'pass') passes++;
      assert.ok(L.apply(st, a));
    }
    assert.strictEqual(st.phase, 'over', `game ${g} ends`);
    if (st.result.reason === 'exhaust' || st.result.reason === 'nagari') {
      assert.deepStrictEqual([st.hands[0].length, st.hands[1].length, st.bombPass[0], st.bombPass[1], st.deck.length], [0, 0, 0, 0, 0], 'everything was played');
    }
  }
  assert.ok(bombs > 20 && passes > 5, `bombs ${bombs}, passes ${passes}`);
});

test('clone keeps the bomb card counts', () => {
  const st = bombState();
  L.apply(st, { type: 'bomb', month: 5 });
  assert.deepStrictEqual(L.clone(st).bombPass, [2, 0]);
});

test('the computer saves its hand cards: with a bomb card and nothing to match it flips only', () => {
  const st = S({ h0: [id(1, 2), id(2, 2)], h1: [id(9, 2)], floor: [id(10, 2), id(11, 2)], flip: id(7, 3) });
  st.bombPass = [1, 0];
  assert.deepStrictEqual(L.aiPick(st, 'hard'), { type: 'pass' });
  const m = S({ h0: [id(1, 2), id(10, 3)], h1: [id(9, 2)], floor: [id(10, 2), id(11, 2)], flip: id(7, 3) });
  m.bombPass = [1, 0];
  assert.deepStrictEqual(L.aiPick(m, 'hard'), { type: 'play', card: id(10, 3) }, 'a card that matches the floor is played instead');
});

// ---------- 쓸: 마지막 손패로는 쓸이 되지 않는다 ----------
test('sseul: clearing the floor with the last hand card is not a sweep, with other cards left it is', () => {
  const last = S({ h0: [id(1, 2)], h1: [id(9, 2), id(10, 2)], floor: [id(1, 3)], flip: id(7, 3), cap1: [id(3, 2), id(3, 3)] });
  last.floor = [id(1, 3), id(7, 2)];                                          // 뒤집는 7월이 바닥 7월을 가져가 바닥이 빈다
  assert.ok(play(last, id(1, 2)));
  assert.strictEqual(last.floor.length, 0);
  assert.ok(!kinds(last).includes('sseul'), 'no sweep with an empty hand');
  assert.strictEqual(last.cap[1].length, 2, 'nothing is stolen');
  const more = S({ h0: [id(1, 2), id(2, 2)], h1: [id(9, 2), id(10, 2)], floor: [id(1, 3)], flip: id(7, 3), cap1: [id(3, 2), id(3, 3)] });
  more.floor = [id(1, 3), id(7, 2)];
  assert.ok(play(more, id(1, 2)));
  assert.ok(kinds(more).includes('sseul'));
  assert.strictEqual(more.cap[1].length, 1);
});

// ---------- 바닥 패를 미리 찍으면 두 장 중 고르기를 묻지 않는다 ----------
test('play with a chosen floor card: no question when the floor holds two of the month', () => {
  const mk = () => S({ h0: [id(6, 2), id(1, 2)], h1: [id(9, 2), id(10, 2)], floor: [id(6, 0), id(6, 1), id(10, 3)], flip: id(8, 2), fill: 6 });
  const asked = mk();
  assert.ok(L.apply(asked, { type: 'play', card: id(6, 2) }));
  assert.strictEqual(asked.phase, 'chooseHand', 'without picking it asks');
  const picked = mk();
  assert.ok(L.apply(picked, { type: 'play', card: id(6, 2), pick: id(6, 1) }));
  assert.notStrictEqual(picked.phase, 'chooseHand');
  assert.ok(picked.cap[0].includes(id(6, 1)) && picked.cap[0].includes(id(6, 2)), 'took the picked one');
  assert.ok(picked.floor.includes(id(6, 0)), 'the other one stays on the floor');
  const wrong = mk();
  assert.ok(L.apply(wrong, { type: 'play', card: id(6, 2), pick: id(10, 3) }));
  assert.strictEqual(wrong.phase, 'chooseHand', 'a card of another month is ignored and it asks');
  const one = S({ h0: [id(6, 2)], h1: [id(9, 2)], floor: [id(6, 0), id(10, 3)], flip: id(8, 2), fill: 6 });
  assert.ok(L.apply(one, { type: 'play', card: id(6, 2), pick: id(10, 3) }));
  assert.ok(one.cap[0].includes(id(6, 0)), 'one match: the pick is ignored');
});

// ---------- 컴퓨터가 국진을 어떻게 쓰는지 ----------
test('the computer decides the gukjin by what it already holds, not always as a yeol', () => {
  const pick = (cap) => { const st = S({}); st.phase = 'gukjin'; st.turn = 0; st.cap[0] = cap; return L.aiPick(st, 'easy').as; };
  assert.strictEqual(pick([GUK, id(1, 2), id(1, 3), id(2, 2), id(2, 3), id(3, 2), id(3, 3), id(4, 2)]), 'ssang', 'lots of pi and no yeol');
  assert.strictEqual(pick([GUK, id(2, 0), id(4, 0), id(5, 0), id(6, 0)]), 'yeol', 'four yeol already: the fifth scores');
  assert.strictEqual(pick([GUK, id(2, 0), id(4, 0), id(1, 2), id(1, 3)]), 'yeol', 'a few yeol and a few pi: stay closer to five yeol');
  assert.strictEqual(pick([GUK, id(1, 2), id(1, 3), id(2, 2), id(2, 3), id(3, 2), id(3, 3), id(4, 2), id(4, 3)]), 'ssang', 'eight pi plus two makes ten');
});

test('jjok plus sseul steals two pi, and a ssang gukjin counts as a pi', () => {
  const mk = (cap1, g) => { const st = S({ h0: [id(2, 3), id(6, 3)], h1: [id(9, 2)], floor: [id(2, 0)], flip: id(2, 1), cap1 }); st.gukjin = [null, g]; return st; };
  const a = mk([id(1, 2), id(1, 3), id(3, 2)], null); play(a, id(2, 3));
  assert.ok(!kinds(a).includes('jjok'));
  const b = S({ h0: [id(2, 3), id(6, 3)], h1: [id(9, 2)], floor: [], flip: id(2, 2), cap1: [id(1, 2), id(1, 3), id(3, 2)] });
  play(b, id(2, 3));
  assert.deepStrictEqual(kinds(b), ['jjok', 'sseul']);
  assert.strictEqual(b.cap[1].length, 1);
  const c = S({ h0: [id(2, 3), id(6, 3)], h1: [id(9, 2)], floor: [id(2, 0), id(2, 1), id(2, 2), id(10, 2)], flip: id(8, 2), cap1: [L.GUKJIN] });
  c.gukjin = [null, 'ssang']; c.ppeok[1] = 0;
  play(c, id(2, 3));
  assert.strictEqual(c.cap[1].length, 0);
});
