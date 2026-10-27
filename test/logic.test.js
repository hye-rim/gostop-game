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
  st.turn = turn; st.phase = 'play'; st.ctx = null; st.goCount = [0, 0]; st.lastGo = [0, 0]; st.shakes = [0, 0]; st.bombs = [0, 0]; st.shaken = {}; st.ppeok = {}; st.result = null;
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

test('a new deal has 10 + 10 + 8 + 20 cards and never starts with four of a month', () => {
  for (let g = 0; g < 200; g++) {
    const st = L.newGame(L.rng(g), g % 2);
    assert.strictEqual(st.hands[0].length, 10); assert.strictEqual(st.hands[1].length, 10);
    assert.strictEqual(st.floor.length, 8); assert.strictEqual(st.deck.length, 20);
    const all = [...st.deck, ...st.floor, ...st.hands[0], ...st.hands[1]];
    assert.strictEqual(new Set(all).size, 48);
    for (const list of [st.hands[0], st.hands[1], st.floor]) for (let m = 0; m < 12; m++) assert.ok(L.countMonth(list, m) < 4);
    assert.strictEqual(st.turn, g % 2);
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
  const st = S({ h0: [id(1, 2)], h1: [id(9, 2)], floor: [id(1, 3)], flip: id(1, 0) === 0 ? id(7, 3) : id(7, 3), cap1: [id(3, 2), id(3, 3)] });
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
