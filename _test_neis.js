/* 실제 나이스 세특 파일로 열 인식과 기본값을 확인한다. (배포 불필요)
   사용: node _test_neis.js "<xlsx 경로>"
   주의: index.html 의 loadGrid 안 매칭 로직과 아래 byName 은 같은 규칙이어야 한다. */
const fs = require('fs');
const path = require('path');
const lib = require(path.join(__dirname, '_readxlsx.js'));

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// index.html 에서 FORM 과 계산부를 그대로 떼어 온다
const FORM = new Function(script.slice(script.indexOf('const FORM ='),
                                       script.indexOf('/* ─── 1. 파일 읽기')) + '\nreturn FORM;')();
const analyze = new Function(script.slice(script.indexOf('const clamp ='),
                                          script.indexOf('/* ─── 4. 화면')) + '\nreturn analyze;')();

const grid = lib.read(process.argv[2]);
const head = grid[0];

const flat = head.map(h => String(h).replace(/_x000D_/g,'').replace(/[\s()·・]/g,''));
const byName = role => {
  const { loose, names } = FORM.alias[role];
  return flat.findIndex(h => h && names.some(a => loose ? h.indexOf(a) >= 0 : h === a));
};
const ct = byName('text'), ci = byName('no'), cc = byName('cls'), cn = byName('name');

console.log('=== 열 인식 ===');
console.log(`  내용   ${ct}  ${ct >= 0 ? head[ct] : '(못 찾음)'}`);
console.log(`  반/번호 ${ci}  ${ci >= 0 ? head[ci] : '(못 찾음)'}`);
console.log(`  반     ${cc}  ${cc >= 0 ? head[cc] : '(따로 없음 — 정상)'}`);
console.log(`  성명   ${cn}  ${cn >= 0 ? head[cn] : '(못 찾음)'}`);

const rows = [];
for (let r = 1; r < grid.length; r++){
  const text = String(grid[r][ct] ?? '').trim();
  if (text.length < 10) continue;
  const raw = String(grid[r][ci] ?? '').trim();
  let cls = '', no = raw;
  if (raw.indexOf('/') >= 0){
    const p = raw.split('/'); cls = p[0].trim(); no = p.slice(1).join('/').trim();
  }
  rows.push({ cls, no, id: (cls ? cls + '반 ' : '') + (no || r) + '번', text });
}
console.log(`\n=== 라벨 ===\n  ${rows.slice(0,3).map(r => r.id).join(' / ')} … 총 ${rows.length}명`);

// 기본값은 index.html 의 입력칸에서 그대로 읽는다 — 테스트가 실제 배포값과 어긋나지 않게
const def = id => {
  const m = html.match(new RegExp('id="' + id + '"[^>]*value="(\\d+)"'));
  if (!m) throw new Error('기본값을 찾지 못함: ' + id);
  return +m[1];
};
const o = { charN:def('charN'), minSpan:def('minSpan'), commonPct:def('commonPct'),
            wordK:def('wordK'), minOthers:def('minOthers'), properDf:def('properDf') };
console.log('\n=== index.html 기본값 ===\n  ' + JSON.stringify(o));
const res = analyze(rows, o);
const per = res.per;
const avg = per.reduce((s,p) => s + p.alive, 0) / per.length;
const flagged = per.filter(p => p.a.length || p.b.length).length;

console.log(`\n=== 기본값 결과 (공통 활동 기준 ${res.commonN}명 이상) ===`);
console.log(`  평균 생존 분량   ${(avg*100).toFixed(0)}%`);
console.log(`  확인 필요 학생   ${flagged} / ${per.length}명`);
console.log(`  평균 글자 수     ${Math.round(per.reduce((s,p)=>s+p.len,0)/per.length)}자`);

const order = per.map((p,i)=>i).sort((x,y) => per[x].alive - per[y].alive);
console.log('\n  생존 분량 낮은 순 5명');
order.slice(0,5).forEach(i => console.log(
  `    ${rows[i].id.padEnd(9)} ${(per[i].alive*100).toFixed(0).padStart(3)}%  ` +
  `글자 ${(per[i].aRate*100).toFixed(0)}% / 골격 ${(per[i].bRate*100).toFixed(0)}%  구간 ${per[i].a.length+per[i].b.length}`));

const show = (t, l) => {
  console.log('\n[' + t + ']');
  if (!l.length) return console.log('  (없음)');
  l.slice(0,6).forEach(p => console.log(`  ${String(p.n+1).padStart(2)}명  "${p.t.slice(0,60)}"`));
};
show('확인 필요 · 글자 그대로 반복', res.phraseA);
show('확인 필요 · 문형 반복', res.phraseB);
show('공통 활동으로 제외', res.phraseC);

// 두 값을 같이 흔들어 본다 — 확인 필요 인원(명)
console.log('\n=== 최소 구간 길이 × 공통 활동 기준 → 확인 필요 인원 / 25명 ===');
const pcts = [10, 12, 16, 20, 30];
console.log('         ' + pcts.map(p => (p + '%').padStart(6)).join(''));
[13, 16, 20, 25, 30].forEach(ms => {
  const cells = pcts.map(pc => {
    const r = analyze(rows, Object.assign({}, o, { minSpan: ms, commonPct: pc }));
    return String(r.per.filter(p => p.a.length || p.b.length).length).padStart(6);
  });
  console.log(String(ms).padStart(6) + '자' + cells.join(''));
});
