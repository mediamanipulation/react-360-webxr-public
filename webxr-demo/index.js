import React, {useEffect, useState} from 'react';
import {DeviceEventEmitter} from 'react-native';
import {
  AppRegistry,
  NativeModules,
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

// The controllers connected right now: gamepads on the page, and in VR the
// headset's controllers or tracked hands, which change as they're picked up
// and put down
function useControllers() {
  const [controllers, setControllers] = useState([]);
  useEffect(() => {
    const without = (list, controller) => list.filter(other => other.index !== controller.index);
    const connected = DeviceEventEmitter.addListener('controllerConnected', controller =>
      setControllers(list => without(list, controller).concat(controller)),
    );
    const disconnected = DeviceEventEmitter.addListener('controllerDisconnected', controller =>
      setControllers(list => without(list, controller)),
    );
    // Those that were connected before this component was listening
    NativeModules.ControllerInfo.getControllers().then(already =>
      setControllers(list => already.reduce((all, controller) => without(all, controller).concat(controller), list)),
    );
    return () => {
      connected.remove();
      disconnected.remove();
    };
  }, []);
  return controllers;
}

// The root react component of the app, written with React hooks
export default function WebXRDemo() {
  const [index, setIndex] = useState(0);
  const seconds = useSecondsSince(index);
  const controllers = useControllers();
  const [lastAxis, setLastAxis] = useState(null);
  const controllerList = controllers
    .map(controller => `${controller.hand || 'no hand'}: ${controller.id} (${controller.buttons} buttons)`)
    .join(', ');

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
    <View
      style={styles.panel}
      onInput={e => {
        // Thumbsticks and touchpads, while the pointer is over the panel
        const event = e.nativeEvent.inputEvent;
        if (event.type === 'axis') {
          setLastAxis(`${event.source} ${event.axisClass || event.axis} ${event.value.toFixed(2)}`);
        }
      }}>
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
      <Text style={styles.controllers}>
        {`Controllers: ${controllerList || 'none'}`}
      </Text>
      <Text style={styles.controllers}>
        {`Last stick move: ${lastAxis || 'none yet'}`}
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
  controllers: {
    marginTop: 8,
    fontSize: 22,
    color: '#ffffff',
  },
});

// register the root component
// this will be used from client.js by r360.createRoot('WebXRDemo' ...)
AppRegistry.registerComponent('WebXRDemo', () => WebXRDemo);
