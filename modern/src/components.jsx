// React 360's building blocks, drawn with @react-three/uikit: flexbox panels
// and text rendered straight into the three.js scene.

import React from 'react';
import {Container, Image as UIImage, Text as UIText} from '@react-three/uikit';
import {AudioModule} from './media.js';
import {sourceURL} from './state.js';
import {flattenStyle, styleToProps} from './style.js';

// React Native lays out in columns and does not shrink children, where the
// web (and uikit) default to rows that shrink
const LAYOUT_DEFAULTS = {flexDirection: 'column', flexShrink: 0};

// React 360's pointer events, as uikit's
function eventProps({onEnter, onExit, onMove, onInput}) {
  const props = {};
  if (onEnter) {
    props.onPointerEnter = onEnter;
  }
  if (onExit) {
    props.onPointerLeave = onExit;
  }
  if (onMove) {
    props.onPointerMove = onMove;
  }
  if (onInput) {
    // Button presses over the view, shaped like React 360's input events
    const send = action => event =>
      onInput({
        nativeEvent: {
          inputEvent: {type: 'button', button: 0, buttonClass: 'confirm', action, source: event.pointerType},
        },
      });
    props.onPointerDown = send('down');
    props.onPointerUp = send('up');
  }
  return props;
}

export function View({style, children, onEnter, onExit, onMove, onInput, ...rest}) {
  return (
    <Container
      {...LAYOUT_DEFAULTS}
      {...styleToProps(style)}
      {...eventProps({onEnter, onExit, onMove, onInput})}
      {...rest}>
      {children}
    </Container>
  );
}

// uikit text takes strings and numbers. Anything React would skip is skipped.
function textOf(children) {
  return React.Children.toArray(children)
    .filter(child => typeof child === 'string' || typeof child === 'number')
    .join('');
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
