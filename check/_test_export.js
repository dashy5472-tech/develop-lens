/* 내보내기 검사 — 결과 Excel 과 학생별 PDF. (배포에 들어가지 않는다)

     node _test_export.js

   나이스에 되올릴 파일은 만들지 않는다. 교사가 확인할 Excel 과 PDF 두 개가 전부다.
   그래서 이 둘이 깨지면 앱이 하는 일의 절반이 없어진다.

   읽기 방식을 바꾸면서 '원본 행' 이 숫자에서 '12·17' 같은 글자로, '반/번호' 가
   '2학년 3반' + '1' 에서 '3/1' 로 바뀌었다. 내보내기가 그걸 그대로 받는지 본다.

   학생 이름과 세특 원문은 찍지 않는다 — 모양과 개수만 본다. */
const fs = require('fs');
const path = require('path');
const { APP, loadXLSX, loadNEIS } = require('./_lib.js');

const FILE = path.join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop', '전 과목 세특.xlsx');
if (!fs.existsSync(FILE)) {
  console.log('건너뜀 — 파일 없음: ' + FILE);
  process.exit(0);
}

const XLSX = loadXLSX();
const NEIS = loadNEIS();

/* 파일로 떨어뜨리지 않고 가로챈다. */
let written = null;
const xlsxForApp = Object.create(XLSX);
xlsxForApp.utils = XLSX.utils;
xlsxForApp.writeFile = (workbook, name) => { written = { workbook, name }; };

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

const app = new Function(
  'document','window','XLSX','navigator','location','requestAnimationFrame','setTimeout','clearTimeout','console',
  APP + '\n;return { analyzeText, getBatchStatus, toClassNumber, foundLabel, exportBatchWorkbook, buildBatchPrintHtml,' +
        '\n         pickPdfItems, pdfScopeLabel,' +
        '\n         setResults: value => { batchResults = value; } };'
)(document, window, xlsxForApp, { userAgent:'node' }, { href:'' }, () => 0, () => 0, () => {}, console);

let pass = 0, fail = 0;
const ok = (label, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (detail == null ? '' : '  → ' + detail)); }
};

/* runBatchCheck 가 만드는 모양 그대로 세운다. */
const parsed = NEIS.parseWorkbook(XLSX, XLSX.read(fs.readFileSync(FILE), { type:'buffer' }));
const results = parsed.records.map((record, index) => {
  const analysis = app.analyzeText(record.text);
  analysis.studentName = record.name;
  return {
    resultIndex:index,
    rowNumber:record.rows.join('·'),
    classNumber:app.toClassNumber(record) || '-',
    name:record.name,
    subject:record.subject || '-',
    text:record.text,
    analysis,
    status:app.getBatchStatus(analysis.counts)
  };
});
app.setResults(results);

console.log('■ 결과 Excel');
app.exportBatchWorkbook();
ok('파일을 만든다', !!written, '만들지 않음');
ok('이름이 세특_사전점검_결과_ 로 시작한다', written && /^세특_사전점검_결과_\d{8}\.xlsx$/.test(written.name), written && written.name);

const sheet = written.workbook.Sheets['점검 결과'];
ok('“점검 결과” 시트가 있다', !!sheet);
const grid = XLSX.utils.sheet_to_json(sheet, { header:1, defval:'', blankrows:true });
ok('머리글 + 206줄', grid.length === 207, grid.length);
ok('열이 11개다', grid[0].length === 11, grid[0].length);
ok('머리글이 그대로다',
  grid[0].join('|') === '원본 행|반/번호|성명|과목|상태|전체|오류|주의|개선 권고|탐지 항목|세특 원문',
  grid[0].join('|'));

const body = grid.slice(1);
ok('반/번호가 3/1 꼴이다', body.every(r => /^\d+\/\d+$/.test(String(r[1]))),
  JSON.stringify(body.map(r => String(r[1])).filter(v => !/^\d+\/\d+$/.test(v)).slice(0, 3)));
ok('과목이 다 채워져 있다', body.every(r => String(r[3]).trim().length > 0));
ok('쪽 경계에서 이어 붙인 40건은 원본 행이 두 개다',
  body.filter(r => String(r[0]).indexOf('·') !== -1).length === 40,
  body.filter(r => String(r[0]).indexOf('·') !== -1).length);
ok('세특 원문의 줄바꿈이 살아 있다 (22건)',
  body.filter(r => String(r[10]).indexOf('\n') !== -1).length === 22,
  body.filter(r => String(r[10]).indexOf('\n') !== -1).length);
/* 줄바꿈 자체는 이제 잡지 않는다. 원문에는 그대로 남지만(위 검사) 탐지 항목에는
   안 나온다. 나오는 것은 '띄어쓰기를 하고 줄을 바꾼' 한 자리뿐이다. */
ok('줄바꿈만 있는 기록은 탐지 항목에 안 나온다',
  body.filter(r => /줄바꿈/.test(String(r[9]))).length === 0,
  body.filter(r => /줄바꿈/.test(String(r[9]))).length);
ok('띄어쓰고 줄바꾼 자리는 줄 앞뒤 공백으로 나간다',
  body.filter(r => /줄 앞뒤 공백/.test(String(r[9]))).length === 1,
  body.filter(r => /줄 앞뒤 공백/.test(String(r[9]))).length);
/* 공백·줄바꿈을 잡은 항목이 빈칸으로 나가면 무엇을 잡았는지 알 수 없다.
   가운데점처럼 '·' 자체가 탐지 표현인 경우도 있으니, 눈에 보이는 글자냐만 본다. */
const blankLabels = results.flatMap(item => item.analysis.issues)
  .filter(issue => /^\s*$/.test(app.foundLabel(issue)));
ok('탐지 표현이 빈칸으로 나가는 항목이 없다', blankLabels.length === 0,
  blankLabels.length + '건 (' + [...new Set(blankLabels.map(i => i.id))].join(', ') + ')');
ok('무결 항목은 그렇게 적힌다', body.some(r => String(r[9]) === '명확한 위반 미발견'));

console.log('■ PDF 에 넣을 등급 고르기');
/* 한 기록에 여러 등급이 섞여 있으므로, 고른 등급이 하나라도 들어 있으면 넣는다.
   숫자는 실제 파일에서 세어 비교한다 — 손으로 적어 두면 규칙이 바뀔 때 같이 안 바뀐다. */
const has = (item, key) => item.analysis.counts[key] > 0;
const countIf = fn => results.filter(fn).length;
const ALL_OFF = { error:false, warning:false, improvement:false, clear:false };
const pick = over => app.pickPdfItems(Object.assign({}, ALL_OFF, over)).length;

ok('오류만 고르면 오류가 든 것만', pick({ error:true }) === countIf(r => has(r, 'error')),
  pick({ error:true }) + ' / ' + countIf(r => has(r, 'error')));
ok('주의만', pick({ warning:true }) === countIf(r => has(r, 'warning')));
ok('개선만', pick({ improvement:true }) === countIf(r => has(r, 'improvement')));
ok('무결만', pick({ clear:true }) === countIf(r => r.status === 'clear'));
ok('오류+주의는 둘 중 하나라도 든 것 (겹치는 것을 두 번 세지 않는다)',
  pick({ error:true, warning:true }) === countIf(r => has(r, 'error') || has(r, 'warning')),
  pick({ error:true, warning:true }) + ' / ' + countIf(r => has(r, 'error') || has(r, 'warning')));
ok('셋 다 고르면 예전 기본값과 같다 (무결 아닌 것 전부)',
  pick({ error:true, warning:true, improvement:true }) === countIf(r => r.status !== 'clear'),
  pick({ error:true, warning:true, improvement:true }) + ' / ' + countIf(r => r.status !== 'clear'));
ok('넷 다 고르면 전부', pick({ error:true, warning:true, improvement:true, clear:true }) === results.length);
ok('하나도 안 고르면 없음', pick({}) === 0);
ok('고른 등급을 말로 적는다',
  app.pdfScopeLabel({ error:true, warning:false, improvement:true, clear:false }) === '오류 · 개선 권고',
  app.pdfScopeLabel({ error:true, warning:false, improvement:true, clear:false }));

console.log('■ 학생별 PDF');
const flagged = results.filter(item => item.status !== 'clear');
const html = app.buildBatchPrintHtml(flagged, {
  totalCount:results.length, excludedCount:results.length - flagged.length, includeClear:false,
  scope:'오류 · 주의 · 개선 권고'
});
ok('HTML 이 나온다', typeof html === 'string' && html.length > 1000, typeof html);
ok('학생 수만큼 쪽이 나온다',
  (html.match(/class="student-page/g) || []).length === flagged.length,
  (html.match(/class="student-page/g) || []).length);
ok('교차점검 확인란이 들어간다', /교차점검 확인/.test(html));
ok('세특 원문 자리가 있다', /세특 원문/.test(html));
/* ↵ 는 '표시된 구간 안에 줄바꿈이 들어 있을 때' 만 찍힌다. 줄바꿈 룰을 끈 뒤로는
   줄바꿈을 표시하는 룰이 없으니 ↵ 도 안 나온다. 원문 자체는 pre-wrap 이라
   종이에서도 줄이 그대로 바뀐다. */
ok('줄바꿈 룰을 끈 뒤로는 ↵ 가 안 나온다', html.indexOf('↵') === -1);
ok('줄 앞뒤 공백 항목은 종이에 실린다', /줄 앞뒤 공백/.test(html));
ok('인쇄 안내가 들어간다', /PDF로 저장/.test(html));
ok('머리에 담은 등급을 적는다', /담은 등급 오류 · 주의 · 개선 권고/.test(html));
ok('닫히지 않은 태그로 끝나지 않는다', /<\/html>\s*$/.test(html));

console.log('■ 고른 등급의 항목만 찍기');
/* 쪽은 그대로 나오되 그 안의 항목만 걸러진다.
   원문 표시와 아래 목록이 같은 배열에서 나와야 번호가 어긋나지 않는다. */
const errItems = results.filter(item => item.analysis.counts.error > 0);
const allOnErrPages = errItems.reduce((n, item) => n + item.analysis.issues.length, 0);
const errOnly = errItems.reduce((n, item) =>
  n + item.analysis.issues.filter(i => i.severity === 'error').length, 0);

const meta = { totalCount:results.length, excludedCount:results.length - errItems.length, includeClear:false,
               scope:'오류' };
const htmlAll = app.buildBatchPrintHtml(errItems, meta);
const htmlOnly = app.buildBatchPrintHtml(errItems, Object.assign({}, meta, { onlyGrades:['error'] }));

const labels = html => (html.match(/class="issue-label">\[\d+\] ([^<]+)</g) || [])
  .map(m => m.replace(/.*\] /, '').replace('<', ''));
const pages = html => (html.match(/class="student-page/g) || []).length;

ok('쪽 수는 그대로다', pages(htmlOnly) === pages(htmlAll) && pages(htmlOnly) === errItems.length,
  pages(htmlOnly) + ' / ' + errItems.length);
ok('안 걸렀을 때는 항목이 전부 나온다', labels(htmlAll).length === allOnErrPages,
  labels(htmlAll).length + ' / ' + allOnErrPages);
ok('걸렀을 때는 오류만 나온다', labels(htmlOnly).length === errOnly,
  labels(htmlOnly).length + ' / ' + errOnly);
ok('주의·개선 딱지가 하나도 없다', labels(htmlOnly).every(t => t === '오류'),
  [...new Set(labels(htmlOnly))].join(', '));
/* 쪽마다 적힌 '숨긴 항목 N건' 을 다 더하면 실제로 뺀 수와 같아야 한다.
   여기가 어긋나면 종이가 거짓말을 하는 것이라 그냥 넘길 수 없다. */
const hiddenOnPaper = (htmlOnly.match(/숨긴 항목 <b>([\d,]+)건<\/b>/g) || [])
  .reduce((sum, m) => sum + Number(m.replace(/\D/g, '')), 0);
ok('쪽에 적힌 숨긴 수의 합이 실제와 같다', hiddenOnPaper === allOnErrPages - errOnly,
  hiddenOnPaper + ' / ' + (allOnErrPages - errOnly));
ok('무엇만 실었는지 적는다', /이 종이에는 <b>오류<\/b> 항목만 실었습니다/.test(htmlOnly));
ok('안 걸렀으면 그런 안내가 없다', htmlAll.indexOf('항목만 실었습니다') === -1);
/* 번호는 1부터 빠짐없이 이어져야 한다 — 거른 뒤 다시 매기지 않으면 [3][7] 처럼 튄다 */
const firstPage = htmlOnly.slice(0, htmlOnly.indexOf('class="student-page', 40));
const nums = (firstPage.match(/class="issue-label">\[(\d+)\]/g) || []).map(m => +m.replace(/\D/g, ''));
ok('번호가 1부터 이어진다', nums.every((n, i) => n === i + 1), nums.join(','));
ok('범례에 안 실린 등급은 안 나온다',
  firstPage.indexOf('key-color warning') === -1 && firstPage.indexOf('key-color improvement') === -1);

console.log('\n  Excel 207줄 · PDF ' + flagged.length + '쪽 (무결 ' + (results.length - flagged.length) + '건 제외)');
console.log('  오류만 찍기 — ' + errItems.length + '쪽, 항목 ' + allOnErrPages + ' → ' + errOnly + '건');
console.log('\n' + (fail === 0 ? '전체 통과' : '실패 ' + fail + '건') + ' (통과 ' + pass + ')');
process.exit(fail === 0 ? 0 : 1);
