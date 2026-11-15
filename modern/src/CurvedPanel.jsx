// A panel wrapped round the viewer, as React 360's cylinder surfaces are.
//
// The panel's UI is laid out flat in a scene of its own and drawn into a
// texture every frame. That texture is shown on a slice of a cylinder, and
// pointer events that hit the slice are passed on to the flat UI at the same
// spot, so buttons work as they do on a flat panel.

import React, {useEffect, useMemo, useRef} from 'react';
import {createPortal, useFrame, useThree} from '@react-three/fiber';
import {forwardObjectEvents} from '@pmndrs/pointer-events';
import {Container} from '@react-three/uikit';
import * as THREE from 'three';
import {CLICK_MS} from './state.js';

// Texture pixels per panel pixel. Text is read up close in a headset.
const RESOLUTION = 2;
const SEGMENTS = 48;

// A slice of a cylinder centered straight ahead (-z), seen from inside, with
// the texture reading left to right
function sliceGeometry(radius, arc, height) {
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius,
    height,
    SEGMENTS,
    1,
    true,
    Math.PI - arc / 2,
    arc,
  );
  // Round the cylinder the texture runs right to left for a viewer inside
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setX(i, 1 - uv.getX(i));
  }
  return geometry;
}

export default function CurvedPanel({surface, children}) {
  const gl = useThree(state => state.gl);
  const {width, height, radius, density} = surface;
  const mesh = useRef(null);
  const forward = useRef(null);

  // The flat UI lives here, one unit to the pixel
  const scene = useMemo(() => new THREE.Scene(), []);
  const camera = useMemo(() => {
    const flat = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 1, 2000);
    flat.position.z = 1000;
    return flat;
  }, [width, height]);

  const target = useMemo(() => {
    const renderTarget = new THREE.WebGLRenderTarget(width * RESOLUTION, height * RESOLUTION, {
      samples: 4,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    renderTarget.texture.anisotropy = gl.capabilities.getMaxAnisotropy();
    return renderTarget;
  }, [gl, width, height]);
  useEffect(() => () => target.dispose(), [target]);

  const pixelSize = (2 * Math.PI * radius) / density;
  const geometry = useMemo(
    () => sliceGeometry(radius, (width / density) * 2 * Math.PI, height * pixelSize),
    [radius, width, height, density, pixelSize],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(() => {
    const forwarding = forwardObjectEvents(mesh.current, () => camera, scene, {
      clickThresholdMs: CLICK_MS,
    });
    forward.current = forwarding.update;
    return () => {
      forward.current = null;
      forwarding.destroy();
    };
  }, [camera, scene]);

  useFrame(() => {
    if (forward.current) {
      forward.current();
    }
    // The headset's cameras must not take over this render
    const xrEnabled = gl.xr.enabled;
    const previous = gl.getRenderTarget();
    gl.xr.enabled = false;
    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(previous);
    gl.xr.enabled = xrEnabled;
  });

  return (
    <>
      {createPortal(
        <Container
          pixelSize={1}
          width={width}
          height={height}
          flexDirection="column"
          alignItems="center"
          justifyContent="center">
          {children}
        </Container>,
        scene,
        {camera},
      )}
      <mesh ref={mesh} geometry={geometry}>
        {/* Drawn into the texture with blending, its colors are already
            multiplied by their opacity */}
        <meshBasicMaterial
          map={target.texture}
          transparent
          premultipliedAlpha
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}
