import React from 'react';
import {AmbientLight, PointLight, View} from 'react-360';
import {requireNativeComponent} from 'react-native';
import {store} from '../store';

// The three.js view registered in client.js
const SandboxField = requireNativeComponent('SandboxField');

export default function SandboxScene() {
  const {kind, color} = store.useStore();
  return (
    <View>
      <AmbientLight intensity={0.5} />
      <PointLight
        intensity={0.9}
        distance={0}
        decay={0}
        style={{transform: [{translate: [0, 2, 0]}]}}
      />
      <SandboxField kind={kind} color={color} />
    </View>
  );
}
