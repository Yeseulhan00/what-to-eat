/**
 * 웹 원본(../index.html 등)을 www/로 복사한다.
 * index.html은 단일 소스로 두고, 앱에서만 필요한 것은 여기서 덧붙인다.
 */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..');
const www = join(here, 'www');

/* 웹에서 가져올 것 (웹에는 있지만 앱에 필요 없는 것은 제외한다) */
const FROM_SITE = ['icons', 'favicon.ico'];
/* 앱에만 있는 것 - 오프라인용으로 내려받아 둔 제목 글꼴 */
const FROM_APP = ['fonts'];

await rm(www, { recursive: true, force: true });
await mkdir(www, { recursive: true });

for (const [base, names] of [[site, FROM_SITE], [here, FROM_APP]]) {
  for (const name of names) {
    const from = join(base, name);
    if (existsSync(from)) await cp(from, join(www, name), { recursive: true });
  }
}

let html = await readFile(join(site, 'index.html'), 'utf8');

/* 앱은 스토어에서 받은 아이콘을 쓰므로 매니페스트 링크는 뺀다 */
html = html.replace(/^.*<link rel="manifest".*\n/m, '');

/* 구글 폰트 CDN 링크를 앱에 넣어둔 폰트로 바꾼다.
   - 오프라인에서도 웹과 같은 화면이 나오고
   - 앱이 외부로 아무 요청도 보내지 않는다 (개인정보 처리방침이 단순해진다)
   제목용 Black Han Sans만 넣는다. 본문 Noto Sans KR은 안드로이드 기본 한글
   폰트와 사실상 같은 글꼴이라 굳이 5MB를 더 실을 이유가 없다. */
html = html.replace(/^.*<link rel="preconnect" href="https:\/\/fonts\..*\n/gm, '');
html = html.replace(
  /^.*fonts\.googleapis\.com\/css2.*\n/m,
  '<link rel="stylesheet" href="./fonts/black-han-sans.css">\n',
);

/* 안드로이드 back 버튼으로 상세 시트를 닫는다.
   웹에서 쓰는 history.pushState 방식을 그대로 태운다. */
const bridge = `
<script>
/* Capacitor가 주입하는 네이티브 브리지. 웹 브라우저에서는 실행되지 않는다. */
document.addEventListener('DOMContentLoaded',()=>{
  const App=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.App;
  if(!App) return;
  App.addListener('backButton',({canGoBack})=>{
    const overlay=document.getElementById('overlay');
    if(overlay&&!overlay.hidden){ history.back(); return; }
    if(canGoBack){ history.back(); return; }
    App.exitApp();
  });
});
</script>
`;
html = html.replace('</body>', bridge + '</body>');

await writeFile(join(www, 'index.html'), html, 'utf8');

console.log('www/ 준비 완료');
