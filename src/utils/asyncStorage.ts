// Web-compatible AsyncStorage polyfill using localStorage
// This replaces @react-native-async-storage/async-storage for web
// Can be used by Supabase and other parts of the app

function getItem(key: string): Promise<string | null> {
  try {
    return Promise.resolve(localStorage.getItem(key));
  } catch (error) {
    console.error('AsyncStorage.getItem error:', error);
    return Promise.resolve(null);
  }
}

function setItem(key: string, value: string): Promise<void> {
  try {
    localStorage.setItem(key, value);
    return Promise.resolve();
  } catch (error) {
    console.error('AsyncStorage.setItem error:', error);
    return Promise.reject(error);
  }
}

function removeItem(key: string): Promise<void> {
  try {
    localStorage.removeItem(key);
    return Promise.resolve();
  } catch (error) {
    console.error('AsyncStorage.removeItem error:', error);
    return Promise.reject(error);
  }
}

function clear(): Promise<void> {
  try {
    localStorage.clear();
    return Promise.resolve();
  } catch (error) {
    console.error('AsyncStorage.clear error:', error);
    return Promise.reject(error);
  }
}

function getAllKeys(): Promise<string[]> {
  try {
    return Promise.resolve(Object.keys(localStorage));
  } catch (error) {
    console.error('AsyncStorage.getAllKeys error:', error);
    return Promise.resolve([]);
  }
}

function multiGet(keys: string[]): Promise<[string, string | null][]> {
  try {
    const result: [string, string | null][] = keys.map(function(key) {
      return [key, localStorage.getItem(key)] as [string, string | null];
    });
    return Promise.resolve(result);
  } catch (error) {
    console.error('AsyncStorage.multiGet error:', error);
    return Promise.resolve([]);
  }
}

function multiSet(keyValuePairs: [string, string][]): Promise<void> {
  try {
    keyValuePairs.forEach(function(pair) {
      const key = pair[0];
      const value = pair[1];
      localStorage.setItem(key, value);
    });
    return Promise.resolve();
  } catch (error) {
    console.error('AsyncStorage.multiSet error:', error);
    return Promise.reject(error);
  }
}

function multiRemove(keys: string[]): Promise<void> {
  try {
    keys.forEach(function(key) {
      localStorage.removeItem(key);
    });
    return Promise.resolve();
  } catch (error) {
    console.error('AsyncStorage.multiRemove error:', error);
    return Promise.reject(error);
  }
}

const AsyncStorage = {
  getItem: getItem,
  setItem: setItem,
  removeItem: removeItem,
  clear: clear,
  getAllKeys: getAllKeys,
  multiGet: multiGet,
  multiSet: multiSet,
  multiRemove: multiRemove,
};

export default AsyncStorage;

