/**
 * A tiny state container that lets several React roots share state. A demo
 * renders its 3D scene and its panel as separate roots (a location and a
 * surface), which can't share React state directly.
 */

import {useEffect, useState} from 'react';

export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(partial) {
    state = {...state, ...partial};
    listeners.forEach(listener => listener(state));
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  // Hook returning the latest state, re-rendering the component on changes
  function useStore() {
    const [current, setCurrent] = useState(state);
    useEffect(() => {
      // Pick up changes made between the first render and subscribing
      setCurrent(state);
      return subscribe(setCurrent);
    }, []);
    return current;
  }

  return {getState, setState, subscribe, useStore};
}
