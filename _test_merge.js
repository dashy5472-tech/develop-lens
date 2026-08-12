/* 여러 파일 합치기 검증. (배포 불필요)
   여기가 틀리면 남의 반 기록이 섞이거나, 고친 내용이 엉뚱한 파일로 돌아간다. */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const cut = (a, b) => script.slice(script.indexOf(a), script.indexOf(b));

const M = new Function(
  cut('const FORM = {', 'const flatHead =') + '\n' +
  cut('const flatHead =', 'const escapeHtml =') + '\n' +
  cut('function mergeSources(', 'function renderFileList(') +
  '\nreturn { mergeSources, flatHead, looksLikeHeader, findHeaderRow };'
)();

const HEAD = ['학년도','학기','학년','과목','반/번호','성명','세부능력 및 특기사항'];
const row = (cls, no, nm, subj, t) => ['2026','1','2',subj,`${cls}/${no}`,nm,t];
const T = n => `${n}번 학생이 쓴 서로 다른 내용입니다. 길이를 채우기 위한 문장입니다.`;

const fileA = { name:'대수_1반.xlsx', grid:[HEAD,
  row(1,1,'가','대수',T('A1')), row(1,2,'나','대수',T('A2')) ] };
const fileB = { name:'대수_2반.xlsx', grid:[HEAD,
  row(2,1,'다','대수',T('B1')), ['','','','','','',''], row(2,2,'라','대수',T('B2')) ] };
// 열 순서가 다른 파일 — 이름으로 맞춰야 한다
const HEAD2 = ['반/번호','세부능력 및 특기사항','성명','과목','학년','학기','학년도'];
const fileC = { name:'미적_3반.xls', grid:[HEAD2,
  ['3/1', T('C1'), '마', '미적분', '2', '1', '2026'],
  ['3/2', T('C2'), '바', '미적분', '2', '1', '2026'] ] };

const ok = [], fail = [];
const chk = (n, c) => (c ? ok : fail).push(n);

// ── 1. 같은 양식 두 개 ──────────────────────────────────────
let src = [ {...fileA}, {...fileB} ];
let m = M.mergeSources(src);
chk('머리글은 한 번만 남는다', m.grid[0].join(',') === HEAD.join(','));
chk('두 파일의 학생이 모두 들어온다', m.grid.length - 1 === 4);
chk('빈 행은 세지 않는다', src[1].rows === 2);
chk('행 번호가 파일과 행을 정확히 가리킨다',
    m.rowRef[1].f === 0 && m.rowRef[3].f === 1 &&
    src[1].clean[m.rowRef[3].r][6] === T('B1'));

// ── 2. 열 순서가 다른 파일 ──────────────────────────────────
src = [ {...fileA}, {...fileC} ];
m = M.mergeSources(src);
const ct = m.grid[0].indexOf('세부능력 및 특기사항');
chk('열 순서가 달라도 이름으로 맞춘다',
    m.grid[3][ct] === T('C1') && m.grid[4][ct] === T('C2'));
chk('열이 새로 생기지 않는다 (이름이 다 겹치므로)',
    m.added.length === 0 && m.grid[0].length === HEAD.length);
chk('그 파일 안의 세특 열 위치를 되찾을 수 있다', src[1].map.indexOf(ct) === 1);
chk('학생 이름도 제자리에 들어간다',
    m.grid[3][m.grid[0].indexOf('성명')] === '마');

// ── 3. 같은 파일을 두 번 올린 경우 ──────────────────────────
src = [ {...fileA}, {...fileB}, {...fileA} ];
m = M.mergeSources(src);
chk('똑같은 행은 한 번만 넣는다', m.grid.length - 1 === 4 && m.dropped === 2);

// ── 4. 열이 하나 더 있는 파일 ───────────────────────────────
const fileD = { name:'추가.csv',
  grid:[HEAD.concat('영재·발명교육 기록사항'),
        row(4,1,'사','대수',T('D1')).concat('없음')] };
src = [ {...fileA}, fileD ];
m = M.mergeSources(src);
chk('없던 열은 뒤에 새로 만든다', m.added.length === 1 && m.grid[0].length === HEAD.length + 1);
chk('새 열이 없는 파일의 행은 빈 칸으로 채운다', m.grid[1][HEAD.length] === '');
chk('모든 행의 폭이 같다', m.grid.every(r => r.length === m.grid[0].length));

// ── 5. 머리글 없는 파일 ─────────────────────────────────────
src = [ { name:'머리글없음.csv', grid:[ row(5,1,'아','대수',T('E1')), row(5,2,'자','대수',T('E2')) ] } ];
m = M.mergeSources(src);
chk('머리글이 없으면 자리 이름을 붙이고 모든 행을 남긴다',
    m.grid.length - 1 === 2 && m.grid[0][0] === '열 1');

// ── 6. 고친 내용이 원래 파일로 돌아가는지 ───────────────────
src = [ {...fileA}, {...fileC} ];
m = M.mergeSources(src);
const back = new Map();
m.rowRef.forEach((ref, i) => { if (ref) back.set(ref.f + ':' + ref.r, i); });
const mct = m.grid[0].indexOf('세부능력 및 특기사항');
const edits = new Map([[4, '고친 내용']]);          // 합친 표 4행 = 미적_3반 두 번째 학생
const outs = src.map((s, f) => {
  const oct = s.map.indexOf(mct);
  let n = 0;
  const g = s.clean.map((r, i) => {
    const cp = r.slice(), mi = back.get(f + ':' + i);
    if (mi != null && edits.has(mi)){ cp[oct] = edits.get(mi); n++; }
    return cp;
  });
  return { name:s.name, g, n };
});
chk('고친 곳이 있는 파일만 내보낸다',
    outs.filter(o => o.n).length === 1 && outs[1].n === 1);
chk('그 파일의 원래 열 자리에 들어간다', outs[1].g[2][1] === '고친 내용');
chk('원본 열 순서가 그대로다', outs[1].g[0].join(',') === HEAD2.join(','));
chk('손대지 않은 파일은 원본 그대로다',
    JSON.stringify(outs[0].g) === JSON.stringify(src[0].clean));

// ── 7. 머리글이 첫 줄에 없는 파일 ───────────────────────────
//    실제로 쓰이는 파일은 제목 한 줄과 빈 줄을 앞에 달고 나온다
const fileE = { name:'바이트계산기.xlsx', grid:[
  ['','','neis 바이트 계산기(2026_3학년 확률과 통계)','','',''],
  ['','','','','',''],
  ['학번','이름','내용','전체글자수','바이트변환','교과세특'],
  ['3215','오현서', T('E1'), '310','531','750'],
  ['3523','장연우', T('E2'), '312','532','750'] ] };
src = [ {...fileE} ];
m = M.mergeSources(src);
chk('제목 줄을 넘어 머리글을 찾아낸다', m.grid[0][0] === '학번' && m.grid[0][2] === '내용');
chk('제목 줄은 기록으로 세지 않는다', m.grid.length - 1 === 2 && src[0].rows === 2);
chk('제목 줄은 원본 쪽에 남겨 둔다 (되돌릴 때 그대로 써야 한다)',
    src[0].clean[0][2].indexOf('바이트 계산기') >= 0 && src[0].headRow === 1);
chk('빈 줄만 걷어 낸다', src[0].clean.length === 4);

// ── 8. 열 이름이 아예 다른 두 양식 ──────────────────────────
//    '세부능력 및 특기사항' 과 '내용' 은 이름은 달라도 같은 칸이다
src = [ {...fileA}, {...fileE} ];
m = M.mergeSources(src);
const tc = m.grid[0].indexOf('세부능력 및 특기사항');
chk('이름이 달라도 구실이 같으면 같은 칸에 넣는다',
    m.grid[3][tc] === T('E1') && m.grid[4][tc] === T('E2'));
chk('성명·이름도 한 칸으로 모은다',
    m.grid[3][m.grid[0].indexOf('성명')] === '오현서');
chk('구실이 없는 열만 새로 만든다',
    m.added.every(h => ['전체글자수','바이트변환','교과세특'].indexOf(h) >= 0));
chk('같은 구실의 열이 두 개면 뒤엣것은 따로 둔다',   // 내용 · 교과세특 둘 다 세특 이름
    src[1].map[2] === tc && src[1].map[5] !== tc);
chk('되돌릴 때 그 파일의 원래 세특 열을 찾을 수 있다', src[1].map.indexOf(tc) === 2);

console.log('\n통과 ' + ok.length + ' / ' + (ok.length + fail.length));
if (fail.length){ fail.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('모두 통과');
