// The entry point of a React 360 app: owns the canvas, the VR session, the
// background and the surfaces that React roots are drawn on.

import React, {Suspense, useEffect, useRef, useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {XR, createXRStore} from '@react-three/xr';
import {Container} from '@react-three/uikit';
import * as THREE from 'three';
import {followSession} from './controllers.js';
import {AppRegistry, background, createEmitter, createValue, settings} from './state.js';

// React 360 measures panels in pixels on a cylinder around the viewer:
// 4680 pixels go all the way round, 4 meters away
const DEFAULT_RADIUS = 4;
const PIXELS_AROUND = 4680;
const PIXEL_SIZE = (2 * Math.PI * DEFAULT_RADIUS) / PIXELS_AROUND;

/**
 * A panel in the world that a React root is drawn on.
 */
export class Surface {
  static SurfaceShape = {Cylinder: 'Cylinder', Flat: 'Flat'};

  constructor(width = 1000, height = 600, shape = Surface.SurfaceShape.Flat) {
    this.width = width;
    this.height = height;
    // Cylinder surfaces are drawn flat for now
    this.shape = shape;
    this.radius = DEFAULT_RADIUS;
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

function SurfacePanel({surface, children}) {
  useSyncExternalStore(surface._changed.subscribe, surface._changed.get);
  return (
    // Positive yaw turns the panel to the viewer's right, as in React 360
    <group rotation={[surface.pitch, -surface.yaw, 0, 'YXZ']}>
      <group position={[0, 0, -surface.radius]}>
        <Container
          pixelSize={PIXEL_SIZE}
          width={surface.width}
          height={surface.height}
          flexDirection="column"
          alignItems="center"
          justifyContent="center">
          {children}
        </Container>
      </group>
    </group>
  );
}

// React 360 content is laid out around the viewer's head. WebXR sessions here
// put the origin on the floor, so once tracking starts everything moves to
// where the head is.
function HeadCentered({store, children}) {
  const group = useRef(null);
  const centered = useRef(false);
  useFrame(({camera}) => {
    const node = group.current;
    if (!store.getState().session) {
      if (centered.current) {
        centered.current = false;
        node.position.set(0, 0, 0);
      }
      return;
    }
    if (!centered.current) {
      camera.getWorldPosition(node.position);
      // The first frames of a session have no pose yet
      centered.current = node.position.lengthSq() > 0;
    }
  });
  return <group ref={group}>{children}</group>;
}

// A 360 photo or video all around the viewer
function Background() {
  const current = useSyncExternalStore(background.subscribe, background.get);
  const scene = useThree(state => state.scene);
  const shown = useRef(null);

  useEffect(() => {
    // Turned so the middle of the picture is straight ahead, as React 360 has it
    scene.backgroundRotation.set(0, Math.PI / 2, 0);
    let cancelled = false;
    const show = texture => {
      if (cancelled) {
        if (texture) {
          texture.dispose();
        }
        return;
      }
      if (texture) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;
      }
      scene.background = texture || new THREE.Color('#000000');
      // The previous picture stays up until the new one is ready
      if (shown.current) {
        shown.current.dispose();
      }
      shown.current = texture;
    };
    if (!current) {
      show(null);
    } else if (current.type === 'video') {
      show(new THREE.VideoTexture(current.player.element));
    } else {
      new THREE.TextureLoader().load(current.url, show, undefined, () => {
        console.warn(`react-360: could not load the background ${current.url}`);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [current, scene]);

  return null;
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
  if (!supported) {
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
        camera={{position: [0, 0, 0], fov: 60, near: 0.1, far: 1000}}
        style={{touchAction: 'none'}}
        onCreated={({scene}) => {
          // The three.js scene, for apps that add objects of their own
          instance.scene = scene;
        }}>
        <XR store={instance.xrStore}>
          {/* Controller and hand models are lit */}
          <ambientLight intensity={1.5} />
          <directionalLight intensity={2} position={[1, 3, 2]} />
          <Background />
          <LookControls store={instance.xrStore} />
          <HeadCentered store={instance.xrStore}>
            <Suspense fallback={null}>
              {roots.map(root => {
                const Component = AppRegistry.getComponent(root.name);
                return (
                  <SurfacePanel key={root.tag} surface={root.surface}>
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

    this.eventEmitter = createEmitter();
    this._roots = createValue([]);
    this._supported = createValue(false);
    this._presenting = createValue(false);
    this._defaultSurface = new Surface(1000, 600, Surface.SurfaceShape.Cylinder);

    const xr = options.xr || {};
    this.xrStore = createXRStore({
      // Apps that want the emulator install it before creating the instance
      emulate: false,
      offerSession: options.offerSession !== false,
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

    this.vrState = {
      isSupported: () => this._supported.get(),
      isPresenting: () => this._presenting.get(),
      getSession: () => this.xrStore.getState().session || null,
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
      setBackground: url => background.set(url ? {type: 'image', url, format: '2D'} : null),
    };

    this._reactRoot = createRoot(parent);
    this._reactRoot.render(<App instance={this} />);
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
