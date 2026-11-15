/**
 * A smoke test of the WebXR session lifecycle, without a headset.
 *
 * Opens this demo in a headless browser with IWER's emulated Quest 3
 * (index.html?emulate), enters VR through the "View in VR" button, pulls a
 * trigger, puts the controllers down for hands, pinches, and leaves again,
 * checking what the React 360 runtime makes of each step.
 *
 *   npm run smoke
 *
 * Uses the dev server on port 8081 if one is running, and starts one for
 * the length of the test otherwise. Needs Chrome or Edge installed; set
 * SMOKE_BROWSER to 'chrome', 'msedge' or 'chromium' (Playwright's own,
 * after `npx playwright-core install chromium`) to pick one.
 */

'use strict';

const assert = require('assert');
const {spawn, spawnSync} = require('child_process');
const http = require('http');
const path = require('path');
const {chromium} = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8081;
const URL = `http://localhost:${PORT}/index.html?emulate`;
// The first load builds both bundles, which takes Metro a while
const BUNDLE_TIMEOUT = 5 * 60 * 1000;
const STEP_TIMEOUT = 15 * 1000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function serverResponds() {
  return new Promise(resolve => {
    const request = http.get(`http://localhost:${PORT}/index.html`, response => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on('error', () => resolve(false));
    request.setTimeout(2000, () => request.destroy());
  });
}

// Resolves with a function that stops the server, if this started it
async function ensureServer() {
  if (await serverResponds()) {
    console.log(`Using the dev server already on port ${PORT}`);
    return () => {};
  }
  console.log('Starting the dev server');
  const server = spawn(
    process.execPath,
    [path.join(ROOT, 'node_modules', 'react-360', 'scripts', 'packager.js')],
    {cwd: ROOT, stdio: 'ignore', detached: process.platform !== 'win32'},
  );
  const stop = () => {
    if (server.exitCode !== null) {
      return;
    }
    // The packager runs Metro in a child process: stop the whole tree
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']);
    } else {
      process.kill(-server.pid);
    }
  };
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) {
      throw new Error(
        `The dev server exited with code ${server.exitCode}. If something else is on port ` +
          `${PORT} without answering, like a dev server that has hung, stop it first.`,
      );
    }
    if (await serverResponds()) {
      return stop;
    }
    await sleep(500);
  }
  stop();
  throw new Error('The dev server did not start');
}

async function launchBrowser() {
  const wanted = process.env.SMOKE_BROWSER;
  const channels = wanted ? [wanted] : ['chrome', 'msedge', 'chromium'];
  const failures = [];
  for (const channel of channels) {
    try {
      const browser = await chromium.launch({
        // 'chromium' is the browser Playwright installs itself
        channel: channel === 'chromium' ? undefined : channel,
        headless: true,
        // Software WebGL, so this runs the same on machines without a GPU
        args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
      });
      console.log(`Running in ${channel} ${browser.version()}`);
      return browser;
    } catch (error) {
      failures.push(`${channel}: ${String(error.message).split('\n')[0]}`);
    }
  }
  throw new Error(`No browser to run in.\n  ${failures.join('\n  ')}`);
}

// Runs in the page, before the test steps: records what the runtime asks
// the browser for, and what it tells the React app, in window.__smoke
function instrument() {
  const smoke = (window.__smoke = {requests: [], buttons: [], controllerEvents: []});

  const xr = navigator.xr;
  const requestSession = xr.requestSession.bind(xr);
  xr.requestSession = (mode, init) => {
    smoke.requests.push({mode, init: JSON.parse(JSON.stringify(init || null))});
    return requestSession(mode, init);
  };

  // Input events, as they are queued for the React app each frame
  const runtime = window.r360.runtime;
  const queueEvents = runtime.queueEvents.bind(runtime);
  runtime.queueEvents = events => {
    for (const event of events) {
      if (event.type === 'button') {
        smoke.buttons.push(`${event.source} ${event.buttonClass} ${event.action}`);
      }
    }
    return queueEvents(events);
  };

  // controllerConnected / controllerDisconnected, as sent to the React app
  const context = runtime.context;
  const callFunction = context.callFunction.bind(context);
  context.callFunction = (module, method, args) => {
    if (module === 'RCTDeviceEventEmitter' && /^controller/.test(args[0])) {
      smoke.controllerEvents.push(`${args[0]} ${args[1].source} ${args[1].id}`);
    }
    return callFunction(module, method, args);
  };

  // What the React app gets from ControllerInfo.getControllers()
  smoke.controllers = () => {
    let controllers = null;
    const invokeCallback = context.invokeCallback;
    context.invokeCallback = (id, args) => {
      controllers = args[0];
    };
    try {
      context.ControllerInfo.$getControllers(0);
    } finally {
      context.invokeCallback = invokeCallback;
    }
    return controllers.map(c => ({id: c.id, hand: c.hand, source: c.source, index: c.index}));
  };

  // When the runtime last ran a frame
  smoke.frameTime = () => window.r360._lastFrameTime;

  smoke.sources = () => {
    const session = window.r360.vrState.getSession();
    return Array.from(session ? session.inputSources : []).map(source => ({
      handedness: source.handedness,
      isHand: Boolean(source.hand),
    }));
  };
}

async function run(page, step) {
  const smoke = fn => page.evaluate(fn);
  const until = (fn, timeout = STEP_TIMEOUT) => page.waitForFunction(fn, null, {timeout});
  const vrButton = page.locator('a', {hasText: /View in VR|Exit VR/});

  await step('the page loads and offers VR', async () => {
    await page.goto(URL, {timeout: BUNDLE_TIMEOUT});
    await until(() => window.r360 && window.xrDevice, BUNDLE_TIMEOUT);
    // The React app's bundle has loaded once the runtime has a root view
    await until(() => window.r360.vrState.isSupported(), BUNDLE_TIMEOUT);
    await vrButton.waitFor({state: 'visible', timeout: STEP_TIMEOUT});
    assert.strictEqual((await vrButton.textContent()).trim(), 'View in VR');
    await page.evaluate(instrument);
    assert.deepStrictEqual(await smoke(() => window.__smoke.controllers()), []);
  });

  await step('"View in VR" starts an immersive session', async () => {
    await vrButton.click();
    await until(() => window.r360.vrState.isPresenting());
    assert.deepStrictEqual(await smoke(() => window.__smoke.requests), [
      {mode: 'immersive-vr', init: {optionalFeatures: ['hand-tracking', 'local-floor']}},
    ]);
    assert.ok(await smoke(() => Boolean(window.r360.vrState.getReferenceSpace())));
    await until(() => document.body.innerText.includes('Exit VR'));
  });

  await step('both controllers are reported', async () => {
    await until(() => window.__smoke.controllers().length === 2);
    assert.deepStrictEqual(await smoke(() => window.__smoke.sources()), [
      {handedness: 'left', isHand: false},
      {handedness: 'right', isHand: false},
    ]);
    const controllers = await smoke(() => window.__smoke.controllers());
    assert.deepStrictEqual(controllers.map(c => c.source), ['xr_left', 'xr_right']);
    assert.deepStrictEqual(controllers.map(c => c.hand), ['left', 'right']);
    assert.notStrictEqual(controllers[0].index, controllers[1].index);
    assert.deepStrictEqual(await smoke(() => window.__smoke.controllerEvents), [
      `controllerConnected xr_left ${controllers[0].id}`,
      `controllerConnected xr_right ${controllers[1].id}`,
    ]);
  });

  await step('frames are drawn through the session', async () => {
    const before = await smoke(() => window.__smoke.frameTime());
    await until(`window.__smoke.frameTime() > ${before}`);
  });

  await step('pulling the trigger is a confirm press', async () => {
    await smoke(() => window.xrDevice.controllers.right.updateButtonValue('trigger', 1));
    await until(() => window.__smoke.buttons.includes('xr_right confirm down'));
    await smoke(() => window.xrDevice.controllers.right.updateButtonValue('trigger', 0));
    await until(() => window.__smoke.buttons.includes('xr_right confirm up'));
  });

  await step('putting the controllers down swaps them for hands', async () => {
    await smoke(() => {
      window.__smoke.controllerEvents.length = 0;
      window.__smoke.buttons.length = 0;
      window.xrDevice.primaryInputMode = 'hand';
    });
    await until(() => {
      const sources = window.__smoke.sources();
      return sources.length === 2 && sources.every(source => source.isHand);
    });
    await until(() => window.__smoke.controllerEvents.length === 4);
    const events = await smoke(() => window.__smoke.controllerEvents);
    assert.deepStrictEqual(events.map(event => event.split(' ').slice(0, 2).join(' ')), [
      'controllerDisconnected xr_left',
      'controllerDisconnected xr_right',
      'controllerConnected xr_left',
      'controllerConnected xr_right',
    ]);
    assert.strictEqual(await smoke(() => window.__smoke.controllers().length), 2);
  });

  await step('pinching is a confirm press', async () => {
    await smoke(() => window.xrDevice.hands.right.updatePinchValue(1));
    await until(() => window.__smoke.buttons.includes('xr_right confirm down'));
    await smoke(() => window.xrDevice.hands.right.updatePinchValue(0));
    await until(() => window.__smoke.buttons.includes('xr_right confirm up'));
  });

  await step('exitVR ends the session and restores the page', async () => {
    await smoke(() => window.r360.exitVR());
    await until(() => !window.r360.vrState.isPresenting());
    await until(() => document.body.innerText.includes('View in VR'));
    assert.deepStrictEqual(await smoke(() => window.__smoke.controllers()), []);
    assert.strictEqual(await smoke(() => window.r360.vrState.getSession()), null);
    // The window's own render loop has taken over again
    const before = await smoke(() => window.__smoke.frameTime());
    await until(`window.__smoke.frameTime() > ${before}`);
  });

  await step('VR can be entered a second time', async () => {
    await smoke(() => {
      window.__smoke.controllerEvents.length = 0;
    });
    await vrButton.click();
    await until(() => window.r360.vrState.isPresenting());
    await until(() => window.__smoke.controllers().length === 2);
    assert.strictEqual(await smoke(() => window.__smoke.controllerEvents.length), 2);
    await smoke(() => window.r360.exitVR());
    await until(() => !window.r360.vrState.isPresenting());
  });
}

async function main() {
  let stopServer = () => {};
  let browser = null;
  let failed = false;
  try {
    stopServer = await ensureServer();
    browser = await launchBrowser();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));

    const step = async (name, fn) => {
      try {
        await fn();
      } catch (error) {
        console.log(`  FAIL  ${name}`);
        throw error;
      }
      console.log(`  ok    ${name}`);
    };
    await run(page, step);
    assert.deepStrictEqual(errors, [], 'The page reported errors');
    console.log('The WebXR smoke test passed');
  } catch (error) {
    failed = true;
    console.error(error);
  } finally {
    if (browser) {
      await browser.close();
    }
    stopServer();
  }
  process.exit(failed ? 1 : 0);
}

main();
