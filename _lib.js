/* 검사들이 index.html 에서 코드를 꺼내 쓰는 공통 도구. (배포 불필요)

   검사마다 따로 잘라 쓰던 것을 한 곳에 모았다. 흩어져 있으면 코드가 조금만
   옮겨져도 어떤 검사는 통과하고 어떤 검사는 "정의되지 않음" 으로 죽는다.
   실제로 commonNeed 를 파일 위쪽으로 옮겼을 때 그런 일이 났다. */
const fs = require('fs');
const path = require('path');

const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const SCRIPT = HTML.match(/<script>([\s\S]*?)<\/script>/)[1];

/* 두 표시 사이를 잘라 온다. 표시가 없으면 조용히 빈 문자열을 주지 않고 바로 알린다 —
   그래야 검사가 헛돌지 않는다. */
function cut(a, b){
  const i = SCRIPT.indexOf(a);
  if (i < 0) throw new Error('코드에서 찾지 못함: ' + a);
  const j = b ? SCRIPT.indexOf(b) : SCRIPT.length;
  if (j < 0) throw new Error('코드에서 찾지 못함: ' + b);
  if (j <= i) throw new Error('자를 범위가 뒤집힘: ' + a + ' … ' + b);
  return SCRIPT.slice(i, j);
}

/* 계산 부분 전체. commonNeed 는 조절판이 먼저 부르는 탓에 파일 맨 위에 있어
   clamp 부터 자르면 빠진다. 그래서 두 조각을 이어 붙인다. */
const ALGO = cut('const commonNeed =', '/* 나이스 글자수') + '\n' +
             cut('const clamp =', '/* ─── 4. 화면');

const NETSRC = () => cut('const NET =', 'function renderNet');

/* 브라우저 전역을 최소한만 흉내 낸다 */
function stubs(state){
  return {
    state: state || {},
    window: { matchMedia: () => ({ matches:false, addEventListener(){} }) },
    document: { body:{} },
    getComputedStyle: () => ({ getPropertyValue: () => '#000000' })
  };
}

/* 계산 함수들을 꺼낸다. extra 로 덧붙일 코드를 더 줄 수 있다. */
function algo(extra, state){
  const s = stubs(state);
  const src = ALGO + (extra ? '\n' + extra : '') +
    '\nreturn { analyze, clamp, commonNeed, normalize, splitWords, ' +
    'buildWordDf, maskWords, pickSpans' + (extra ? ', ...(typeof __more === "function" ? __more() : {})' : '') + ' };';
  return new Function('state','window','document','getComputedStyle', src)(
    s.state, s.window, s.document, s.getComputedStyle);
}

/* index.html 에 심어 둔 예시 학년 */
function sample(){
  return new Function(cut('const SAMPLE = (function', '/* ─── 1. 파일 읽기') +
                      '\nreturn SAMPLE;')();
}

/* 조절판의 기본값 — 검사가 화면과 같은 설정으로 돌게 한다 */
function defaults(){
  const def = id => {
    const m = HTML.match(new RegExp('id="' + id + '"[^>]*value="(\\d+)"'));
    if (!m) throw new Error('기본값을 못 찾음: ' + id);
    return +m[1];
  };
  return { charN:def('charN'), minSpan:def('minSpan'), commonPct:def('commonPct'),
           wordK:def('wordK'), minOthers:def('minOthers'), properDf:def('properDf') };
}

/* 예시 학년을 분석에 넣을 모양으로 바꾼다 */
function sampleRows(){
  const g = sample(), head = g[0];
  const ci = head.indexOf('반/번호'), ct = head.indexOf('세부능력 및 특기사항');
  return g.slice(1).map(r => {
    const [cls, no] = String(r[ci]).split('/');
    return { cls, no, label:`${cls}반 ${no}번`, text:String(r[ct]) };
  });
}

module.exports = { HTML, SCRIPT, cut, ALGO, NETSRC, algo, sample, sampleRows, defaults, stubs };
