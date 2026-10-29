import React, {memo, useMemo} from 'react';
import {AmbientLight, Box, Plane, PointLight, View} from 'react-360';
import data from '../data.json';
import {districtColor, FLOOR_Y, layoutCity, LOT} from '../layout';
import {store} from '../store';

function setHovered(path) {
  store.setState({hovered: path});
}

function clearHovered(path) {
  if (store.getState().hovered === path) {
    store.setState({hovered: null});
  }
}

// memo: pointing at a building re-renders only the two buildings whose
// `hovered` prop changes, not all of them
const Building = memo(function Building({building, hovered}) {
  const {path, x, z, angle, height, district} = building;
  return (
    <Box
      lit
      dimWidth={LOT}
      dimDepth={LOT}
      dimHeight={height}
      onEnter={() => setHovered(path)}
      onExit={() => clearHovered(path)}
      style={{
        color: hovered ? '#ffffff' : districtColor(district),
        transform: [
          {translate: [x, FLOOR_Y + height / 2, z]},
          {rotateY: `${(-angle * 180) / Math.PI}deg`},
        ],
      }}
    />
  );
});

export default function CodeCity() {
  const {hovered, district} = store.useStore();
  // The layout only depends on the data, so it is worked out once
  const {buildings} = useMemo(() => layoutCity(data.files), []);
  const visible = useMemo(
    () => (district ? buildings.filter(b => b.folder === district) : buildings),
    [buildings, district],
  );
  return (
    <View>
      <AmbientLight intensity={0.55} />
      <PointLight
        intensity={0.7}
        distance={0}
        decay={0}
        style={{transform: [{translate: [0, 8, 0]}]}}
      />
      <Plane
        dimWidth={40}
        dimHeight={40}
        style={{
          color: '#0d1430',
          transform: [{translate: [0, FLOOR_Y - 0.01, 0]}, {rotateX: '-90deg'}],
        }}
      />
      {visible.map(building => (
        <Building key={building.path} building={building} hovered={hovered === building.path} />
      ))}
    </View>
  );
}
