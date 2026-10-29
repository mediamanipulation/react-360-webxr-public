import React, {useState} from 'react';
import {StyleSheet, Text, View, VrButton} from 'react-360';
import {COLORS} from './palette';

export function Panel({title, hint, children, style}) {
  return (
    <View style={[styles.panel, style]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>{children}</View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Button({label, onClick, active, style}) {
  const [hovered, setHovered] = useState(false);
  return (
    <VrButton
      onClick={onClick}
      onEnter={() => setHovered(true)}
      onExit={() => setHovered(false)}
      style={[
        styles.button,
        hovered && styles.buttonHovered,
        active && styles.buttonActive,
        style,
      ]}>
      <Text style={[styles.buttonLabel, active && styles.buttonLabelActive]}>
        {label}
      </Text>
    </VrButton>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    padding: 30,
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderWidth: 2,
    borderRadius: 16,
  },
  title: {
    fontSize: 44,
    fontWeight: 'bold',
    color: COLORS.accent,
    marginBottom: 16,
  },
  body: {
    flex: 1,
  },
  hint: {
    fontSize: 22,
    color: COLORS.dim,
    marginTop: 12,
  },
  button: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    margin: 6,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  buttonHovered: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(108, 240, 255, 0.18)',
  },
  buttonActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent,
  },
  buttonLabel: {
    fontSize: 28,
    color: COLORS.text,
    textAlign: 'center',
  },
  buttonLabelActive: {
    color: '#05070f',
  },
});
