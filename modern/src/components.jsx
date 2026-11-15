// React 360's building blocks, drawn with @react-three/uikit: flexbox panels
// and text rendered straight into the three.js scene.

import React from 'react';
import {Container, Image as UIImage, Text as UIText} from '@react-three/uikit';
import {useInputHandlers} from './input.js';
import {AudioModule} from './media.js';
import {sourceURL} from './state.js';
import {flattenStyle, styleToProps} from './style.js';
import {Group, transformMatrix, useSpace} from './three-d.jsx';

// React Native lays out in columns and does not shrink children, where the
// web (and uikit) default to rows that shrink
const LAYOUT_DEFAULTS = {flexDirection: 'column', flexShrink: 0};

export function View({style, children, onEnter, onExit, onMove, onInput, ...rest}) {
  const events = useInputHandlers({onEnter, onExit, onMove, onInput});
  // In the 3D world a View is a group that places its children
  if (useSpace() === 'location') {
    return (
      <Group style={style} onEnter={onEnter} onExit={onExit} onMove={onMove} onInput={onInput}>
        {children}
      </Group>
    );
  }
  return (
    <Container
      {...LAYOUT_DEFAULTS}
      {...styleToProps(style)}
      {...events}
      {...rest}>
      {children}
    </Container>
  );
}

// Characters the built-in font has no glyph for, and what is drawn instead
const MISSING_GLYPHS = {'×': 'x', '¼': '1/4', '½': '1/2', '¾': '3/4', '…': '...', '→': '->', '←': '<-'};
const MISSING = new RegExp(`[${Object.keys(MISSING_GLYPHS).join('')}]`, 'g');

// uikit text takes strings and numbers. Anything React would skip is skipped.
function textOf(children) {
  return React.Children.toArray(children)
    .filter(child => typeof child === 'string' || typeof child === 'number')
    .join('')
    .replace(MISSING, character => MISSING_GLYPHS[character]);
}

export function Text({style, children, ...rest}) {
  return (
    <UIText color="white" flexShrink={0} {...styleToProps(style)} {...rest}>
      {textOf(children)}
    </UIText>
  );
}

export function Image({style, source, ...rest}) {
  // tintColor recolors an icon in React Native. Not available here yet.
  const {tintColor, ...flat} = flattenStyle(style);
  return <UIImage flexShrink={0} src={sourceURL(source)} {...styleToProps(flat)} {...rest} />;
}

/**
 * A View that can be clicked: with a mouse, a controller's trigger, a pinch,
 * or a tap. `onClick` is the same for all of them.
 */
export function VrButton({
  style,
  children,
  disabled,
  onClick,
  onEnter,
  onExit,
  onButtonPress,
  onButtonRelease,
  onClickSound,
  onEnterSound,
  onExitSound,
  ...rest
}) {
  const play = source => source && AudioModule.playOneShot({source});
  const space = useSpace();
  const handlers = disabled
    ? {}
    : {
        onClick: event => {
          play(onClickSound);
          if (onClick) {
            onClick(event);
          }
        },
        onPointerEnter: event => {
          play(onEnterSound);
          if (onEnter) {
            onEnter(event);
          }
        },
        onPointerLeave: event => {
          play(onExitSound);
          if (onExit) {
            onExit(event);
          }
        },
        onPointerDown: onButtonPress,
        onPointerUp: onButtonRelease,
      };
  // Around 3D objects, the button is whatever its children draw
  if (space === 'location') {
    const flat = flattenStyle(style);
    return (
      <group
        matrix={transformMatrix(flat.transform)}
        matrixAutoUpdate={false}
        {...handlers}>
        {children}
      </group>
    );
  }
  return (
    <Container
      {...LAYOUT_DEFAULTS}
      cursor={disabled ? undefined : 'pointer'}
      {...styleToProps(style)}
      {...handlers}
      {...rest}>
      {children}
    </Container>
  );
}
