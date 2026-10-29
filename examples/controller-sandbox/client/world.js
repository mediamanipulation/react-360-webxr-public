/**
 * The sandbox's shapes and input, on the main thread. The SandboxField view
 * draws and steps the shapes; the Sandbox module lets React clear them and
 * hear how many there are.
 */

import * as THREE from 'three';
import {addShape, LAUNCH_SPEED} from '../physics';

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const forward = new THREE.Vector3();
const orientation = new THREE.Quaternion();

function randomSpin() {
  return [0, 1, 2].map(() => (Math.random() - 0.5) * 4);
}

export const world = {
  shapes: [],
  // Shapes on their way out: {shape, time} with time in seconds
  fading: [],
  kind: 'cube',
  color: '#6cf0ff',
  onCountChange: count => {},

  attach(r360) {
    const canvas = r360.compositor.getCanvas();
    // Launches only into empty space: a click or trigger pull over a panel
    // is for the panel
    const overPanel = () => r360.runtime.isCursorActive();

    canvas.addEventListener('click', event => {
      if (r360.vrState.isPresenting() || overPanel()) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, r360.compositor.getCamera());
      this.launch(raycaster.ray.origin.toArray(), raycaster.ray.direction.toArray());
    });

    const onSelect = event => {
      if (overPanel()) {
        return;
      }
      const pose = event.frame.getPose(
        event.inputSource.targetRaySpace,
        r360.vrState.getReferenceSpace(),
      );
      if (!pose) {
        return;
      }
      const {position: p, orientation: o} = pose.transform;
      orientation.set(o.x, o.y, o.z, o.w);
      forward.set(0, 0, -1).applyQuaternion(orientation);
      this.launch([p.x, p.y, p.z], forward.toArray());
    };
    // Each VR session gets its own listener, so re-entering VR never stacks
    // a second one
    let session = null;
    r360.vrState.onEnter(entered => {
      session = entered;
      session.addEventListener('select', onSelect);
    });
    r360.vrState.onExit(() => {
      if (session) {
        session.removeEventListener('select', onSelect);
        session = null;
      }
    });
  },

  launch(origin, direction) {
    const shape = {
      // Start a little ahead of the controller or camera
      position: origin.map((v, i) => v + direction[i] * 0.15),
      velocity: direction.map(v => v * LAUNCH_SPEED),
      spin: randomSpin(),
      kind: this.kind,
      color: this.color,
      age: 0,
    };
    const evicted = addShape(this.shapes, shape);
    if (evicted) {
      this.fading.push({shape: evicted, time: 0});
    }
  },

  clear() {
    this.shapes.forEach(shape => this.fading.push({shape, time: 0}));
    this.shapes = [];
  },
};
