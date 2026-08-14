/* 실제 나이스 세특 파일로 열 인식과 기본값을 확인한다. (배포 불필요)
   사용: node _test_neis.js "<xlsx 경로>"
   주의: index.html 의 loadGrid 안 매칭 로직과 아래 byName 은 같은 규칙이어야 한다.

   계산부는 _lib.js 를 거쳐 꺼낸다. 예전에는 여기서 'const clamp' 부터 직접
   잘라 왔는데, commonNeed 는 조절판이 먼저 부르는 탓에 파일 위쪽에 있어서
   그 조각에 안 들어왔다. 그래서 analyze 를 부르는 순간
   "commonNeed is not defined" 로 죽었다 — 열 인식까지 멀쩡히 찍고 나서.
   _lib.js 가 두 조각을 이어 붙이는 일을 이미 하고 있으니 그걸 쓴다.
   자르는 자리는 한 곳에만 둔다. */
const path = require('path');
const xlsx = require(path.join(__dirname, '_readxlsx.js'));
const lib = require(path.join(__dirname, '_lib.js'));

const FORM = new Function(lib.cut('const FORM =', '/* \u2500\u2500\u2500 1. 파일 읽기') + '\nreturn FORM;')();
const analyze = lib.algo().analyze;

const file = process.argv[2];
if (!file){
  console.log('쓸 파일을 알려 주세요.\n');
  console.log('  node _test_neis.js "<xlsx 경로>"\n');
  console.log('나이스에서 내려받은 세특 파일이면 됩니다.');
  console.log('지어낸 예시로 도는 검사는 _test_sample.js 입니다.');
  process.exit(0);
}
const grid = xlsx.read(file);
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

/* 세특 열을 못 찾았으면 아래 루프는 빈 배열만 만든다. 그러면 '줄이 없다' 는
   엉뚱한 말이 나온다 — 줄이 없는 게 아니라 어느 칸을 읽어야 할지 모르는 것이다.
   조회 다운로드본을 넣으면 실제로 여기에 걸린다. 업로드 양식이라야 읽는다. */
if (ct < 0){
  console.log('');
  console.log('세특 내용 열을 찾지 못했습니다 — 이 파일은 업로드 양식이 아닌 듯합니다.');
  const shown = head.map(h => String(h).trim()).filter(Boolean).join(' | ');
  if (shown) console.log('머리글: ' + shown);
  else console.log('첫 줄이 비어 있습니다 — 머리글이 다른 줄에 있는 조회 다운로드본일 수 있습니다.');
  console.log('나이스 [세특 업로드 양식] 으로 내려받은 파일을 넣어 주세요.');
  process.exit(0);
}

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

/* 빈 업로드 양식처럼 세특이 적힌 줄이 하나도 없으면 아래는 전부 0 으로 나누게 된다.
   열 인식까지는 이미 확인했으니 여기서 곱게 멈춘다. */
if (!rows.length){
  console.log('\n세특이 적힌 줄이 없습니다 — 열 인식까지만 확인했습니다.');
  console.log('빈 업로드 양식이라면 정상입니다. 학생이 든 파일로 다시 돌려 보세요.');
  process.exit(0);
}

// 기본값은 index.html 의 입력칸에서 그대로 읽는다 — 검사가 실제 배포값과 어긋나지 않게.
// 읽는 규칙은 _lib.js 에 한 벌만 둔다.
const o = lib.defaults();
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
console.log(`\n=== 최소 구간 길이 × 공통 활동 기준 → 확인 필요 인원 / ${per.length}명 ===`);
const pcts = [10, 12, 16, 20, 30];
console.log('         ' + pcts.map(p => (p + '%').padStart(6)).join(''));
[13, 16, 20, 25, 30].forEach(ms => {
  const cells = pcts.map(pc => {
    const r = analyze(rows, Object.assign({}, o, { minSpan: ms, commonPct: pc }));
    return String(r.per.filter(p => p.a.length || p.b.length).length).padStart(6);
  });
  console.log(String(ms).padStart(6) + '자' + cells.join(''));
});
