// The part of React Native's Animated that React 360 apps lean on: values,
// timing and spring animations, interpolation, and animated components.

import React, {useEffect, useReducer} from 'react';
import {Image, Text, View} from './components.jsx';

class Node {
  constructor() {
    this._listeners = new Set();
  }

  _subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _notify() {
    this._listeners.forEach(listener => listener());
  }

  interpolate(config) {
    return new Interpolation(this, config);
  }
}

class Value extends Node {
  constructor(value = 0) {
    super();
    this._value = value;
    this._stop = null;
  }

  __getValue() {
    return this._value;
  }

  setValue(value) {
    this.stopAnimation();
    this._set(value);
  }

  _set(value) {
    if (value !== this._value) {
      this._value = value;
      this._notify();
    }
  }

  stopAnimation(callback) {
    if (this._stop) {
      this._stop();
      this._stop = null;
    }
    if (callback) {
      callback(this._value);
    }
  }

  addListener(callback) {
    return this._subscribe(() => callback({value: this._value}));
  }

  removeListener(remove) {
    if (typeof remove === 'function') {
      remove();
    }
  }
}

class Interpolation extends Node {
  constructor(parent, {inputRange, outputRange, extrapolate = 'extend'}) {
    super();
    this._parent = parent;
    this._input = inputRange;
    this._output = outputRange;
    this._clamp = extrapolate === 'clamp';
    parent._subscribe(() => this._notify());
  }

  __getValue() {
    const input = this._input;
    const output = this._output;
    let x = this._parent.__getValue();
    if (this._clamp) {
      x = Math.min(Math.max(x, input[0]), input[input.length - 1]);
    }
    // The segment x falls in, or the nearest one beyond the ends
    let i = 1;
    while (i < input.length - 1 && x > input[i]) {
      i++;
    }
    const t = (x - input[i - 1]) / (input[i] - input[i - 1] || 1);
    return output[i - 1] + (output[i] - output[i - 1]) * t;
  }
}

const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function animation(run) {
  return {
    start(callback) {
      run(finished => callback && callback({finished}));
    },
    stop() {},
  };
}

function timing(value, {toValue, duration = 500, delay = 0, easing = easeInOut} = {}) {
  return animation(done => {
    value.stopAnimation();
    const from = value.__getValue();
    let frame = null;
    let startTime = null;
    const step = now => {
      if (startTime === null) {
        startTime = now + delay;
      }
      const t = duration > 0 ? Math.min(Math.max((now - startTime) / duration, 0), 1) : 1;
      value._set(from + (toValue - from) * easing(t));
      if (t < 1) {
        frame = requestAnimationFrame(step);
      } else {
        value._stop = null;
        done(true);
      }
    };
    frame = requestAnimationFrame(step);
    value._stop = () => {
      cancelAnimationFrame(frame);
      done(false);
    };
  });
}

// A spring that settles without ringing for long: close enough for UI feedback
const spring = (value, {toValue, ...rest} = {}) =>
  timing(value, {
    toValue,
    duration: 400,
    easing: t => 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 1.5),
    ...rest,
  });

const sequence = animations =>
  animation(done => {
    const next = i => {
      if (i >= animations.length) {
        done(true);
        return;
      }
      animations[i].start(({finished}) => (finished ? next(i + 1) : done(false)));
    };
    next(0);
  });

const parallel = animations =>
  animation(done => {
    let left = animations.length;
    let all = true;
    if (!left) {
      done(true);
    }
    animations.forEach(a =>
      a.start(({finished}) => {
        all = all && finished;
        if (--left === 0) {
          done(all);
        }
      }),
    );
  });

const delay = time => animation(done => setTimeout(() => done(true), time));

// Every animated node inside a style, however deeply arrays and transforms nest
function collectNodes(style, found = []) {
  if (style instanceof Node) {
    found.push(style);
  } else if (Array.isArray(style)) {
    style.forEach(entry => collectNodes(entry, found));
  } else if (style && typeof style === 'object') {
    Object.keys(style).forEach(key => collectNodes(style[key], found));
  }
  return found;
}

// The same style with each animated node replaced by its current value
function resolve(style) {
  if (style instanceof Node) {
    return style.__getValue();
  }
  if (Array.isArray(style)) {
    return style.map(resolve);
  }
  if (style && typeof style === 'object') {
    const result = {};
    Object.keys(style).forEach(key => {
      result[key] = resolve(style[key]);
    });
    return result;
  }
  return style;
}

function createAnimatedComponent(Component) {
  function AnimatedComponent({style, ...props}) {
    const [, redraw] = useReducer(n => n + 1, 0);
    const nodes = collectNodes(style);
    useEffect(() => {
      const unsubscribe = nodes.map(node => node._subscribe(redraw));
      return () => unsubscribe.forEach(remove => remove());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, nodes);
    return <Component {...props} style={resolve(style)} />;
  }
  AnimatedComponent.displayName = `Animated.${Component.displayName || Component.name}`;
  return AnimatedComponent;
}

const Animated = {
  Value,
  timing,
  spring,
  sequence,
  parallel,
  delay,
  createAnimatedComponent,
  View: createAnimatedComponent(View),
  Text: createAnimatedComponent(Text),
  Image: createAnimatedComponent(Image),
};

export default Animated;
