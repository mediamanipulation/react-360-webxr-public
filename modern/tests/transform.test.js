import * as THREE from 'three';
import {describe, expect, it} from 'vitest';
import {transformMatrix} from '../src/three-d.jsx';

// Where a point ends up, rounded
const apply = (transform, point = [0, 0, 0]) =>
  new THREE.Vector3(...point)
    .applyMatrix4(transformMatrix(transform))
    .toArray()
    .map(n => Math.round(n * 1000) / 1000 + 0);

describe('transformMatrix', () => {
  it('is the identity for no transform', () => {
    expect(apply(undefined, [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('translates', () => {
    expect(apply([{translate: [1, 2, -3]}])).toEqual([1, 2, -3]);
    expect(apply([{translateX: 4}, {translateY: 5}, {translateZ: 6}])).toEqual([4, 5, 6]);
  });

  it('reads bare numbers and "deg" strings as degrees, and "rad" as radians', () => {
    const ahead = [0, 0, -1];
    // A quarter turn to the left around the vertical axis
    expect(apply([{rotateY: 90}], ahead)).toEqual([-1, 0, 0]);
    expect(apply([{rotateY: '90deg'}], ahead)).toEqual([-1, 0, 0]);
    expect(apply([{rotateY: `${Math.PI / 2}rad`}], ahead)).toEqual([-1, 0, 0]);
  });

  it('applies later entries in the space of earlier ones', () => {
    // Moved first, then turned on the spot: the turn does not swing it round
    expect(apply([{translate: [0, 0, -5]}, {rotateY: 90}])).toEqual([0, 0, -5]);
    // Turned first, then moved along its own turned axis
    expect(apply([{rotateY: 90}, {translate: [0, 0, -5]}])).toEqual([-5, 0, 0]);
  });

  it('scales evenly or per axis', () => {
    expect(apply([{scale: 2}], [1, 1, 1])).toEqual([2, 2, 2]);
    expect(apply([{scale: [1, 2, 3]}], [1, 1, 1])).toEqual([1, 2, 3]);
    expect(apply([{scaleY: 3}], [1, 1, 1])).toEqual([1, 3, 1]);
  });
});
