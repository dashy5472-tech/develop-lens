/* 문장 종결 룰 검사. (배포에 들어가지 않는다)

     node _test_ending.js

   명사형 종결은 '-(으)ㅁ' 이라 마지막 글자의 종성이 ㅁ이면 명사형이다.
   예전에는 함·됨·임… 서른두 자를 손으로 적어 두고 맞춰 봤는데, 그 목록에
   낌·띔·셈 같은 글자가 빠져 실제 파일에서 '느낌' 이 헛걸렸다.

   이 검사는 그 경계를 지킨다 — 종성이 ㅁ이면 넘어가고, 경어체·대화체는
   오류로, 그 밖의 종결은 주의로 잡는다. 목록으로 되돌아가면 여기서 걸린다. */
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

const { analyzeText } = new Function(
  'document','window','XLSX','navigator','location','requestAnimationFrame','setTimeout','clearTimeout','console',
  APP + '\n;return { analyzeText };'
)(document, window, undefined, { userAgent:'node' }, { href:'' }, () => 0, () => 0, () => {}, console);

let pass = 0, fail = 0;
const ok = (label, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (detail == null ? '' : '  → ' + detail)); }
};
const ending = text => analyzeText(text).issues.filter(i => i.id === 'ENDING');
const quiet = (label, text) => ok(label + '  ' + JSON.stringify(text), ending(text).length === 0,
  ending(text).map(i => i.severity + '/' + i.found).join(', '));

console.log('■ 명사형 종결은 넘어간다 (종성이 ㅁ)');
quiet('흔한 것', '자료를 비교하여 설명함.');
quiet('되다', '표현의 정확성이 높아짐.');
quiet('이다', '탐구 과정이 인상적임.');
quiet('있다', '오차가 생길 수 있음.');
quiet('예전 목록에 없던 것 — 느낌', '수업에서 흥미를 느낌.');
quiet('예전 목록에 없던 것 — 띔', '친구에게 귀띔.');
quiet('예전 목록에 없던 것 — 셈', '전체 변화량을 셈.');
quiet('예전 목록에 없던 것 — 뺌', '중복된 구간을 뺌.');

console.log('■ 겹받침 ㄻ 도 명사형이다');
quiet('앎', '스스로 모자란 부분을 앎.');
quiet('삶', '자료를 통해 본 삶.');

console.log('■ 경어체·대화체는 오류');
const polite = t => ending(t)[0];
ok('~하였습니다', polite('자료를 모아 정리하였습니다.').severity === 'error');
ok('~습니다', polite('결과를 표로 정리했습니다.').severity === 'error');
ok('~나요', polite('어떻게 생각하나요.').severity === 'error');
ok('제목이 경어체·대화체 종결이다', polite('정리하였습니다.').title === '경어체·대화체 종결',
  polite('정리하였습니다.').title);

console.log('■ 그 밖의 종결은 주의');
ok('~는가', ending('무엇이 문제인가.')[0].severity === 'warning');
ok('~했는가', ending('무엇이 원인을 대신했는가.')[0].severity === 'warning');
ok('제목이 명사형 종결 확인이다', ending('무엇이 문제인가.')[0].title === '명사형 종결 확인');
ok('평서형도 잡는다', ending('자료를 비교하여 설명했다.').length === 1,
  ending('자료를 비교하여 설명했다.').length);

console.log('■ 진짜 파일');
const FILE = path.join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop', '전 과목 세특.xlsx');
if (!fs.existsSync(FILE)) {
  console.log('  건너뜀 — 파일 없음: ' + FILE);
} else {
  const XLSX = loadXLSX();
  const NEIS = loadNEIS();
  const parsed = NEIS.parseWorkbook(XLSX, XLSX.read(fs.readFileSync(FILE), { type:'buffer' }));
  const hits = parsed.records.flatMap(r => ending(r.text));
  const words = hits.map(h => h.found);
  ok('종성이 ㅁ인 낱말은 한 건도 안 잡힌다',
    words.every(w => { const c = w.charCodeAt(w.length - 1);
      const j = (c >= 0xAC00 && c <= 0xD7A3) ? (c - 0xAC00) % 28 : -1;
      return j !== 16 && j !== 10; }),
    words.join(', '));
  console.log('  잡힌 종결 ' + hits.length + '건: ' + words.join(', '));
}

console.log('\n' + (fail === 0 ? '전체 통과' : '실패 ' + fail + '건') + ' (통과 ' + pass + ')');
process.exit(fail === 0 ? 0 : 1);
