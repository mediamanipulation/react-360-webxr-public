import {createElement} from 'react';

// What the pieces of the runtime share: the registered root components,
// where assets live, what the background shows, and the events sent to apps.

/** A value that components can subscribe to with React's useSyncExternalStore. */
export function createValue(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      if (next !== value) {
        value = next;
        listeners.forEach(listener => listener());
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** React Native's event emitter, as far as React 360 apps use it. */
export function createEmitter() {
  const listeners = new Map();
  const remove = (type, listener) => {
    const set = listeners.get(type);
    if (set) {
      set.delete(listener);
    }
  };
  return {
    addListener(type, listener) {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      listeners.get(type).add(listener);
      return {remove: () => remove(type, listener)};
    },
    removeListener: remove,
    emit(type, ...args) {
      const set = listeners.get(type);
      if (set) {
        Array.from(set).forEach(listener => listener(...args));
      }
    },
  };
}

// How long a press may last and still be a click when it is let go. The
// pointer library's own limit is 0.3 seconds, which a slow trigger pull or a
// low frame rate overruns. React 360 had no limit.
export const CLICK_MS = 1500;

export const settings = {
  // Where asset() looks, set from the ReactInstance's `assetRoot` option
  assetRoot: 'static_assets/',
};

// {type: 'image', url} | {type: 'video', player} | null
export const background = createValue(null);

export const DeviceEventEmitter = createEmitter();

// How many lights the app has put in the scene itself
export const appLights = createValue(0);

// Views an app registers by name with the ReactInstance's `customViews`
// option, and draws with requireNativeComponent(name)
const customViews = new Map();

export function registerCustomView(name, view) {
  customViews.set(name, view);
}

/**
 * The component for a custom view. On the original runtime these were
 * classes drawing with three.js on the other side of a bridge; here a custom
 * view is any React component, usually a react-three-fiber one.
 */
export function requireNativeComponent(name) {
  function NativeComponent(props) {
    const View = customViews.get(name);
    if (!View) {
      throw new Error(
        `react-360: no custom view is registered as "${name}". ` +
          'Pass it in the customViews option of the ReactInstance.',
      );
    }
    return createElement(View, props);
  }
  NativeComponent.displayName = name;
  return NativeComponent;
}

const components = new Map();

export const AppRegistry = {
  registerComponent(name, getComponent) {
    components.set(name, getComponent);
  },
  getComponent(name) {
    const getComponent = components.get(name);
    if (!getComponent) {
      throw new Error(
        `react-360: no component is registered as "${name}". ` +
          'Import the file that calls AppRegistry.registerComponent before creating a root.',
      );
    }
    return getComponent();
  },
};

/**
 * A reference to a file in the app's static assets folder.
 */
export function asset(name) {
  return {uri: settings.assetRoot + name};
}

/** The URL of an asset() result, a {uri} or {url} object, or a plain string. */
export function sourceURL(source) {
  if (!source) {
    return null;
  }
  if (typeof source === 'string') {
    return source;
  }
  if (Array.isArray(source)) {
    return sourceURL(source[0]);
  }
  return source.uri || source.url || null;
}
