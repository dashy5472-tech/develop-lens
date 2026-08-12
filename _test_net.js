/* 관계망 구성 검증. (배포 불필요) */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const algo = require('./_lib.js').ALGO;      // 계산부는 한 곳에서만 꺼낸다
const net  = script.slice(script.indexOf('const NET ='),   script.indexOf('function renderNet'));

// 브라우저 전역을 최소한만 흉내 낸다 (NET 초기화가 matchMedia 를 본다)
const state = {};
const win = { matchMedia: () => ({ matches:false, addEventListener(){} }) };
const doc = { body:{} };
const getComputedStyle = () => ({ getPropertyValue: () => '#000000' });
const M = new Function('state','window','document','getComputedStyle',
  algo + '\n' + net + '\nreturn { analyze, buildGraph, relax3, project, unrot, NET };'
)(state, win, doc, getComputedStyle);

const P = '2학기 융합탐구 프로젝트 수행평가에서 ';
const rows = [
  { cls:'1', id:'1', text: P + '「침묵의 봄」을 읽고 환경 문제에 대한 관심을 키웠으며 적극적으로 탐구하는 자세를 보임.' },
  { cls:'1', id:'2', text: P + '「이기적 유전자」를 읽고 환경 문제에 대한 관심을 키웠으며 적극적으로 탐구하는 자세를 보임.' },
  { cls:'2', id:'3', text: P + '「총 균 쇠」를 읽고 역사 문제에 대한 관심을 키웠으며 적극적으로 탐구하는 자세를 보임.' },
  { cls:'1', id:'4', text: P + '「침묵의 봄」을 읽고, 저자가 인과관계 대신 상관관계만 제시한 대목에 의문을 제기함. 이를 확인하려 지역 하천 세 곳의 수질 자료를 오 년치 비교했고, 강수량 변수를 통제하지 못한 점을 스스로 한계로 지적함.' },
  { cls:'2', id:'5', text: P + '모둠 토론에서 자료의 출처가 블로그라는 점을 지적해 팀의 결론을 뒤집었고, 다시 찾은 통계청 자료로 발표문을 새로 씀.' },
  { cls:'2', id:'6', text: P + '탄소중립을 주제로 논문을 읽고 실험을 설계해 결과를 도출하였으며 보고서로 정리함' },
  { cls:'2', id:'7', text: P + '유전자가위를 주제로 서적을 읽고 조사를 설계해 자료를 도출하였으며 포스터로 정리함' }
];

state.res = M.analyze(rows, { charN:8, minSpan:16, commonPct:50, wordK:5, minOthers:1, properDf:1 });
const g = M.buildGraph();

const nm = i => `${rows[i].cls}반 ${rows[i].id}번`;
console.log('=== 그린 점 ===');
g.nodes.forEach(i => console.log(`  ${nm(i)}  연결 ${g.deg.get(i)}개`));
console.log('\n=== 선 ===');
g.edges.forEach(e => {
  const same = rows[e.a].cls === rows[e.b].cls;
  console.log(`  ${nm(e.a)} ↔ ${nm(e.b)}  ${same ? '같은 반(굵은 실선)' : '다른 반(가는 점선)'}`);
});
console.log(`\n겹침 없어 안 그린 학생: ${rows.length - g.nodes.length}명`);

// ── 3차원 배치 ────────────────────────────────────────────
const R = M.NET.R;
function layout(nodes, edges){
  const pos = new Map(), n = nodes.length, ga = Math.PI * (3 - Math.sqrt(5));
  nodes.forEach((id, k) => {                       // 피보나치 나선 — 구 위에 고르게
    const y = n <= 1 ? 0 : 1 - (k/(n-1))*2;
    const rr = Math.sqrt(Math.max(0, 1-y*y)), th = ga*k;
    pos.set(id, { x:Math.cos(th)*rr*R, y:y*R, z:Math.sin(th)*rr*R, vx:0, vy:0, vz:0 });
  });
  const links = edges.map(e => [pos.get(e.a), pos.get(e.b)]);
  for (let i=0;i<260;i++) M.relax3(nodes, pos, links, null);
  return pos;
}
const p1 = layout(g.nodes, g.edges);
const p2 = layout(g.nodes, g.edges);
const key = p => g.nodes.map(i => { const q = p.get(i);
  return [q.x,q.y,q.z].map(v => v.toFixed(4)).join(','); }).join('|');
const dist3 = (a,b) => { const p=p1.get(a), q=p1.get(b);
  return Math.hypot(p.x-q.x, p.y-q.y, p.z-q.z); };

// ── 검증 ──────────────────────────────────────────────────
const ok = [], fail = [];
const chk = (n, c) => (c ? ok : fail).push(n);
const hasEdge = (a,b) => g.edges.some(e => (e.a===a&&e.b===b)||(e.a===b&&e.b===a));

chk('겹침 있는 5명만 그린다 (4·5번 제외)',
    g.nodes.length === 5 && g.nodes.join(',') === '0,1,2,5,6');
chk('복붙 3인방이 서로 다 이어진다', hasEdge(0,1) && hasEdge(0,2) && hasEdge(1,2));
chk('템플릿 쌍 6·7번이 이어진다', hasEdge(5,6));
chk('고유하게 쓴 4·5번은 점이 없다',
    g.nodes.indexOf(3) < 0 && g.nodes.indexOf(4) < 0);
chk('선은 중복 없이 4개', g.edges.length === 4);
chk('같은 반 선 2개 · 다른 반 선 2개',
    g.edges.filter(e => rows[e.a].cls === rows[e.b].cls).length === 2 &&
    g.edges.filter(e => rows[e.a].cls !== rows[e.b].cls).length === 2);
chk('배치가 매번 같다 (난수를 쓰지 않음)', key(p1) === key(p2));
chk('모든 점이 좌표가 유효하고 구 안에 있다',
    g.nodes.every(i => { const p = p1.get(i);
      return isFinite(p.x) && isFinite(p.y) && isFinite(p.z) &&
             Math.hypot(p.x,p.y,p.z) <= R + 0.5; }));
chk('겹쳐 붙은 점이 없다 (3차원 최소 간격 20)',
    g.nodes.every((a,i) => g.nodes.slice(i+1).every(b => dist3(a,b) >= 20)));
chk('평면에 눌리지 않고 3차원으로 퍼진다',
    Math.max(...g.nodes.map(i => Math.abs(p1.get(i).z))) > 20);

// 화면 좌표 변환과 그 역변환이 서로 맞물리는지 — 점 끌기가 이 둘에 걸려 있다
const probe = { x:40, y:-25, z:15 };
const o = M.project(probe);
const back = M.unrot(12 / o.s, 7 / o.s);      // 화면에서 (12, 7)만큼 옮기고 싶다
const n2 = M.project({ x:probe.x+back.x, y:probe.y+back.y, z:probe.z+back.z });
chk('끈 만큼 화면에서 움직인다 (투영 ↔ 역변환)',
    Math.abs((n2.x-o.x) - 12) < 2 && Math.abs((n2.y-o.y) - 7) < 2);

console.log('\n통과 ' + ok.length + ' / ' + (ok.length + fail.length));
if (fail.length){ fail.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('모두 통과');
