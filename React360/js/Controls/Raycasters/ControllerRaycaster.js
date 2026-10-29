/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import * as THREE from 'three';
import type VRState from '../../Compositor/VRState';
import {rotateByQuaternion} from '../../Utils/Math';
import {type Quaternion, type Vec3} from '../Types';
import {type Raycaster} from './Types';
import {createControllerMesh} from '../Utils/ControllerRenderer';

const TYPE = 'controller';

// Avoid reallocating the ray orientation each frame
const rayQuat: Quaternion = [0, 0, 0, 1];

/**
 * Casts a ray from a WebXR input source: a motion controller, a tracked hand,
 * or the viewer's gaze on headsets without controllers.
 * With several input sources, the ray follows whichever one most recently
 * started a select (trigger pull, pinch, or tap).
 */
export default class ControllerRaycaster implements Raycaster {
  _activeSource: ?XRInputSource;
  _enabled: boolean;
  _mesh: THREE.Mesh;
  _pose: ?XRPose;
  _rayRenderingEnabled: boolean;
  _scene: THREE.Scene;
  _vrState: VRState;

  constructor(scene: THREE.Scene, vrState: VRState) {
    this._activeSource = null;
    this._enabled = true;
    this._pose = null;
    this._scene = scene;
    this._vrState = vrState;
    this._mesh = createControllerMesh('#fff');
    this._mesh.visible = false;
    this._rayRenderingEnabled = true;
    this._scene.add(this._mesh);

    (this: any)._onSelectStart = this._onSelectStart.bind(this);
    vrState.onEnter(session => {
      session.addEventListener('selectstart', this._onSelectStart);
    });
    vrState.onExit(() => {
      this._activeSource = null;
    });
  }

  _onSelectStart(event: XRInputSourceEvent) {
    if (event.inputSource.targetRayMode !== 'screen') {
      this._activeSource = event.inputSource;
    }
  }

  /**
   * Keep the most recently active source while it remains connected. Until
   * one is used, prefer a right-handed pointer, then any pointer, then gaze.
   */
  _getActiveSource(sources: XRInputSourceArray): ?XRInputSource {
    let pointer = null;
    let gaze = null;
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      if (source === this._activeSource) {
        return source;
      }
      if (source.targetRayMode === 'tracked-pointer') {
        if (!pointer || source.handedness === 'right') {
          pointer = source;
        }
      } else if (source.targetRayMode === 'gaze' && !gaze) {
        gaze = source;
      }
    }
    this._activeSource = null;
    return pointer || gaze;
  }

  enable() {
    this._enabled = true;
  }

  disable() {
    this._enabled = false;
  }

  getType(): string {
    return TYPE;
  }

  getMaxLength(): number {
    return Infinity;
  }

  setRayRenderingEnabled(enabled: boolean) {
    this._rayRenderingEnabled = enabled;
  }

  fillDirection(direction: Vec3): boolean {
    // Assume no input source provides a ray, set ray mesh invisible.
    this._mesh.visible = false;
    this._pose = null;
    if (!this._enabled) {
      return false;
    }
    const frame = this._vrState.getFrame();
    const referenceSpace = this._vrState.getReferenceSpace();
    if (!frame || !referenceSpace) {
      return false;
    }
    const source = this._getActiveSource(frame.session.inputSources);
    if (!source) {
      return false;
    }
    const pose = frame.getPose(source.targetRaySpace, referenceSpace);
    if (!pose) {
      return false;
    }
    this._pose = pose;

    const orientation = pose.transform.orientation;
    rayQuat[0] = orientation.x;
    rayQuat[1] = orientation.y;
    rayQuat[2] = orientation.z;
    rayQuat[3] = orientation.w;
    direction[0] = 0;
    direction[1] = 0;
    direction[2] = -1;
    rotateByQuaternion(direction, rayQuat);

    this._mesh.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
    // Draw the beam for hands and controllers, not out of the viewer's eyes
    if (this._rayRenderingEnabled && source.targetRayMode === 'tracked-pointer') {
      this._mesh.visible = true;
    }
    return true;
  }

  fillOrigin(origin: Vec3): boolean {
    // fillDirection always runs first, and found the pose for this frame
    const pose = this._pose;
    if (!this._enabled || !pose) {
      return false;
    }
    const position = pose.transform.position;
    origin[0] = position.x;
    origin[1] = position.y;
    origin[2] = position.z;

    this._mesh.position.set(origin[0], origin[1], origin[2]);
    return true;
  }

  drawsCursor() {
    return true;
  }

  hasAbsoluteCoordinates() {
    return true;
  }
}
