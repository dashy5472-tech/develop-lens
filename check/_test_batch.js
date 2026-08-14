/* 읽기 → 점검까지 한 번에 통과하는지 본다. (배포에 들어가지 않는다)

     node _test_batch.js

   파서만 맞고 점검이 깨지면 소용이 없다. 진짜 파일 206건을 실제 점검 함수에
   그대로 흘려보내, 한 건도 터지지 않는지 · 결과가 말이 되는지 확인한다.

   학생 이름과 세특 원문은 찍지 않는다. 룰별 적발 건수만 본다. */
const fs = require('fs');
const path = require('path');
const { APP, loadXLSX, loadNEIS } = require('./_lib.js');

const XLSX = loadXLSX();
const NEIS = loadNEIS();

const DESKTOP = path.join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop');
const FILE = path.join(DESKTOP, '전 과목 세특.xlsx');

if (!fs.existsSync(FILE)) {
  console.log('건너뜀 — 파일 없음: ' + FILE);
  process.exit(0);
}

/* 앱 코드를 가짜 화면 위에 올리고 점검 함수만 꺼내 온다.
   베껴 쓰지 않는 이유는 _lib.js 에 적어 두었다. */
const stub = () => ({
  hidden:false, open:false, value:'', textContent:'', innerHTML:'', checked:false, className:'',
  style:{}, dataset:{}, disabled:false, max:'',
  classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } },
  addEventListener(){}, setAttribute(){}, getAttribute(){ return null; },
  querySelector(){ return null; }, querySelectorAll(){ return []; },
  appendChild(){}, remove(){}, focus(){}, click(){}, scrollIntoView(){}, closest(){ return null; }
});
const document = {
  body:stub(), head:stub(), documentElement:stub(),
  getElementById(){ return stub(); }, querySelector(){ return stub(); },
  querySelectorAll(){ return []; }, createElement(){ return stub(); }, addEventListener(){}
};
const window = { requestAnimationFrame(){ return 0; }, setTimeout(){ return 0; }, clearTimeout(){}, print(){}, open(){ return null; }, addEventListener(){} };

const { analyzeText, countSeverities } = new Function(
  'document','window','XLSX','navigator','location','requestAnimationFrame','setTimeout','clearTimeout','console',
  APP + '\n;return { analyzeText, countSeverities };'
)(document, window, XLSX, { userAgent:'node' }, { href:'' }, () => 0, () => 0, () => {}, console);

let pass = 0, fail = 0;
const ok = (label, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (detail == null ? '' : '  → ' + detail)); }
};

const parsed = NEIS.parseWorkbook(XLSX, XLSX.read(fs.readFileSync(FILE), { type:'buffer' }));
console.log('■ 읽기');
ok('기록 206건', parsed.records.length === 206, parsed.records.length);

console.log('■ 206건 전부 점검');
const byRule = new Map();
const bySeverity = { error:0, warning:0, improvement:0 };
let crashed = 0, clean = 0;
const started = Date.now();
parsed.records.forEach(record => {
  let result = null;
  try { result = analyzeText(record.text); }
  catch (e) { crashed++; return; }
  if (!result.issues.length) clean++;
  result.issues.forEach(issue => {
    byRule.set(issue.id, (byRule.get(issue.id) || 0) + 1);
    if (bySeverity[issue.severity] != null) bySeverity[issue.severity]++;
  });
});
const took = Date.now() - started;

ok('한 건도 터지지 않음', crashed === 0, crashed + '건 터짐');
ok('결과가 나옴 (전부 무결로 나오지는 않음)', clean < parsed.records.length, '무결 ' + clean + '건');
ok('점검이 느리지 않음 (206건 3초 이내)', took < 3000, took + 'ms');

console.log('\n  206건 ' + took + 'ms · 무결 ' + clean + '건');
console.log('  등급별 적발: 오류 ' + bySeverity.error + ' · 주의 ' + bySeverity.warning + ' · 개선 ' + bySeverity.improvement);
console.log('  룰별 적발 (많은 순):');
[...byRule.entries()].sort((a, b) => b[1] - a[1]).forEach(([id, n]) => {
  console.log('    ' + id.padEnd(22) + String(n).padStart(5));
});

console.log('\n' + (fail === 0 ? '전체 통과' : '실패 ' + fail + '건') + ' (통과 ' + pass + ')');
process.exit(fail === 0 ? 0 : 1);
