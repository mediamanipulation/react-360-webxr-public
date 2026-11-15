import {describe, expect, it, vi} from 'vitest';
import {AppRegistry, asset, createEmitter, createValue, settings, sourceURL} from '../src/state.js';
import {StyleSheet, flattenStyle, styleToProps} from '../src/style.js';

describe('flattenStyle', () => {
  it('merges arrays, later entries winning, and skips falsy ones', () => {
    const focused = false;
    expect(
      flattenStyle([{width: 10, height: 20}, focused && {width: 99}, [{height: 30}, null]]),
    ).toEqual({width: 10, height: 30});
  });

  it('gives an empty style for nothing', () => {
    expect(flattenStyle(undefined)).toEqual({});
  });
});

describe('styleToProps', () => {
  it('passes through what means the same in both', () => {
    expect(
      styleToProps({width: 100, backgroundColor: '#333', borderRadius: 5, flexDirection: 'row'}),
    ).toEqual({width: 100, backgroundColor: '#333', borderRadius: 5, flexDirection: 'row'});
  });

  it('renames React Native spellings', () => {
    expect(
      styleToProps({paddingHorizontal: 20, marginVertical: 4, position: 'absolute', top: 5, left: 6}),
    ).toEqual({paddingX: 20, marginY: 4, positionType: 'absolute', positionTop: 5, positionLeft: 6});
  });

  it('expands flex into grow, shrink and basis', () => {
    expect(styleToProps({flex: 1})).toEqual({flexGrow: 1, flexShrink: 1, flexBasis: 0});
  });

  it('turns transforms into uikit transform properties', () => {
    expect(styleToProps({transform: [{scale: 2}, {translateX: 10}, {rotateZ: 45}]})).toEqual({
      transformScaleX: 2,
      transformScaleY: 2,
      transformScaleZ: 2,
      transformTranslateX: 10,
      transformRotateZ: 45,
    });
  });

  it('warns once about a style it cannot draw, and leaves it out', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(styleToProps({shadowColor: 'red', width: 1})).toEqual({width: 1});
    styleToProps({shadowColor: 'blue'});
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('keeps line heights in pixels', () => {
    expect(styleToProps({lineHeight: 40})).toEqual({lineHeight: '40px'});
  });

  it('takes style arrays', () => {
    expect(styleToProps([{width: 1}, {width: 2}])).toEqual({width: 2});
  });
});

describe('StyleSheet', () => {
  it('hands styles back as they are', () => {
    const styles = {panel: {width: 1000}};
    expect(StyleSheet.create(styles)).toBe(styles);
  });
});

describe('assets', () => {
  it('points into the asset root', () => {
    settings.assetRoot = 'static_assets/';
    expect(asset('world.jpg')).toEqual({uri: 'static_assets/world.jpg'});
  });

  it('finds the URL of each kind of source', () => {
    expect(sourceURL('a.jpg')).toBe('a.jpg');
    expect(sourceURL({uri: 'b.jpg'})).toBe('b.jpg');
    expect(sourceURL({url: 'c.mp4'})).toBe('c.mp4');
    expect(sourceURL([{url: 'd.mp4'}, {url: 'd.webm'}])).toBe('d.mp4');
    expect(sourceURL(null)).toBeNull();
  });
});

describe('AppRegistry', () => {
  it('returns a registered component', () => {
    const Hello = () => null;
    AppRegistry.registerComponent('Hello', () => Hello);
    expect(AppRegistry.getComponent('Hello')).toBe(Hello);
  });

  it('says which name is missing', () => {
    expect(() => AppRegistry.getComponent('Nope')).toThrow(/"Nope"/);
  });
});

describe('createEmitter', () => {
  it('delivers events until a listener is removed', () => {
    const emitter = createEmitter();
    const seen = [];
    const subscription = emitter.addListener('controllerConnected', c => seen.push(c));
    emitter.emit('controllerConnected', 'left');
    emitter.emit('somethingElse', 'ignored');
    subscription.remove();
    emitter.emit('controllerConnected', 'right');
    expect(seen).toEqual(['left']);
  });
});

describe('createValue', () => {
  it('tells subscribers only about real changes', () => {
    const value = createValue(1);
    const listener = vi.fn();
    const unsubscribe = value.subscribe(listener);
    value.set(1);
    value.set(2);
    unsubscribe();
    value.set(3);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(value.get()).toBe(3);
  });
});
