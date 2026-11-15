// Turns React Native style objects, as React 360 apps write them, into the
// properties of @react-three/uikit components.

// React Native names that are spelled differently in uikit
const RENAMED = {
  paddingHorizontal: 'paddingX',
  paddingVertical: 'paddingY',
  marginHorizontal: 'marginX',
  marginVertical: 'marginY',
  top: 'positionTop',
  left: 'positionLeft',
  right: 'positionRight',
  bottom: 'positionBottom',
  position: 'positionType',
  textAlignVertical: 'verticalAlign',
  resizeMode: 'objectFit',
};

// Names that mean the same in both
const SAME = new Set([
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'aspectRatio',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'flexDirection', 'flexWrap', 'flexGrow', 'flexShrink', 'flexBasis', 'gap',
  'justifyContent', 'alignItems', 'alignSelf', 'alignContent',
  'backgroundColor', 'opacity', 'overflow', 'zIndex', 'display',
  'borderWidth', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderColor', 'borderRadius',
  'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
  'color', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign',
]);

// Styles with no counterpart yet. Each is reported once, then ignored.
const reported = new Set();
function unsupported(name) {
  if (!reported.has(name)) {
    reported.add(name);
    console.warn(`react-360: the style "${name}" is not supported yet and is ignored`);
  }
}

/**
 * Merge a style, an array of styles, or nested arrays, into one object.
 * Falsy entries are skipped, so `[styles.a, focused && styles.b]` works.
 */
export function flattenStyle(style) {
  if (!style) {
    return {};
  }
  if (!Array.isArray(style)) {
    return style;
  }
  const result = {};
  for (const entry of style) {
    Object.assign(result, flattenStyle(entry));
  }
  return result;
}

const TRANSFORMS = {
  translateX: 'transformTranslateX',
  translateY: 'transformTranslateY',
  translateZ: 'transformTranslateZ',
  scaleX: 'transformScaleX',
  scaleY: 'transformScaleY',
  scaleZ: 'transformScaleZ',
  rotateX: 'transformRotateX',
  rotateY: 'transformRotateY',
  rotateZ: 'transformRotateZ',
};

function applyTransform(props, transform) {
  for (const step of transform) {
    for (const key of Object.keys(step)) {
      const value = step[key];
      if (key === 'scale') {
        props.transformScaleX = props.transformScaleY = props.transformScaleZ = value;
      } else if (key === 'translate' && Array.isArray(value)) {
        [props.transformTranslateX, props.transformTranslateY, props.transformTranslateZ = 0] = value;
      } else if (TRANSFORMS[key]) {
        props[TRANSFORMS[key]] = value;
      } else {
        unsupported(`transform ${key}`);
      }
    }
  }
}

/**
 * The uikit properties for a React Native style.
 */
export function styleToProps(style) {
  const flat = flattenStyle(style);
  const props = {};
  for (const name of Object.keys(flat)) {
    const value = flat[name];
    if (value === undefined || value === null) {
      continue;
    }
    if (name === 'flex') {
      // React Native's `flex: n` grows to fill its share of the space
      props.flexGrow = value;
      props.flexShrink = 1;
      props.flexBasis = 0;
    } else if (name === 'transform') {
      applyTransform(props, value);
    } else if (name === 'resizeMode') {
      props.objectFit = value === 'cover' ? 'cover' : 'fill';
    } else if (RENAMED[name]) {
      props[RENAMED[name]] = value;
    } else if (SAME.has(name)) {
      props[name] = value;
    } else {
      unsupported(name);
    }
  }
  return props;
}

/**
 * React 360's StyleSheet. Styles are plain objects here, so `create` hands
 * them back unchanged.
 */
export const StyleSheet = {
  create: styles => styles,
  flatten: flattenStyle,
  absoluteFill: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
  hairlineWidth: 1,
};
