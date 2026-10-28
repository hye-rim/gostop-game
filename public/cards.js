'use strict';

// 화투 48장 그림. 그림 파일은 public/cards/c00.webp ~ c47.webp (카드 번호 = 달 * 4 + 순서, logic.js 와 같다).
// 그림 출처와 라이선스는 public/cards/LICENSE.md 에 있다 (CC BY-SA 4.0, Marcus Richert · Louie Mantia Jr.).
const HWATU_ART = (() => {
const L = typeof LOGIC_GOSTOP !== 'undefined' ? LOGIC_GOSTOP : require('./logic.js');
const file = (id) => `cards/c${String(id).padStart(2, '0')}.webp`;
const NAMES = { gwang: '광', yeol: '열끗', tti: '띠', pi: '피' };
const TTI = { hong: '홍단', cho: '초단', cheong: '청단', plain: '띠' };
const label = (id) => {
  const c = L.card(id);
  return `${c.m + 1}월 ${L.MONTH_NAMES[c.m]} ${c.kind === 'tti' ? TTI[c.tti] : c.ssang ? '쌍피' : NAMES[c.kind]}`;
};
const use = (id) => `<img class="art" src="${file(id)}" alt="" draggable="false" decoding="async">`;
return { file, use, label, COUNT: 48 };
})();
if (typeof module !== 'undefined') module.exports = HWATU_ART;
