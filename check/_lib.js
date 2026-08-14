/* 검사들이 index.html 에서 코드를 꺼내 쓰는 공통 도구. (배포에 들어가지 않는다)

   돋보기의 _lib.js 와 같은 방식이다. 검사가 index.html 을 베껴 두면
   앱만 고치고 검사는 옛 코드를 통과시키는 일이 생긴다. 그래서 늘 잘라 온다. */
const fs = require('fs');
const path = require('path');

const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

/* 이 파일에는 <script> 가 두 개다. 앞이 앱 코드, 뒤가 인라인된 SheetJS. */
const SCRIPTS = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (SCRIPTS.length < 2) throw new Error('index.html 에서 script 두 개를 찾지 못했습니다.');
const APP = SCRIPTS[0];
const SHEETJS = SCRIPTS[1];

/* 두 표시 사이를 잘라 온다. 표시가 없으면 조용히 넘어가지 않고 바로 알린다. */
function cut(source, a, b) {
  const i = source.indexOf(a);
  if (i < 0) throw new Error('코드에서 찾지 못함: ' + a);
  const j = b ? source.indexOf(b, i) : source.length;
  if (j < 0) throw new Error('코드에서 찾지 못함: ' + b);
  return source.slice(i, j);
}

/* 앱에 인라인돼 있는 SheetJS 를 그대로 쓴다.
   node 에 따로 설치한 판을 쓰면, 앱이 실제로 쓰는 판과 달라도 검사가 통과한다. */
function loadXLSX() {
  const run = new Function('require', SHEETJS +
    '\n;if (typeof XLSX.read !== "function" && typeof make_xlsx_lib === "function") make_xlsx_lib(XLSX);' +
    '\n;return XLSX;');
  return run(require);
}

/* NEIS 읽기 부분만 떼어 온다. 화면도 DOM 도 건드리지 않는 조각이라 그대로 돈다. */
function loadNEIS() {
  const source = cut(APP, 'const NEIS = (function () {', '/* ─── NEIS 엑셀 읽기 끝');
  return new Function(source + '\n;return NEIS;')();
}

module.exports = { HTML, APP, SHEETJS, cut, loadXLSX, loadNEIS };
