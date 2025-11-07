import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

export default function MapSearchDestination() {
  const [location, setLocation] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [destination, setDestination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // 現在地取得
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('位置情報の許可が必要です');
        return;
      }

      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
      setLoading(false);
    })();
  }, []);

  // 目的地を検索してピンを表示（Nominatimを使用）
  const handleSearch = async () => {
    if (!searchText) return;

    setSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchText)}&format=json&limit=1`);
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setDestination({
          latitude: parseFloat(lat),
          longitude: parseFloat(lon),
        });
      } else {
        Alert.alert('見つかりませんでした', '検索ワードを確認してください');
      }
    } catch (error) {
      Alert.alert('エラー', '検索に失敗しました');
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* 検索UI */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.input}
          placeholder="目的地を検索（例: 渋谷駅）"
          value={searchText}
          onChangeText={setSearchText}
        />
        <Button title="検索" onPress={handleSearch} disabled={searching} />
      </View>

      {/* 地図表示 */}
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
      >
        {destination && (
          <Marker
            coordinate={destination}
            title="目的地"
            pinColor="blue"
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: 'white',
    alignItems: 'center',
    zIndex: 10,
  },
  input: {
    flex: 1,
    borderColor: '#ccc',
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    height: 40,
  },
});
