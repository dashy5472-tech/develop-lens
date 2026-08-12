/* 색각 이상에서도 서로 구분되는지 본다. (배포 불필요)
   OKLab 거리(×100) 를 protan · deutan · tritan 에서 재고, 8 이상이면 통과,
   6~8 은 굵기·점선 같은 2차 표시가 함께 있을 때만 허용한다.
   색 토큰은 index.html 에서 직접 읽으므로 값이 따로 놀 수 없다.

   Machado(2009) 강도 1.0 행렬 — dataviz 스킬의 검증기와 같은 방식이라 수치를 그대로 비교할 수 있다. */
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function tokens(startAt){
  const i = html.indexOf(startAt);
  if (i < 0) throw new Error('토큰 블록 없음: ' + startAt);
  const block = html.slice(i, html.indexOf('}', i));
  const out = {};
  for (const m of block.matchAll(/--([\w-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g)) out[m[1]] = m[2];
  return out;
}
const MACHADO = {
  protan: [[0.152286,1.052583,-0.204868],[0.114503,0.786281,0.099216],[-0.003882,-0.048116,1.051998]],
  deutan: [[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]],
  tritan: [[1.255528,-0.076749,-0.178779],[-0.078411,0.930809,0.147602],[0.004733,0.691367,0.303900]]
};
const s2lin = c => c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
const lin = h => [1,3,5].map(i => parseInt(h.substr(i,2),16)/255).map(s2lin);
function oklab([r,g,b]){
  const l = Math.cbrt(0.4122214708*r + 0.5363325363*g + 0.0514459929*b);
  const m = Math.cbrt(0.2119034982*r + 0.6806995451*g + 0.1073969566*b);
  const s = Math.cbrt(0.0883024619*r + 0.2817188376*g + 0.6299787005*b);
  return [0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
          1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
          0.0259040371*l + 0.7827717662*m - 0.8086757660*s];
}
const sim = (h, k) => { const [r,g,b] = lin(h), M = MACHADO[k], cl = c => Math.max(0, Math.min(1, c));
  return [cl(M[0][0]*r + M[0][1]*g + M[0][2]*b),
          cl(M[1][0]*r + M[1][1]*g + M[1][2]*b),
          cl(M[2][0]*r + M[2][1]*g + M[2][2]*b)]; };
const dE = (a, b, k) => { const x = oklab(k ? sim(a,k) : lin(a)), y = oklab(k ? sim(b,k) : lin(b));
  return 100 * Math.hypot(x[0]-y[0], x[1]-y[1], x[2]-y[2]); };

/* 실제로 나란히 놓여 헷갈리면 곤란한 짝만 넣는다.
   second 가 true 면 색 말고 다른 표시가 함께 있는 자리라 6 까지 허용한다. */
const PAIRS = [
  // 칠 바로 뒤에 붙는 칩 글자가 '그대로 N명' / '문형 N명' 으로 서로 다르다.
  // 색을 못 가려도 어느 겹침인지 읽히므로 6 까지 허용한다.
  { a:'markA-bg',  b:'markB-bg',  what:'같은 문단 안의 두 겹침 표시', second:true, note:'칩 글자가 다름' },
  { a:'markA-ink', b:'markB-ink', what:'두 유사 인원 칩',            second:true, note:'칩 글자가 다름' },
  // 생존 분량은 같은 자리에서 색만 바뀐다 (성한 값 → 주의 → 경고).
  // 다만 숫자 값과 막대 길이가 같은 뜻을 한 번 더 말해 주므로 6 까지 허용한다.
  { a:'warn',  b:'danger', what:'주의 / 경고',      second:true, note:'숫자와 막대 길이' },
  { a:'muted', b:'warn',   what:'성한 값 / 주의',   second:true, note:'숫자와 막대 길이' },
  { a:'muted', b:'danger', what:'성한 값 / 경고',   second:true, note:'숫자와 막대 길이' },
];
/* 여기 없는 짝에 대하여 —
   ink-2 와 danger 는 요약의 경고 줄에서 나란히 놓이지만("5명 같은 반끼리 겹칩니다"),
   둘 중 하나를 고르는 자리가 아니라 한 문장의 강조다. 색을 못 가려도 문장은 그대로
   읽히고, 숫자 쪽이 더 굵고 크다. 그래서 검사에 넣지 않는다. */

const ok = [], fail = [], warnList = [];
for (const [mode, start] of [['밝은 화면', '  :root{']]){
  const T = tokens(start);
  console.log('\n=== ' + mode + ' ===');
  for (const p of PAIRS){
    const A = T[p.a], B = T[p.b];
    if (!A || !B){ fail.push(`${mode} ${p.what} — 토큰 없음`); continue; }
    const ds = { 정상: dE(A,B), protan: dE(A,B,'protan'), deutan: dE(A,B,'deutan'), tritan: dE(A,B,'tritan') };
    const worst = Math.min(ds.protan, ds.deutan, ds.tritan);
    const floor = p.second ? 6 : 8;
    const mark = worst >= 8 ? ' ' : worst >= floor ? '△' : '✗';
    if (worst >= 8) ok.push(1);
    else if (worst >= floor){ warnList.push(`${mode} · ${p.what} ΔE ${worst.toFixed(1)}${p.note ? ' — ' + p.note : ''}`); ok.push(1); }
    else fail.push(`${mode} · ${p.what} ΔE ${worst.toFixed(1)} (${floor} 필요)`);
    console.log(`  ${mark} ${p.what.padEnd(26)} 정상 ${ds.정상.toFixed(1).padStart(5)}` +
                `  protan ${ds.protan.toFixed(1).padStart(5)}` +
                `  deutan ${ds.deutan.toFixed(1).padStart(5)}` +
                `  tritan ${ds.tritan.toFixed(1).padStart(5)}`);
  }
}

if (warnList.length){
  console.log('\n△ 색만으로는 빠듯 — 2차 표시가 반드시 함께 있어야 하는 자리:');
  warnList.forEach(w => console.log('  · ' + w));
}
console.log('\n통과 ' + ok.length + ' / ' + (ok.length + fail.length));
if (fail.length){ fail.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('모두 통과');
