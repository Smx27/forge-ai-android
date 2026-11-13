import {DeviceEventEmitter, Keyboard, Platform} from 'react-native';

type Listener = (top: number | null) => void;

let current: number | null = null;
const listeners = new Set<Listener>();
let wired = false;

function publish(top: number | null) {
  if (top === current) return;
  current = top;
  listeners.forEach(listener => listener(top));
}

function wire() {
  if (wired) return;
  wired = true;
  if (Platform.OS === 'android') {
    DeviceEventEmitter.addListener('ForgeKeyboard', (event: {visible: boolean; top: number}) => publish(event.visible ? event.top : null));
  } else {
    Keyboard.addListener('keyboardWillShow', event => publish(event.endCoordinates.screenY));
    Keyboard.addListener('keyboardWillHide', () => publish(null));
  }
}

export function onKeyboard(listener: Listener): () => void {
  wire();
  listeners.add(listener);
  if (current !== null) listener(current);
  return () => { listeners.delete(listener); };
}
