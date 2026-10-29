import React from 'react';
import {NativeModules, StyleSheet, Text, View} from 'react-360';
import {Button, Panel} from '../../shared/ui';
import {COLORS} from '../../shared/palette';
import {PANEL_SIZE} from '../constants';
import {MOODS} from '../pattern';
import {store} from '../store';

const {Synth} = NativeModules;
const VOLUME_STEP = 0.1;

function changeVolume(delta) {
  const volume = Math.round(Math.min(1, Math.max(0, store.getState().volume + delta)) * 10) / 10;
  store.setState({volume});
  Synth.setVolume(volume);
}

export default function SoundPanel() {
  const {playing, mood, volume} = store.useStore();
  return (
    <Panel
      style={PANEL_SIZE}
      title="Sound visualizer"
      hint="The music is generated live and plays from the glowing orb. Turn your head and listen.">
      <View style={styles.row}>
        <Button
          label={playing ? 'Pause' : 'Play'}
          active={playing}
          onClick={() => {
            if (playing) {
              Synth.pause();
            } else {
              Synth.play();
            }
            store.setState({playing: !playing});
          }}
        />
      </View>
      <View style={styles.row}>
        {Object.keys(MOODS).map(name => (
          <Button
            key={name}
            label={MOODS[name].label}
            active={mood === name}
            onClick={() => {
              Synth.setMood(name);
              store.setState({mood: name});
            }}
          />
        ))}
      </View>
      <View style={styles.row}>
        <Button label="-" onClick={() => changeVolume(-VOLUME_STEP)} />
        <Text style={styles.volume}>{`Volume ${Math.round(volume * 100)}%`}</Text>
        <Button label="+" onClick={() => changeVolume(VOLUME_STEP)} />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  volume: {
    width: 220,
    fontSize: 28,
    color: COLORS.text,
    textAlign: 'center',
  },
});
