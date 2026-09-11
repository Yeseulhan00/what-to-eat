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

/* 웹에는 있지만 앱에 넣을 필요가 없는 것들은 제외한다 */
const COPY = ['icons', 'favicon.ico'];

await rm(www, { recursive: true, force: true });
await mkdir(www, { recursive: true });

for (const name of COPY) {
  const from = join(site, name);
  if (existsSync(from)) await cp(from, join(www, name), { recursive: true });
}

let html = await readFile(join(site, 'index.html'), 'utf8');

/* 앱은 스토어에서 받은 아이콘을 쓰므로 매니페스트 링크는 뺀다 */
html = html.replace(/^.*<link rel="manifest".*\n/m, '');

/* 구글 폰트 CDN 링크를 걷어낸다.
   - 오프라인에서 폰트를 기다리며 멈칫거리지 않고
   - 앱이 외부로 아무 요청도 보내지 않는다 (개인정보 처리방침이 단순해진다)
   본문은 안드로이드 기본 한글 폰트로 떨어져 거의 같아 보인다. */
html = html.replace(/^.*<link rel="preconnect" href="https:\/\/fonts\..*\n/gm, '');
html = html.replace(/^.*fonts\.googleapis\.com\/css2.*\n/m, '');

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
