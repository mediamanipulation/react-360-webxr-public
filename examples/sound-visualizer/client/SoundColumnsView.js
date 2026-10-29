/**
 * The `SoundColumns` custom view: a ring of columns around the viewer that
 * rise and change color with the music, and a glowing orb where the sound
 * comes from. It reads the analyser straight from the engine every frame,
 * without going through React.
 */

import * as THREE from 'three';
import {RCTBaseView} from 'react-360-web';
import UIView from 'react-360-web/js/OVRUI/UIView/UIView';
import {MOODS} from '../pattern';
import {engine, ORB_POSITION} from './engine';

const FLOOR_Y = -1.6;
// Only the lower part of the spectrum has much in it
const USABLE_BINS = 0.7;
const noRaycast = () => {};

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.35)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export default class SoundColumnsView extends RCTBaseView {
  constructor(guiSys) {
    super();
    this.view = new UIView(guiSys);
    this._count = 48;
    this._radius = 4;
    this._colors = MOODS.chill.colors.map(c => new THREE.Color(c));
    this._columns = [];
    this._heights = [];
    this._needsBuild = true;
    this._columnGeometry = new THREE.BoxGeometry(0.16, 1, 0.16);
    this._columnGeometry.translate(0, 0.5, 0);

    const floor = new THREE.GridHelper(12, 24, 0x2a3566, 0x151c3a);
    floor.position.y = FLOOR_Y;
    floor.raycast = noRaycast;
    this.view.add(floor);

    this._orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 32, 24),
      new THREE.MeshBasicMaterial({color: 0xffffff}),
    );
    this._orb.position.fromArray(ORB_POSITION);
    this._orb.raycast = noRaycast;
    this._halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this._halo.raycast = noRaycast;
    this._orb.add(this._halo);
    this.view.add(this._orb);

    Object.defineProperty(this.props, 'count', {
      set: value => {
        this._count = value || 48;
        this._needsBuild = true;
      },
    });
    Object.defineProperty(this.props, 'radius', {
      set: value => {
        this._radius = value || 4;
        this._needsBuild = true;
      },
    });
    Object.defineProperty(this.props, 'mood', {
      set: value => {
        const mood = MOODS[value] || MOODS.chill;
        this._colors = mood.colors.map(c => new THREE.Color(c));
      },
    });
  }

  _build() {
    this._needsBuild = false;
    this._columns.forEach(column => {
      this.view.remove(column);
      column.material.dispose();
    });
    this._columns = [];
    this._heights = [];
    for (let i = 0; i < this._count; i++) {
      // Column 0 is straight ahead, at -z
      const angle = (i / this._count) * Math.PI * 2;
      const column = new THREE.Mesh(
        this._columnGeometry,
        new THREE.MeshBasicMaterial({color: this._colors[0]}),
      );
      column.position.set(
        Math.sin(angle) * this._radius,
        FLOOR_Y,
        -Math.cos(angle) * this._radius,
      );
      column.rotation.y = -angle;
      column.raycast = noRaycast;
      this.view.add(column);
      this._columns.push(column);
      this._heights.push(0.1);
    }
  }

  frame(timeStamp, deltaTime) {
    super.frame(timeStamp, deltaTime);
    if (this._needsBuild) {
      this._build();
    }
    const data = engine.getFrequencyData();
    const usable = Math.floor(data.length * USABLE_BINS);
    const half = this._count / 2;
    const ease = Math.min(1, (deltaTime / 1000) * 12);
    for (let i = 0; i < this._count; i++) {
      // Mirrored, so low notes are in front and high notes behind
      const j = i < half ? i : this._count - 1 - i;
      const value = data[Math.floor((j / half) * usable)] / 255;
      const target = 0.1 + 2.5 * value;
      this._heights[i] += (target - this._heights[i]) * ease;
      const column = this._columns[i];
      column.scale.y = this._heights[i];
      column.material.color.copy(this._colors[0]).lerp(this._colors[1], value);
    }

    const level = engine.getLevel();
    this._orb.scale.setScalar(1 + level * 1.2);
    this._orb.material.color.copy(this._colors[0]).lerp(this._colors[1], level);
    this._halo.material.color.copy(this._orb.material.color);
    this._halo.scale.setScalar(1.6 + level * 4);
  }

  static describe() {
    const base = super.describe();
    return {
      ...base,
      NativeProps: {...base.NativeProps, count: 'number', radius: 'number', mood: 'string'},
    };
  }
}
