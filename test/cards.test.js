'use strict';

// 화투 그림(public/cards/*.webp) 점검: 48장이 모두 있고, 진짜 WebP 이고, 크기가 같고, 출처 표기가 있는지
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ART = require('../public/cards.js');
const L = require('../public/logic.js');

const DIR = path.join(__dirname, '..', 'public', 'cards');

test('all 48 card images exist, are WebP files and share one size', () => {
  const sizes = new Set();
  for (let id = 0; id < 48; id++) {
    const f = path.join(DIR, path.basename(ART.file(id)));
    assert.ok(fs.existsSync(f), `card ${id} has an image`);
    const b = fs.readFileSync(f);
    assert.strictEqual(b.toString('ascii', 0, 4), 'RIFF', `card ${id} is RIFF`);
    assert.strictEqual(b.toString('ascii', 8, 12), 'WEBP', `card ${id} is WebP`);
    assert.ok(b.length > 1000 && b.length < 40000, `card ${id} size ${b.length}`);
    const kind = b.toString('ascii', 12, 16);                 // VP8 / VP8L / VP8X
    if (kind === 'VP8X') sizes.add(`${(b.readUIntLE(24, 3) + 1)}x${(b.readUIntLE(27, 3) + 1)}`);
    else if (kind === 'VP8L') { const v = b.readUInt32LE(21); sizes.add(`${(v & 0x3fff) + 1}x${((v >> 14) & 0x3fff) + 1}`); }
    else sizes.add(`${b.readUInt16LE(26) & 0x3fff}x${b.readUInt16LE(28) & 0x3fff}`);
  }
  assert.deepStrictEqual([...sizes], ['144x234']);
});

test('image names follow the card number and no stray files are left', () => {
  const names = fs.readdirSync(DIR).filter((n) => n.endsWith('.webp')).sort();
  assert.deepStrictEqual(names, Array.from({ length: 48 }, (_, id) => `c${String(id).padStart(2, '0')}.webp`));
  assert.strictEqual(ART.file(7), 'cards/c07.webp');
  assert.ok(ART.use(40).includes('cards/c40.webp'));
});

test('labels name every card and none repeat except plain pi', () => {
  const names = Array.from({ length: 48 }, (_, id) => ART.label(id));
  assert.ok(names.every((n) => /^\d+월 \S+ \S+$/.test(n)));
  const nonPi = names.filter((n) => !/피$/.test(n));
  assert.strictEqual(new Set(nonPi).size, nonPi.length);
  assert.strictEqual(L.CARDS.filter((c) => c.ssang).length, names.filter((n) => /쌍피$/.test(n)).length);
});

test('the picture license and credit are kept next to the images', () => {
  const lic = fs.readFileSync(path.join(DIR, 'LICENSE.md'), 'utf8');
  assert.ok(lic.includes('CC BY-SA 4.0') && lic.includes('Marcus Richert') && lic.includes('Louie Mantia'));
  const game = fs.readFileSync(path.join(__dirname, '..', 'public', 'game.js'), 'utf8');
  assert.ok(game.includes('Marcus Richert') && game.includes('CC BY-SA 4.0'));
});
