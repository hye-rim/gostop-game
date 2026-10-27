'use strict';

// 화투 48장 그림 (SVG). 달마다 바탕 그림(소나무·매화·벚꽃 …)이 있고, 광·열끗·띠는 그 위에 학·새·리본 같은 것을 얹는다.
// 한 번만 숨은 그림 묶음(스프라이트)으로 넣어 두고, 카드마다 <use> 로 가져다 쓴다. 규칙은 logic.js 만 본다.
const HWATU_ART = (() => {
const L = typeof LOGIC_GOSTOP !== 'undefined' ? LOGIC_GOSTOP : require('./logic.js');
const INK = '#2a2230';

// ---------- 그리기 도구 ----------
const f = (d, fill, x = '') => `<path d="${d}" fill="${fill}" ${x}/>`;
const st = (d, col, w, x = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${x}/>`;
const c = (x, y, r, fill, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
const e = (x, y, rx, ry, fill, rot = 0, extra = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${rot} ${x} ${y})" ${extra}/>`;
const g = (inner, tf) => `<g transform="${tf}">${inner}</g>`;
const at = (x, y, s, rot, inner) => g(inner, `translate(${x} ${y}) rotate(${rot}) scale(${s})`);
const rad = (d) => (d * Math.PI) / 180;
const bez = (p, t) => {                                 // 3차 곡선 위의 점 [x, y, 접선각]
  const u = 1 - t, [a, b, cc, d] = p;
  const x = u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * cc[0] + t * t * t * d[0];
  const y = u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * cc[1] + t * t * t * d[1];
  const dx = 3 * u * u * (b[0] - a[0]) + 6 * u * t * (cc[0] - b[0]) + 3 * t * t * (d[0] - cc[0]);
  const dy = 3 * u * u * (b[1] - a[1]) + 6 * u * t * (cc[1] - b[1]) + 3 * t * t * (d[1] - cc[1]);
  return [x, y, (Math.atan2(dy, dx) * 180) / Math.PI];
};
const flower = (x, y, r, fill, cen) => {
  let s = '';
  for (let i = 0; i < 5; i++) s += c((x + Math.cos(rad(i * 72 - 90)) * r * 0.62).toFixed(1), (y + Math.sin(rad(i * 72 - 90)) * r * 0.62).toFixed(1), (r * 0.58).toFixed(1), fill);
  return s + c(x, y, (r * 0.32).toFixed(1), cen);
};
const leavesAlong = (pts, fill, n, size) => {                 // 줄기를 따라 작은 잎을 번갈아 붙인다
  let s = '';
  for (let i = 1; i <= n; i++) {
    const [x, y, a] = bez(pts, i / (n + 1));
    s += e(x.toFixed(1), y.toFixed(1), size, size * 0.45, fill, a + (i % 2 ? 55 : -55));
  }
  return s;
};

// ---------- 달마다 바탕 ----------
const PLANT = [
  // 1월 소나무
  () => st('M32 90 C26 74 36 62 30 44', '#6b4423', 4.6) + st('M31 60 C40 56 48 52 55 46', '#6b4423', 2.6) + st('M30 52 C22 50 14 46 8 44', '#6b4423', 2.4) +
    f('M3 41 Q16 25 31 36 Q16 45 3 41Z', '#2f8a43') + f('M33 31 Q46 15 59 26 Q46 37 33 31Z', '#2f8a43') + f('M13 23 Q28 7 43 20 Q28 29 13 23Z', '#3da255') +
    f('M34 68 Q46 56 59 63 Q46 74 34 68Z', '#2f8a43') + st('M7 39 Q16 32 27 36', '#8fd69a', 1) + st('M17 20 Q28 12 38 19', '#9fe0a8', 1) + st('M38 29 Q47 22 55 26', '#8fd69a', 1),
  // 2월 매화
  () => st('M2 86 C12 70 26 66 30 50 S46 28 58 14', '#5a3828', 3.4) + st('M30 50 C34 56 42 58 52 56', '#5a3828', 2.2) +
    [[13, 73, 5], [24, 62, 4.6], [37, 41, 5.2], [50, 23, 5], [45, 57, 4.2], [31, 51, 4]].map(([x, y, r], i) => flower(x, y, r, i % 3 === 2 ? '#fff' : '#e24a68', '#ffd23f')).join('') +
    c(18, 68, 1.6, '#e24a68') + c(52, 14, 1.6, '#e24a68') + c(8, 82, 1.6, '#e24a68'),
  // 3월 벚꽃
  () => st('M58 88 C50 70 34 68 30 52 S14 30 4 16', '#5a3828', 3.4) + st('M30 52 C26 58 18 60 8 58', '#5a3828', 2.2) +
    [[52, 76, 4.4], [44, 66, 4.2], [31, 52, 4.6], [22, 40, 4.4], [12, 26, 4.8], [9, 59, 4], [38, 58, 3.8], [16, 14, 3.8]].map(([x, y, r]) => flower(x, y, r, '#f8a5bd', '#e8607f')).join(''),
  // 4월 흑싸리(등나무)
  () => st('M3 7 C20 3 40 9 58 5', '#4a3a2a', 2.6) + [[11, 9, 8], [24, 7, 9], [38, 9, 8], [51, 7, 9]].map(([x, y, n]) => {
    let s = st(`M${x} ${y} L${x} ${y + 3}`, '#4a3a2a', 1);
    for (let i = 0; i < n; i++) s += e(x + (i % 2 ? 0.9 : -0.9), y + 5 + i * 6.1, Math.max(2.6, 6.2 - i * 0.45), 3.6, i % 2 ? '#3d2a55' : '#563a80');
    return s;
  }).join('') + f('M3 9 Q10 14 6 20 Q2 14 3 9Z', '#2f8a4a') + f('M57 9 Q50 14 54 20 Q58 14 57 9Z', '#2f8a4a'),
  // 5월 난초
  () => f('M30 90 Q22 60 12 28 Q28 56 32 90Z', '#2c8a4a') + f('M30 90 Q36 56 49 22 Q40 60 34 90Z', '#3aa05a') + f('M28 90 Q18 72 3 64 Q22 70 30 90Z', '#2c8a4a') + f('M32 90 Q44 74 58 68 Q42 78 34 90Z', '#3aa05a') +
    e(30, 29, 4.2, 9.5, '#6b69d8') + e(23, 38, 4, 8.5, '#5a58c9', -52) + e(37, 38, 4, 8.5, '#5a58c9', 52) + c(30, 38, 2.2, '#ffd23f') +
    e(47, 50, 2.8, 6, '#6b69d8', 25) + e(52, 55, 2.6, 5.4, '#5a58c9', 70) + c(48.5, 54, 1.4, '#ffd23f'),
  // 6월 모란
  () => f('M3 82 Q9 56 30 68 Q16 84 3 82Z', '#2f8a4a') + f('M57 82 Q51 56 30 68 Q44 84 57 82Z', '#3aa05a') + f('M4 18 Q14 6 28 17 Q14 28 4 18Z', '#2f8a4a') + f('M56 18 Q46 6 32 17 Q46 28 56 18Z', '#3aa05a') +
    Array.from({ length: 8 }, (_, i) => c((30 + Math.cos(rad(i * 45)) * 11).toFixed(1), (42 + Math.sin(rad(i * 45)) * 11).toFixed(1), 8, '#e23c5b')).join('') +
    Array.from({ length: 6 }, (_, i) => c((30 + Math.cos(rad(i * 60 + 15)) * 6).toFixed(1), (42 + Math.sin(rad(i * 60 + 15)) * 6).toFixed(1), 5.2, '#f06a85')).join('') + c(30, 42, 4.6, '#f7a8ba') + c(30, 42, 1.8, '#ffd23f'),
  // 7월 홍싸리
  () => {
    const A = [[30, 90], [30, 62], [20, 42], [6, 30]], B = [[30, 90], [33, 56], [46, 36], [58, 24]], C = [[30, 74], [38, 64], [50, 60], [58, 58]];
    return [A, B, C].map((p) => st(`M${p[0]} C${p[1]} ${p[2]} ${p[3]}`, '#7a4a2a', 1.8) + leavesAlong(p, '#c4452d', 9, 3.6)).join('') + leavesAlong(A, '#8f2e1f', 5, 2.4);
  },
  // 8월 공산(달 뜬 억새 언덕)
  () => f('M0 90 L0 60 Q16 50 30 62 Q46 52 60 58 L60 90Z', '#2d2a3a') +
    [[10, 80, -12], [20, 82, -4], [40, 82, 6], [50, 80, 14]].map(([x, y, a]) => st(`M${x} ${y} Q${x + a / 2} ${y - 14} ${x + a} ${y - 26}`, '#a89a6a', 1.2) + e(x + a, y - 31, 2.7, 9, '#ead58f', a * 0.6)).join('') +
    st('M0 66 Q16 58 30 68', '#463f55', 1) + st('M30 68 Q46 58 60 64', '#463f55', 1),
  // 9월 국화
  () => {
    const flw = (x, y, s) => at(x, y, s, 0, Array.from({ length: 14 }, (_, i) => e((Math.cos(rad(i * 25.7)) * 10).toFixed(1), (Math.sin(rad(i * 25.7)) * 10).toFixed(1), 7, 2.5, i % 2 ? '#ffd23f' : '#ffe680', i * 25.7)).join('') +
      Array.from({ length: 8 }, (_, i) => e((Math.cos(rad(i * 45)) * 5).toFixed(1), (Math.sin(rad(i * 45)) * 5).toFixed(1), 4, 1.8, '#f6b21c', i * 45)).join('') + c(0, 0, 3.4, '#e8941a'));
    return f('M3 86 Q8 62 26 74 Q14 88 3 86Z', '#2f8a4a') + f('M57 86 Q52 62 34 74 Q46 88 57 86Z', '#3aa05a') + st('M30 90 C30 76 30 66 30 54', '#2f8a4a', 2) + flw(30, 38, 1.05) + flw(48, 70, 0.55) + flw(13, 66, 0.45);
  },
  // 10월 단풍
  () => {
    const leaf = (x, y, s, rot, fill) => at(x, y, s, rot, f('M0 -9 L2 -4 L7 -6 L5 -1 L9 1 L4 3 L5 8 L0 5 L-5 8 L-4 3 L-9 1 L-5 -1 L-7 -6 L-2 -4Z', fill, 'stroke="#8f2a14" stroke-width=".5"') + st('M0 -2 L0 11', '#8f2a14', 0.7));
    return st('M58 6 C42 20 40 40 22 52 S8 70 4 84', '#5a3828', 3) + st('M40 32 C48 38 54 36 58 44', '#5a3828', 2) +
      [[44, 14, 1.1, 20, '#d9381e'], [52, 34, 1, -30, '#f08a24'], [28, 28, 1.1, -60, '#d9381e'], [14, 46, 1, 40, '#f08a24'], [30, 58, 1.1, -20, '#d9381e'], [48, 54, 0.9, 70, '#e8601c'], [14, 72, 1, 10, '#d9381e'], [36, 76, 0.9, -50, '#f08a24']].map((a) => leaf(...a)).join('');
  },
  // 11월 오동
  () => e(16, 66, 14, 10.5, '#2f8a4a', -22) + e(45, 70, 14, 10.5, '#3aa05a', 22) + e(30, 84, 12, 7.5, '#2f8a4a') + st('M30 90 L30 60', '#5a7a3a', 2) +
    [[30, 12], [18, 20], [43, 22], [30, 30], [23, 40], [37, 41], [30, 50]].map(([x, y], i) => e(x, y, 4.6, 6.2, i % 2 ? '#8e5bc4' : '#a577d4', (x - 30) * 2)).join('') + st('M30 10 L30 56', '#5a7a3a', 1),
  // 12월 버드나무 비
  () => st('M10 90 C13 62 8 40 14 10', '#5a3a28', 4.4) + [14, 22, 31, 41, 50].map((x, i) => st(`M${x} 8 C${x - 5} ${26 + i * 2} ${x + 5} ${46 + i * 3} ${x} ${60 + (i % 3) * 6}`, '#5aa86a', 1.7) + leavesAlong([[x, 8], [x - 5, 26 + i * 2], [x + 5, 46 + i * 3], [x, 60 + (i % 3) * 6]], '#79c387', 5, 2.4)).join('') +
    [[6, 40], [22, 54], [38, 36], [52, 56], [44, 76], [14, 76], [30, 80]].map(([x, y]) => st(`M${x} ${y} L${x - 3} ${y + 8}`, '#6f93bd', 0.9)).join(''),
];

// ---------- 동물·물건 ----------
const bird = (x, y, s, rot, body, wing, beak) =>
  at(x, y, s, rot, st('M-3 4 L-4 9 M2 4 L1 9', '#d9a066', 1) + f('M-6 0 L-17 -4 L-16 3Z', wing) + e(0, 0, 8.5, 5.2, body) + e(-1, -0.5, 5, 3, wing, -20) + c(7.2, -4, 3.8, body) + f('M10.4 -4.6 L15 -3.4 L10.4 -2.4Z', beak) + c(8.2, -5, 0.9, INK));
const crane = (x, y, s) =>
  at(x, y, s, 0, st('M-2 5 L-3 17 M3 5 L4 17', '#d9a066', 1.2) + f('M-8 0 L-19 -2 L-17 4 L-9 4Z', INK) + e(0, 0, 10.5, 6.4, '#fff', -12, 'stroke="#c9c9d2" stroke-width=".7"') +
    f('M-6 -2 L-14 -5 L-8 2Z', INK) + st('M6 -3 C12 -6 10 -14 12 -20', '#c9c9d2', 4.2) + st('M6 -3 C12 -6 10 -14 12 -20', '#fff', 3) + c(12.6, -21, 2.8, '#fff', 'stroke="#c9c9d2" stroke-width=".6"') + c(12.8, -23, 1.6, '#e63946') +
    f('M15 -21.6 L21 -20.4 L15 -19.4Z', '#f2a50c') + c(13.4, -21.6, 0.7, INK));
const boar = (x, y, s) =>
  at(x, y, s, 0, st('M-8 6 L-8 14 M-3 7 L-3 14 M5 7 L5 14 M10 6 L10 14', '#4a2a14', 2.2) + st('M-12 -2 Q-18 -6 -16 -11', '#4a2a14', 1.6) + e(0, 0, 14, 8.4, '#7a4a2c') + e(14, 2, 7.4, 6.4, '#6b3f24') +
    e(20, 4.6, 3.2, 2.7, '#e0a090') + f('M11 -4 L13 -10 L17 -3Z', '#4a2a14') + f('M17 6 L21 10 L16 8Z', '#fff') + c(15.6, 0, 1, '#fff') + c(15.8, 0, 0.5, INK) +
    st('M-6 -7 L-4 -3 M0 -8 L1 -4 M6 -7 L6 -3', '#4a2a14', 1));
const deer = (x, y, s) =>
  at(x, y, s, 0, st('M-8 5 L-9 15 M-4 6 L-4 15 M5 6 L5 15 M9 5 L10 15', '#8a5a2a', 2) + e(0, 0, 12.4, 6.8, '#c27a3c') + st('M8 -3 C12 -8 12 -12 12 -15', '#c27a3c', 5) + e(13.6, -16, 4.6, 3.3, '#cf8a48', -20) +
    st('M13 -19 L11 -27 M12 -23 L8 -25 M12 -22 L17 -26 M15 -19 L18 -27', '#6b4423', 1.3) + c(15.4, -16.6, 0.8, INK) + c(18, -15.5, 0.9, INK) +
    [[-5, -2], [0, 2], [5, -2], [-2, -4], [3, 3]].map(([a, b]) => c(a, b, 0.9, '#fff3dc')).join('') + f('M-12 -2 L-16 -5 L-12 2Z', '#fff3dc'));
const butterfly = (x, y, s, rot) =>
  at(x, y, s, rot, e(-5, -4, 6, 4.2, '#ff9f1c', -30, `stroke="${INK}" stroke-width=".8"`) + e(5, -4, 6, 4.2, '#ff9f1c', 30, `stroke="${INK}" stroke-width=".8"`) + e(-4, 4, 4.4, 3.2, '#ff7a1c', 30, `stroke="${INK}" stroke-width=".8"`) + e(4, 4, 4.4, 3.2, '#ff7a1c', -30, `stroke="${INK}" stroke-width=".8"`) +
    c(-6, -4, 1.3, '#fff') + c(6, -4, 1.3, '#fff') + e(0, 0, 1.2, 6, INK) + st('M0 -5 L-3 -10 M0 -5 L3 -10', INK, 0.7));
const geese = (x, y, s, rot) => at(x, y, s, rot, st('M-9 -2 Q-4 -9 0 0 Q4 -9 9 -2', INK, 2.4) + c(0, 1.4, 1.8, INK));
const swallow = (x, y, s, rot) =>
  at(x, y, s, rot, f('M-4 3 L-18 12 L-8 6Z', INK) + f('M-6 2 L-20 5 L-9 1Z', INK) + f('M0 -1 Q-6 -16 6 -18 Q2 -8 6 -1Z', '#1c2b52') + e(0, 0, 9, 4.6, '#1c2b52') + e(1, 2, 6, 2.8, '#fff') + c(8.4, -1.6, 3.4, '#1c2b52') + c(10.6, -0.4, 1.4, '#d63a2a') + c(9.2, -2.4, 0.7, '#fff'));
const phoenix = (x, y, s) =>
  at(x, y, s, 0, [['M-6 3 C-18 12 -22 24 -14 34', '#2a9d8f'], ['M-4 4 C-10 16 -8 28 0 36', '#e9c46a'], ['M-2 4 C0 16 6 24 12 30', '#e76f51'], ['M0 3 C8 10 16 14 22 14', '#3a6ea5']].map(([d, col]) => st(d, col, 2.6)).join('') +
    f('M-8 -2 C-6 -14 10 -16 14 -4 C10 6 -4 8 -8 -2Z', '#d93a3a') + f('M-6 -2 C-2 -12 6 -12 9 -4 C4 2 -2 3 -6 -2Z', '#2b6cb0') + e(9, -9, 4.2, 3.8, '#e8523b') + f('M12 -9.4 L18 -8 L12 -6.6Z', '#f2a50c') +
    st('M7 -12 L5 -19 M9 -12 L10 -19 M11 -11 L15 -17', '#e9c46a', 1.2) + c(10, -9.6, 0.8, INK));
const cup = (x, y, s) =>
  at(x, y, s, 0, f('M-11 -6 L11 -6 L8 6 Q0 10 -8 6Z', '#d62828', 'stroke="#8f1d1d" stroke-width=".8"') + e(0, -6, 11, 3, '#f06a5a', 0, 'stroke="#8f1d1d" stroke-width=".8"') + e(0, -6, 8.4, 1.8, '#7a1a1a') +
    f('M-3 8 L3 8 L2 13 L-2 13Z', '#b02020') + e(0, 14, 6.6, 1.8, '#8f1d1d') + st('M-6 -1 Q0 2 6 -1', '#ffd23f', 1) + c(-4, 2, 1, '#ffd23f') + c(4, 2, 1, '#ffd23f'));
const bridge = () => {
  let s = f('M2 70 L58 52 L58 60 L2 80Z', '#7a4a2a', 'stroke="#4a2a14" stroke-width=".8"');
  for (let i = 0; i < 8; i++) { const x = 6 + i * 7; s += st(`M${x} ${78 - i * 3.4} L${x + 1} ${70 - i * 3.4}`, '#4a2a14', 1); }
  return s + st('M2 66 L58 48', '#a8743a', 1.6) + st('M8 78 L8 66 M30 70 L30 58 M52 62 L52 50', '#4a2a14', 1.3);
};
const umbrellaMan = () =>
  f('M5 28 A25 15 0 0 1 55 28Z', '#d62828', 'stroke="#7a1010" stroke-width=".8"') + st('M30 13 L30 28 M17 17 L18 28 M43 17 L42 28', '#7a1010', 0.7) + st('M5 28 Q17 24 30 28 Q43 24 55 28', '#f4d35e', 1.2) +
  st('M30 28 L30 62', '#5a3a28', 1.4) + c(36, 40, 4.4, '#f5d6b0') + e(36, 36.4, 5, 2, INK) + st('M36 44 L38 48', '#a8743a', 0.8) +
  f('M31 46 L43 46 L47 72 L28 72Z', '#2e7d52', 'stroke="#1d5238" stroke-width=".8"') + st('M33 46 L36 72', '#7bc58f', 0.8) + st('M32 72 L30 82 M44 72 L46 82', INK, 1.8) + e(29, 83, 3.4, 1.4, INK) + e(47, 83, 3.4, 1.4, INK) +
  st('M43 52 L50 44', '#2e7d52', 2.6);
const moon = () => c(30, 26, 17, '#fff2b8', 'opacity=".5"') + c(30, 26, 13, '#ffe27a') + c(30, 26, 13, 'none', 'stroke="#e8b923" stroke-width=".8"') + c(26, 22, 2, '#ffd34d') + c(34, 30, 2.6, '#ffd34d');
const curtain = () => {
  let s = '';
  for (let i = 0; i < 6; i++) s += f(`M${i * 10} 8 L${i * 10 + 10} 8 L${i * 10 + 10} 36 Q${i * 10 + 5} 40 ${i * 10} 36Z`, i % 2 ? '#fff' : '#d62828', 'stroke="#7a1010" stroke-width=".6"');
  return s + st('M0 8 L60 8', '#5a3828', 2.4);
};
const sun = () => c(46, 16, 8.6, '#e63946', 'stroke="#fff" stroke-width="1"');

// ---------- 표시 ----------
const badge = () => c(9, 9, 7.2, '#d62828', 'stroke="#fff" stroke-width="1"') + `<text x="9" y="12.4" text-anchor="middle" font-size="9" font-weight="700" fill="#fff" font-family="serif">光</text>`;
const ssangMark = () => c(46, 83, 3.1, '#d62828', 'stroke="#fff" stroke-width=".9"') + c(53, 83, 3.1, '#d62828', 'stroke="#fff" stroke-width=".9"');
const RIBBON = { hong: ['#e23a3a', '#a01f1f', '홍단'], cho: ['#e23a3a', '#a01f1f', '초단'], cheong: ['#2f6fd0', '#1c4690', '청단'], plain: ['#e23a3a', '#a01f1f', ''] };
const ribbon = (kind) => {
  const [fill, edge, label] = RIBBON[kind];
  return g(f('M16 4 L44 4 L44 66 L30 60 L16 66Z', fill, `stroke="${edge}" stroke-width="1"`) + st('M19 7 L19 60', 'rgba(255,255,255,.35)', 1) +
    (label ? [...label].map((ch, i) => `<text x="30" y="${24 + i * 14}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" font-family="sans-serif">${ch}</text>`).join('') : ''), 'rotate(-5 30 34)');
};

const OVER = {                                           // 카드 번호 → 바탕 위에 얹는 그림
  0: () => sun() + crane(24, 56, 1),
  4: () => bird(40, 46, 1.2, -8, '#f4c20d', '#6b8e23', '#f2a50c'),
  8: () => curtain(),
  12: () => bird(32, 40, 1.3, -18, '#4a4a5a', '#23232f', '#d63a2a') + c(32, 40, 0, 'none'),
  16: () => bridge(),
  20: () => butterfly(20, 32, 1.3, -20) + butterfly(42, 58, 1.15, 25),
  24: () => boar(26, 58, 1),
  28: () => moon(),
  29: () => c(30, 30, 20, '#f0b24a', 'opacity=".85"') + geese(18, 22, 1, -10) + geese(34, 30, 1.1, 0) + geese(24, 40, 0.9, 6),
  32: () => cup(30, 50, 1.5),
  36: () => deer(26, 50, 1.15),
  40: () => phoenix(26, 40, 1.35),
  44: () => umbrellaMan(),
  45: () => swallow(34, 38, 1.5, -10),
};
const BASE_FILL = '#fbf4e2';
const body = (id) => {
  const c0 = L.card(id), m = c0.m, k = id & 3;
  let art = PLANT[m]();
  if (k === 3) art = g(art, 'translate(60 0) scale(-1 1)');             // 같은 달 피 두 장은 서로 거울처럼
  if (c0.kind === 'gwang') art += (OVER[id] || (() => ''))() + badge();
  else if (c0.kind === 'yeol') art += (OVER[id] || (() => ''))();
  else if (c0.kind === 'tti') art += ribbon(c0.tti);
  if (c0.ssang) art += ssangMark();
  return `<rect width="60" height="90" fill="${BASE_FILL}"/><rect x="2.5" y="2.5" width="55" height="85" rx="3" fill="none" stroke="#e1d2ac" stroke-width=".8"/>${art}`;
};

const NAMES = { gwang: '광', yeol: '열끗', tti: '띠', pi: '피' };
const label = (id) => { const c0 = L.card(id); return `${c0.m + 1}월 ${L.MONTH_NAMES[c0.m]} ${c0.kind === 'tti' ? ({ hong: '홍단', cho: '초단', cheong: '청단', plain: '띠' })[c0.tti] : c0.ssang ? '쌍피' : NAMES[c0.kind]}`; };
const sprite = () => `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true">${Array.from({ length: 48 }, (_, id) => `<symbol id="hw${id}" viewBox="0 0 60 90">${body(id)}</symbol>`).join('')}</svg>`;
const use = (id) => `<svg class="art" viewBox="0 0 60 90" aria-hidden="true"><use href="#hw${id}"/></svg>`;

if (typeof document !== 'undefined') {
  const put = () => document.body.insertAdjacentHTML('afterbegin', sprite());
  if (document.body) put(); else document.addEventListener('DOMContentLoaded', put);
}
return { body, sprite, use, label };
})();
if (typeof module !== 'undefined') module.exports = HWATU_ART;
