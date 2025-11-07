// App.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapWithRoute from './components/MapWithRoute'; // ← ここを変更

export default function App() {
  return (
    <View style={styles.container}>
      <MapWithRoute />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
