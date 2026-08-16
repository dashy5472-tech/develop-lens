/* 줄바꿈을 어떻게 다루는지 검사. (배포에 들어가지 않는다)

     node _test_linebreak.js

   줄바꿈 자체는 잡지 않는다. 문단을 나누려고 줄을 바꾸는 것은 문제가 아니다.
   잡는 것은 '띄어쓰기를 하고 줄을 바꾼 자리' 다 — 그 공백은 화면에서 보이지
   않는데 나이스가 글자 수에 넣는다.

   경계가 한 칸이라 눈으로는 확인이 안 된다. 실제 파일에서 줄바꿈 22곳 중
   앞에 공백이 있는 자리는 1곳뿐이라, 경계가 흐려지면 21곳이 헛경고가 되거나
   진짜 1곳을 놓친다. 그래서 지어낸 문장으로 못 박고 실제 파일로 확인한다. */
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
const ids = text => analyzeText(text).issues.map(i => i.id);
const edge = text => analyzeText(text).issues.filter(i => i.id === 'LINE_EDGE_SPACE');

console.log('■ 줄바꿈만 있으면 잡지 않는다');
ok('줄바꿈 하나', ids('지식으로 확장함.\n1970년부터 살펴봄.').length === 0,
  ids('지식으로 확장함.\n1970년부터 살펴봄.').join(', '));
ok('줄바꿈 둘', ids('하나임.\n둘임.\n셋임.').length === 0);
ok('빈 줄', ids('앞 문장임.\n\n뒤 문장임.').length === 0);
ok('줄바꿈 룰은 꺼져 있다', ids('앞임.\n\n\n뒤임.').indexOf('LINE_BREAK') === -1);

console.log('■ 띄어쓰기하고 줄을 바꾸면 오류');
ok('줄바꿈 앞 공백 한 칸을 잡는다', edge('지식으로 확장함. \n1970년부터 살펴봄.').length === 1,
  edge('지식으로 확장함. \n1970년부터 살펴봄.').length);
ok('줄바꿈 앞 탭도 잡는다', edge('지식으로 확장함.\t\n1970년부터 살펴봄.').length === 1);
ok('줄이 여럿이면 각각 잡는다', edge('하나임. \n둘임. \n셋임.').length === 2);
ok('오류 등급이다', edge('확장함. \n1970년')[0].severity === 'error');
ok('탐지 표현을 공백으로 말한다', foundLabel(edge('확장함. \n1970년')[0]) === '공백 1칸',
  foundLabel(edge('확장함. \n1970년')[0]));
ok('줄을 바꿀 때 띄어쓰기가 필요 없다고 알린다',
  /띄어쓰기 없이/.test(edge('확장함. \n1970년')[0].suggestion),
  edge('확장함. \n1970년')[0].suggestion);

console.log('■ 줄바꿈과 상관없는 앞뒤 공백도 그대로 잡는다');
ok('줄 시작 공백', edge(' 지식으로 확장함.').length === 1);
ok('글 맨 끝 공백', edge('지식으로 확장함. ').length === 1);

console.log('■ 두 칸을 띄우고 줄을 바꾸면');
const two = ids('지식으로 확장함.  \n1970년부터 살펴봄.');
ok('연속 공백과 줄 끝 공백이 둘 다 걸린다',
  two.indexOf('MULTI_SPACE') >= 0 && two.indexOf('LINE_EDGE_SPACE') >= 0, two.join(', '));

console.log('■ 진짜 파일');
const FILE = path.join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop', '전 과목 세특.xlsx');
if (!fs.existsSync(FILE)) {
  console.log('  건너뜀 — 파일 없음: ' + FILE);
} else {
  const XLSX = loadXLSX();
  const NEIS = loadNEIS();
  const parsed = NEIS.parseWorkbook(XLSX, XLSX.read(fs.readFileSync(FILE), { type:'buffer' }));
  const texts = parsed.records.map(r => r.text);
  let breaks = 0, spaced = 0;
  texts.forEach(t => {
    for (let i = 0; i < t.length; i++) {
      if (t[i] !== '\n') continue;
      breaks++;
      if (t[i - 1] === ' ' || t[i - 1] === '\t') spaced++;
    }
  });
  const edgeHits = texts.filter(t => edge(t).length > 0).length;
  const breakHits = texts.filter(t => ids(t).indexOf('LINE_BREAK') >= 0).length;
  ok('줄바꿈 자체는 한 건도 안 잡는다', breakHits === 0, breakHits);
  ok('띄어쓰고 줄바꾼 자리만 잡는다', edgeHits === spaced, edgeHits + ' / ' + spaced);
  console.log('  줄바꿈 ' + breaks + '곳 중 앞에 공백이 있는 곳 ' + spaced + '곳 — 그 ' + edgeHits + '건만 오류');
}

console.log('\n' + (fail === 0 ? '전체 통과' : '실패 ' + fail + '건') + ' (통과 ' + pass + ')');
process.exit(fail === 0 ? 0 : 1);
