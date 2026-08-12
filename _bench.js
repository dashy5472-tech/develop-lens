/* 200명 규모에서 계산 시간을 잰다. (배포 불필요)
   사용: node _bench.js "<실제 xlsx 경로>" */
const fs = require('fs');
const path = require('path');
const lib = require(path.join(__dirname, '_readxlsx.js'));

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const FORM = new Function(script.slice(script.indexOf('const FORM ='),
                                       script.indexOf('/* ─── 1. 파일 읽기')) + '\nreturn FORM;')();
const analyze = require('./_lib.js').algo().analyze;
const def = id => +html.match(new RegExp('id="' + id + '"[^>]*value="(\\d+)"'))[1];
const o = { charN:def('charN'), minSpan:def('minSpan'), commonPct:def('commonPct'),
            wordK:def('wordK'), minOthers:def('minOthers'), properDf:def('properDf') };

const grid = lib.read(process.argv[2]);
const head = grid[0].map(h => String(h).replace(/_x000D_/g,'').replace(/[\s()·・]/g,''));
const idx = role => {
  const { loose, names } = FORM.alias[role];
  return head.findIndex(h => h && names.some(a => loose ? h.indexOf(a) >= 0 : h === a));
};
const ct = idx('text'), ci = idx('no');

const base = [];
for (let r = 1; r < grid.length; r++){
  const text = String(grid[r][ct] ?? '').trim();
  if (text.length >= 10) base.push({ id: String(grid[r][ci] ?? r).trim(), text });
}

/* 실제 기록을 늘려 표본을 만든다.
   ① 그대로 복제 — 공유 조각이 많아 집합이 커지는 쪽
   ② 어절을 조금씩 바꿔 복제 — 서로 다른 조각이 많아지는 쪽
   둘 중 느린 쪽을 상한으로 본다. */
function grow(n, perturb){
  const out = [];
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; out.length < n; i++){
    const src = base[i % base.length];
    let text = src.text;
    if (perturb){
      const ws = text.split(' ');
      for (let k = 0; k < ws.length; k++){
        if (rnd() < 0.18) ws[k] = ws[k] + '가' + Math.floor(rnd() * 900);
      }
      text = ws.join(' ');
    }
    out.push({ id: `${Math.floor(out.length / 30) + 1}반 ${out.length % 30 + 1}번`, text });
  }
  return out;
}

const time = rows => {
  analyze(rows, o);                       // 워밍업
  const t = process.hrtime.bigint();
  const r = analyze(rows, o);
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  const chars = rows.reduce((s, x) => s + x.text.length, 0);
  const flagged = r.per.filter(p => p.a.length || p.b.length).length;
  return { ms, chars, flagged, common: r.commonC || r.phraseC.length, commonN: r.commonN };
};

console.log(`설정 ${JSON.stringify(o)}\n`);
console.log('표본            학생   총글자   계산시간   확인대상   공통표현');
for (const n of [25, 50, 100, 200, 400]){
  for (const [tag, perturb] of [['그대로 복제', false], ['변형 복제', true]]){
    const rows = grow(n, perturb);
    const r = time(rows);
    console.log(
      `${tag.padEnd(12)} ${String(n).padStart(5)} ${String(r.chars).padStart(8)} ` +
      `${(r.ms.toFixed(0) + 'ms').padStart(9)} ${String(r.flagged).padStart(9)} ${String(r.common).padStart(9)}`);
  }
}
console.log('\n※ 실시간 재계산이 쓸 만하려면 200명에서 300ms 안쪽이어야 한다.');

/* 관계망 배치도 O(n²) 이라 따로 잰다. 설정을 바꿀 때마다 다시 그려지므로
   여기가 느리면 슬라이더가 끊긴다. */
const netSrc = script.slice(script.indexOf('const NET ='), script.indexOf('function renderNet'));
const stateStub = {};
const win = { matchMedia: () => ({ matches:false, addEventListener(){} }) };
const M = new Function('state','window','document','getComputedStyle',
  require('./_lib.js').ALGO + '\n' + netSrc +
  '\nreturn { analyze, buildGraph, relax3, project, NET };'
)(stateStub, win, { body:{} }, () => ({ getPropertyValue: () => '#000000' }));

console.log('\n=== 관계망 3D 배치 시간 ===');
console.log('점    선     반복    배치시간   한 프레임(투영)');
for (const n of [30, 60, 120, 200]){
  const rows = grow(n, false).map((r, i) => Object.assign({}, r, { cls: String(Math.floor(i/30)+1) }));
  stateStub.res = M.analyze(rows, o);
  const g = M.buildGraph();
  if (!g.nodes.length){ console.log(`  (${n}명: 겹치는 학생 없음)`); continue; }

  const R = M.NET.R, ga = Math.PI * (3 - Math.sqrt(5)), N = g.nodes.length;
  const iters = N > 150 ? 120 : 260;
  const t = process.hrtime.bigint();
  const pos = new Map();
  g.nodes.forEach((id, k) => {
    const y = N <= 1 ? 0 : 1 - (k/(N-1))*2;
    const rr = Math.sqrt(Math.max(0, 1-y*y)), th = ga*k;
    pos.set(id, { x:Math.cos(th)*rr*R, y:y*R, z:Math.sin(th)*rr*R, vx:0, vy:0, vz:0 });
  });
  const links = g.edges.map(e => [pos.get(e.a), pos.get(e.b)]);
  for (let i=0;i<iters;i++) M.relax3(g.nodes, pos, links, null);
  const ms = Number(process.hrtime.bigint() - t) / 1e6;

  // 매 프레임 하는 일 — 위치 보간 + 투영 + 정렬 (그리기 자체는 캔버스 몫)
  const t2 = process.hrtime.bigint();
  for (let f=0; f<60; f++){
    const pr = new Map();
    for (const id of g.nodes) pr.set(id, M.project(pos.get(id)));
    g.edges.slice().sort((a,b) => (pr.get(b.a).z+pr.get(b.b).z)-(pr.get(a.a).z+pr.get(a.b).z));
    g.nodes.slice().sort((a,b) => pr.get(b).z - pr.get(a).z);
  }
  const fps = Number(process.hrtime.bigint() - t2) / 1e6 / 60;

  console.log(`${String(N).padStart(4)} ${String(g.edges.length).padStart(6)} ` +
              `${String(iters).padStart(6)} ${(ms.toFixed(0)+'ms').padStart(9)} ` +
              `${(fps.toFixed(2)+'ms').padStart(14)}`);
}
