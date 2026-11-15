// The entry point of a React 360 app: owns the canvas, the VR session, the
// background and the surfaces that React roots are drawn on.

import React, {Suspense, useEffect, useRef, useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {PointerEvents, XR, createXRStore, noEvents} from '@react-three/xr';
import {Container} from '@react-three/uikit';
import * as THREE from 'three';
import Background from './Background.jsx';
import {followSession} from './controllers.js';
import CurvedPanel from './CurvedPanel.jsx';
import {pollInput} from './input.js';
import {isLegacyView, legacyViewComponent} from './legacy.jsx';
import {updateAudioListener} from './media.js';
import {
  AppRegistry,
  CLICK_MS,
  DeviceEventEmitter,
  appLights,
  background,
  createEmitter,
  createValue,
  registerCustomView,
  registerNativeModule,
  settings,
} from './state.js';
import {SpaceContext} from './three-d.jsx';

// React 360 measures panels in pixels on a cylinder around the viewer:
// 4680 pixels go all the way round, 4 meters away
const DEFAULT_RADIUS = 4;
const PIXELS_AROUND = 4680;

/**
 * A panel in the world that a React root is drawn on.
 */
export class Surface {
  static SurfaceShape = {Cylinder: 'Cylinder', Flat: 'Flat'};

  constructor(width = 1000, height = 600, shape = Surface.SurfaceShape.Flat) {
    this.width = width;
    this.height = height;
    // A Cylinder surface wraps round the viewer; a Flat one faces them
    this.shape = shape;
    this.radius = DEFAULT_RADIUS;
    this.density = PIXELS_AROUND;
    this.yaw = 0;
    this.pitch = 0;
    this._changed = createValue(0);
  }

  _touch() {
    this._changed.set(this._changed.get() + 1);
  }

  /** Where the panel sits around the viewer, in radians. */
  setAngle(yaw, pitch = 0) {
    this.yaw = yaw;
    this.pitch = pitch;
    this._touch();
  }

  setRadius(radius) {
    this.radius = radius;
    this._touch();
  }

  /**
   * How many pixels would go all the way round the viewer. More makes the
   * panel, and everything on it, smaller.
   */
  setDensity(density) {
    this.density = density;
    this._touch();
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this._touch();
  }

  getWidth() {
    return this.width;
  }

  getHeight() {
    return this.height;
  }
}

/**
 * A place in the 3D world that a React root's 3D content is drawn at.
 */
export class Location {
  constructor(position = [0, 0, 0], rotation = [0, 0, 0, 1]) {
    this.position = position;
    this.rotation = rotation;
    this._changed = createValue(0);
  }

  setWorldPosition(x, y, z) {
    this.position = [x, y, z];
    this._changed.set(this._changed.get() + 1);
  }

  /** A quaternion: x, y, z, w. */
  setWorldRotation(x, y, z, w) {
    this.rotation = [x, y, z, w];
    this._changed.set(this._changed.get() + 1);
  }
}

function LocationGroup({location, children}) {
  useSyncExternalStore(location._changed.subscribe, location._changed.get);
  return (
    <group position={location.position} quaternion={location.rotation}>
      <SpaceContext.Provider value="location">{children}</SpaceContext.Provider>
    </group>
  );
}

function SurfacePanel({surface, instance, children}) {
  useSyncExternalStore(surface._changed.subscribe, surface._changed.get);
  // The instance knows whether the pointer is over a panel
  const enter = () => instance._overPanels.add(surface);
  const leave = () => instance._overPanels.delete(surface);
  useEffect(() => leave, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (surface.shape === Surface.SurfaceShape.Cylinder) {
    return (
      <group rotation={[surface.pitch, -surface.yaw, 0, 'YXZ']}>
        <CurvedPanel surface={surface} onEnter={enter} onLeave={leave}>
          {children}
        </CurvedPanel>
      </group>
    );
  }
  return (
    // Positive yaw turns the panel to the viewer's right, as in React 360
    <group rotation={[surface.pitch, -surface.yaw, 0, 'YXZ']}>
      <group position={[0, 0, -surface.radius]}>
        <Container
          pixelSize={(2 * Math.PI * surface.radius) / surface.density}
          width={surface.width}
          height={surface.height}
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          onPointerEnter={enter}
          onPointerLeave={leave}>
          {children}
        </Container>
      </group>
    </group>
  );
}

// React 360 content is laid out around the viewer's head. WebXR sessions here
// put the origin on the floor, so once tracking starts everything moves to
// where the head is.
function HeadCentered({store, instance, children}) {
  const group = useRef(null);
  const centered = useRef(false);
  useFrame(({camera}) => {
    const node = group.current;
    if (!store.getState().session) {
      if (centered.current) {
        centered.current = false;
        node.position.set(0, 0, 0);
        instance._headOffset.set(0, 0, 0);
      }
      return;
    }
    if (!centered.current) {
      camera.getWorldPosition(node.position);
      // The first frames of a session have no pose yet
      centered.current = node.position.lengthSq() > 0;
      instance._headOffset.copy(node.position);
    }
  });
  return <group ref={group}>{children}</group>;
}

const head = new THREE.Vector3();
const facing = new THREE.Vector3();
const upward = new THREE.Vector3();
const turn = new THREE.Quaternion();

// What the runtime does every frame, besides drawing
function EveryFrame({instance}) {
  useFrame(({camera, gl}) => {
    instance._camera = camera;
    instance._gl = gl;
    pollInput(instance.xrStore.getState().session);

    // Sounds are placed in the same head-centered space as everything else
    camera.getWorldPosition(head).sub(instance._headOffset);
    camera.getWorldQuaternion(turn);
    facing.set(0, 0, -1).applyQuaternion(turn);
    upward.set(0, 1, 0).applyQuaternion(turn);
    updateAudioListener(head.toArray(), facing.toArray(), upward.toArray());

    if (instance._frameHook) {
      instance._frameHook(performance.now());
    }
  });
  return null;
}

// Tells the instance when the scene is mounted inside the XR session root
function Ready({instance}) {
  useEffect(() => {
    instance._ready.set(true);
    return () => instance._ready.set(false);
  }, [instance]);
  return null;
}

// Controller and hand models are lit, so a scene with no lights of its own
// gets some. An app that lights its scene is left alone.
function DefaultLights() {
  const count = useSyncExternalStore(appLights.subscribe, appLights.get);
  if (count > 0) {
    return null;
  }
  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight intensity={2} position={[1, 3, 2]} />
    </>
  );
}

// On the page, drag to look around
function LookControls({store}) {
  const camera = useThree(state => state.camera);
  const element = useThree(state => state.gl.domElement);

  useEffect(() => {
    let dragging = false;
    let x = 0;
    let y = 0;
    camera.rotation.order = 'YXZ';
    const down = event => {
      dragging = true;
      x = event.clientX;
      y = event.clientY;
    };
    const move = event => {
      if (!dragging || store.getState().session) {
        return;
      }
      // The world follows the pointer, as if you were pulling it round
      const perPixel = (camera.fov * Math.PI) / 180 / element.clientHeight;
      camera.rotation.y += (event.clientX - x) * perPixel;
      camera.rotation.x += (event.clientY - y) * perPixel;
      camera.rotation.x = Math.min(Math.max(camera.rotation.x, -Math.PI / 2), Math.PI / 2);
      x = event.clientX;
      y = event.clientY;
    };
    const up = () => {
      dragging = false;
    };
    element.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      element.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [camera, element, store]);

  return null;
}

const BUTTON_STYLE = {
  position: 'absolute',
  left: 18,
  bottom: 18,
  padding: '10px 16px',
  borderRadius: 6,
  background: 'rgba(0, 0, 0, 0.6)',
  border: '1px solid rgba(255, 255, 255, 0.7)',
  color: '#ffffff',
  font: '16px system-ui, sans-serif',
  cursor: 'pointer',
  userSelect: 'none',
};

function VRButton({instance}) {
  const supported = useSyncExternalStore(instance._supported.subscribe, instance._supported.get);
  const presenting = useSyncExternalStore(instance._presenting.subscribe, instance._presenting.get);
  const ready = useSyncExternalStore(instance._ready.subscribe, instance._ready.get);
  // A session can only start once the scene is up
  if (!supported || !ready) {
    return null;
  }
  return (
    <a style={BUTTON_STYLE} onClick={() => (presenting ? instance.exitVR() : instance.enterVR())}>
      {presenting ? 'Exit VR' : 'View in VR'}
    </a>
  );
}

function App({instance}) {
  const roots = useSyncExternalStore(instance._roots.subscribe, instance._roots.get);
  return (
    <div style={{position: 'relative', width: '100%', height: '100%'}}>
      <Canvas
        flat
        // The mouse, touch, controllers and hands all go through one pointer
        // system, so they behave the same
        events={noEvents}
        camera={{position: [0, 0, 0], fov: 60, near: 0.1, far: 1000}}
        style={{touchAction: 'none'}}
        onCreated={({scene, camera, gl}) => {
          // The three.js scene, for apps that add objects of their own
          instance.scene = scene;
          instance._camera = camera;
          instance._gl = gl;
        }}>
        <PointerEvents clickThresholdMs={CLICK_MS} />
        <XR store={instance.xrStore}>
          <Ready instance={instance} />
          <EveryFrame instance={instance} />
          <DefaultLights />
          <Background />
          <LookControls store={instance.xrStore} />
          <HeadCentered store={instance.xrStore} instance={instance}>
            <Suspense fallback={null}>
              {roots.map(root => {
                const Component = AppRegistry.getComponent(root.name);
                return root.location ? (
                  <LocationGroup key={root.tag} location={root.location}>
                    <Component {...root.props} />
                  </LocationGroup>
                ) : (
                  <SurfacePanel key={root.tag} surface={root.surface} instance={instance}>
                    <Component {...root.props} />
                  </SurfacePanel>
                );
              })}
            </Suspense>
          </HeadCentered>
        </XR>
      </Canvas>
      <VRButton instance={instance} />
    </div>
  );
}

let nextTag = 1;

export default class ReactInstance {
  /**
   * `new ReactInstance(parent, options)`. For code written for React 360,
   * `new ReactInstance(bundle, parent, options)` works too: there is no
   * separate bundle to load any more, so that argument is ignored.
   */
  constructor(...args) {
    const [parent, options = {}] = args[0] instanceof Element ? args : args.slice(1);
    let assetRoot = options.assetRoot || 'static_assets/';
    if (!assetRoot.endsWith('/')) {
      assetRoot += '/';
    }
    settings.assetRoot = assetRoot;

    if (options.fullScreen) {
      Object.assign(parent.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        margin: '0',
        padding: '0',
        width: '100%',
        height: '100%',
      });
    }

    // A custom view is a React component, or a class written for the
    // original runtime
    (options.customViews || []).forEach(({name, view}) =>
      registerCustomView(name, isLegacyView(view) ? legacyViewComponent(view) : view),
    );
    // A native module is an object with a name, or a function that makes one.
    // The function is given what the original runtime's modules used to send
    // events to the app.
    const context = {
      callFunction: (module, method, args) => {
        if (module === 'RCTDeviceEventEmitter' && method === 'emit') {
          DeviceEventEmitter.emit(...args);
        }
      },
    };
    (options.nativeModules || []).forEach(module =>
      registerNativeModule(typeof module === 'function' ? module(context) : module),
    );
    this._frameHook = options.frame || null;
    this._overPanels = new Set();
    this._headOffset = new THREE.Vector3();
    this._camera = null;
    this._gl = null;

    this.eventEmitter = createEmitter();
    this._roots = createValue([]);
    this._supported = createValue(false);
    this._presenting = createValue(false);
    this._ready = createValue(false);
    this._defaultSurface = new Surface(1000, 600, Surface.SurfaceShape.Cylinder);
    this._defaultLocation = new Location();

    const xr = options.xr || {};
    this.xrStore = createXRStore({
      // Apps that want the emulator install it before creating the instance
      emulate: false,
      offerSession: options.offerSession !== false,
      controller: {rayPointer: {clickThresholdMs: CLICK_MS}},
      hand: {rayPointer: {clickThresholdMs: CLICK_MS}},
      transientPointer: {clickThresholdMs: CLICK_MS},
      foveation: xr.fixedFoveation,
      frameBufferScaling: xr.framebufferScaleFactor,
    });
    this.xrStore.subscribe((state, previous) => {
      if (state.session === previous.session) {
        return;
      }
      followSession(state.session);
      this._presenting.set(Boolean(state.session));
      this.eventEmitter.emit(state.session ? 'entervr' : 'exitvr', {
        type: state.session ? 'entervr' : 'exitvr',
        timeStamp: Date.now(),
        payload: state.session ? {stage: 'succeed'} : undefined,
      });
    });

    const enterCallbacks = [];
    const exitCallbacks = [];
    this.xrStore.subscribe((state, previous) => {
      if (state.session && !previous.session) {
        enterCallbacks.forEach(callback => callback(state.session));
      } else if (!state.session && previous.session) {
        exitCallbacks.forEach(callback => callback());
      }
    });
    let offsetSpace = null;
    this.vrState = {
      isSupported: () => this._supported.get(),
      isPresenting: () => this._presenting.get(),
      getSession: () => this.xrStore.getState().session || null,
      onEnter: callback => enterCallbacks.push(callback),
      onExit: callback => exitCallbacks.push(callback),
      /** The XRFrame of the frame being drawn, while in VR. */
      getFrame: () => (this._gl && this._gl.xr.isPresenting ? this._gl.xr.getFrame() : null),
      /**
       * A reference space whose origin is where the viewer's head was when
       * the session started: the space content is laid out in.
       */
      getReferenceSpace: () => {
        const base = this._gl && this._gl.xr.isPresenting ? this._gl.xr.getReferenceSpace() : null;
        if (!base) {
          return null;
        }
        const {x, y, z} = this._headOffset;
        const key = `${x},${y},${z}`;
        if (!offsetSpace || offsetSpace.base !== base || offsetSpace.key !== key) {
          offsetSpace = {
            base,
            key,
            space: base.getOffsetReferenceSpace(new XRRigidTransform({x, y, z})),
          };
        }
        return offsetSpace.space;
      },
    };
    const updateSupported = () => {
      navigator.xr.isSessionSupported('immersive-vr').then(
        supported => this._supported.set(supported),
        () => this._supported.set(false),
      );
    };
    if (navigator.xr) {
      navigator.xr.addEventListener('devicechange', updateSupported);
      updateSupported();
    }

    // The original runtime's compositor, as far as client.js files use it
    this.compositor = {
      setBackground: (url, options = {}) =>
        background.set(url ? {type: 'image', url, format: options.format || '2D'} : null),
      getCanvas: () => (this._gl ? this._gl.domElement : null),
      getCamera: () => this._camera,
    };
    this.runtime = {
      /** Whether the pointer is over a panel. */
      isCursorActive: () => this._overPanels.size > 0,
    };

    this._reactRoot = createRoot(parent);
    this._reactRoot.render(<App instance={this} />);
  }

  /** Resolves once the canvas and scene exist. */
  whenReady() {
    return new Promise(resolve => {
      if (this._ready.get()) {
        resolve();
        return;
      }
      const unsubscribe = this._ready.subscribe(() => {
        if (this._ready.get()) {
          unsubscribe();
          resolve();
        }
      });
    });
  }

  /** A root: the component registered as `name`, with these props. */
  createRoot(name, initialProps = {}) {
    return {name, props: initialProps, tag: nextTag++};
  }

  /** Draw a root on a surface. Returns a tag to pass to detachRoot. */
  renderToSurface(root, surface = this._defaultSurface) {
    this._roots.set(this._roots.get().concat({...root, surface}));
    return root.tag;
  }

  /** Draw a root's 3D content at a location in the world. */
  renderToLocation(root, location = this._defaultLocation) {
    this._roots.set(this._roots.get().concat({...root, location}));
    return root.tag;
  }

  getDefaultLocation() {
    return this._defaultLocation;
  }

  detachRoot(tag) {
    this._roots.set(this._roots.get().filter(root => root.tag !== tag));
  }

  getDefaultSurface() {
    return this._defaultSurface;
  }

  getAssetURL(name) {
    return settings.assetRoot + name;
  }

  /** Start a VR session. Must be called from a click or a key press. */
  enterVR() {
    this.eventEmitter.emit('entervr', {type: 'entervr', timeStamp: Date.now(), payload: {stage: 'attempt'}});
    return Promise.resolve(this.xrStore.enterVR()).catch(error => {
      this.eventEmitter.emit('entervr', {
        type: 'entervr',
        timeStamp: Date.now(),
        error: String(error && error.message ? error.message : error),
        payload: {stage: 'failed'},
      });
    });
  }

  exitVR() {
    const session = this.xrStore.getState().session;
    return session ? session.end() : Promise.resolve();
  }
}
