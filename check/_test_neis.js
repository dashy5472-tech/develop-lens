/* 나이스 엑셀 읽기 검사. (배포에 들어가지 않는다)

     node _test_neis.js

   바탕화면의 진짜 나이스 파일 세 개로 돌린다. 파일이 없으면 그 묶음만 건너뛴다.
   학생 이름과 세특 원문은 한 글자도 찍지 않는다 — 개수·길이·해시만 본다.

   왜 진짜 파일로 하냐면, 이 파서가 상대하는 건 규격이 아니라 나이스가 실제로
   토해 내는 인쇄물이기 때문이다. 지어낸 표로는 쪽 경계에서 잘린 세특도,
   과목 칸이 비는 자리도 재현되지 않는다. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadXLSX, loadNEIS } = require('./_lib.js');

const XLSX = loadXLSX();
const NEIS = loadNEIS();

const DESKTOP = path.join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop');
const FILES = {
  excel: path.join(DESKTOP, '전 과목 세특.xlsx'),
  excelData: path.join(DESKTOP, '전 과목 세특 xlsx data.xlsx'),
  template: path.join(DESKTOP, '세특 업로드 양식.xlsx')
};

let pass = 0, fail = 0, skip = 0;
const ok = (label, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (detail == null ? '' : '  → ' + detail)); }
};
const group = name => console.log('\n■ ' + name);
const read = file => NEIS.parseWorkbook(XLSX, XLSX.read(fs.readFileSync(file), { type:'buffer' }));
const keyOf = r => [r.className, r.grade, r.term, r.subject, r.number, r.name].join('|');
const sha = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

let a = null, b = null;

if (fs.existsSync(FILES.excel)) {
  group('조회 다운로드 "엑셀" — 병합 레이아웃');
  a = read(FILES.excel);
  ok('인쇄 레이아웃으로 알아봄', a.layout === 'paged', a.layout);
  ok('오류 없음', !a.error, a.error);
  ok('기록 206건', a.records.length === 206, a.records.length);
  ok('쪽 경계에서 잘린 40건을 이어 붙임', a.joinedCount === 40, a.joinedCount);
  ok('줄바꿈 든 기록 22건 — 이 형식은 줄바꿈을 지키다', a.lineBreakCount === 22, a.lineBreakCount);
  ok('과목 14종', a.subjects.length === 14, a.subjects.length);
  ok('본문이 빈 기록 없음', a.records.every(r => r.text.trim().length > 0));
  ok('모든 기록에 과목이 채워짐', a.records.every(r => r.subject));
  ok('모든 기록에 학년·학기가 채워짐', a.records.every(r => r.grade && r.term));
  ok('머리글·쪽번호가 학생으로 새지 않음', a.records.every(r => !/학교생활기록부/.test(r.name) && !/^과\s*목$/.test(r.name)));
  ok('반이 모두 채워짐', a.records.every(r => /\d+학년\s*\d+반/.test(r.className)));
} else { skip++; console.log('\n건너뜀 — 파일 없음: ' + FILES.excel); }

if (fs.existsSync(FILES.excelData)) {
  group('조회 다운로드 "엑셀 data"');
  b = read(FILES.excelData);
  ok('인쇄 레이아웃으로 알아봄', b.layout === 'paged', b.layout);
  ok('기록 206건', b.records.length === 206, b.records.length);
  ok('쪽 경계에서 잘린 40건을 이어 붙임', b.joinedCount === 40, b.joinedCount);
  ok('줄바꿈 든 기록 0건 — 이 형식은 줄바꿈을 지운다', b.lineBreakCount === 0, b.lineBreakCount);
} else { skip++; console.log('\n건너뜀 — 파일 없음: ' + FILES.excelData); }

if (a && b) {
  group('두 형식 대조 — 줄바꿈 말고는 같아야 한다');
  ok('학생·과목 집합이 완전히 같음',
    sha(a.records.map(keyOf).sort().join('\n')) === sha(b.records.map(keyOf).sort().join('\n')));
  const other = new Map(b.records.map(r => [keyOf(r), r.text]));
  let same = 0, breakOnly = 0, differs = 0;
  a.records.forEach(r => {
    const t = other.get(keyOf(r));
    if (t == null) return;
    if (t === r.text) same++;
    else if (t === r.text.replace(/\n/g, '')) breakOnly++;
    else differs++;
  });
  ok('본문이 그대로 같은 것 184건', same === 184, same);
  ok('차이가 줄바꿈뿐인 것 22건', breakOnly === 22, breakOnly);
  ok('그 밖의 본문 차이 0건', differs === 0, differs);
}

if (fs.existsSync(FILES.template)) {
  group('업로드 양식 — 빈 서식');
  const c = read(FILES.template);
  ok('업로드 양식으로 알아봄', c.layout === 'flat', c.layout);
  ok('오류 없음', !c.error, c.error);
  ok('머리글은 1행', c.headerRow === 1, c.headerRow);
  ok('학생 0건', c.records.length === 0, c.records.length);
} else { skip++; console.log('\n건너뜀 — 파일 없음: ' + FILES.template); }

group('업로드 양식 — 지어낸 학생 두 명');
/* 이름은 예시용으로 지어낸 것이다. */
const made = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(made, XLSX.utils.aoa_to_sheet([
  ['학년도','학기','학년','학생개인번호','과목','과목코드','반/번호','성명','학적변동\n구분','세부능력 및 특기사항','영재·발명교육 기록사항'],
  ['2026','1','2','X1','대수','M01','3/1','학생가','','무리함수의 정의역을 구하는 과정을 근거를 들어 설명함.',''],
  ['2026','1','2','X2','대수','M01','3/2','학생나','','수열의 귀납적 정의를 표로 정리함.\n두 번째 줄.','']
]), '과목별세부능력및특기사항');
const d = NEIS.parseWorkbook(XLSX, made);
ok('업로드 양식으로 알아봄', d.layout === 'flat', d.layout);
ok('학생 2건', d.records.length === 2, d.records.length);
ok('과목을 읽음', d.records.every(r => r.subject === '대수'));
ok('반/번호를 읽음', d.records[0].number === '3/1', d.records[0].number);
ok('줄바꿈을 지키다', d.records[1].text.indexOf('\n') !== -1);

group('본문을 다듬지 않는지');
/* 줄 앞뒤 공백과 연속 공백을 잡는 룰이 있다. 읽으면서 지워 버리면 그 룰이 죽는다. */
const rough = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(rough, XLSX.utils.aoa_to_sheet([
  ['반/번호','성명','과목','세부능력 및 특기사항'],
  ['3/1','학생다','대수','  앞에 공백이 둘 있고  가운데도 둘이다.']
]), 'Sheet1');
const e = NEIS.parseWorkbook(XLSX, rough);
ok('앞 공백을 지우지 않음', e.records[0].text.startsWith('  '), JSON.stringify(e.records[0].text.slice(0, 4)));
ok('가운데 연속 공백을 지우지 않음', /있고 {2}가운데/.test(e.records[0].text));

console.log('\n' + (fail === 0 ? '전체 통과' : '실패 ' + fail + '건') +
  ' (통과 ' + pass + (skip ? ' · 건너뜀 ' + skip : '') + ')');
process.exit(fail === 0 ? 0 : 1);
