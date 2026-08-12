/* index.html 의 순수 계산부만 떼어내 실제로 돌려 본다. (배포 시 불필요) */
const analyze = require('./_lib.js').algo().analyze;

// 7명 전원이 같은 프로젝트에 참여했다 — 이 앞머리는 공통 활동으로 분류돼야 한다
const P = '2학기 융합탐구 프로젝트 수행평가에서 ';

// 1·2번은 같은 1반, 3번은 2반 — 같은 반 겹침이 제대로 갈리는지 보기 위해 나눴다
const rows = [
  { cls:'1', id:'1', text: P + '「침묵의 봄」을 읽고 환경 문제에 대한 관심을 키웠으며 적극적으로 탐구하는 자세를 보임.' },
  { cls:'1', id:'2', text: P + '「이기적 유전자」를 읽고 환경 문제에 대한 관심을 키웠으며 적극적으로 탐구하는 자세를 보임.' },
  { cls:'2', id:'3', text: P + '「총 균 쇠」를 읽고 역사 문제에 대한 관심을 키웠으며 적극적으로 탐구하는 자세를 보임.' },

  { cls:'1', id:'4', text: P + '「침묵의 봄」을 읽고, 저자가 인과관계 대신 상관관계만 제시한 대목에 의문을 제기함. 이를 확인하려 지역 하천 세 곳의 수질 자료를 오 년치 비교했고, 강수량 변수를 통제하지 못한 점을 스스로 한계로 지적함.' },
  { cls:'2', id:'5', text: P + '모둠 토론에서 자료의 출처가 블로그라는 점을 지적해 팀의 결론을 뒤집었고, 다시 찾은 통계청 자료로 발표문을 새로 씀.' },

  // 6·7번: 주제어를 촘촘히 갈아끼워 연속 8글자가 한 번도 안 맞는 쌍.
  // 글자 겹침으로는 안 잡히고 골격 겹침으로만 잡혀야 한다 — 템플릿 돌려쓰기의 전형.
  { cls:'2', id:'6', text: P + '탄소중립을 주제로 논문을 읽고 실험을 설계해 결과를 도출하였으며 보고서로 정리함' },
  { cls:'2', id:'7', text: P + '유전자가위를 주제로 서적을 읽고 조사를 설계해 자료를 도출하였으며 포스터로 정리함' }
];

const o = { charN:8, minSpan:16, commonPct:50, wordK:5, minOthers:1, properDf:1 };
const res = analyze(rows, o);

console.log(`학생 ${rows.length}명 · 공통 활동 기준 ${res.commonN}명 이상\n`);
console.log('번호  생존   글자겹침  골격겹침  확인구간  공통구간');
res.per.forEach((p, i) => console.log(
  String(rows[i].id).padEnd(5),
  (p.alive*100).toFixed(0).padStart(3) + '%',
  (p.aRate*100).toFixed(0).padStart(7) + '%',
  (p.bRate*100).toFixed(0).padStart(7) + '%',
  String(p.a.length + p.b.length).padStart(8),
  String(p.common.length).padStart(8)
));

const show = (title, list) => {
  console.log('\n[' + title + ']');
  if (!list.length) return console.log('  (없음)');
  list.slice(0, 4).forEach(p => console.log(`  ${p.n + 1}명  "${p.t}"`));
};
show('확인 필요 · 글자 그대로 반복', res.phraseA);
show('확인 필요 · 고유명사를 지워도 남는 문형', res.phraseB);
show('공통 활동으로 분류해 제외', res.phraseC);

// ── 검증 ────────────────────────────────────────────────────
const ok = [], fail = [];
const chk = (n, c) => (c ? ok : fail).push(n);
const anyText = (list, sub) => list.some(p => p.t.indexOf(sub) >= 0);

// 절대값이 아니라 격차로 본다 — 공통 활동명은 생존 분량에 포함되므로 절대 기준은 표본에 휘둘린다
chk('복붙한 1·2번이 고유하게 쓴 4번보다 30%p 이상 낮음',
    res.per[0].alive < res.per[3].alive - .3 && res.per[1].alive < res.per[3].alive - .3);
chk('고유하게 쓴 4·5번의 생존 분량이 90% 초과', res.per[3].alive > .9 && res.per[4].alive > .9);
chk('4·5번은 확인할 구간이 없음',
    res.per[3].a.length + res.per[3].b.length === 0 &&
    res.per[4].a.length + res.per[4].b.length === 0);

// 골격 탐지가 글자 겹침과 독립으로 동작하는지 — 이 도구의 핵심
chk('6·7번은 연속 8글자가 안 맞아 글자 겹침이 0',
    res.per[5].a.length === 0 && res.per[6].a.length === 0);
chk('그런데도 골격 겹침으로 템플릿 돌려쓰기가 잡힘',
    res.per[5].bRate > 0 && res.per[6].bRate > 0);

// 이번에 고친 것 ①: 전원이 쓴 활동명은 공통으로 분류돼 감점하지 않는다
chk('전원이 쓴 활동명이 모든 학생에게서 공통으로 분류됨',
    res.per.every(p => p.common.length > 0));
chk('그 활동명이 확인 필요 목록에는 없음',
    !anyText(res.phraseA, '수행평가에서') && !anyText(res.phraseB, '수행평가에서'));
chk('공통 목록에는 그 활동명이 있음', anyText(res.phraseC, '수행평가'));

// 이번에 고친 것 ②: 최소 구간 길이보다 짧은 조각은 버린다
chk('11자짜리 「침묵의 봄」을 읽고 가 최소 길이 16자에 걸려 빠짐',
    !anyText(res.phraseA, '「침묵의 봄」을 읽고'));
chk('모든 확인 구간이 최소 길이 이상',
    res.per.every(p => p.a.concat(p.b).every(s => s.end - s.start >= o.minSpan)));

chk('반복 표현 목록에 서로 포함되는 중복 항목이 없음',
    !res.phraseA.some((x,i) => res.phraseA.some((y,j) => i !== j && y.t.indexOf(x.t) >= 0)));

// 학년 단위로 돌릴 때의 핵심 신호 — 같은 반끼리 겹치는지 가려낸다
console.log('\n=== 겹치는 상대 ===');
res.per.forEach((p, i) => console.log(
  `  ${rows[i].cls}반 ${rows[i].id}번  겹침 ${p.peerCount}명 중 같은 반 ${p.sameCls}명`));

chk('1번(1반)은 같은 반 2번과 겹치므로 같은 반 1명',
    res.per[0].sameCls === 1);
chk('3번(2반)은 겹치는 상대가 모두 1반이라 같은 반 0명',
    res.per[2].peerCount > 0 && res.per[2].sameCls === 0);
chk('6·7번(둘 다 2반)은 서로 같은 반으로 잡힘',
    res.per[5].sameCls === 1 && res.per[6].sameCls === 1);

console.log('\n통과 ' + ok.length + ' / ' + (ok.length + fail.length));
if (fail.length){ fail.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('모두 통과');

