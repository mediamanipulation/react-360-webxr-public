# React 360, on WebXR

React 360 is a framework for building interactive 360 and VR experiences with
React, which run in a web browser. Facebook archived it in 2020 while it still
ran on WebVR, an API that browsers have since removed, so React 360 apps could
no longer enter VR.

This fork ports React 360 to the WebXR Device API. Apps written for it enter VR
again on current browsers and headsets, such as the Meta Quest browser, with
controllers, tracked hands or gaze.

## What's here

| Folder | What it is |
| --- | --- |
| [`React360/`](React360/README.md) | The web runtime (`react-360-web`), ported from WebVR to WebXR. Its README lists what changed for apps. |
| [`Libraries/`](Libraries) | The React components (`react-360`), moved from React 16.3 and React Native 0.55 to React 16.8 and React Native 0.59, so components can use hooks. |
| [`webxr-demo/`](webxr-demo/README.md) | A runnable app on both, with the fixes its 2019 toolchain needs on current Node. It also holds the runtime's tests. Start here. |
| [`examples/`](examples/README.md) | Four showcase demos: a solar system, a controller sandbox, a sound visualizer and a city built from React 360's own source code. |
| [`docs/`](docs) | The original React 360 documentation. The API it describes is unchanged, apart from what the runtime's README lists. |
| [`WEBXR_STATUS.md`](WEBXR_STATUS.md) | What the port covers, what has been checked and how, and what is still open. |

The rest is the archived project as Facebook left it. That includes
[`packages/`](packages/README.md), an unreleased next-generation runtime that
still uses WebVR and is not part of this port.

## Try it

You need Node.js and npm. The port is developed and tested on Node 22.

```bash
cd webxr-demo
npm install
npm start
```

Then open http://localhost:8081/index.html.

- **Without a headset:** open http://localhost:8081/index.html?emulate. This
  loads Meta's WebXR emulator as a virtual Quest 3, so the "View in VR" button
  starts a real WebXR session in a desktop browser.
- **On a Meta Quest:** WebXR needs a secure context. Connect the headset over
  USB, run `adb reverse tcp:8081 tcp:8081`, and open
  `http://localhost:8081/index.html` in the Quest browser. Or run
  `npm start -- --https` and open `https://<your computer's IP>:8081/index.html`.

[`webxr-demo/README.md`](webxr-demo/README.md) has the details, and
[`examples/README.md`](examples/README.md) runs the showcase demos the same way.

## Start your own app

The port is not on npm yet: `react-360` and `react-360-web` there are still the
2019 WebVR releases, and `react-360 init` scaffolds against them. Until that
changes, the way to build on the port is from a checkout of this repository:

1. Copy `webxr-demo/` to a new folder beside it and rename the app in
   `package.json`, `client.js` and `index.js`.
2. Run `npm install` and `npm start` in it.
3. Write your app in `index.js`, as the [documentation](docs) describes.

The copy has to stay beside `React360/` and `Libraries/`, because its
`metro.config.js` loads both from there. The "How this differs from a
`react-360 init` project" section of
[`webxr-demo/README.md`](webxr-demo/README.md) explains each piece of that
setup.

To move an existing React 360 app onto the port, start from a copy of
`webxr-demo/` the same way and bring your `index.js`, components and
`static_assets/` across. Most apps need no code changes. Apps whose
`client.js` used the VR internals do: see "WebXR" in
[`React360/README.md`](React360/README.md).

## Tests

```bash
cd webxr-demo
npm test        # the runtime's unit tests
npm run smoke   # a whole VR session against the emulated headset
```

## Status

The port is developed against the emulator, with checks on a Meta Quest. It is a
restoration, not a modernization: three.js stays at r87 and the bundler is
still Metro from the React Native 0.59 era. [`WEBXR_STATUS.md`](WEBXR_STATUS.md)
has the full picture, including what has only been checked in the emulator.

Issues and pull requests are welcome. If you report a bug, include the
browser, the headset and what you saw.

## License

React 360 is [BSD licensed](./LICENSE). Its documentation is
[Creative Commons licensed](./LICENSE-docs), and the examples are
[separately licensed](./LICENSE-examples). The WebXR port is offered under the
same terms.
