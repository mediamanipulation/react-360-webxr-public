// React 360's 3D components: primitives, models and lights, placed with the
// `transform` of their style. These are for roots drawn at a Location.

import React, {Suspense, createContext, useContext, useEffect, useMemo} from 'react';
import {useLoader} from '@react-three/fiber';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MTLLoader} from 'three/examples/jsm/loaders/MTLLoader.js';
import {OBJLoader} from 'three/examples/jsm/loaders/OBJLoader.js';
import {appLights, sourceURL} from './state.js';
import {flattenStyle} from './style.js';

/**
 * Where a component is being drawn: 'surface' for a panel of 2D UI, or
 * 'location' for a place in the 3D world.
 */
export const SpaceContext = createContext('surface');
export const useSpace = () => useContext(SpaceContext);

// 30, '30deg' and '0.5rad' are all angles. Bare numbers are degrees.
function radians(value) {
  if (typeof value === 'string') {
    const number = parseFloat(value);
    return value.trim().endsWith('rad') ? number : (number * Math.PI) / 180;
  }
  return (value * Math.PI) / 180;
}

const step = new THREE.Matrix4();

/**
 * The matrix for a React Native transform list, like
 * `[{translate: [0, 1, -2]}, {rotateY: '45deg'}, {scale: 2}]`. Later entries
 * apply in the space of the earlier ones.
 */
export function transformMatrix(transform) {
  const matrix = new THREE.Matrix4();
  if (!transform) {
    return matrix;
  }
  for (const entry of transform) {
    for (const key of Object.keys(entry)) {
      const value = entry[key];
      step.identity();
      switch (key) {
        case 'translate':
          step.makeTranslation(value[0] || 0, value[1] || 0, value[2] || 0);
          break;
        case 'translateX':
          step.makeTranslation(value, 0, 0);
          break;
        case 'translateY':
          step.makeTranslation(0, value, 0);
          break;
        case 'translateZ':
          step.makeTranslation(0, 0, value);
          break;
        case 'scale':
          if (Array.isArray(value)) {
            step.makeScale(value[0], value[1], value[2]);
          } else {
            step.makeScale(value, value, value);
          }
          break;
        case 'scaleX':
          step.makeScale(value, 1, 1);
          break;
        case 'scaleY':
          step.makeScale(1, value, 1);
          break;
        case 'scaleZ':
          step.makeScale(1, 1, value);
          break;
        case 'rotateX':
          step.makeRotationX(radians(value));
          break;
        case 'rotateY':
          step.makeRotationY(radians(value));
          break;
        case 'rotateZ':
        case 'rotate':
          step.makeRotationZ(radians(value));
          break;
        case 'matrix':
          step.fromArray(value);
          break;
        default:
          console.warn(`react-360: the transform "${key}" is not supported and is ignored`);
      }
      matrix.multiply(step);
    }
  }
  return matrix;
}

// React 360's pointer events, as react-three-fiber's
function eventProps({onEnter, onExit, onMove, onClick, onInput}) {
  const props = {};
  if (onEnter) {
    props.onPointerEnter = onEnter;
  }
  if (onExit) {
    props.onPointerLeave = onExit;
  }
  if (onMove) {
    props.onPointerMove = onMove;
  }
  if (onClick) {
    props.onClick = onClick;
  }
  if (onInput) {
    const send = action => event =>
      onInput({
        nativeEvent: {
          inputEvent: {type: 'button', button: 0, buttonClass: 'confirm', action, source: event.pointerType},
        },
      });
    props.onPointerDown = send('down');
    props.onPointerUp = send('up');
  }
  return props;
}

/**
 * A group placed by a style's transform. In a Location, this is what View
 * and VrButton are.
 */
export function Group({style, children, ...events}) {
  const flat = flattenStyle(style);
  // The transform is usually a new array each render with the same contents
  const key = JSON.stringify(flat.transform || null);
  const matrix = useMemo(() => transformMatrix(flat.transform), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group
      matrix={matrix}
      matrixAutoUpdate={false}
      visible={flat.display !== 'none'}
      {...eventProps(events)}>
      {children}
    </group>
  );
}

function Shape({style, lit, wireframe, texture, children, ...events}) {
  const flat = flattenStyle(style);
  const opacity = flat.opacity === undefined ? 1 : flat.opacity;
  const material = {
    color: flat.color || '#ffffff',
    wireframe: Boolean(wireframe),
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
  };
  return (
    <Group style={style}>
      <mesh {...eventProps(events)}>
        {children}
        {lit ? <meshPhongMaterial {...material} /> : <meshBasicMaterial {...material} />}
      </mesh>
    </Group>
  );
}

export function Box({dimWidth = 1, dimHeight = 1, dimDepth = 1, ...rest}) {
  return (
    <Shape {...rest}>
      <boxGeometry args={[dimWidth, dimHeight, dimDepth]} />
    </Shape>
  );
}

export function Plane({dimWidth = 1, dimHeight = 1, ...rest}) {
  return (
    <Shape {...rest}>
      <planeGeometry args={[dimWidth, dimHeight]} />
    </Shape>
  );
}

export function Sphere({radius = 0.5, widthSegments = 24, heightSegments = 16, ...rest}) {
  return (
    <Shape {...rest}>
      <sphereGeometry args={[radius, widthSegments, heightSegments]} />
    </Shape>
  );
}

export function Cylinder({radiusTop = 0.5, radiusBottom = 0.5, dimHeight = 1, segments = 24, ...rest}) {
  return (
    <Shape {...rest}>
      <cylinderGeometry args={[radiusTop, radiusBottom, dimHeight, segments]} />
    </Shape>
  );
}

function GLTFModel({url}) {
  const gltf = useLoader(GLTFLoader, url);
  // A clone, so the same file can be shown more than once
  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);
  return <primitive object={scene} />;
}

function OBJModel({url, mtl}) {
  const materials = useLoader(MTLLoader, mtl);
  const object = useLoader(OBJLoader, url, loader => {
    materials.preload();
    loader.setMaterials(materials);
  });
  const copy = useMemo(() => object.clone(true), [object]);
  return <primitive object={copy} />;
}

function PlainOBJModel({url}) {
  const object = useLoader(OBJLoader, url);
  const copy = useMemo(() => object.clone(true), [object]);
  return <primitive object={copy} />;
}

/**
 * A 3D model: `source={{gltf2: asset('thing.glb')}}`, or
 * `source={{obj: asset('thing.obj'), mtl: asset('thing.mtl')}}`.
 */
export function Entity({source = {}, style, ...events}) {
  const gltf = sourceURL(source.gltf2);
  const obj = sourceURL(source.obj);
  const mtl = sourceURL(source.mtl);
  let model = null;
  if (gltf) {
    model = <GLTFModel url={gltf} />;
  } else if (obj && mtl) {
    model = <OBJModel url={obj} mtl={mtl} />;
  } else if (obj) {
    model = <PlainOBJModel url={obj} />;
  }
  return (
    <Group style={style} {...events}>
      <Suspense fallback={null}>{model}</Suspense>
    </Group>
  );
}

export const Model = Entity;

// three.js lights have been physically based since r155, which made the same
// intensity dimmer by a factor of pi. React 360 scenes were tuned before that.
const LEGACY_LIGHT = Math.PI;

// Tells the runtime the app lights its own scene, so it adds no light of its own
function useAppLight() {
  useEffect(() => {
    appLights.set(appLights.get() + 1);
    return () => appLights.set(appLights.get() - 1);
  }, []);
}

export function AmbientLight({intensity = 1, style}) {
  useAppLight();
  return <ambientLight intensity={intensity * LEGACY_LIGHT} color={flattenStyle(style).color || '#ffffff'} />;
}

export function PointLight({intensity = 1, distance = 0, decay = 0, style}) {
  useAppLight();
  return (
    <Group style={style}>
      <pointLight
        intensity={intensity * LEGACY_LIGHT}
        distance={distance}
        decay={decay}
        color={flattenStyle(style).color || '#ffffff'}
      />
    </Group>
  );
}

export function DirectionalLight({intensity = 1, style}) {
  useAppLight();
  // It shines from where it is placed towards the middle of the scene
  return (
    <Group style={style}>
      <directionalLight intensity={intensity * LEGACY_LIGHT} color={flattenStyle(style).color || '#ffffff'} position={[0, 0, 0]} />
    </Group>
  );
}

export function SpotLight({intensity = 1, distance = 0, decay = 0, angle = Math.PI / 3, penumbra = 0, style}) {
  useAppLight();
  return (
    <Group style={style}>
      <spotLight
        intensity={intensity * LEGACY_LIGHT}
        distance={distance}
        decay={decay}
        angle={angle}
        penumbra={penumbra}
        color={flattenStyle(style).color || '#ffffff'}
      />
    </Group>
  );
}
