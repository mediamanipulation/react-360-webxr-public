import React, {useEffect, useState} from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View,
  Image,
  asset,
  Environment,
} from 'react-360';
import BasicAppTemplateInfoButton from 'BasicAppTemplateInfoButton.react';
import BasicAppTemplateScenePage from 'BasicAppTemplateScenePage.react';

// referencing an asset from 'static_assets' directory
const INFO_BUTTON_IMAGE = asset('info_icon.png');
const SCENE_COUNT = 3;

// Counts the seconds since `key` last changed
function useSecondsSince(key) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setSeconds(0);
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [key]);
  return seconds;
}

// The root react component of the app, written with React hooks
export default function WebXRDemo() {
  const [index, setIndex] = useState(0);
  const seconds = useSecondsSince(index);

  const sceneButtons = [];
  for (let i = 0; i < SCENE_COUNT; i++) {
    sceneButtons.push(
      <BasicAppTemplateInfoButton
        key={i}
        style={styles.button}
        source={INFO_BUTTON_IMAGE}
        text={`Scene ${i}`}
        onClick={() => setIndex(i)}
      />)
  }
  return (
    <View style={styles.panel}>
      <View style={styles.section}>
        {sceneButtons}
      </View>
      <View style={styles.scenePage}>
        <BasicAppTemplateScenePage
          index={index} />
      </View>
      <Text style={styles.status}>
        {`Viewing scene ${index} for ${seconds}s`}
      </Text>
    </View>
  );
};

// defining StyleSheet
const styles = StyleSheet.create({
  panel: {
    width: 1000,
    height: 600,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  section: {
    padding: 5,
    width: 750,
    backgroundColor: '#000000',
    borderColor: '#639dda',
    borderWidth: 2,
    flexDirection: 'row',
  },
  button: {
    marginLeft: 5,
    marginRight: 5,
  },
  scenePage: {
    padding: 5,
    width: 600,
    height: 300,
    backgroundColor: 'grey',
    borderRadius: 5,
  },
  status: {
    marginTop: 20,
    fontSize: 30,
    color: '#ffffff',
  },
});

// register the root component
// this will be used from client.js by r360.createRoot('WebXRDemo' ...)
AppRegistry.registerComponent('WebXRDemo', () => WebXRDemo);
