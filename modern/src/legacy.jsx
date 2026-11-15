// Runs code written for the original runtime's extension points: custom
// views (classes extending RCTBaseView that draw with three.js) and native
// modules (classes extending Module).
//
// There is no bridge here: the app and this code share one thread. A custom
// view's object is added to the scene, its props are set as React renders,
// and its frame() is called every frame. A native module is an object whose
// methods the app calls directly.

import React, {useEffect, useMemo, useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';

/**
 * The base class of custom views. A view puts what it draws in `this.view`,
 * defines setters on `this.props` for the props it takes, and may override
 * frame() to animate.
 */
export class RCTBaseView {
  constructor() {
    this.props = {};
    this.style = {};
    this.view = null;
  }

  /** Called every frame with the time, and the time since the last frame, in milliseconds. */
  frame(timeStamp, deltaTime) {}

  dispose() {}

  static describe() {
    return {NativeProps: {}};
  }
}

/**
 * What custom views use as their `this.view`: a three.js group.
 */
export class UIView extends THREE.Group {
  constructor(guiSys) {
    super();
    this.guiSys = guiSys;
  }
}

/**
 * The base class of native modules. `name` is what the app finds the module
 * under in NativeModules.
 */
export class Module {
  constructor(name) {
    this.name = name;
  }
}

export const isLegacyView = view =>
  typeof view === 'function' && view.prototype instanceof RCTBaseView;

/**
 * A React component that draws a custom view class.
 */
export function legacyViewComponent(ViewClass) {
  function LegacyView(props) {
    const view = useMemo(() => new ViewClass({}), []);
    const applied = useRef({});

    // Each prop goes through the setter the view defined for it, when it changes
    for (const name of Object.keys(props)) {
      if (name !== 'children' && applied.current[name] !== props[name]) {
        applied.current[name] = props[name];
        view.props[name] = props[name];
      }
    }

    useFrame((state, delta) => view.frame(performance.now(), delta * 1000));
    useEffect(() => () => view.dispose(), [view]);

    return <primitive object={view.view} />;
  }
  LegacyView.displayName = ViewClass.name;
  return LegacyView;
}
