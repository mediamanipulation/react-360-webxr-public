// A 360 photo or video all around the viewer.
//
// An ordinary panorama is the scene's background. A stereo one holds a
// picture for each eye, stacked or side by side, and is drawn on two spheres:
// in a headset each eye sees its own, and on the page both show the left.

import React, {useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {background} from './state.js';

// Which part of the picture each eye gets, as [repeatX, repeatY, offsetX, offsetY]
const EYES = {
  '3DTB': {left: [1, 0.5, 0, 0.5], right: [1, 0.5, 0, 0]},
  '3DBT': {left: [1, 0.5, 0, 0], right: [1, 0.5, 0, 0.5]},
  '3DLR': {left: [0.5, 1, 0, 0], right: [0.5, 1, 0.5, 0]},
  '3DRL': {left: [0.5, 1, 0.5, 0], right: [0.5, 1, 0, 0]},
};

export const isStereoFormat = format => Boolean(EYES[format]);

// three.js draws layer 1 for the left eye only, and layer 2 for the right
const LEFT_EYE = 1;
const RIGHT_EYE = 2;

function eyeTexture(texture, [repeatX, repeatY, offsetX, offsetY]) {
  const eye = texture.clone();
  eye.repeat.set(repeatX, repeatY);
  eye.offset.set(offsetX, offsetY);
  eye.needsUpdate = true;
  return eye;
}

function StereoSpheres({texture, format}) {
  const group = useRef(null);
  const left = useRef(null);
  // Seen from inside, with the middle of the picture straight ahead
  const geometry = useMemo(() => {
    const sphere = new THREE.SphereGeometry(500, 64, 32);
    sphere.scale(-1, 1, 1);
    sphere.rotateY(-Math.PI / 2);
    return sphere;
  }, []);
  const eyes = useMemo(
    () => ({
      left: eyeTexture(texture, EYES[format].left),
      right: eyeTexture(texture, EYES[format].right),
    }),
    [texture, format],
  );
  useEffect(
    () => () => {
      eyes.left.dispose();
      eyes.right.dispose();
    },
    [eyes],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({camera, gl}) => {
    // Always centered on the viewer, like a sky
    camera.getWorldPosition(group.current.position);
    // On the page there is one camera, which sees the left eye's picture
    left.current.layers.set(gl.xr.isPresenting ? LEFT_EYE : 0);
  });

  const material = {depthWrite: false, depthTest: false, toneMapped: false};
  return (
    <group ref={group} renderOrder={-1000}>
      <mesh ref={left} geometry={geometry} frustumCulled={false} raycast={() => {}}>
        <meshBasicMaterial map={eyes.left} {...material} />
      </mesh>
      <mesh geometry={geometry} frustumCulled={false} layers={RIGHT_EYE} raycast={() => {}}>
        <meshBasicMaterial map={eyes.right} {...material} />
      </mesh>
    </group>
  );
}

export default function Background() {
  const current = useSyncExternalStore(background.subscribe, background.get);
  const scene = useThree(state => state.scene);
  // {texture, format} of the picture on show
  const [shown, setShown] = useState(null);
  const previous = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const show = texture => {
      if (cancelled) {
        if (texture) {
          texture.dispose();
        }
        return;
      }
      if (texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      }
      // The previous picture stays up until the new one is ready
      if (previous.current) {
        previous.current.dispose();
      }
      previous.current = texture;
      setShown(texture ? {texture, format: current.format} : null);
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
  }, [current]);

  const stereo = shown && isStereoFormat(shown.format);
  useEffect(() => {
    if (shown && !stereo) {
      shown.texture.mapping = THREE.EquirectangularReflectionMapping;
      shown.texture.needsUpdate = true;
      // Turned so the middle of the picture is straight ahead, as React 360 has it
      scene.backgroundRotation.set(0, Math.PI / 2, 0);
      scene.background = shown.texture;
    } else {
      scene.background = new THREE.Color('#000000');
    }
  }, [shown, stereo, scene]);

  return stereo ? <StereoSpheres texture={shown.texture} format={shown.format} /> : null;
}
