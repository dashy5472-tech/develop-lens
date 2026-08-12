/* 스크립트가 실제로 끝까지 실행되는지 본다. (배포 불필요)

   문법 검사만으로는 부족하다. `분석 시작` 이 안 눌리던 일이 그 예다 —
   화면 그리기 전에 부르는 함수가 아래쪽 const 를 건드려 그 자리에서 멈췄는데,
   문법은 멀쩡해서 아무 검사도 잡지 못했다. 실행하다 멈추면 그 뒤의
   addEventListener 가 전부 등록되지 않아 단추가 죽는다.

   그래서 최소한의 가짜 DOM 위에서 스크립트를 통째로 돌려 보고,
   끝까지 갔는지 · 단추가 다 연결됐는지 확인한다. */
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

/* 마크업에 있는 id 를 그대로 가진 가짜 화면 */
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const made = new Map();
const listeners = new Map();          // "id:event" → 몇 개 걸렸나

function makeEl(id){
  const el = {
    id, hidden:false, value:'', textContent:'', innerHTML:'', checked:false,
    className:'', style:{}, dataset:{}, disabled:false,
    classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    addEventListener(ev){ const k = id + ':' + ev; listeners.set(k, (listeners.get(k)||0)+1); },
    removeEventListener(){}, setAttribute(){}, getAttribute(){ return null; },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    appendChild(){}, remove(){}, focus(){}, click(){}, scrollIntoView(){},
    getBoundingClientRect(){ return { top:0, left:0, width:0, height:0, bottom:0, right:0 }; },
    getContext(){ return null; }, closest(){ return null; }
  };
  return el;
}
const get = id => { if (!made.has(id)) made.set(id, makeEl(id)); return made.get(id); };

const document = {
  body: Object.assign(makeEl('body'), { dataset:{ phase:'setup' } }),
  documentElement: makeEl('html'),
  querySelector(sel){
    const m = /^#([\w-]+)$/.exec(String(sel));
    return m ? (ids.indexOf(m[1]) >= 0 ? get(m[1]) : null) : null;
  },
  querySelectorAll(){ return []; },
  createElement(){ return makeEl('tmp'); },
  addEventListener(){}
};
const window = {
  matchMedia: () => ({ matches:false, addEventListener(){}, addListener(){} }),
  addEventListener(ev){ listeners.set('window:' + ev, (listeners.get('window:'+ev)||0)+1); },
  innerWidth:1440, innerHeight:900, devicePixelRatio:1,
  requestAnimationFrame(){ return 0; }, cancelAnimationFrame(){},
  URL:{ createObjectURL(){ return ''; }, revokeObjectURL(){} },
  setTimeout(){ return 0; }, clearTimeout(){}
};

let boom = null;
try {
  new Function('document','window','requestAnimationFrame','cancelAnimationFrame',
               'getComputedStyle','setTimeout','clearTimeout','XLSX','navigator','location',
    script
  )(document, window, () => 0, () => {},
    () => ({ getPropertyValue: () => '#000000' }), () => 0, () => {},
    undefined, { userAgent:'node' }, { href:'' });
} catch (e){
  boom = e;
}

const ok = [], fail = [];
const chk = (n, c) => (c ? ok : fail).push(n);

if (boom){
  console.log('실행이 멈춘 자리:\n  ' + boom.message);
  const line = String(boom.stack || '').split('\n')[1];
  if (line) console.log('  ' + line.trim());
}
chk('스크립트가 끝까지 실행된다', !boom);

/* 끝까지 갔다면 단추들이 실제로 연결돼 있어야 한다.
   중간에 멈추면 그 아래 것들만 조용히 빠지므로 뒤쪽 단추까지 확인한다. */
const WIRED = ['run','sampleBtn','tourBtn','reset','exportBtn','editBtn','saveBtn',
               'cancelBtn','copyBtn','revertBtn','pasteBtn','addBtn','drop',
               'tourNext','tourPrev','tourQuit','spinBtn','netReset','colText'];
const dead = WIRED.filter(id => !listeners.has(id + ':click') &&
                                !listeners.has(id + ':change') &&
                                !listeners.has(id + ':input'));
if (dead.length) console.log('  연결 안 된 단추: ' + dead.join(', '));
chk('단추가 모두 연결된다', dead.length === 0);
chk('검사가 헛돌지 않는다 (연결을 실제로 세고 있다)', listeners.size >= 20);

console.log('\n연결된 손잡이 ' + listeners.size + '개');
console.log('통과 ' + ok.length + ' / ' + (ok.length + fail.length));
if (fail.length){ fail.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('모두 통과');
