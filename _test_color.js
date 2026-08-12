/* 글자색·바탕색 짝의 명도 대비 검증. (배포 불필요)
   색 토큰은 index.html 에서 직접 읽으므로 값이 따로 놀 수 없다.
   기준 — 작은 글자 4.5:1, 굵거나 큰 글자·그래픽 3:1 (WCAG 2.1 AA) */
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

/* :root 와 :root[data-theme="dark"] 블록에서 토큰을 긁어 온다 */
function tokens(startAt){
  const i = html.indexOf(startAt);
  if (i < 0) throw new Error('토큰 블록을 찾지 못했습니다: ' + startAt);
  const block = html.slice(i, html.indexOf('}', i));
  const out = {};
  for (const m of block.matchAll(/--([\w-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g)) out[m[1]] = m[2];
  return out;
}
const light = tokens('  :root{');

const lin = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const L = h => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/* [글자, 바탕, 최소, 어디에 쓰이는지] — 실제로 화면에 겹쳐 나오는 짝만 넣는다 */
const pairs = [
  ['ink',    'surface',    4.5, '기록 본문'],
  ['ink',    'bg',         4.5, '기본 글자'],
  ['ink-2',  'surface',    4.5, '카드 안 보조'],
  ['ink-2',  'bg',         4.5, '본문 보조'],
  ['ink-2',  'accent-soft',4.5, '고른 줄의 꼬리표 · 읽기 지표 부제'],
  ['muted',  'surface',    4.5, '조절판 힌트 · 접힌 도움말'],
  ['muted',  'bg',         4.5, '조용한 명단 숫자'],
  ['muted',  'surface-2',  4.5, '표 머리글'],
  // accent-soft 는 선택된 줄·알약, accent-fill 은 요약 블록. 올라가는 글자가 다르다.
  ['accent', 'accent-soft',4.5, '고른 줄의 이름'],
  ['accent-2', 'accent-fill',4.5, '확인 대상 큰 숫자'],
  ['ink', 'accent-lite',4.5, '단추 글자'],
  ['accent-2','surface',4.5, '단추에 마우스 올렸을 때'],
  ['ink-2',  'accent-fill',4.5, '요약 블록의 항목 이름'],
  ['accent', 'surface',    4.5, '고른 학생 이름 · 수정됨 표시'],
  ['accent', 'bg',         4.5, '고른 학생 이름 (바탕 위)'],
  ['warn',   'bg',         4.5, '주의 단계 생존 숫자'],
  ['warn',   'accent-soft',4.5, '주의 단계 · 고른 줄'],
  ['danger', 'bg',         4.5, '낮은 생존 숫자'],
  ['danger', 'surface',    4.5, '같은 반 경고'],
  ['danger', 'warn-soft',  4.5, '같은 반 알약'],
  ['danger', 'accent-soft',4.5, '낮은 생존 · 고른 줄'],
  ['surface','danger',     4.5, 'r1 카드 개수 알약'],
  ['surface','warn',       4.5, 'r2 카드 개수 알약'],
  ['muted',  'surface-2',  3.0, '조용한 막대 (그래픽)'],
  ['warn',   'surface-2',  3.0, '주의 막대 (그래픽)'],
  ['danger', 'surface-2',  3.0, '낮음 막대 (그래픽)'],
  ['markA-ink','markA-bg', 4.5, '글자 겹침 표시'],
  ['markB-ink','markB-bg', 4.5, '골격 겹침 표시'],
  ['surface','markA-ink',  4.5, '유사 N명 칩 (글자 겹침)'],
  ['surface','markB-ink',  4.5, '유사 N명 칩 (골격 겹침)'],
];

let bad = 0;
for (const [mode, P] of [['밝은 화면', light]]){
  console.log('\n=== ' + mode + ' ===');
  for (const [f, b, min, what] of pairs){
    if (!P[f] || !P[b]){ console.log(`  ? 토큰 없음: ${f} / ${b}`); bad++; continue; }
    const r = ratio(P[f], P[b]);
    const ok = r >= min;
    if (!ok) bad++;
    console.log(`  ${ok ? ' ' : '✗'} ${r.toFixed(2).padStart(5)} : ${min}  ${what}`);
  }
}
console.log(bad ? `\n✗ ${bad}개 미달` : `\n통과 ${pairs.length} / ${pairs.length}\n모두 통과`);
process.exit(bad ? 1 : 0);
