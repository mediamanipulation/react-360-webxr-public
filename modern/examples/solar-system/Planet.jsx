// The `Planet` view of the solar system example: a textured sphere that
// orbits the center of its location and spins. On the original runtime this
// was a custom view written against the runtime's internals
// (../../../examples/solar-system/client/PlanetView.js). Here it is an
// ordinary react-three-fiber component, using the same orbit maths and
// painted textures.

import React, {useMemo, useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {glowTexture, planetTexture} from '../../../examples/solar-system/client/planetTexture.js';
import {advanceSimDays, orbitPosition, spinAngle} from '../../../examples/solar-system/orbit.js';

// Saturn's rings and axial tilt
const RING_TILT = 0.47;
const RINGS = [[1.35, 1.75, 0.55], [1.8, 2.25, 0.4], [2.3, 2.45, 0.25]];
// The pointer passes through decorations, to the planet behind them
const noRaycast = () => {};

const painted = texture => {
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

export default function Planet({
  name = '',
  color = '#ffffff',
  size = 0.1,
  orbitRadius = 0,
  periodDays = 1,
  dayLengthHours = 24,
  phase = 0,
  glow = false,
  rings = false,
  speed = 1,
  highlighted = false,
}) {
  const body = useRef(null);
  const surface = useRef(null);
  const simDays = useRef(0);

  const texture = useMemo(() => painted(planetTexture(name, color)), [name, color]);
  const halo = useMemo(() => (glow ? painted(glowTexture(color)) : null), [glow, color]);
  const orbit = useMemo(() => {
    if (orbitRadius <= 0) {
      return null;
    }
    const points = [];
    for (let i = 0; i < 128; i++) {
      const angle = (i / 128) * Math.PI * 2;
      points.push(new THREE.Vector3(orbitRadius * Math.cos(angle), 0, orbitRadius * Math.sin(angle)));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [orbitRadius]);

  // Animation never goes through React: only the props above do
  useFrame((state, delta) => {
    simDays.current = advanceSimDays(simDays.current, delta * 1000, speed);
    if (orbitRadius > 0) {
      const [x, y, z] = orbitPosition(orbitRadius, periodDays, phase, simDays.current);
      body.current.position.set(x, y, z);
    }
    surface.current.rotation.y = spinAngle(dayLengthHours, simDays.current);
  });

  return (
    <group>
      {/* The body moves along the orbit; the orbit line stays put */}
      <group ref={body} scale={size}>
        <mesh ref={surface}>
          <sphereGeometry args={[1, 48, 32]} />
          {glow ? (
            <meshBasicMaterial map={texture} />
          ) : (
            <meshPhongMaterial map={texture} shininess={6} />
          )}
        </mesh>
        {/* A faint shell around the planet while it is pointed at or selected */}
        <mesh visible={highlighted} raycast={noRaycast}>
          <sphereGeometry args={[1.18, 32, 24]} />
          <meshBasicMaterial
            color="#6cf0ff"
            transparent
            opacity={0.28}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
        {rings &&
          RINGS.map(([inner, outer, opacity]) => (
            <mesh key={inner} rotation={[-Math.PI / 2 + RING_TILT, 0, 0]} raycast={noRaycast}>
              <ringGeometry args={[inner, outer, 96]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={opacity}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          ))}
        {halo && (
          <sprite scale={4.5} raycast={noRaycast}>
            <spriteMaterial map={halo} blending={THREE.AdditiveBlending} depthWrite={false} />
          </sprite>
        )}
      </group>
      {orbit && (
        // Lines would otherwise catch the pointer from a meter away
        <lineLoop geometry={orbit} raycast={noRaycast}>
          <lineBasicMaterial color="#ffffff" transparent opacity={0.12} />
        </lineLoop>
      )}
    </group>
  );
}
