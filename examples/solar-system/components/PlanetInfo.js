import React from 'react';
import {StyleSheet, Text, View} from 'react-360';
import {Button, Panel} from '../../shared/ui';
import {COLORS} from '../../shared/palette';
import {PANEL_SIZE} from '../constants';
import {PLANETS, SUN} from '../planets';
import {store} from '../store';

const SPEEDS = [
  {label: 'Pause', value: 0},
  {label: '1×', value: 1},
  {label: '10×', value: 10},
  {label: '100×', value: 100},
];

function formatNumber(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatYear(days) {
  return days < 1000 ? `${formatNumber(days)} Earth days` : `${(days / 365.25).toFixed(1)} Earth years`;
}

function formatDay(hours) {
  const length = Math.abs(hours);
  const text = length < 48 ? `${length.toFixed(1)} hours` : `${(length / 24).toFixed(1)} Earth days`;
  return hours < 0 ? `${text}, spinning backwards` : text;
}

// Each fact is a single line of text: React 360 draws text next to other text
// out of line with it
function Facts({rows}) {
  return (
    <View>
      {rows.map(([label, value]) => (
        <Text key={label} style={styles.fact}>
          {`${label}: ${value}`}
        </Text>
      ))}
    </View>
  );
}

export default function PlanetInfo() {
  const {hovered, selected, speed} = store.useStore();
  const body = selected === 'Sun' ? SUN : PLANETS.find(p => p.name === selected);
  return (
    <Panel
      style={PANEL_SIZE}
      title={body.name}
      hint={hovered ? `Pointing at ${hovered}. Click to select it.` : 'Point at a planet and click to learn about it.'}>
      <Facts
        rows={[
          ['Diameter', `${formatNumber(body.diameterKm)} km`],
          body.orbitalPeriodDays ? ['Year', formatYear(body.orbitalPeriodDays)] : null,
          [body === SUN ? 'Rotation' : 'Day', formatDay(body.dayLengthHours)],
          body.moons != null ? ['Moons', String(body.moons)] : null,
        ].filter(Boolean)}
      />
      <Text style={styles.highlight}>{body.fact}</Text>
      <View style={styles.speeds}>
        {SPEEDS.map(({label, value}) => (
          <Button
            key={label}
            label={label}
            active={speed === value}
            onClick={() => store.setState({speed: value})}
          />
        ))}
      </View>
      <Text style={styles.caption}>
        Sizes and distances are compressed to fit the room. Moon counts as of early 2025.
      </Text>
    </Panel>
  );
}

const styles = StyleSheet.create({
  fact: {
    fontSize: 28,
    lineHeight: 40,
    color: COLORS.text,
  },
  highlight: {
    fontSize: 26,
    color: COLORS.warm,
    marginTop: 14,
    marginBottom: 10,
  },
  speeds: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  caption: {
    fontSize: 18,
    color: COLORS.dim,
    textAlign: 'center',
    marginTop: 6,
  },
});
