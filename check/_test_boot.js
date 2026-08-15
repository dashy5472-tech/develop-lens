/* 스크립트가 실제로 끝까지 실행되는지 본다. (배포에 들어가지 않는다)

     node _test_boot.js

   문법 검사만으로는 부족하다. 이 앱은 손잡이를 전부 DOMContentLoaded 안에서 거는데,
   그 안에서 한 줄이라도 걸려 넘어지면 그 아래 addEventListener 가 통째로 빠진다.
   화면은 멀쩡히 그려지고 단추만 죽는다 — 눈으로는 알아채기 어렵다.

   그래서 최소한의 가짜 화면 위에서 스크립트를 통째로 돌려 보고,
   끝까지 갔는지 · 단추가 다 걸렸는지 · 새로 넣은 칸이 마크업에 있는지 확인한다. */
const { HTML, APP } = require('./_lib.js');

const ids = [...HTML.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const made = new Map();
const listeners = new Map();

function makeEl(id) {
  return {
    id, hidden:false, open:false, value:'', textContent:'', innerHTML:'', checked:false,
    className:'', style:{}, dataset:{}, disabled:false, max:'', files:null,
    classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    addEventListener(ev){ const k = id + ':' + ev; listeners.set(k, (listeners.get(k) || 0) + 1); },
    removeEventListener(){}, setAttribute(){}, getAttribute(){ return null; },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    appendChild(){}, remove(){}, focus(){}, click(){}, scrollIntoView(){},
    closest(){ return null; }
  };
}
const get = id => { if (!made.has(id)) made.set(id, makeEl(id)); return made.get(id); };

let domReady = null;
const document = {
  body: makeEl('body'),
  head: makeEl('head'),
  documentElement: makeEl('html'),
  getElementById(id){ return ids.indexOf(id) >= 0 ? get(id) : null; },
  querySelector(sel){ const m = /^#([\w-]+)$/.exec(String(sel)); return m ? this.getElementById(m[1]) : null; },
  querySelectorAll(){ return []; },
  createElement(){ return makeEl('tmp'); },
  addEventListener(ev, fn){ if (ev === 'DOMContentLoaded') domReady = fn; }
};
const window = {
  matchMedia: () => ({ matches:false, addEventListener(){}, addListener(){} }),
  addEventListener(){}, print(){}, open(){ return null; },
  innerWidth:1440, innerHeight:900,
  requestAnimationFrame(){ return 0; }, setTimeout(){ return 0; }, clearTimeout(){},
  URL:{ createObjectURL(){ return ''; }, revokeObjectURL(){} }
};

let boom = null;
try {
  new Function('document','window','XLSX','navigator','location','requestAnimationFrame','setTimeout','clearTimeout','console',
    APP
  )(document, window, undefined, { userAgent:'node' }, { href:'' }, () => 0, () => 0, () => {}, console);
} catch (e) { boom = e; }

const ok = [], fail = [];
const chk = (name, cond) => (cond ? ok : fail).push(name);

if (boom) console.log('실행이 멈춘 자리:\n  ' + boom.message);
chk('스크립트가 끝까지 실행된다', !boom);

let domBoom = null;
if (!boom && domReady) {
  try { domReady(); } catch (e) { domBoom = e; }
}
if (domBoom) console.log('첫 화면 준비 중 멈춘 자리:\n  ' + domBoom.message);
chk('첫 화면 준비가 끝까지 간다', !!domReady && !domBoom);

/* 손잡이. 뒤쪽까지 걸렸는지 봐야 중간에 멈춘 걸 잡는다. */
const WIRED = ['copyButton','printButton',
               'excelFile','excelDropZone','sheetSelect','headerRowInput',
               'classNumberColumnSelect','nameColumnSelect','subjectColumnSelect','recordColumnSelect',
               'runBatchButton','resetBatchButton','batchFilter',
               'exportBatchButton','exportBatchPdfButton','batchTableBody'];
const dead = WIRED.filter(id => ![...listeners.keys()].some(k => k.startsWith(id + ':')));
if (dead.length) console.log('  연결 안 된 손잡이: ' + dead.join(', '));
chk('손잡이가 모두 걸린다', dead.length === 0);

/* 새로 넣은 읽기 결과 칸이 마크업에 실제로 있는지. 이름을 하나만 틀려도
   renderBatchReadout 이 null 을 만지며 조용히 죽는다. */
const NEEDED = ['batchReadout','readoutTag','readoutSheet','readoutRecords','readoutSubjects',
                'readoutJoined','readoutBreaks','readoutNote','manualMap','batchConfig'];
const missing = NEEDED.filter(id => ids.indexOf(id) < 0);
if (missing.length) console.log('  마크업에 없는 칸: ' + missing.join(', '));
chk('읽기 결과 칸이 마크업에 다 있다', missing.length === 0);

/* 밖으로 나가는 길이 하나도 없어야 한다. 이 앱의 존재 이유다. */
const LEAKS = [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /new\s+WebSocket/, /google\.script\.run/, /<script[^>]+src=/i];
const found = LEAKS.filter(re => re.test(HTML)).map(re => String(re));
if (found.length) console.log('  밖으로 나가는 길: ' + found.join(', '));
chk('밖으로 나가는 길이 없다', found.length === 0);

console.log('\n걸린 손잡이 ' + listeners.size + '개');
console.log('통과 ' + ok.length + ' / ' + (ok.length + fail.length));
if (fail.length) { fail.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('모두 통과');
