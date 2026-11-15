/**
 * A smoke test of the modern runtime, without a headset.
 *
 * Opens the demo in a headless browser: clicks a scene button with the
 * mouse, then enters VR in IWER's emulated Quest 3 (index.html?emulate),
 * clicks another with the controller's ray, swaps the controllers for hands,
 * and leaves again.
 *
 *   npm run smoke
 *
 * Uses the dev server on port 8083 if one is running, and starts one for the
 * length of the test otherwise. Needs Chrome or Edge installed; set
 * SMOKE_BROWSER to 'chrome', 'msedge' or 'chromium' to pick one.
 */

import assert from 'node:assert';
import {spawn, spawnSync} from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8083;
const PAGE = `http://localhost:${PORT}/index.html`;
const TIMEOUT = 20 * 1000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function serverResponds() {
  return new Promise(resolve => {
    const request = http.get(PAGE, response => {
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
  const server = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  const stop = () => {
    if (server.exitCode !== null) {
      return;
    }
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']);
    } else {
      server.kill();
    }
  };
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) {
      throw new Error(`The dev server exited with code ${server.exitCode}`);
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

// Runs in the page: the file name of the panorama around the viewer
const backgroundName = () => {
  const texture = window.r360 && window.r360.scene && window.r360.scene.background;
  const image = texture && texture.image;
  return image && image.src ? image.src.split('/').pop() : null;
};

// Runs in the page: what the app is told about controllers. The app's own
// copy of the runtime module is the one Vite serves at this address.
const controllers = async () => {
  const runtime = await import('/src/index.js');
  const list = await runtime.NativeModules.ControllerInfo.getControllers();
  return list.map(c => `${c.source} ${c.hand}`);
};

async function run(page, step) {
  const until = (fn, arg) => page.waitForFunction(fn, arg, {timeout: TIMEOUT});
  const vrButton = page.locator('a', {hasText: /View in VR|Exit VR/});
  const ready = () =>
    until(() => {
      const scene = window.r360 && window.r360.scene;
      return Boolean(scene && scene.background && scene.background.isTexture && scene.background.image);
    });

  await step('the page draws the app over its panorama', async () => {
    await page.goto(PAGE);
    await ready();
    assert.strictEqual(await page.evaluate(backgroundName), '360_world.jpg');
    // No headset here, so no button
    assert.strictEqual(await vrButton.count(), 0);
  });

  await step('a mouse click on "Scene 1" switches the scene', async () => {
    const {width, height} = page.viewportSize();
    // The buttons sit in a row near the top of the panel, "Scene 1" in the middle
    await page.mouse.click(width / 2, height * 0.253);
    await until(name => {
      const texture = window.r360.scene.background;
      const image = texture && texture.image;
      return Boolean(image && image.src && image.src.endsWith(name));
    }, 'chess-world.jpg');
  });

  await step('with a headset, the page offers VR', async () => {
    await page.goto(`${PAGE}?emulate`);
    await ready();
    await until(() => window.r360.vrState.isSupported());
    await vrButton.waitFor({state: 'visible', timeout: TIMEOUT});
    assert.strictEqual((await vrButton.textContent()).trim(), 'View in VR');
    assert.deepStrictEqual(await page.evaluate(controllers), []);
  });

  await step('"View in VR" starts an immersive session', async () => {
    await vrButton.click();
    await until(() => window.r360.vrState.isPresenting());
    assert.strictEqual(await page.evaluate(() => window.r360.vrState.getSession().mode || 'immersive-vr'), 'immersive-vr');
  });

  await step('both controllers are reported', async () => {
    await until(() => window.r360.vrState.getSession().inputSources.length === 2);
    await sleep(300);
    assert.deepStrictEqual(await page.evaluate(controllers), ['xr_left left', 'xr_right right']);
  });

  await step("pointing the controller at \"Scene 1\" and pulling the trigger switches the scene", async () => {
    // Give the session a few frames to place the panel around the head
    await sleep(1500);
    await page.evaluate(() => {
      const device = window.xrDevice;
      const right = device.controllers.right;
      // From the head, the button is straight ahead and about 16 degrees up
      right.position.copy(device.position);
      const pitch = Math.atan2(1.14, 4);
      right.quaternion.set(Math.sin(pitch / 2), 0, 0, Math.cos(pitch / 2));
    });
    await sleep(800);
    await page.evaluate(() => window.xrDevice.controllers.right.updateButtonValue('trigger', 1));
    await sleep(120);
    await page.evaluate(() => window.xrDevice.controllers.right.updateButtonValue('trigger', 0));
    await until(name => {
      const texture = window.r360.scene.background;
      const image = texture && texture.image;
      return Boolean(image && image.src && image.src.endsWith(name));
    }, 'chess-world.jpg');
  });

  await step('putting the controllers down swaps them for hands', async () => {
    await page.evaluate(() => {
      window.xrDevice.primaryInputMode = 'hand';
    });
    await until(() => {
      const sources = Array.from(window.r360.vrState.getSession().inputSources);
      return sources.length === 2 && sources.every(source => source.hand);
    });
    await sleep(300);
    assert.deepStrictEqual(await page.evaluate(controllers), ['xr_left left', 'xr_right right']);
  });

  await step('exitVR ends the session and restores the page', async () => {
    await page.evaluate(() => window.r360.exitVR());
    await until(() => !window.r360.vrState.isPresenting());
    await until(() => document.body.innerText.includes('View in VR'));
    assert.deepStrictEqual(await page.evaluate(controllers), []);
  });

  await step('VR can be entered a second time', async () => {
    await vrButton.click();
    await until(() => window.r360.vrState.isPresenting());
    await page.evaluate(() => window.r360.exitVR());
    await until(() => !window.r360.vrState.isPresenting());
  });
}

// Runs in the page: how many boxes the scene is drawing
const boxCount = () => {
  let count = 0;
  window.r360.scene.traverse(object => {
    if (object.isMesh && object.geometry && object.geometry.type === 'BoxGeometry') {
      count++;
    }
  });
  return count;
};

// The code city example: 3D content from React, beside a panel
async function runCodeCity(page, step) {
  const until = (fn, arg) => page.waitForFunction(fn, arg, {timeout: TIMEOUT});

  await step('the code city draws a building for every file', async () => {
    await page.goto(`http://localhost:${PORT}/examples/code-city/index.html`);
    await until(() => window.r360 && window.r360.scene);
    await page.waitForFunction(boxCount, null, {timeout: TIMEOUT});
    await sleep(500);
    const count = await page.evaluate(boxCount);
    assert.ok(count > 200, `expected a city of buildings, found ${count} boxes`);
  });

  await step('its panel filters the city to one folder', async () => {
    const before = await page.evaluate(boxCount);
    const {width, height} = page.viewportSize();
    // The "Views" button, third in the panel's first row of filters
    await page.mouse.click(width * 0.508, height * 0.708);
    await page.waitForFunction(
      ({count, total}) => {
        let boxes = 0;
        window.r360.scene.traverse(object => {
          if (object.isMesh && object.geometry && object.geometry.type === 'BoxGeometry') {
            boxes++;
          }
        });
        return boxes === count && boxes < total;
      },
      {count: 24, total: before},
      {timeout: TIMEOUT},
    );
  });
}

// The solar system example: a custom view, as a react-three-fiber component
async function runSolarSystem(page, step) {
  const spheres = () => {
    let count = 0;
    window.r360.scene.traverse(object => {
      if (object.isMesh && object.geometry && object.geometry.type === 'SphereGeometry') {
        count++;
      }
    });
    return count;
  };
  await step('the solar system draws the Sun and eight planets', async () => {
    await page.goto(`http://localhost:${PORT}/examples/solar-system/index.html`);
    await page.waitForFunction(() => window.r360 && window.r360.scene, null, {timeout: TIMEOUT});
    await page.waitForFunction(spheres, null, {timeout: TIMEOUT});
    await sleep(500);
    // Each body is a surface and a highlight shell
    assert.strictEqual(await page.evaluate(spheres), 18);
  });

  await step('the planets move along their orbits', async () => {
    const positions = () => {
      const all = [];
      window.r360.scene.traverse(object => {
        if (object.isMesh && object.material && object.material.map && object.parent) {
          all.push(Math.round(object.parent.position.x * 1000));
        }
      });
      return all.join(',');
    };
    const before = await page.evaluate(positions);
    await sleep(700);
    assert.notStrictEqual(await page.evaluate(positions), before);
  });
}

async function main() {
  let stopServer = () => {};
  let browser = null;
  let failed = false;
  try {
    stopServer = await ensureServer();
    browser = await launchBrowser();
    const page = await browser.newPage({viewport: {width: 1280, height: 720}});
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
    await runCodeCity(page, step);
    await runSolarSystem(page, step);
    assert.deepStrictEqual(errors, [], 'The page reported errors');
    console.log('The modern runtime smoke test passed');
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
