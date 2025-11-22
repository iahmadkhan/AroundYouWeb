// Stub module for react-native to prevent Vite from trying to resolve it
// This is used when shared code or dependencies try to import react-native
// The web app uses pure React.js and doesn't need React Native

export const View = () => null;
export const Text = () => null;
export const TouchableOpacity = () => null;
export const ScrollView = () => null;
export const TextInput = () => null;
export const Image = () => null;
export const ActivityIndicator = () => null;
export const SafeAreaView = () => null;
export const StatusBar = () => null;
export const Alert = { alert: () => {} };
export const Dimensions = { get: () => ({ width: 0, height: 0 }) };
export const Animated = {};
export const Platform = { OS: 'web' };
export const StyleSheet = { create: (styles: any) => styles };
export const Linking = {};
export const AppRegistry = { registerComponent: () => {} };

// Export everything as a default object for compatibility
const ReactNative = {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
  Dimensions,
  Animated,
  Platform,
  StyleSheet,
  Linking,
  AppRegistry,
};

export default ReactNative;

