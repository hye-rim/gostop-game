'use strict';

// 화투 그림(public/cards.js) 점검: 48장 모두 그려지고, 종류마다 알아볼 표시가 있는지
const test = require('node:test');
const assert = require('node:assert');
const ART = require('../public/cards.js');
const L = require('../public/logic.js');

test('all 48 cards draw without broken numbers', () => {
  for (let id = 0; id < 48; id++) {
    const svg = ART.body(id);
    assert.ok(svg.length > 400, `card ${id} has art`);
    assert.ok(!/NaN|undefined|Infinity/.test(svg), `card ${id} has no broken numbers`);
  }
});

test('the sprite holds one symbol per card and tags are balanced', () => {
  const sprite = ART.sprite();
  assert.strictEqual((sprite.match(/<symbol /g) || []).length, 48);
  assert.strictEqual((sprite.match(/<\/symbol>/g) || []).length, 48);
  const open = (sprite.match(/<g[ >]/g) || []).length, close = (sprite.match(/<\/g>/g) || []).length;
  assert.strictEqual(open, close);
  assert.strictEqual((sprite.match(/<text/g) || []).length, (sprite.match(/<\/text>/g) || []).length);
});

test('each kind has its mark: gwang badge, tti ribbon, ssang dots', () => {
  for (let id = 0; id < 48; id++) {
    const c = L.card(id), svg = ART.body(id);
    assert.strictEqual(svg.includes('光'), c.kind === 'gwang', `card ${id} gwang badge`);
    assert.strictEqual(svg.includes('M16 4 L44 4'), c.kind === 'tti', `card ${id} ribbon`);
    assert.strictEqual(svg.includes('r="3.1" fill="#d62828"'), !!c.ssang, `card ${id} ssang mark`);
  }
});

test('labels name every card and none repeat', () => {
  const names = Array.from({ length: 48 }, (_, id) => ART.label(id));
  assert.ok(names.every((n) => /^\d+월 \S+ \S+$/.test(n)));
  assert.strictEqual(new Set(names.filter((n) => !/피$/.test(n))).size, names.filter((n) => !/피$/.test(n)).length);
});
