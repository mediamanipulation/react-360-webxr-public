import React, {useEffect, useState} from 'react';
import {NativeModules, StyleSheet, Text, View, VrButton} from 'react-360';
import {DeviceEventEmitter} from 'react-native';
import {Button, Panel} from '../../shared/ui';
import {COLORS} from '../../shared/palette';
import {PANEL_SIZE, SHAPES} from '../constants';
import {store} from '../store';

const {Sandbox} = NativeModules;
const SWATCHES = [COLORS.accent, COLORS.warm, '#ff5c8a', '#9cff9c', COLORS.text];

function Swatch({color, active}) {
  const [hovered, setHovered] = useState(false);
  return (
    <VrButton
      onClick={() => store.setState({color})}
      onEnter={() => setHovered(true)}
      onExit={() => setHovered(false)}
      style={[
        styles.swatch,
        {backgroundColor: color},
        (active || hovered) && styles.swatchActive,
      ]}
    />
  );
}

export default function SandboxPanel() {
  const {kind, color} = store.useStore();
  const [count, setCount] = useState(0);

  // The Sandbox module emits the count from the main thread
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('sandboxCountChanged', setCount);
    return () => subscription.remove();
  }, []);

  return (
    <Panel
      style={PANEL_SIZE}
      title="Sandbox"
      hint="Pull the trigger, or click empty space, to launch a shape.">
      <Text style={styles.count}>
        {count === 1 ? '1 shape flying' : `${count} shapes flying`}
      </Text>
      <View style={styles.row}>
        {SHAPES.map(shape => (
          <Button
            key={shape.kind}
            label={shape.label}
            active={kind === shape.kind}
            onClick={() => store.setState({kind: shape.kind})}
          />
        ))}
      </View>
      <View style={styles.row}>
        {SWATCHES.map(swatch => (
          <Swatch key={swatch} color={swatch} active={swatch === color} />
        ))}
      </View>
      <View style={styles.row}>
        <Button label="Clear" onClick={() => Sandbox.clear()} />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  count: {
    fontSize: 30,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 4,
  },
  swatch: {
    width: 56,
    height: 56,
    margin: 8,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  swatchActive: {
    borderColor: COLORS.text,
  },
});
