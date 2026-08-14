/* 줄바꿈 룰 검사. (배포에 들어가지 않는다)

     node _test_linebreak.js

   줄바꿈은 눈에 안 보인다. 그래서 잘못 잡아도 · 못 잡아도 알아채기 어렵다.
   지어낸 문장으로 경계를 못 박고, 마지막에 진짜 파일에서 몇 건이 걸리는지 센다. */
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

const { analyzeText, foundLabel, buildHighlightedHtml } = new Function(
  'document','window','XLSX','navigator','location','requestAnimationFrame','setTimeout','clearTimeout','console',
  APP + '\n;return { analyzeText, foundLabel, buildHighlightedHtml };'
)(document, window, undefined, { userAgent:'node' }, { href:'' }, () => 0, () => 0, () => {}, console);

let pass = 0, fail = 0;
const ok = (label, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (detail == null ? '' : '  → ' + detail)); }
};
const breaks = text => analyzeText(text).issues.filter(i => i.id === 'LINE_BREAK');

console.log('■ 잡아야 하는 것');
ok('줄바꿈 하나를 잡는다', breaks('앞 문장임.\n뒤 문장임.').length === 1);
ok('떨어져 있는 줄바꿈 둘을 둘로 센다', breaks('하나임.\n둘임.\n셋임.').length === 2);
ok('빈 줄도 잡는다', breaks('앞 문장임.\n\n뒤 문장임.').length === 1);
ok('맨 앞 줄바꿈도 잡는다', breaks('\n앞 문장임.').length === 1);

console.log('■ 한 덩어리로 묶어야 하는 것');
ok('빈 줄은 한 번만 알린다', breaks('앞임.\n\n\n뒤임.').length === 1, JSON.stringify(breaks('앞임.\n\n\n뒤임.').length));
ok('공백만 있는 줄도 한 덩어리다', breaks('앞임.\n   \n뒤임.').length === 1);

console.log('■ 잡으면 안 되는 것');
ok('줄바꿈이 없으면 잡지 않는다', breaks('한 줄로만 쓴 문장임.').length === 0);
ok('빈 문자열에서 잡지 않는다', breaks('').length === 0);
ok('연속 공백만 있는 문장에서 잡지 않는다', breaks('두  칸 공백만 있음.').length === 0);

console.log('■ 등급과 안내');
const one = breaks('앞 문장임.\n뒤 문장임.')[0];
ok('주의 등급이다', one.severity === 'warning', one.severity);
ok('분류가 문장부호와 형식이다', one.category === '문장부호와 형식', one.category);
ok('나이스가 글자 수에 넣는다고 알린다', /글자 수/.test(one.reason), one.reason);

console.log('■ 눈에 보이게 만드는 부분');
ok('탐지 표현을 말로 바꾼다 — 줄바꿈 1개', foundLabel(one) === '줄바꿈 1개', foundLabel(one));
ok('빈 줄은 개수로 말한다', foundLabel(breaks('앞임.\n\n뒤임.')[0]) === '빈 줄 1개', foundLabel(breaks('앞임.\n\n뒤임.')[0]));
ok('연속 공백은 칸수로 말한다', foundLabel({ found:'  ' }) === '공백 2칸', foundLabel({ found:'  ' }));
ok('보통 표현은 그대로 둔다', foundLabel({ found:'탁월한' }) === '탁월한');
ok('아무것도 없으면 문장 전체', foundLabel({ found:'' }) === '문장 전체');

const text = '앞 문장임.\n뒤 문장임.';
const html = buildHighlightedHtml(text, analyzeText(text).issues);
ok('표시 화면에 ↵ 가 찍힌다', html.indexOf('↵') !== -1);
ok('줄바꿈 자체는 지우지 않는다', html.indexOf('↵\n') !== -1);

console.log('■ 진짜 파일');
const FILE = path.join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop', '전 과목 세특.xlsx');
if (fs.existsSync(FILE)) {
  const XLSX = loadXLSX();
  const NEIS = loadNEIS();
  const parsed = NEIS.parseWorkbook(XLSX, XLSX.read(fs.readFileSync(FILE), { type:'buffer' }));
  const hit = parsed.records.filter(r => breaks(r.text).length > 0).length;
  ok('줄바꿈이 든 22건을 모두 잡는다', hit === 22, hit);
  ok('나머지 184건은 건드리지 않는다', parsed.records.length - hit === 184, parsed.records.length - hit);
} else {
  console.log('  건너뜀 — 파일 없음');
}

console.log('\n' + (fail === 0 ? '전체 통과' : '실패 ' + fail + '건') + ' (통과 ' + pass + ')');
process.exit(fail === 0 ? 0 : 1);
