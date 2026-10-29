import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-360';
import {Button, Panel} from '../../shared/ui';
import {COLORS} from '../../shared/palette';
import {PANEL_SIZE} from '../constants';
import data from '../data.json';
import {store} from '../store';

const FILTER_COUNT = 6;

function formatNumber(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// "React360/js/Views" → "Views", and "React360/js" → "React360"
function shortName(folder) {
  const parts = folder.split('/');
  const last = parts[parts.length - 1];
  return last === 'js' && parts.length > 1 ? parts[parts.length - 2] : last;
}

// The folders with the most lines, for the filter buttons
function largestFolders(files) {
  const folders = new Map();
  files.forEach(file => {
    folders.set(file.folder, (folders.get(file.folder) || 0) + file.lines);
  });
  return Array.from(folders.keys())
    .sort((a, b) => folders.get(b) - folders.get(a))
    .slice(0, FILTER_COUNT);
}

export default function CityPanel() {
  const {hovered, district} = store.useStore();
  const largest = useMemo(() => largestFolders(data.files), []);
  const byPath = useMemo(() => new Map(data.files.map(file => [file.path, file])), []);

  const shown = district ? data.files.filter(file => file.folder === district) : data.files;
  const lines = shown.reduce((sum, file) => sum + file.lines, 0);
  const pointedAt = hovered ? byPath.get(hovered) : null;

  return (
    <Panel
      style={PANEL_SIZE}
      title="Code city"
      hint="Every building is a source file of React 360. Its height is the file's length.">
      <Text style={styles.totals}>
        {`${district || 'All of React 360'}: ${shown.length} files, ${formatNumber(lines)} lines`}
      </Text>
      <Text style={styles.pointed}>
        {pointedAt
          ? `${pointedAt.path}, ${formatNumber(pointedAt.lines)} lines`
          : 'Point at a building to see its file.'}
      </Text>
      <View style={styles.filters}>
        <Button label="All" active={!district} onClick={() => store.setState({district: null})} />
        {largest.map(folder => (
          <Button
            key={folder}
            label={shortName(folder)}
            active={district === folder}
            onClick={() => store.setState({district: folder})}
          />
        ))}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  totals: {
    fontSize: 28,
    color: COLORS.text,
  },
  pointed: {
    fontSize: 24,
    color: COLORS.warm,
    marginTop: 8,
    marginBottom: 10,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
});
