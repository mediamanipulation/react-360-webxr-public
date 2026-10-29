import React from 'react';
import {AmbientLight, PointLight, View, VrButton} from 'react-360';
import {requireNativeComponent} from 'react-native';
import {compressDistance, compressSize} from '../orbit';
import {PLANETS, SUN} from '../planets';
import {store} from '../store';

// The three.js view registered in client.js
const Planet = requireNativeComponent('Planet');

function Body({body, orbitRadius, periodDays, glow, hovered, selected, speed}) {
  const {name} = body;
  return (
    <VrButton
      onEnter={() => store.setState({hovered: name})}
      onExit={() => {
        if (store.getState().hovered === name) {
          store.setState({hovered: null});
        }
      }}
      onClick={() => store.setState({selected: name})}>
      <Planet
        name={name}
        color={body.color}
        size={compressSize(body.diameterKm)}
        orbitRadius={orbitRadius}
        periodDays={periodDays}
        dayLengthHours={body.dayLengthHours}
        phase={body.phase || 0}
        rings={!!body.rings}
        glow={glow}
        speed={speed}
        highlighted={hovered === name || selected === name}
      />
    </VrButton>
  );
}

export default function SolarSystem() {
  const {hovered, selected, speed} = store.useStore();
  return (
    <View>
      <AmbientLight intensity={0.2} />
      <PointLight intensity={1.6} distance={0} decay={0} style={{color: '#fff3dd'}} />
      <Body
        body={SUN}
        orbitRadius={0}
        periodDays={1}
        glow
        hovered={hovered}
        selected={selected}
        speed={speed}
      />
      {PLANETS.map(planet => (
        <Body
          key={planet.name}
          body={planet}
          orbitRadius={compressDistance(planet.au)}
          periodDays={planet.orbitalPeriodDays}
          glow={false}
          hovered={hovered}
          selected={selected}
          speed={speed}
        />
      ))}
    </View>
  );
}
