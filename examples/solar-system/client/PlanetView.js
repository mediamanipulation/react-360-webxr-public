/**
 * The `Planet` custom view: a textured sphere that orbits the center of its
 * location and spins, all in three.js on the main thread. React only sets its
 * props, so animation never crosses the bridge.
 */

import * as THREE from 'three';
import {RCTBaseView} from 'react-360-web';
import UIView from 'react-360-web/js/OVRUI/UIView/UIView';
import {advanceSimDays, orbitPosition, spinAngle} from '../orbit';
import {glowTexture, planetTexture} from './planetTexture';

// Saturn's rings and axial tilt
const RING_TILT = 0.47;
const noRaycast = () => {};

export default class PlanetView extends RCTBaseView {
  constructor(guiSys) {
    super();
    this.view = new UIView(guiSys);

    this._name = '';
    this._color = '#ffffff';
    this._size = 0.1;
    this._orbitRadius = 0;
    this._periodDays = 1;
    this._dayLengthHours = 24;
    this._phase = 0;
    this._speed = 1;
    this._glow = false;
    this._rings = false;
    this._simDays = 0;
    this._needsBuild = true;

    // The body moves along the orbit; the orbit line stays put
    this._body = new THREE.Group();
    this.view.add(this._body);

    this._mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32));
    this._body.add(this._mesh);

    // A faint shell around the planet while it is pointed at or selected
    this._shell = new THREE.Mesh(
      new THREE.SphereGeometry(1.18, 32, 24),
      new THREE.MeshBasicMaterial({
        color: 0x6cf0ff,
        transparent: true,
        opacity: 0.28,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    this._shell.visible = false;
    this._shell.raycast = noRaycast;
    this._body.add(this._shell);

    this._orbitLine = null;
    this._ringMeshes = [];
    this._halo = null;

    const prop = (name, apply) => {
      Object.defineProperty(this.props, name, {
        set: value => {
          apply(value);
          this._needsBuild = true;
        },
      });
    };
    prop('name', value => (this._name = value || ''));
    prop('color', value => (this._color = value || '#ffffff'));
    prop('size', value => (this._size = value || 0.1));
    prop('orbitRadius', value => (this._orbitRadius = value || 0));
    prop('periodDays', value => (this._periodDays = value || 1));
    prop('dayLengthHours', value => (this._dayLengthHours = value || 24));
    prop('phase', value => (this._phase = value || 0));
    prop('glow', value => (this._glow = !!value));
    prop('rings', value => (this._rings = !!value));
    Object.defineProperty(this.props, 'speed', {
      set: value => (this._speed = value == null ? 1 : value),
    });
    Object.defineProperty(this.props, 'highlighted', {
      set: value => (this._shell.visible = !!value),
    });
  }

  // Props arrive one at a time, so the meshes are rebuilt once per frame at
  // most, after all of them are set
  _build() {
    this._needsBuild = false;
    const texture = planetTexture(this._name, this._color);
    if (this._mesh.material) {
      this._mesh.material.dispose();
    }
    this._mesh.material = this._glow
      ? new THREE.MeshBasicMaterial({map: texture})
      : new THREE.MeshPhongMaterial({map: texture, shininess: 6});
    this._body.scale.setScalar(this._size);

    if (this._orbitLine) {
      this.view.remove(this._orbitLine);
      this._orbitLine = null;
    }
    if (this._orbitRadius > 0) {
      const geometry = new THREE.Geometry();
      for (let i = 0; i < 128; i++) {
        const angle = (i / 128) * Math.PI * 2;
        geometry.vertices.push(
          new THREE.Vector3(this._orbitRadius * Math.cos(angle), 0, this._orbitRadius * Math.sin(angle)),
        );
      }
      this._orbitLine = new THREE.LineLoop(
        geometry,
        new THREE.LineBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.12}),
      );
      // Lines would otherwise catch the pointer from a meter away
      this._orbitLine.raycast = noRaycast;
      this.view.add(this._orbitLine);
    }

    this._ringMeshes.forEach(ring => this._body.remove(ring));
    this._ringMeshes = [];
    if (this._rings) {
      [[1.35, 1.75, 0.55], [1.8, 2.25, 0.4], [2.3, 2.45, 0.25]].forEach(([inner, outer, opacity]) => {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(inner, outer, 96),
          new THREE.MeshBasicMaterial({
            color: this._color,
            transparent: true,
            opacity,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        ring.rotation.x = -Math.PI / 2 + RING_TILT;
        this._body.add(ring);
        this._ringMeshes.push(ring);
      });
    }

    if (this._halo) {
      this._body.remove(this._halo);
      this._halo = null;
    }
    if (this._glow) {
      this._halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture(this._color),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      this._halo.scale.setScalar(4.5);
      this._halo.raycast = noRaycast;
      this._body.add(this._halo);
    }
  }

  frame(timeStamp, deltaTime) {
    super.frame(timeStamp, deltaTime);
    if (this._needsBuild) {
      this._build();
    }
    this._simDays = advanceSimDays(this._simDays, deltaTime, this._speed);
    if (this._orbitRadius > 0) {
      const [x, y, z] = orbitPosition(this._orbitRadius, this._periodDays, this._phase, this._simDays);
      this._body.position.set(x, y, z);
    }
    this._mesh.rotation.y = spinAngle(this._dayLengthHours, this._simDays);
  }

  static describe() {
    const base = super.describe();
    return {
      ...base,
      NativeProps: {
        ...base.NativeProps,
        name: 'string',
        color: 'string',
        size: 'number',
        orbitRadius: 'number',
        periodDays: 'number',
        dayLengthHours: 'number',
        phase: 'number',
        glow: 'boolean',
        rings: 'boolean',
        speed: 'number',
        highlighted: 'boolean',
      },
    };
  }
}
