/* 구간 비교 검증. (배포 불필요)
   칠해진 구간을 눌렀을 때 상대 학생의 '그 자리' 를 제대로 짚는지 본다.
   그대로 겹침은 글자가 같아 쉽지만, 문형 겹침은 글자가 서로 달라
   골격에서 되짚어야 하므로 여기가 틀리면 엉뚱한 문장을 근거로 내민다. */
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const cut = (a, b) => script.slice(script.indexOf(a), script.indexOf(b));

const state = {};
const M = new Function('state',
  require('./_lib.js').ALGO + '\n' +
  cut('function findInPeer(', 'const MAX_CMP') +
  '\nreturn { analyze, findInPeer, markup:null };'
)(state);

const SAMPLE = new Function(cut('const SAMPLE = (function', '/* ─── 1. 파일 읽기') +
                            '\nreturn SAMPLE;')();
const def = id => +html.match(new RegExp('id="' + id + '"[^>]*value="(\\d+)"'))[1];
const o = { charN:def('charN'), minSpan:def('minSpan'), commonPct:def('commonPct'),
            wordK:def('wordK'), minOthers:def('minOthers'), properDf:def('properDf') };

const head = SAMPLE[0];
const ci = head.indexOf('반/번호'), ct = head.indexOf('세부능력 및 특기사항');
const rows = SAMPLE.slice(1).map(r => {
  const [cls, no] = String(r[ci]).split('/');
  return { cls, no, label:`${cls}반 ${no}번`, text:String(r[ct]) };
});
state.res = M.analyze(rows, o);
const { per } = state.res;
const at = (c, n) => rows.findIndex(r => r.cls === String(c) && r.no === String(n));

/* markup 이 만드는 것과 같은 모양의 구간 꾸러미 */
const pack = (i, kind) => per[i][kind].map(sp => ({ t: kind === 'a' ? 'a' : 'b', sp }));

const ok = [], fail = [];
const chk = (n, c) => (c ? ok : fail).push(n);
const show = (v, r) => r ? per[v].doc.slice(r[0], r[1]) : null;

// ── 그대로 겹침 — 1반 5번 ↔ 11번 ─────────────────────────
const me = at(1, 5), you = at(1, 11);
const aSpan = pack(me, 'a')[0];
const aHit = M.findInPeer(aSpan, you);
console.log('=== 그대로 겹침 ===');
console.log('  내 구간   ', JSON.stringify(aSpan.sp.text.slice(0, 40) + '…'));
console.log('  상대에서  ', JSON.stringify(String(show(you, aHit)).slice(0, 40) + '…'));
chk('그대로 겹침을 상대 본문에서 찾아낸다', !!aHit);
chk('찾은 글자가 내 구간과 똑같다', show(you, aHit) === aSpan.sp.text);

// ── 문형 겹침 — 2반 3 · 6 · 9 · 12번 ─────────────────────
const tpl = [3, 6, 9, 12].map(n => at(2, n));
const bSpan = pack(tpl[0], 'b')[0];
console.log('\n=== 문형 겹침 ===');
console.log('  골격      ', JSON.stringify(bSpan.sp.text));
let allFound = true, allDiffer = true, allPlausible = true;
for (const v of tpl){
  const r = M.findInPeer(bSpan, v);
  const got = show(v, r);
  console.log(`  ${rows[v].label.padEnd(8)} ${got === null ? '✗ 못 찾음' : JSON.stringify(got)}`);
  if (!r) { allFound = false; continue; }
  if (v !== tpl[0] && got === bSpan.sp.text) allDiffer = false;
  // 골격의 마스킹되지 않은 어절은 상대 문장에도 그대로 들어 있어야 한다
  const real = bSpan.sp.text.split(' ').filter(w => w !== '·');
  if (!real.every(w => got.indexOf(w) >= 0)) allPlausible = false;
}
chk('문형이 같은 네 명 모두에서 자리를 짚는다', allFound);
chk('짚어 온 문장이 서로 다르다 (글자가 아니라 틀이 같은 것)', allDiffer);
chk('골격의 실제 어절이 상대 문장에 모두 들어 있다', allPlausible);

// ── 엉뚱한 사람에게서는 찾히면 안 된다 ────────────────────
const stranger = at(3, 7);
chk('겹치지 않는 학생에게서는 찾지 않는다',
    M.findInPeer(bSpan, stranger) === null && M.findInPeer(aSpan, stranger) === null);

// ── 반을 넘어 퍼진 문형도 세 명 다 짚는지 ────────────────
const cross = [at(1,2), at(2,7), at(3,4)];
const cSpan = pack(cross[0], 'b')[0];
chk('반을 넘어 퍼진 문형도 모두 짚는다',
    cross.every(v => M.findInPeer(cSpan, v) !== null));

// ── 구간에 속한 사람 전체를 짚을 수 있는지 (한 명이라도 놓치면 근거가 빈다) ──
let missed = 0, total = 0;
per.forEach((p, i) => ['a','b'].forEach(kind => p[kind].forEach(sp => {
  const o2 = { t: kind, sp };
  sp.set.forEach(v => { if (v === i) return; total++; if (!M.findInPeer(o2, v)) missed++; });
})));
console.log(`\n구간에 속한 상대 ${total}건 중 못 짚은 것 ${missed}건`);
chk('예시 학년 전체에서 못 짚는 자리가 하나도 없다', missed === 0);

console.log('\n통과 ' + ok.length + ' / ' + (ok.length + fail.length));
if (fail.length){ fail.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('모두 통과');
