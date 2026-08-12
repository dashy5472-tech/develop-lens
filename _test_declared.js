/* 직접 적어 둔 활동명 검증. (배포 불필요)

   슬라이더는 "여럿이 쓰면 활동명일 것" 이라는 추측이다. 두 명만 쓴 수행평가명은
   그 추측에 걸리지 않아 감점 대상으로 남는다. 직접 적으면 인원과 상관없이 빠져야 한다. */
const lib = require('./_lib.js');
const analyze = lib.algo().analyze;
const o0 = lib.defaults();

const ACT = '2학기 융합탐구 프로젝트 수행평가에서';
const BOOK = '「침묵의 봄」';

/* 열 명 중 둘만 같은 수행평가를 했다. 기준 인원은 세 명이라 자동으로는 안 빠진다. */
const rows = [
  { cls:'1', no:'1', label:'1반 1번',
    text:`${ACT} ${BOOK}을 읽고 살충제가 먹이사슬을 타고 쌓인다는 대목에 의문을 품어 자료를 더 찾아봄.` },
  { cls:'1', no:'2', label:'1반 2번',
    text:`${ACT} ${BOOK}을 읽고 저자가 인과관계 대신 상관관계만 제시했다고 보아 원자료를 확인함.` },
];
for (let i = 3; i <= 10; i++) rows.push({
  cls:'2', no:String(i), label:`2반 ${i}번`,
  text:`${i}번 학생이 저마다 다르게 쓴 기록입니다. 주제도 방식도 겹치지 않게 적어 두었습니다. ${'가나다라마바사'[i-3]}`
});

const run = (declared) => analyze(rows, Object.assign({}, o0, { declared }));

const bare = run([]);
const with1 = run([ACT]);
const with2 = run([ACT, BOOK]);

const spans = r => r.per.slice(0,2).reduce((s,p) => s + p.a.length + p.b.length, 0);
const commons = r => r.per.slice(0,2).reduce((s,p) => s + p.common.length, 0);
const alive = r => Math.round(r.per[0].alive * 100);

console.log(`기준 인원 ${bare.commonN}명 (열 명의 ${o0.commonPct}%)`);
console.log(`적지 않았을 때   확인 대상 구간 ${spans(bare)}곳 · 공통 ${commons(bare)}곳 · 생존 ${alive(bare)}%`);
console.log(`활동명만 적었을 때 확인 대상 구간 ${spans(with1)}곳 · 공통 ${commons(with1)}곳 · 생존 ${alive(with1)}%`);
console.log(`도서명까지 적었을 때 확인 대상 구간 ${spans(with2)}곳 · 공통 ${commons(with2)}곳 · 생존 ${alive(with2)}%`);

const ok = [], fail = [];
const chk = (n, c) => (c ? ok : fail).push(n);

chk('두 명만 쓴 수행평가명은 자동으로는 안 빠진다 (그래서 이 칸이 필요하다)',
    bare.commonN > 2 && spans(bare) > 0);
chk('적어 두면 감점에서 빠진다', spans(with1) < spans(bare));
chk('빠진 구간은 공통 활동 쪽으로 옮겨진다', commons(with1) > commons(bare));
chk('생존 분량이 그만큼 올라간다', alive(with1) > alive(bare));
chk('둘 다 적으면 남는 게 없다', spans(with2) === 0 && alive(with2) === 100);
chk('직접 지정한 것은 표시가 남는다',
    with2.phraseC.some(x => x.dec) && !bare.phraseC.some(x => x.dec));
chk('적은 목록이 결과에 실려 나온다', with2.declared.length === 2);

/* 너무 짧은 것을 받으면 엉뚱한 곳까지 활동명으로 빠진다 */
chk('세 글자 이하는 무시한다', run(['읽고']).declared.length === 0);
chk('앞뒤 공백과 겹친 공백은 정리한다',
    run(['  2학기   융합탐구 프로젝트 수행평가에서 ']).declared[0] === ACT);
chk('적지 않은 사람의 기록은 건드리지 않는다',
    with2.per.slice(2).every((p, i) => p.alive === bare.per[i+2].alive));

/* ── 도려내기 — 활동명 뒤에 진짜 겹침이 붙어 있는 경우 ──────────
   통째로 빼면 뒤에 붙은 복붙까지 함께 사라진다. 활동명 자리만 잘라 내고
   나머지는 확인 대상으로 남아야 한다. */
const TAIL = '자료를 수집하고 분석하는 과정을 거쳤으며 그 결과를 보고서로 정리하여 발표하였음.';
const pair = [
  { cls:'1', no:'1', label:'1반 1번', text:`${ACT} ${TAIL}` },
  { cls:'1', no:'2', label:'1반 2번', text:`${ACT} ${TAIL}` },
].concat(rows.slice(2));

const p0 = analyze(pair, Object.assign({}, o0, { declared:[] }));
const p1 = analyze(pair, Object.assign({}, o0, { declared:[ACT] }));
const flagText = r => r.per[0].a.concat(r.per[0].b).map(s => s.text).join(' | ');
const decText  = r => r.per[0].common.map(s => s.text).join(' | ');

console.log('\n=== 활동명 뒤에 복붙이 붙은 경우 ===');
console.log('  적기 전 · 확인 대상 :', JSON.stringify(flagText(p0).slice(0, 70) + '…'));
console.log('  적은 뒤 · 확인 대상 :', JSON.stringify(flagText(p1)));
console.log('  적은 뒤 · 뺀 자리   :', JSON.stringify(decText(p1)));

chk('활동명 자리만 도려내고 뒤에 붙은 복붙은 남긴다',
    flagText(p1).indexOf('보고서로 정리하여') >= 0);
chk('도려낸 뒤 확인 대상에 활동명이 남지 않는다',
    flagText(p1).indexOf('융합탐구 프로젝트') < 0);
chk('도려낸 활동명은 공통 활동 쪽에 있다',
    decText(p1).indexOf('융합탐구 프로젝트') >= 0);
chk('생존 분량이 0 이 되지는 않는다 (복붙은 여전히 감점)',
    p1.per[0].alive > 0 && p1.per[0].alive < 0.9);

console.log('\n통과 ' + ok.length + ' / ' + (ok.length + fail.length));
if (fail.length){ fail.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('모두 통과');
