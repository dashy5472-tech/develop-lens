/* 예시 학년이 의도한 그림을 실제로 만들어 내는지 확인한다. (배포 불필요)
   따라 하기 안내는 이 화면을 가리키며 설명하므로, 여기가 어긋나면 안내가 거짓말이 된다.
   설정은 index.html 의 기본값을 그대로 읽어 온다. */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const analyze = require('./_lib.js').algo().analyze;
const def = id => +html.match(new RegExp('id="' + id + '"[^>]*value="(\\d+)"'))[1];
const o = { charN:def('charN'), minSpan:def('minSpan'), commonPct:def('commonPct'),
            wordK:def('wordK'), minOthers:def('minOthers'), properDf:def('properDf') };

/* index.html 에 심어 둔 자료를 그대로 꺼내 쓴다 — 원본과 따로 놀 수 없게 */
const SAMPLE = new Function(script.slice(script.indexOf('const SAMPLE = (function'),
                                         script.indexOf('/* ─── 1. 파일 읽기')) + '\nreturn SAMPLE;')();

const head = SAMPLE[0];
const ci = head.indexOf('반/번호'), ct = head.indexOf('세부능력 및 특기사항');
const rows = SAMPLE.slice(1).map(r => {
  const [cls, no] = String(r[ci]).split('/');
  return { cls, no, label: `${cls}반 ${no}번`, text: String(r[ct]) };
});
const res = analyze(rows, o);
const { per } = res;
const at = (c, n) => rows.findIndex(r => r.cls === String(c) && r.no === String(n));

console.log(`설정 ${JSON.stringify(o)}`);
console.log(`학생 ${rows.length}명 · 공통 활동 기준 ${res.commonN}명 이상\n`);

const flagged = per.map((p, i) => ({ i, p })).filter(x => x.p.a.length || x.p.b.length);
console.log('=== 확인 대상 ===');
flagged.forEach(({ i, p }) => console.log(
  `  ${rows[i].label.padEnd(8)} 생존 ${String((p.alive*100).toFixed(0)).padStart(3)}%` +
  `  그대로 ${p.a.length}곳 · 문형 ${p.b.length}곳` +
  (p.sameCls ? `  · 같은 반 ${p.sameCls}명` : '')));

console.log('\n=== 공통 활동으로 제외 ===');
res.phraseC.forEach(x => console.log(`  ${x.n + 1}명  "${x.t}"`));
console.log('\n=== 문형 반복 ===');
res.phraseB.forEach(x => console.log(`  ${x.n + 1}명  "${x.t}"`));
console.log('\n=== 그대로 반복 ===');
res.phraseA.forEach(x => console.log(`  ${x.n + 1}명  "${x.t}"`));

const ok = [], fail = [];
const chk = (n, c) => (c ? ok : fail).push(n);
const P = (c, n) => per[at(c, n)];

chk('서른여섯 명이다', rows.length === 36);
/* 여기가 이 도구의 핵심 규칙이다.
   2반 네 명짜리 무리는 인원으로만 보면 기준을 넘어 활동명으로 빠져야 하는데,
   한 반에 몰려 있어서 빠지지 않는다. 인원이 아니라 '퍼진 모양' 으로 가르기 때문이다. */
chk('기준 인원이 전체보다 작다 (그래야 도입부가 활동명으로 빠진다)', res.commonN <= rows.length);
chk('인원만 보면 2반 무리도 기준을 넘는다', res.commonN <= 4);
chk('그런데도 한 반에 몰려 있어 확인 대상으로 남는다',
    [3,6,9,12].every(n => P(2,n).b.length > 0));
chk('세 반에 걸친 도입부는 활동명으로 빠진다',
    res.phraseC.some(x => x.t.indexOf('수행평가에서') >= 0));
chk('모두가 쓴 도입부가 공통 활동으로 빠진다',
    res.phraseC.some(x => x.t.indexOf('수행평가에서') >= 0 && x.n + 1 >= 30));

chk('1반 5번과 11번이 그대로 겹침으로 걸린다',
    P(1,5).a.length > 0 && P(1,11).a.length > 0);
chk('그 둘이 같은 반으로 표시된다', P(1,5).sameCls >= 1 && P(1,11).sameCls >= 1);

const tpl = [3,6,9,12].map(n => P(2,n));
chk('2반 네 명이 문형 겹침으로 걸린다', tpl.every(p => p.b.length > 0));
chk('그 네 명이 같은 반 겹침으로 표시된다', tpl.every(p => p.sameCls >= 3));
chk('그 무리가 공통 활동으로 잘못 빠지지 않는다',
    !res.phraseC.some(x => x.t.indexOf('근거로 결론을') >= 0));

const cross = [P(1,2), P(2,7), P(3,4)];
chk('반을 넘어 퍼진 문형 세 명도 걸린다', cross.every(p => p.b.length > 0));
chk('그 셋은 같은 반 겹침이 아니다', cross.every(p => !p.sameCls));

const planted = new Set([at(1,5),at(1,11),at(2,3),at(2,6),at(2,9),at(2,12),at(1,2),at(2,7),at(3,4)]);
chk('심어 둔 아홉 명만 걸리고 나머지는 조용하다',
    flagged.length === planted.size && flagged.every(x => planted.has(x.i)));
chk('고유하게 쓴 학생은 생존 분량이 100% 다',
    per.filter((_, i) => !planted.has(i)).every(p => p.alive > 0.999));
chk('걸린 학생은 생존 분량이 눈에 띄게 낮다',
    [...planted].every(i => per[i].alive < 0.9));
chk('한 반에 몰린 신호가 요약에 잡힌다', per.filter(p => p.sameCls > 0).length === 6);

/* 안내가 이름을 들어 가리키는 학생들이 실제로 그 상태여야 한다 */
const guide = script.slice(script.indexOf('const TOUR = ['), script.indexOf('let tourAt'));
const named = [...guide.matchAll(/selectStudent\('(\d+)',\s*'(\d+)'\)/g)].map(m => [m[1], m[2]]);
chk('안내가 여는 학생이 예시에 있다', named.length > 0 && named.every(([c,n]) => at(c,n) >= 0));
chk('안내가 "노란 칠" 이라 부르는 1반 5번이 실제로 그대로 겹침이다', P(1,5).a.length > 0);
chk('안내가 "하늘색 칠" 이라 부르는 2반 3번이 실제로 문형 겹침이다',
    P(2,3).b.length > 0 && P(2,3).a.length === 0);
chk('안내가 말하는 "1반 5번 생존 30%" 가 맞다',
    Math.round(P(1,5).alive * 100) === 30);
chk('안내가 말하는 "네 명이 모두 2반" 이 맞다',
    [3,6,9,12].every(n => rows[at(2,n)].cls === '2'));

/* 조절판이 "몇 명 이상" 이라고 말하는 숫자가 실제 계산과 같아야 한다.
   다르면 화면이 거짓말을 한다. */
const need = require('./_lib.js').algo().commonNeed;
chk('조절판이 말하는 기준 인원이 실제 계산과 같다', need(rows.length, o.commonPct) === res.commonN);
chk('인원이 달라져도 같이 움직인다',
    need(200, 12) === Math.max(3, Math.ceil(200 * 12 / 100)) && need(10, 5) === 3);

/* 길이 눈금은 슬라이더 최댓값까지 보여 줄 수 있어야 한다 */
const ruler = html.match(/const RULER = '([^']+)'/)[1];
const maxSpan = +html.match(/id="minSpan"[^>]*max="(\d+)"/)[1];
chk('길이 눈금 문장이 슬라이더 최댓값보다 길다', ruler.length >= maxSpan);

console.log('\n통과 ' + ok.length + ' / ' + (ok.length + fail.length));
if (fail.length){ fail.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('모두 통과');
