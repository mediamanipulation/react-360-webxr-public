import React from 'react';
import {requireNativeComponent} from 'react-native';
import {store} from '../store';

// The three.js view registered in client.js
const SoundColumns = requireNativeComponent('SoundColumns');

export default function Visualizer() {
  const {mood} = store.useStore();
  return <SoundColumns mood={mood} count={48} radius={4} />;
}
