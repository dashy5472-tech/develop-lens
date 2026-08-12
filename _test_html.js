/* 표시 구조가 어긋나지 않았는지 본다. (배포 불필요)
   여는 태그와 닫는 태그의 짝, 그리고 코드가 손대는 id 가 실제로 있는지 확인한다.
   화면을 못 열어 보는 환경에서 마크업이 깨진 채 넘어가는 것을 막으려는 것이다. */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// <style> · <script> 안쪽은 표시 구조가 아니다
const html = src
  .replace(/<style>[\s\S]*?<\/style>/g, '')
  .replace(/<script>[\s\S]*?<\/script>/g, '');

const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr']);
const stack = [], errs = [];
for (const m of html.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)){
  const [, close, tag, attrs, self] = m;
  const name = tag.toLowerCase();
  if (VOID.has(name) || self) continue;
  if (!close){ stack.push({ name, at: m.index }); continue; }
  const top = stack.pop();
  if (!top) errs.push(`닫는 </${name}> 에 짝이 없습니다`);
  else if (top.name !== name) errs.push(`<${top.name}> 을 </${name}> 로 닫았습니다`);
}
stack.forEach(t => errs.push(`<${t.name}> 이 닫히지 않았습니다`));

// 코드가 찾는 id 가 실제 마크업에 있는지
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const script = src.match(/<script>([\s\S]*?)<\/script>/)[1];
const wanted = new Set([...script.matchAll(/\$\('#([\w-]+)'\)/g)].map(m => m[1]));
const missing = [...wanted].filter(x => !ids.has(x));

// 두 번 쓰인 id
const seen = new Set(), dup = [];
for (const m of html.matchAll(/\sid="([^"]+)"/g)){
  if (seen.has(m[1])) dup.push(m[1]); else seen.add(m[1]);
}

// 위계 점검 — 손으로 박은 글자 크기가 남아 있으면 눈금이 무너진다
const rogue = [...src.matchAll(/font-size:\s*(?!var\()([^;"']+)/g)]
  .map(m => m[1].trim())
  .filter(v => v !== '15px' && !v.startsWith('clamp('));

/* 코드가 만들어 붙이는 HTML 은 위 검사에 안 잡힌다.
   innerHTML 에 넣는 템플릿에서 ${...} 를 걷어 내고 뼈대만 짝을 맞춰 본다. */
function stripExpr(s){
  let out = '', i = 0;
  while (i < s.length){
    if (s[i] === '$' && s[i+1] === '{'){
      let d = 1; i += 2;
      while (i < s.length && d){ if (s[i] === '{') d++; else if (s[i] === '}') d--; i++; }
      continue;
    }
    out += s[i++];
  }
  return out;
}
function balance(frag){
  const st = [], bad = [];
  for (const m of frag.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)){
    const [, close, tag, , self] = m;
    const name = tag.toLowerCase();
    if (VOID.has(name) || self) continue;
    if (!close){ st.push(name); continue; }
    const top = st.pop();
    if (top !== name) bad.push(`<${top || '없음'}> ↔ </${name}>`);
  }
  st.forEach(t => bad.push(`<${t}> 안 닫힘`));
  return bad;
}
/* 대입문 끝까지 읽는다. 괄호·따옴표·역따옴표 깊이를 세지 않으면
   화살표 함수 안쪽 첫 세미콜론에서 잘려 아무것도 검사하지 못한다. */
function stmtAfter(s, from){
  let i = from, par = 0, brc = 0, brk = 0, q = null;
  while (i < s.length){
    const c = s[i], p = s[i-1];
    if (q){
      if (c === '\\'){ i += 2; continue; }
      if (c === q) q = null;
      else if (q === '`' && c === '$' && s[i+1] === '{'){ brc++; i += 2; continue; }
      else if (q === '`' && c === '}' && brc > 0){ brc--; }
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`'){ q = c; i++; continue; }
    if (c === '(') par++; else if (c === ')') par--;
    else if (c === '{') brc++;  else if (c === '}') brc--;
    else if (c === '[') brk++;  else if (c === ']') brk--;
    else if (c === ';' && par <= 0 && brc <= 0 && brk <= 0) return s.slice(from, i);
    i++;
  }
  return s.slice(from);
}
const tplErrs = [];
let found = 0;
for (const m of script.matchAll(/\.innerHTML\s*=\s*/g)){
  const body = stmtAfter(script, m.index + m[0].length);
  if (body.indexOf('<') < 0) continue;
  found++;
  const bad = balance(stripExpr(body));
  if (bad.length) tplErrs.push(bad.join(' · '));
}

/* 따라 하기 안내는 화면의 한 곳을 비춘다. 가리킬 곳이 없으면 안내가 헛돈다.
   $('#..') 로 찾지 않고 querySelector 로 찾으므로 위 검사에 안 걸린다. */
const tourSrc = script.slice(script.indexOf('const TOUR = ['), script.indexOf('let tourAt'));
const tourSel = [...tourSrc.matchAll(/sel:'#([\w-]+)'/g)].map(m => m[1]);
const tourMissing = tourSel.filter(x => !ids.has(x));
const tourSteps = (tourSrc.match(/title:'/g) || []).length;

const ok = [], fail = [];
const chk = (n, c) => (c ? ok : fail).push(n);
chk('여는 태그와 닫는 태그의 짝이 맞는다', errs.length === 0);
chk('안내가 가리키는 곳이 모두 있다', tourMissing.length === 0);
chk('안내에 걸음이 들어 있다 (검사가 헛돌지 않게)', tourSteps >= 8 && tourSel.length >= 6);

/* 조절판은 "아는 것 → 어림하는 것" 차례로 놓여 있고, 안내도 같은 차례로 짚어야 한다.
   한쪽만 바꾸면 안내가 엉뚱한 곳을 가리키며 설명하게 된다. */
const KNOBS = ['commonList', 'minSpan', 'commonPct'];
const panel = html.slice(html.indexOf('<div class="ctrl-in">'), html.indexOf('<details class="more">'));
const shown = [...panel.matchAll(/<label for="(\w+)"/g)].map(m => m[1]).filter(x => KNOBS.indexOf(x) >= 0);
const guided = tourSel.filter(x => KNOBS.indexOf(x) >= 0);
if (shown.join(' → ') !== KNOBS.join(' → ')) console.log('  조절판 차례: ' + shown.join(' → '));
if (guided.join(' → ') !== KNOBS.join(' → ')) console.log('  안내 차례:   ' + guided.join(' → '));
chk('조절판이 활동명 → 최소 길이 → 공통 기준 차례다', shown.join() === KNOBS.join());
chk('안내도 같은 차례로 짚는다', guided.join() === KNOBS.join());
if (tourMissing.length) console.log('  없는 안내 대상: ' + tourMissing.join(', '));
chk('코드가 만드는 HTML 의 태그 짝이 맞는다', tplErrs.length === 0);
chk('검사할 템플릿을 실제로 찾았다 (검사가 헛돌지 않게)', found >= 6);
tplErrs.slice(0, 6).forEach(e => console.log('  템플릿: ' + e));
chk('코드가 찾는 id 가 모두 있다', missing.length === 0);
chk('같은 id 를 두 번 쓰지 않았다', dup.length === 0);
chk('글자 크기가 모두 눈금(var) 을 쓴다', rogue.length === 0);

errs.slice(0, 8).forEach(e => console.log('  구조: ' + e));
if (missing.length) console.log('  없는 id: ' + missing.join(', '));
if (dup.length) console.log('  겹친 id: ' + dup.join(', '));
if (rogue.length) console.log('  눈금 밖 크기: ' + [...new Set(rogue)].join(', '));

console.log('\n통과 ' + ok.length + ' / ' + (ok.length + fail.length));
if (fail.length){ fail.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('모두 통과');
