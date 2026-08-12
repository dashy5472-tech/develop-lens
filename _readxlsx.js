/* 라이브러리 없이 xlsx 안을 들여다보는 일회용 도구. (배포 불필요)
   xlsx 는 XML 들을 담은 zip 이므로 zlib 만으로 열 수 있다. */
const fs = require('fs');
const zlib = require('zlib');

function unzip(buf){
  // End of Central Directory 를 뒤에서 찾는다
  let eo = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--){
    if (buf.readUInt32LE(i) === 0x06054b50){ eo = i; break; }
  }
  if (eo < 0) throw new Error('zip 이 아닙니다');
  const count = buf.readUInt16LE(eo + 10);
  let p = buf.readUInt32LE(eo + 16);

  const files = {};
  for (let n = 0; n < count; n++){
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method  = buf.readUInt16LE(p + 10);
    const csize   = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extLen  = buf.readUInt16LE(p + 30);
    const cmtLen  = buf.readUInt16LE(p + 32);
    const lho     = buf.readUInt32LE(p + 42);
    const name    = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');

    const lNameLen = buf.readUInt16LE(lho + 26);
    const lExtLen  = buf.readUInt16LE(lho + 28);
    const start    = lho + 30 + lNameLen + lExtLen;
    const raw      = buf.slice(start, start + csize);
    files[name] = method === 8 ? zlib.inflateRawSync(raw) : raw;

    p += 46 + nameLen + extLen + cmtLen;
  }
  return files;
}

const unesc = s => s.replace(/&lt;/g,'<').replace(/&gt;/g,'>')
                    .replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');

function sharedStrings(xml){
  if (!xml) return [];
  const out = [];
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(xml))){
    let t = '';
    const tre = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let tm;
    while ((tm = tre.exec(m[1]))) t += tm[1];
    out.push(unesc(t));
  }
  return out;
}

const colNum = ref => {
  const a = ref.match(/^([A-Z]+)/)[1];
  let n = 0;
  for (const ch of a) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

function sheetRows(xml, ss){
  const rows = [];
  const rre = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rre.exec(xml))){
    const cells = [];
    const cre = /<c r="([A-Z]+\d+)"([^>]*)\/?>(?:([\s\S]*?)<\/c>)?/g;
    let cm;
    while ((cm = cre.exec(rm[2]))){
      const attrs = cm[2] || '', inner = cm[3] || '';
      const t = (attrs.match(/t="([^"]+)"/) || [])[1];
      let v = '';
      if (t === 's'){
        const i = (inner.match(/<v>(\d+)<\/v>/) || [])[1];
        v = i != null ? (ss[+i] || '') : '';
      } else if (t === 'inlineStr'){
        const im = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        v = im ? unesc(im[1]) : '';
      } else {
        const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
        v = vm ? unesc(vm[1]) : '';
      }
      cells[colNum(cm[1])] = v;
    }
    for (let i=0;i<cells.length;i++) if (cells[i] === undefined) cells[i] = '';
    rows.push(cells);
  }
  return rows;
}

/* 시트1을 2차원 배열로 읽어 준다 */
function read(p){
  const f = unzip(fs.readFileSync(p));
  const ss = sharedStrings(f['xl/sharedStrings.xml'] ? f['xl/sharedStrings.xml'].toString('utf8') : '');
  const key = Object.keys(f).find(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
  return key ? sheetRows(f[key].toString('utf8'), ss) : [];
}
module.exports = { read, unzip };

// 아래는 직접 실행했을 때만 — 파일 내부를 훑어보는 용도
if (require.main !== module) return;

const path = process.argv[2];
const files = unzip(fs.readFileSync(path));

console.log('=== zip 내부 ===');
Object.keys(files).forEach(k => console.log('  ' + k));

const ss = sharedStrings(files['xl/sharedStrings.xml'] && files['xl/sharedStrings.xml'].toString('utf8'));

const wb = files['xl/workbook.xml'] && files['xl/workbook.xml'].toString('utf8');
if (wb){
  console.log('\n=== 시트 이름 ===');
  const re = /<sheet[^>]*name="([^"]*)"/g;
  let m; while ((m = re.exec(wb))) console.log('  ' + unesc(m[1]));
}

Object.keys(files).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).forEach(k => {
  console.log('\n=== ' + k + ' ===');
  const rows = sheetRows(files[k].toString('utf8'), ss);
  rows.slice(0, 12).forEach((r, i) =>
    console.log(String(i+1).padStart(3) + ' | ' + r.map(c => String(c).slice(0,42)).join(' | ')));
  console.log(`  ... 총 ${rows.length}행`);
});
