/**
 * Launch smoke test.
 *
 * Compiling and "the process didn't crash" are not proof that a UI rendered.
 * This loads the real built renderer in a real Electron window, waits for React
 * to mount, and asserts against the actual DOM — the navigation the user will
 * see, the theme actually applying, and the IPC bridge being reachable.
 *
 * It also captures a PNG via webContents.capturePage(), which works under
 * Wayland where external X11 screenshot tools do not.
 *
 * Run:  npm run test:smoke
 */

import { app, BrowserWindow } from 'electron';

// The REAL dependency graph and IPC handlers, so this exercises the true path:
// renderer -> preload -> IPC -> use case -> adapter. Stubbing them here would
// leave the integration between those layers untested, which is precisely the
// integration most likely to be wrong.
import { buildDependencies } from '../out/main/composition.js';
import { registerIpcHandlers } from '../out/main/ipc.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HERE, '..');
const SHOT_DIR = process.env.SMOKE_SHOT_DIR ?? join(APP_ROOT, 'out', 'smoke');

/** Expected navigation, in order. Mirrors config/navigation.ts. */
const EXPECTED_NAV = ['Dashboard', 'Cameras', 'LoRaWAN Gateway', 'Zigbee', 'Thread', 'Settings'];

/** Contract 2 rule 1: none of these may ever appear in the UI. */
const FORBIDDEN_JARGON = ['container', 'Twin', 'Z2M', 'dockerode', 'ttyUSB'];

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

/**
 * Both sizes are tested because the ui-kit treats **anything below 1248px as
 * mobile** — its Sidebar becomes a full-screen overlay there. A shell that only
 * works on a wide desktop would cover the entire screen on a 1024×600 Raspberry
 * Pi touchscreen, which is the primary target. That regression shipped once and
 * only the screenshot caught it; these two viewports keep it caught.
 */
const VIEWPORTS = [
  { name: 'Pi touchscreen 1024x600', width: 1024, height: 600, expectPermanentSidebar: false },
  { name: 'desktop 1440x900', width: 1440, height: 900, expectPermanentSidebar: true },
];

async function testViewport({ name, width, height, expectPermanentSidebar }) {
  console.log(`\n— ${name} —`);

  const window = new BrowserWindow({
    width,
    height,
    show: false,
    webPreferences: {
      preload: join(APP_ROOT, 'out/preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  await window.loadFile(join(APP_ROOT, 'out/renderer/index.html'));

  // Give React a moment to mount and the theme to apply.
  await new Promise((resolve) => setTimeout(resolve, 2500));

  // The layout assertion that matters: on a desktop the sidebar is a permanent
  // rail beside the content; below `lg` it must not be covering the screen.
  const layout = await window.webContents.executeJavaScript(`(() => {
        const paper = document.querySelector('.MuiDrawer-paper');
        const main = document.querySelector('main');
        return {
            drawerWidth: paper ? Math.round(paper.getBoundingClientRect().width) : 0,
            mainVisible: main ? main.getBoundingClientRect().width > 200 : false,
            viewport: window.innerWidth,
        };
    })()`);

  if (expectPermanentSidebar) {
    check(
      'sidebar is a rail, not full-width',
      layout.drawerWidth > 0 && layout.drawerWidth < layout.viewport * 0.5,
      `${layout.drawerWidth}px of ${layout.viewport}px`
    );
  } else {
    check(
      'sidebar does not cover the content',
      layout.drawerWidth === 0 || layout.drawerWidth < layout.viewport,
      `${layout.drawerWidth}px of ${layout.viewport}px`
    );
  }
  check('main content area is visible', layout.mainVisible);

  const bodyTextEarly = await window.webContents.executeJavaScript(`document.body.innerText`);
  // The dashboard must render its device card and a capability card for each
  // hardware section — not merely a heading.
  check('device card rendered', bodyTextEarly.includes('This device'));
  check(
    'a capability card is shown for each section',
    ['Cameras', 'LoRaWAN Gateway', 'Zigbee', 'Thread'].every((label) => bodyTextEarly.includes(label))
  );
  // Contract 2 rule 4: an unavailable capability explains itself rather than
  // rendering an empty box.
  check(
    'unavailable capabilities explain themselves',
    /RAK5146|Zigbee coordinator|own radio|needs Docker/.test(bodyTextEarly)
  );

  // Contract 3: nothing may overflow horizontally at either size.
  const overflow = await window.webContents.executeJavaScript(
    `document.documentElement.scrollWidth > document.documentElement.clientWidth`
  );
  check(`no horizontal overflow at ${width}x${height}`, overflow === false);

  mkdirSync(SHOT_DIR, { recursive: true });
  const image = await window.webContents.capturePage();
  writeFileSync(join(SHOT_DIR, `chirp-hub-${width}x${height}.png`), image.toPNG());

  window.destroy();
  // Destroying and immediately creating another BrowserWindow races the
  // compositor, and the next file:// load fails with ERR_FAILED. A short beat
  // between viewports avoids it.
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function run() {
  registerIpcHandlers(buildDependencies());

  console.log('\nSmoke test — real window, real DOM:');

  for (const viewport of VIEWPORTS) {
    await testViewport(viewport);
  }

  console.log('\n— contracts —');

  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      preload: join(APP_ROOT, 'out/preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  await window.loadFile(join(APP_ROOT, 'out/renderer/index.html'));
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const navText = await window.webContents.executeJavaScript(
    `Array.from(document.querySelectorAll('nav a, aside a, a')).map(a => a.textContent.trim()).filter(Boolean)`
  );
  for (const label of EXPECTED_NAV) {
    check(
      `nav shows "${label}"`,
      navText.some((t) => t.includes(label))
    );
  }

  const rootHtml = await window.webContents.executeJavaScript(`document.getElementById('root')?.innerHTML.length ?? 0`);
  check('React mounted content into #root', rootHtml > 500, `${rootHtml} chars`);

  const bodyText = await window.webContents.executeJavaScript(`document.body.innerText`);
  check('dashboard heading rendered', bodyText.includes('Dashboard'));

  // The theme must actually be applied, not just imported.
  const bg = await window.webContents.executeJavaScript(`getComputedStyle(document.body).backgroundColor`);
  check('theme applied to body', bg !== '' && bg !== 'rgba(0, 0, 0, 0)', bg);

  const fontFamily = await window.webContents.executeJavaScript(`getComputedStyle(document.body).fontFamily`);
  check('brand font in use', /Alliance/i.test(fontFamily), fontFamily.slice(0, 60));

  // Contract 1 / 3: the renderer must have no Node reach.
  const nodeReach = await window.webContents.executeJavaScript(
    `({ req: typeof require, proc: typeof process, bridge: typeof window.chirpHub })`
  );
  check('renderer has no require()', nodeReach.req === 'undefined');
  check('renderer has no process', nodeReach.proc === 'undefined');
  check('preload bridge exposed', nodeReach.bridge === 'object');

  // Contract 2 rule 1: no jargon leaked into the UI.
  const leaked = FORBIDDEN_JARGON.filter((word) => bodyText.includes(word));
  check('no jargon in the UI', leaked.length === 0, leaked.join(', '));

  window.destroy();

  console.log(`\n  screenshots: ${SHOT_DIR}`);

  const failed = results.filter((r) => !r.pass);
  console.log(
    failed.length === 0
      ? `\n${results.length}/${results.length} checks passed.\n`
      : `\n${failed.length} of ${results.length} checks FAILED.\n`
  );

  app.exit(failed.length === 0 ? 0 : 1);
}

// Each viewport destroys its window before opening the next. Without this,
// Electron's default window-all-closed behaviour quits the app between
// viewports — silently, with exit code 0, so the run *looks* like it passed
// while having skipped every check after the first.
app.on('window-all-closed', () => {
  /* handled by app.exit() at the end of run() */
});

void app.whenReady().then(() =>
  run().catch((error) => {
    console.error('\nSmoke test crashed:', error);
    app.exit(1);
  })
);
