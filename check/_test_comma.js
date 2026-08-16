/* 쉼표 뒤 띄어쓰기 룰 검사. (배포에 들어가지 않는다)

     node _test_comma.js

   쉼표는 흔하다. 잘못 잡으면 모든 학생에게 헛경고가 붙고, 못 잡으면
   있으나 마나다. 숫자 자릿점(1,000)을 잡지 않는 것이 이 룰의 핵심이라
   경계를 지어낸 문장으로 못 박고, 마지막에 진짜 파일에서 몇 건인지 센다. */
const fs = require('fs');
const path = require('path');
const { APP, loadXLSX, loadNEIS } = require('./_lib.js');

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

const { analyzeText, foundLabel } = new Function(
  'document','window','XLSX','navigator','location','requestAnimationFrame','setTimeout','clearTimeout','console',
  APP + '\n;return { analyzeText, foundLabel };'
)(document, window, undefined, { userAgent:'node' }, { href:'' }, () => 0, () => 0, () => {}, console);

let pass = 0, fail = 0;
const ok = (label, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (detail == null ? '' : '  → ' + detail)); }
};
const hits = text => analyzeText(text).issues.filter(i => i.id === 'COMMA_SPACE');

console.log('■ 잡아야 하는 것');
ok('붙여 쓴 쉼표 셋을 셋으로 센다', hits('의료,교통,재난 분야를 살펴봄.').length === 2,
  hits('의료,교통,재난 분야를 살펴봄.').length);
ok('한 곳만 붙어 있으면 하나', hits('의료, 교통,재난 분야를 살펴봄.').length === 1);
ok('쉼표 뒤가 숫자라도 앞이 글자면 잡는다', hits('의료,3개 분야를 살펴봄.').length === 1);
ok('쉼표 뒤가 여는 괄호여도 잡는다', hits('세 분야,(의료 포함) 를 살펴봄.').length === 1);
ok('탐지 표현이 쉼표로 보인다', foundLabel(hits('의료,교통')[0]) === ',',
  JSON.stringify(foundLabel(hits('의료,교통')[0])));

console.log('■ 잡으면 안 되는 것');
ok('한 칸 띄운 쉼표는 넘어간다', hits('의료, 교통, 재난 분야를 살펴봄.').length === 0);
ok('숫자 자릿점은 넘어간다', hits('1,000자 분량을 1,200,000명과 견주어 봄.').length === 0,
  hits('1,000자 분량을 1,200,000명과 견주어 봄.').length);
ok('쉼표가 글 맨 끝이면 넘어간다', hits('앞 문장을 살펴봄,').length === 0);
ok('쉼표가 없으면 아무것도 안 잡는다', hits('의료 교통 재난 분야를 살펴봄.').length === 0);
ok('쉼표 뒤 줄바꿈은 이 룰이 안 잡는다 (줄바꿈 룰이 본다)',
  hits('앞 문장을 살펴봄,\n뒤 문장을 살펴봄.').length === 0);

console.log('■ 등급과 안내');
const one = hits('의료,교통')[0];
ok('오류 등급이다', one.severity === 'error', one.severity);
ok('분류가 문장부호와 형식이다', one.category === '문장부호와 형식');
ok('고칠 방법을 예시로 보여 준다', /의료, 교통, 재난/.test(one.suggestion), one.suggestion);

console.log('■ 진짜 파일');
const FILE = path.join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop', '전 과목 세특.xlsx');
if (!fs.existsSync(FILE)) {
  console.log('  건너뜀 — 파일 없음: ' + FILE);
} else {
  const XLSX = loadXLSX();
  const NEIS = loadNEIS();
  const parsed = NEIS.parseWorkbook(XLSX, XLSX.read(fs.readFileSync(FILE), { type:'buffer' }));
  const texts = parsed.records.map(r => r.text);
  const per = texts.map(t => hits(t).length);
  const flagged = per.filter(n => n > 0).length;
  /* 손으로 센 값과 대조한다. 룰이 흔들리면 여기서 먼저 걸린다. */
  const byHand = texts.reduce((sum, t) =>
    sum + [...t].filter((ch, i) =>
      ch === ',' &&
      i + 1 < t.length &&
      !/\s/.test(t[i + 1]) &&
      !(/\d/.test(t[i - 1] || '') && /\d/.test(t[i + 1]))).length, 0);
  const total = per.reduce((a, b) => a + b, 0);
  ok('손으로 센 것과 같다', total === byHand, total + ' / ' + byHand);
  console.log('  기록 ' + texts.length + '건 중 ' + flagged + '건에서 쉼표 ' + total + '곳');
}

console.log('\n' + (fail === 0 ? '전체 통과' : '실패 ' + fail + '건') + ' (통과 ' + pass + ')');
process.exit(fail === 0 ? 0 : 1);
