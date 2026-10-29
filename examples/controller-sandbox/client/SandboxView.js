/**
 * The `SandboxField` custom view: draws the world's shapes, steps their
 * physics each frame, and fades out the ones that leave. React sets which
 * shape and color the next launch uses.
 */

import * as THREE from 'three';
import {RCTBaseView} from 'react-360-web';
import UIView from 'react-360-web/js/OVRUI/UIView/UIView';
import {BOUNDS, stepShapes} from '../physics';
import {world} from './world';

const FADE_SECONDS = 0.5;
const noRaycast = () => {};

const GEOMETRIES = {
  cube: new THREE.BoxGeometry(0.12, 0.12, 0.12),
  sphere: new THREE.SphereGeometry(0.075, 20, 14),
  ring: new THREE.TorusGeometry(0.07, 0.022, 12, 32),
};

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.25)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export default class SandboxView extends RCTBaseView {
  constructor(guiSys) {
    super();
    this.view = new UIView(guiSys);
    this._meshes = new Map();
    this._lastCount = -1;
    this._glow = glowTexture();

    const floor = new THREE.GridHelper(BOUNDS.wallRadius * 2, 24, 0x3a4a7a, 0x1c2547);
    floor.position.y = BOUNDS.floorY;
    floor.raycast = noRaycast;
    this.view.add(floor);

    Object.defineProperty(this.props, 'kind', {
      set: value => (world.kind = value || 'cube'),
    });
    Object.defineProperty(this.props, 'color', {
      set: value => (world.color = value || '#6cf0ff'),
    });
  }

  _createMesh(shape) {
    const material = new THREE.MeshStandardMaterial({
      color: shape.color,
      emissive: shape.color,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.1,
      transparent: true,
    });
    const mesh = new THREE.Mesh(GEOMETRIES[shape.kind] || GEOMETRIES.cube, material);
    mesh.raycast = noRaycast;
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this._glow,
        color: shape.color,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    halo.scale.setScalar(0.45);
    halo.raycast = noRaycast;
    mesh.add(halo);
    this.view.add(mesh);
    this._meshes.set(shape, mesh);
    return mesh;
  }

  _removeMesh(shape) {
    const mesh = this._meshes.get(shape);
    if (mesh) {
      this.view.remove(mesh);
      mesh.material.dispose();
      mesh.children[0].material.dispose();
      this._meshes.delete(shape);
    }
  }

  frame(timeStamp, deltaTime) {
    super.frame(timeStamp, deltaTime);
    const dt = deltaTime / 1000;
    stepShapes(world.shapes, dt);
    stepShapes(world.fading.map(f => f.shape), dt);

    const place = (shape, opacity) => {
      const mesh = this._meshes.get(shape) || this._createMesh(shape);
      mesh.position.fromArray(shape.position);
      mesh.rotation.x += shape.spin[0] * dt;
      mesh.rotation.y += shape.spin[1] * dt;
      mesh.rotation.z += shape.spin[2] * dt;
      mesh.material.opacity = opacity;
      mesh.children[0].material.opacity = opacity;
    };
    world.shapes.forEach(shape => place(shape, 1));

    world.fading = world.fading.filter(entry => {
      entry.time += dt;
      if (entry.time >= FADE_SECONDS) {
        this._removeMesh(entry.shape);
        return false;
      }
      place(entry.shape, 1 - entry.time / FADE_SECONDS);
      return true;
    });

    if (world.shapes.length !== this._lastCount) {
      this._lastCount = world.shapes.length;
      world.onCountChange(this._lastCount);
    }
  }

  static describe() {
    const base = super.describe();
    return {
      ...base,
      NativeProps: {...base.NativeProps, kind: 'string', color: 'string'},
    };
  }
}
