import {MMKV} from 'react-native-mmkv';
import type {StateStorage} from 'zustand/middleware';
import {forgeNative, nativeAvailable} from '../native';

const ID = 'forge.v4';

function open(): MMKV {
  const key = forgeNative.storageKey;
  if (!nativeAvailable || !key) return new MMKV({id: ID});
  const meta = new MMKV({id: 'forge.meta'});
  if (meta.getBoolean('encrypted')) {
    const store = new MMKV({id: ID, encryptionKey: key});
    if (forgeNative.storageKeyFresh) store.clearAll();
    return store;
  }
  const store = new MMKV({id: ID});
  store.recrypt(key);
  meta.set('encrypted', true);
  return store;
}

export const kv = open();

export const zustandStorage: StateStorage = {
  getItem: key => kv.getString(key) ?? null,
  setItem: (key, value) => kv.set(key, value),
  removeItem: key => kv.delete(key),
};
