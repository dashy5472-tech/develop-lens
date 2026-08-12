/**
 * 생기부 돋보기 — Apps Script 배포용 껍데기
 *
 * ─────────────────────────────────────────────────────────────
 * 이 서버 코드가 하는 일은 index.html 을 그대로 내려주는 것뿐이다.
 * 생기부 내용은 서버로 오지 않는다.
 *
 *  · 시트를 읽거나 쓰지 않는다      (SpreadsheetApp 호출 없음)
 *  · 저장하지 않는다                (PropertiesService / CacheService 호출 없음)
 *  · 로그를 남기지 않는다           (console.log / Logger 호출 없음)
 *  · 외부로 보내지 않는다           (UrlFetchApp 호출 없음)
 *
 * 파일 파싱과 유사도 계산은 전부 index.html 안의 자바스크립트가
 * 교사 브라우저에서 수행한다. 클라이언트에서 서버를 부르는 통로인
 * google.script.run 호출이 index.html 에 단 한 줄도 없으므로,
 * 업로드한 엑셀 파일의 내용은 브라우저 메모리 밖으로 나가지 않는다.
 * (탭을 닫으면 사라진다.)
 *
 * appsscript.json 의 oauthScopes 가 비어 있어 권한 승인 화면도 뜨지 않는다.
 * ─────────────────────────────────────────────────────────────
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('생기부 돋보기')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
