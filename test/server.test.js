'use strict';

// 서버 시험: 보안·안정성 회귀 + 맞고 온라인 대국 흐름
// 실행: npm test  (Node 18 이상, 별도 설치 없이 node:test)
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const { WebSocket } = require('ws');
const L = require('../public/logic.js');

// 운영체제가 지금 비어 있는 포트를 골라 준다 (고정 포트·범위 난수는 다른 서버와 겹쳐 가끔 실패한다)
const freePort = () => Number(require('child_process').execFileSync(process.execPath, ['-e', "const s = require('net').createServer().listen(0, '127.0.0.1', () => { console.log(s.address().port); s.close(); })"]));
const PORT = freePort();
const get = (p) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: PORT, path: p, method: 'GET' }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
  req.on('error', reject); req.end();
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: String(PORT), TURN_MS: '2500' }, stdio: 'ignore' });
child.unref();
process.on('exit', () => child.kill());
const ready = (async () => {
  for (let i = 0; i < 80; i++) { try { await get('/'); return; } catch { await sleep(100); } }
  throw new Error('server did not start');
})();

const open = () => new Promise((resolve, reject) => {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/`);
  const c = { ws, msgs: [], room: null, queued: false, errors: [], closed: null };
  ws.on('message', (d) => {
    let m; try { m = JSON.parse(d); } catch { return; }
    c.msgs.push(m);
    if (m.t === 'room') c.room = m;
    if (m.t === 'queued') c.queued = true;
    if (m.t === 'error') c.errors.push(m.msg);
  });
  ws.on('close', (code) => { c.closed = code; });
  ws.on('error', () => {});
  ws.on('open', () => resolve(c));
  setTimeout(() => reject(new Error('websocket connect failed')), 3000);
});
const send = (c, t, p = {}) => c.ws.send(JSON.stringify({ t, ...p }));
const until = async (fn, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(10); } return false; };

// 두 손님을 빠른 대전으로 맺어 준다
async function pair() {
  const a = await open(), b = await open();
  send(a, 'hello', { name: '가' }); send(b, 'hello', { name: '나' });
  send(a, 'quick'); await until(() => a.queued);
  send(b, 'quick');
  assert.ok(await until(() => a.room && b.room && a.room.state === 'playing' && b.room.state === 'playing'), 'both players enter a playing room');
  // 총통(손패 같은 달 네 장)이 걸린 판이면 둘 다 계속하기를 골라서 보통 판으로 만든다 (약 2.6% 의 판)
  for (let i = 0; i < 3 && a.room.phase === 'chongtong'; i++) {
    const m = mover(a, b), seq = m.room.seq;
    assert.deepStrictEqual(m.room.legal.map((x) => x.type).sort(), ['chongtong', 'continue']);
    send(m, 'act', { a: { type: 'continue' } });
    await until(() => a.room.phase !== 'chongtong' || a.room.turn !== m.room.you || a.room.seq > seq, 2000);
  }
  return [a, b];
}
const mover = (a, b) => (a.room.turn === a.room.you ? a : b);
const closeAll = (...cs) => cs.forEach((c) => c.ws.close());
// 봇: 내가 볼 수 있는 것(내 손패 · 바닥 · 먹은 패)만으로 상태를 맞춰서 컴퓨터 판단을 쓴다. 서버가 준 legal 목록에 없으면 그중 첫 번째
function botAct(c, level = 'hard') {
  const r = c.room, me = r.you;
  const st = L.newGame(L.rng(1), 0);
  st.hands = [[], []]; st.hands[me] = r.hand.slice(); st.hands[1 - me] = new Array(r.handN[1 - me]).fill(0);
  st.floor = r.floor.slice(); st.cap = r.cap.map((x) => x.slice()); st.goCount = r.goCount.slice(); st.turn = r.turn; st.phase = r.phase;
  st.shakes = r.shakes.slice(); st.bombs = r.bombs.slice(); st.gukjin = (r.gukjin || [null, null]).slice(); st.bombPass = (r.bombPass || [0, 0]).slice(); st.ctx = r.options ? { options: r.options } : null;
  st.deck = new Array(r.deckN).fill(0); st.shaken = {};
  let a;
  try { a = L.aiPick(st, level, Math.random); } catch (_) { a = null; }
  const ok = a && r.legal.some((x) => x.type === a.type && x.card === a.card && x.month === a.month && x.as === a.as);
  return ok ? a : r.legal[0];
}
async function oneAction(a, b, level) {
  const m = mover(a, b), seq = m.room.seq;
  const act = botAct(m, level);
  send(m, 'act', { a: act });
  await until(() => a.room.seq > seq && b.room.seq > seq, 3000);
}

test('malformed URLs get 400 and the server stays up', async () => {
  await ready;
  assert.strictEqual(await get('/%'), 400);
  assert.strictEqual(await get('/%00'), 400);
  assert.strictEqual(await get('/'), 200);
  assert.strictEqual(await get('/logic.js'), 200);
});

test('dotfiles and paths outside the public dir are not served', async () => {
  await ready;
  assert.strictEqual(await get('/.git/config'), 403);
  assert.ok([403, 404].includes(await get('/../server.js')));
});

test('oversized websocket message closes the connection (1009)', async () => {
  await ready;
  const c = await open();
  c.ws.send('x'.repeat(2 * 1024 * 1024));
  await sleep(500);
  assert.strictEqual(c.closed, 1009);
  assert.strictEqual(await get('/'), 200);
});

test('a deal: ten cards each, eight on the floor, and the opponent hand and the deck never leave the server', async () => {
  await ready;
  const [a, b] = await pair();
  for (const c of [a, b]) {
    assert.strictEqual(c.room.hand.length, 10);
    assert.deepStrictEqual(c.room.handN, [10, 10]);
    assert.strictEqual(c.room.deckN, 20);
    assert.strictEqual(c.room.floor.length, 8);
    for (const key of Object.keys(c.room)) assert.ok(!['deck', 'hands', 'oppHand'].includes(key), 'leaked key ' + key);
  }
  assert.strictEqual(a.room.carry, 1);
  assert.strictEqual(a.room.nextCarry, 1);
  assert.ok(a.room.hand.every((x) => !b.room.hand.includes(x)), 'the two hands are disjoint');
  assert.notStrictEqual(a.room.you, b.room.you);
  assert.strictEqual(a.room.turn, a.room.first);
  const first = mover(a, b);
  assert.ok(first.room.legal.length >= 10, 'the mover gets the list of legal actions');
  assert.deepStrictEqual((first === a ? b : a).room.legal, [], 'the other side gets none');
  const all = [...a.room.hand, ...b.room.hand, ...a.room.floor];
  assert.strictEqual(new Set(all).size, 28);
  closeAll(a, b);
});

test('out-of-turn, illegal and garbage actions are ignored', async () => {
  await ready;
  const [a, b] = await pair();
  const first = mover(a, b), second = first === a ? b : a;
  const seq = a.room.seq;
  send(second, 'act', { a: { type: 'play', card: second.room.hand[0] } });         // 내 차례가 아님
  send(first, 'act', { a: { type: 'play', card: second.room.hand[0] } });          // 상대 손패
  for (const m of [{}, { a: null }, { a: 5 }, { a: { type: 5 } }, { a: { type: 'play' } }, { a: { type: 'play', card: 'x' } }, { a: { type: 'play', card: 1.5 } }, { a: { type: 'play', card: 99 } },
    { a: { type: 'go' } }, { a: { type: 'stop' } }, { a: { type: 'bomb', month: 'a' } }, { a: { type: 'choose', card: first.room.hand[0] } }, { a: { type: 'shake', month: 40 } }]) send(first, 'act', m);
  await sleep(300);
  assert.strictEqual(a.room.seq, seq, 'nothing happened');
  assert.deepStrictEqual(a.room.handN, [10, 10]);
  closeAll(a, b);
});

test('a legal play reaches both players with the events', async () => {
  await ready;
  const [a, b] = await pair();
  const first = mover(a, b), second = first === a ? b : a;
  // 같은 달 바닥 패가 두 장이면 고르는 중이라 뒤집기가 아직 없다 (약 8% 의 판). 그런 패는 피해서 낸다
  const onFloor = (c) => first.room.floor.filter((f) => L.monthOf(f) === L.monthOf(c)).length;
  const card = first.room.hand.find((c) => onFloor(c) !== 2) ?? first.room.hand[0], seq = a.room.seq;
  send(first, 'act', { a: { type: 'play', card } });
  assert.ok(await until(() => a.room.seq > seq && b.room.seq > seq));
  assert.ok(first.room.events.some((e) => e.t === 'play' && e.card === card));
  assert.ok(second.room.events.some((e) => e.t === 'play' && e.card === card), 'the opponent sees the played card');
  assert.ok(second.room.events.some((e) => e.t === 'flip'), 'and the flipped card');
  assert.ok(first.room.hand.length === 9 && second.room.handN[first.room.you] === 9);
  closeAll(a, b);
});

test('two computers play whole games through the server and both sides agree on the result', async () => {
  await ready;
  for (let game = 0; game < 3; game++) {
    const [a, b] = await pair();
    for (let i = 0; i < 400 && a.room.state === 'playing'; i++) await oneAction(a, b, i % 3 ? 'easy' : 'hard');
    assert.ok(await until(() => a.room.state === 'over' && b.room.state === 'over', 3000), 'the game ends');
    assert.deepStrictEqual(a.room.result, b.room.result);
    const r = a.room.result;
    assert.ok(['stop', 'exhaust', 'nagari'].includes(r.reason), r.reason);
    if (r.winner >= 0) {
      assert.ok(r.points > 0);
      assert.strictEqual(a.room.total[r.winner], r.points);
      assert.strictEqual(a.room.total[1 - r.winner], -r.points);
    } else assert.deepStrictEqual(a.room.total, [0, 0]);
    // 총 48 장 모두 있어야 한다 (더미는 서버만 알지만 나머지는 보인다)
    const seen = [...a.room.cap[0], ...a.room.cap[1], ...a.room.floor, ...a.room.hand, ...b.room.hand];
    assert.strictEqual(new Set(seen).size, seen.length);
    closeAll(a, b);
  }
});

test('resigning ends the game and a rematch changes who goes first and keeps the running total', async () => {
  await ready;
  const [a, b] = await pair();
  const first = a.room.first;
  send(a, 'resign');
  assert.ok(await until(() => b.room.state === 'over'));
  assert.strictEqual(b.room.reason, 'resign');
  assert.strictEqual(b.room.winner, b.room.you);
  assert.ok(b.room.total[b.room.you] > 0);
  const total = b.room.total.slice();
  send(a, 'rematch'); send(b, 'rematch');
  assert.ok(await until(() => a.room.state === 'playing' && a.room.games === 2));
  assert.notStrictEqual(a.room.first, first, 'the first player alternates');
  assert.deepStrictEqual(a.room.total, total);
  assert.strictEqual(a.room.carry, 1, 'a game decided by a resignation carries nothing');
  assert.strictEqual(a.room.hand.length, 10);
  closeAll(a, b);
});

test('running out of time loses the game for the one who has to decide', async () => {
  await ready;
  const [a, b] = await pair();
  const first = mover(a, b);
  assert.ok(await until(() => a.room.state === 'over', 5000), 'the timer fires');
  assert.strictEqual(a.room.reason, 'timeout');
  assert.strictEqual(a.room.winner, 1 - first.room.you);
  closeAll(a, b);
});

test('private rooms: create, join by code, and a third player is turned away', async () => {
  await ready;
  const a = await open(), b = await open(), c = await open();
  send(a, 'create');
  assert.ok(await until(() => a.room && a.room.code));
  assert.strictEqual(a.room.state, 'waiting');
  send(b, 'join', { code: a.room.code.toLowerCase() });
  assert.ok(await until(() => a.room.state === 'playing' && b.room && b.room.state === 'playing'));
  send(c, 'join', { code: a.room.code });
  assert.ok(await until(() => c.errors.length > 0));
  assert.match(c.errors[0], /이미 두 사람/);
  a.ws.close(); b.ws.close(); c.ws.close();
});

test('a dropped player can resume the same seat with the token', async () => {
  await ready;
  const [a, b] = await pair();
  const token = a.room.token, code = a.room.code, you = a.room.you;
  a.ws.close();
  assert.ok(await until(() => b.room.players.some((p) => !p.online)), 'the other side sees the drop');
  const a2 = await open();
  send(a2, 'resume', { code, token });
  assert.ok(await until(() => a2.room && a2.room.you === you && a2.room.state === 'playing'));
  assert.ok(await until(() => b.room.players.every((p) => p.online)));
  a2.ws.close(); b.ws.close();
});

// 같은 주소에서 코드를 일부러 많이 틀리므로 이 시험은 맨 뒤에 둔다 (뒤의 시험이 막히지 않게)
test('repeated wrong room codes get temporarily blocked', async () => {
  await ready;
  const c = await open();
  for (let i = 0; i < 10; i++) c.ws.send(JSON.stringify({ t: 'join', code: 'ZZZ' + 'ABCDEFGH'[i] }));
  await sleep(500);
  assert.ok(c.errors.some((x) => /그런 방이 없어요/.test(x)), 'first attempts are answered with room-not-found');
  assert.ok(c.errors.some((x) => /너무 많이 틀렸어요/.test(x)), 'many wrong codes get blocked');
  c.ws.close();
});

test('shutdown', () => { child.kill(); });
