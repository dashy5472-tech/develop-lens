/* 나이스 바이트 계산 검증. (배포 불필요)
   사용: node _test_bytes.js "<실제 xlsx 경로>" */
const fs = require('fs');
const path = require('path');
const lib = require(path.join(__dirname, '_readxlsx.js'));

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const from = script.indexOf('function neisBytes');
const neisBytes = new Function(script.slice(from, script.indexOf('/* ─── 1. 파일 읽기')) +
                               '\nreturn neisBytes;')();

const ok = [], fail = [];
const chk = (name, got, want) => (got === want ? ok : fail).push(`${name}  기대 ${want} / 실제 ${got}`);

chk('한글 3자',            neisBytes('가나다'), 9);
chk('영문 3자',            neisBytes('abc'), 3);
chk('숫자 3자',            neisBytes('123'), 3);
chk('공백·문장부호',        neisBytes(' .,'), 3);
chk('한글+영문+숫자+공백',   neisBytes('가a 1.'), 7);
chk('줄바꿈 LF',           neisBytes('가\n나'), 8);
chk('줄바꿈 CRLF도 2바이트', neisBytes('가\r\n나'), 8);
chk('빈 문자열',            neisBytes(''), 0);
chk('한자도 3바이트',       neisBytes('漢'), 3);
chk('500자 한글 = 1500B',   neisBytes('가'.repeat(500)), 1500);
chk('300자 한글 = 900B',    neisBytes('가'.repeat(300)), 900);

/* 분량 상한은 학년도 훈령에 따라 바뀐다. 화면의 선택지가 지금 훈령과 맞는지,
   그리고 어느 해 기준인지 적혀 있는지 확인한다 — 연도가 없으면 몇 년 전 값인지
   알 수 없어 그대로 믿고 쓰게 된다. */
const opts = [...html.matchAll(/<option value="(\d+)"[^>]*>([^<]+)</g)]
  .map(m => ({ v:+m[1], t:m[2].trim() }))
  .filter(o => html.indexOf('id="limitSel"') < html.indexOf(o.t));
const has = v => opts.some(o => o.v === v);
chk('1,500바이트 선택지가 있다',        has(1500), true);
chk('900바이트 선택지가 있다',          has(900), true);
chk('2,100바이트는 더 이상 없다',       has(2100), false);
chk('진로활동이 1,500 쪽에 있다',
    /1500"[^>]*>[^<]*진로/.test(html), true);
chk('행동특성이 900 쪽에 있다',
    /900"[^>]*>[^<]*행동특성/.test(html), true);
chk('어느 해 기준인지 적혀 있다',       /\d{4}학년도<\/b> 기준/.test(html), true);

console.log('=== 기본 규칙 ===');
ok.forEach(s => console.log('  ✓ ' + s.split('  ')[0]));
fail.forEach(s => console.log('  ✗ ' + s));

// 실제 기록으로 — 스크린샷의 "241자 · 583B" 와 맞는지
if (process.argv[2]){
  const grid = lib.read(process.argv[2]);
  const head = grid[0].map(h => String(h).replace(/_x000D_/g,'').replace(/[\s()·・]/g,''));
  const ct = head.findIndex(h => h.indexOf('세부능력') >= 0);
  console.log('\n=== 실제 기록 (앞 5건) ===');
  console.log('  글자수(공백제외)  전체글자  바이트');
  for (let r = 1; r <= 5 && r < grid.length; r++){
    const t = String(grid[r][ct] || '');
    if (!t) continue;
    console.log(`  ${String(t.replace(/\s/g,'').length).padStart(12)} ` +
                `${String(t.length).padStart(9)} ${String(neisBytes(t)).padStart(7)}`);
  }
  console.log('\n  ※ 스크린샷의 "241자 · 583B" 와 같은 조합이 나오면 계산 방식이 일치하는 것.');
}

console.log(`\n통과 ${ok.length} / ${ok.length + fail.length}`);
if (fail.length) process.exit(1);
