/* 초깃값이 근거를 지키는지 확인한다. (배포 불필요)

   두 값은 감으로 고른 것이 아니라 정답을 아는 자료에서 재어 고른 것이다.
   나중에 누가 슬며시 되돌려 놓으면 여기서 걸린다.
   자세한 측정은 `node _tune.js` 로 다시 볼 수 있다. */
const lib = require('./_lib.js');
const analyze = lib.algo().analyze;
const base = lib.defaults();
const rows = lib.sampleRows();

const at = (c, n) => rows.findIndex(r => r.cls === String(c) && r.no === String(n));
const PLANTED = new Set([at(1,5), at(1,11), at(2,3), at(2,6), at(2,9), at(2,12),
                         at(1,2), at(2,7), at(3,4)]);

function score(over){
  const r = analyze(rows, Object.assign({}, base, { declared:[] }, over));
  let miss = 0, wrong = 0;
  r.per.forEach((p, i) => {
    const flagged = p.a.length > 0 || p.b.length > 0;
    if (PLANTED.has(i) && !flagged) miss++;
    if (!PLANTED.has(i) && flagged) wrong++;
  });
  return { miss, wrong, r };
}

const now = score({});
const ok = [], fail = [];
const chk = (n, c) => (c ? ok : fail).push(n);

console.log(`지금 초깃값 — 최소 구간 ${base.minSpan}자 · 공통 활동 ${base.commonPct}%`);
console.log(`  놓침 ${now.miss} · 헛짚음 ${now.wrong} (심어 둔 ${PLANTED.size}명 / 고유 ${rows.length - PLANTED.size}명)\n`);

chk('초깃값에서 심어 둔 것을 하나도 놓치지 않는다', now.miss === 0);
chk('초깃값에서 고유하게 쓴 사람을 하나도 헛짚지 않는다', now.wrong === 0);

/* ── 최소 구간 길이 — 20자가 '헛짚음 0' 이 되는 가장 낮은 값이어야 한다.
   더 낮추면 잡음이 늘고, 더 올릴 이유는 없다. */
console.log('최소 구간 길이를 낮추면');
let lowestClean = base.minSpan;
for (const sp of [8, 12, 16, 20]){
  const s = score({ minSpan: sp });
  console.log(`  ${String(sp+'자').padStart(4)}   놓침 ${s.miss} · 헛짚음 ${s.wrong}`);
  if (s.wrong === 0 && s.miss === 0 && sp < lowestClean) lowestClean = sp;
}
chk('20자보다 낮추면 고유하게 쓴 사람이 걸리기 시작한다', score({ minSpan:16 }).wrong > 0);
chk('20자가 깨끗해지는 가장 낮은 값이다', lowestClean === base.minSpan);

/* ── 공통 활동 기준 — 낮추면 심어 둔 무리가 '활동명' 으로 조용히 빠진다.
   이게 이 설정에서 가장 위험한 잘못이다. 눈에 안 띄기 때문이다. */
console.log('\n공통 활동 기준을 낮추면');
for (const pc of [5, 8, 12, 20, 40]){
  const s = score({ commonPct: pc });
  console.log(`  ${String(pc+'%').padStart(4)}  기준 ${String(s.r.commonN+'명').padStart(4)}` +
              `   놓침 ${s.miss} · 헛짚음 ${s.wrong}`);
}
chk('너무 낮추면 심어 둔 무리가 활동명으로 빠져 버린다', score({ commonPct:5 }).miss > 0);
chk('초깃값에서는 그런 일이 없다', now.miss === 0);

/* ── 공통 활동 기준을 낮게 둘 수 있는 것은 인원과 함께 '퍼진 모양' 을 보기 때문이다.
   한 반이 다 같이 쓴 수행평가명과 한 교사의 돌려쓰기는 인원이 똑같아 숫자로는
   못 가른다. 그래서 한 반에 몰린 구간은 인원이 아무리 많아도 빼지 않는다.
   이 규칙이 없으면 기준을 낮추는 순간 가장 중요한 신호가 조용히 사라진다. */
const src = lib.sampleRows().filter(r =>
  ['1/5','1/11','2/3','2/6','2/9','2/12','1/2','2/7','3/4']
    .indexOf(r.cls + '/' + r.no) < 0)
  .map(r => r.text.replace('2학기 수학 융합탐구 프로젝트 수행평가에서 ', ''));
const GRADE = '2학기 학년 공동 탐구 발표회 수행평가에서';      // 세 반이 다 쓴다
const TOPIC = ['인구 이동을','감염병 확산을','전기 사용량을','교통량 변화을','강수량 변화를',
               '물가 상승을','학업 시간을','통학 거리를','수면 시간을'];
const TPL = t => `${t} 자료를 모아 표로 정리하였고, 근거를 들어 결론을 이끌어 냄.`;

/* 세 반 × 아홉 명. 2반 아홉 명 전원이 같은 문형을 돌려 쓴다. */
const whole = [];
for (let c = 0; c < 3; c++) for (let n = 0; n < 9; n++){
  const body = c === 1 ? TPL(TOPIC[n]) : src[(c*9+n) % src.length];
  whole.push({ cls:String(c+1), no:String(n+1), label:`${c+1}반 ${n+1}번`,
               text:`${GRADE} ${body}` });
}
const run = (pct, rows) => analyze(rows || whole,
  Object.assign({}, base, { commonPct:pct, declared:[] }));
const caughtAt = pct => {
  const r = run(pct);
  let k = 0; for (let i = 9; i < 18; i++) if (r.per[i].a.length || r.per[i].b.length) k++;
  return k;
};

console.log('\n2반 아홉 명 전원이 같은 문형을 돌려 쓸 때 (한 반 = 9명)');
console.log('  기준   인원선   잡은 인원   학년 공통 도입부');
let always = true;
for (const pc of [5, 10, 20, 40, 60]){
  const r = run(pc), k = caughtAt(pc);
  if (k !== 9) always = false;
  console.log(`  ${String(pc+'%').padStart(4)}   ${String(r.commonN+'명').padStart(5)}` +
              `   ${String(k+'/9명').padStart(9)}   ` +
              (r.phraseC.some(x => x.t.indexOf('발표회') >= 0) ? '빠짐 ✓' : '안 빠짐'));
}
chk('기준을 아무리 낮춰도 한 반 돌려쓰기는 안 빠진다 (퍼진 모양을 보므로)', always);
chk('세 반에 걸친 도입부는 낮은 기준에서 잘 빠진다',
    run(10).phraseC.some(x => x.t.indexOf('발표회') >= 0));
chk('인원만 보면 빠졌어야 한다 (규칙이 실제로 일하고 있다)',
    run(10).commonN <= 9);

/* 반이 하나뿐이면 퍼진 모양을 볼 수 없어 인원만으로 판단하게 된다 —
   그래서 화면이 그때는 경고한다. */
const oneCls = whole.filter(r => r.cls === '2').map(r => ({ ...r, cls:'2' }));
const solo = analyze(oneCls, Object.assign({}, base, { commonPct:10, declared:[] }));
chk('반이 하나뿐이면 인원만으로 판단한다 (그래서 화면이 경고한다)',
    solo.per.every(p => p.a.length === 0 && p.b.length === 0));
chk('화면이 그 경우를 경고한다',
    lib.HTML.indexOf('반이 하나뿐이라') >= 0);

/* 슬라이더가 그 값에 닿을 수 있어야 한다 */
const html = lib.HTML;
const range = id => {
  const m = html.match(new RegExp('id="' + id + '"[^>]*min="(\\d+)"[^>]*max="(\\d+)"[^>]*value="(\\d+)"'));
  return { min:+m[1], max:+m[2], val:+m[3] };
};
const rp = range('commonPct'), rs = range('minSpan');
chk('공통 활동 기준 슬라이더가 초깃값을 담는다', rp.val === base.commonPct && rp.min <= rp.val && rp.val <= rp.max);
chk('최소 구간 길이 슬라이더가 초깃값을 담는다', rs.val === base.minSpan && rs.min <= rs.val && rs.val <= rs.max);
chk('기준을 한 반 위로 올릴 여지가 남아 있다', rp.max >= 60);

console.log('\n통과 ' + ok.length + ' / ' + (ok.length + fail.length));
if (fail.length){ fail.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('모두 통과');
