import { BACKEND_URL } from "../config"; // 🔗 FastAPIなどのバックエンドURL設定
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Button,
  Alert,
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  Animated,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps"; // 🗺️ 地図表示
import * as Location from "expo-location"; // 📍 位置情報取得
import { Ionicons } from "@expo/vector-icons"; // 🎨 アイコン表示

// 🚗 経路検索用APIキー（OpenRouteService）
const OPENROUTESERVICE_API_KEY =
  "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjhhNWQwZTllZmZkZDRmZTM4NDc2OTFlMjY5ZGFkNDdlIiwiaCI6Im11cm11cjY0In0=";

// 💾 一度取得したレーン情報をキャッシュ（同じ場所の重複APIを防ぐ）
const laneCache = new Map();

export default function MapWithRoute() {
  const mapRef = useRef(null); // MapView参照
  const [origin, setOrigin] = useState(null); // 出発地
  const [destination, setDestination] = useState(null); // 目的地
  const [routeCoords, setRouteCoords] = useState([]); // 経路座標配列
  const [intersectionData, setIntersectionData] = useState([]); // 各交差点のレーン情報
  const [searchQuery, setSearchQuery] = useState(""); // 検索ワード
  const [loading, setLoading] = useState(false); // ローディング状態
  const [places, setPlaces] = useState([]); // 検索結果（店舗など）
  const [region, setRegion] = useState({
    latitude: 35.681236,
    longitude: 139.767125,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [searchVisible, setSearchVisible] = useState(false); // 検索UIの開閉
  const [aiResult, setAiResult] = useState(null); // AI診断結果
  const slideAnim = useRef(new Animated.Value(-300)).current; // 検索UIスライドアニメーション

  // 📍 起動時に現在地を取得
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync(); // 権限確認
      if (status !== "granted") {
        Alert.alert("位置情報の許可が必要です");
        return;
      }

      // 現在地取得
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const current = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setOrigin(current);

      // 地図を現在地中心に移動
      const newRegion = { ...current, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      setRegion(newRegion);
      if (mapRef.current) mapRef.current.animateToRegion(newRegion, 1000);
    })();
  }, []);

  // 🔍 検索パネルの開閉アニメーション
  const toggleSearch = (closeAll = false) => {
    const toValue = searchVisible ? -300 : 0;
    Animated.timing(slideAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (closeAll) {
        setPlaces([]);
        setSearchQuery("");
      }
      setSearchVisible(!searchVisible);
    });
  };

  // 🏪 店舗検索処理（Nominatim APIを使用）
  const handleSearchPlace = async () => {
    if (!searchQuery || !region) return;
    setLoading(true);
    try {
      // 現在地周辺の検索範囲を指定
      const minLon = region.longitude - region.longitudeDelta / 2;
      const maxLon = region.longitude + region.longitudeDelta / 2;
      const minLat = region.latitude - region.latitudeDelta / 2;
      const maxLat = region.latitude + region.latitudeDelta / 2;

      // Nominatim検索URL構築
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        searchQuery
      )}&format=json&bounded=1&limit=20&addressdetails=1&viewbox=${minLon},${maxLat},${maxLon},${minLat}`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": "RouteLens/1.0",
          Accept: "application/json",
        },
      });
      const results = await response.json();

      // 検索結果がなければ警告
      if (!Array.isArray(results) || results.length === 0) {
        Alert.alert("店舗が見つかりませんでした");
        setPlaces([]);
        return;
      }

      // 検索結果整形
      const formatted = results.map((p, i) => ({
        id: i.toString(),
        name: p.display_name,
        lat: parseFloat(p.lat),
        lon: parseFloat(p.lon),
      }));
      setPlaces(formatted);
    } catch (error) {
      Alert.alert("検索エラー", error.message);
    } finally {
      setLoading(false);
    }
  };

  // 🛣️ Overpass APIで道路（車線）情報を取得（ミラー対応＆エラー回避版）
async function fetchLaneInfo(lat, lon) {
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (laneCache.has(cacheKey)) return laneCache.get(cacheKey);

  const query = `
    [out:json][timeout:25];
    way(around:80,${lat},${lon})[highway~"^(motorway|trunk|primary|secondary|tertiary)$"];
    out tags center;
  `;

  // 🛰️ 複数のOverpassミラーを順に試す
  const overpassServers = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
  ];

  let data = null;

  for (const base of overpassServers) {
    try {
      const res = await fetch(`${base}?data=${encodeURIComponent(query)}`, {
        headers: { "User-Agent": "RouteLens/1.0" },
      });
      const text = await res.text();

      // ⚠️ HTML（エラーページ）ならスキップ
      if (text.trim().startsWith("<")) {
        console.warn(`⚠️ HTML応答: ${base}`);
        continue;
      }

      data = JSON.parse(text);
      if (data.elements) break; // 成功したら終了
    } catch (err) {
      console.warn(`⚠️ Overpassサーバー失敗: ${base}`);
    }
  }

  if (!data || !data.elements) {
    console.error("❌ 全Overpassサーバー失敗");
    return [];
  }

  // ✅ レーン情報抽出処理
  const parsed = data.elements.map((el) => {
    const tags = el.tags || {};
    let lanes = tags.lanes;
    let turnLanes = tags["turn:lanes"];

    if (!lanes) {
      if (["motorway", "trunk"].includes(tags.highway)) lanes = "3";
      else if (["primary", "secondary"].includes(tags.highway)) lanes = "2";
      else lanes = "1";
    }

    if (!turnLanes) {
      if (["motorway", "trunk"].includes(tags.highway)) turnLanes = "直進のみ";
      else turnLanes = "直進・右左折あり";
    }

    return {
      id: el.id,
      lanes,
      turnLanes,
      name: tags.name || "（名称なし）",
      type: tags.highway || "road",
      center: el.center || null,
    };
  });

  laneCache.set(cacheKey, parsed);
  return parsed.sort((a, b) => (parseInt(b.lanes) || 0) - (parseInt(a.lanes) || 0));
}


  // 🚦 経路上の交差点を並列で解析（最大30点サンプリング）
  async function analyzeRouteForLanes(coords) {
    const MAX_POINTS = 30;
    const step = Math.max(1, Math.floor(coords.length / MAX_POINTS));
    const samples = [];
    for (let i = 0; i < coords.length; i += step) samples.push(coords[i]);
    if (coords.length > 0) samples.push(coords[coords.length - 1]);

    const CONCURRENCY = 5; // 同時処理数制限
    const results = [];

    for (let i = 0; i < samples.length; i += CONCURRENCY) {
      const chunk = samples.slice(i, i + CONCURRENCY);
      const batch = await Promise.all(
        chunk.map(async (s) => {
          const info = await fetchLaneInfo(s.latitude, s.longitude);
          if (info.length > 0) {
            const best = info[0];
            return {
              point: { latitude: s.latitude, longitude: s.longitude },
              lanes: best.lanes,
              turn: best.turnLanes,
              roadName: best.name,
              roadType: best.type,
            };
          } else {
            return {
              point: { latitude: s.latitude, longitude: s.longitude },
              lanes: "1",
              turn: "直進のみ",
              roadName: "（不明道路）",
              roadType: "unknown",
            };
          }
        })
      );
      results.push(...batch);
    }

    console.log("✅ 交差点情報:", results.length, "件");
    return results;
  }

  // 🤖 AIバックエンドに経路を送信し、深層学習モデルで診断
  async function diagnoseRouteAI(intersections) {
    try {
      const res = await fetch(`${BACKEND_URL}/ai/route-diagnosis-dl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinates: intersections.map((i) => ({
            lanes: i.lanes,
            curvature: 0.3,
            intersection_density: 2,
            elevation_diff: 1.5,
          })),
        }),
      });

      const data = await res.json();
      console.log("🤖 深層学習診断:", data);
      return data;
    } catch (err) {
      console.error("AI診断エラー:", err);
      return [];
    }
  }

  // 🚗 経路取得（OpenRouteService）＋AI診断統合処理
  const fetchRoute = async (lat, lon) => {
    if (!origin) return;
    const url = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";
    const body = {
      coordinates: [
        [origin.longitude, origin.latitude],
        [lon, lat],
      ],
    };

    setLoading(true);
    setIntersectionData([]);
    try {
      // 経路を取得
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: OPENROUTESERVICE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json?.features?.[0]?.geometry?.coordinates)
        throw new Error("ルートが取得できませんでした");

      // 経路座標をlat/lonに変換
      const coords = json.features[0].geometry.coordinates.map(([lng, lat]) => ({
        latitude: lat,
        longitude: lng,
      }));

      setDestination({ latitude: lat, longitude: lon });
      setRouteCoords(coords);
      setPlaces([]);
      setSearchVisible(false);

      // 地図をルート全体が見えるように調整
      if (mapRef.current && coords.length > 0) {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }

      // 経路上の道路情報を解析
      const intersections = await analyzeRouteForLanes(coords);
      setIntersectionData(intersections);

      // AIで診断
      const aiResults = await diagnoseRouteAI(intersections);
      if (aiResults && aiResults.avg_score !== undefined) {
        setAiResult(aiResults);
      }
    } catch (err) {
      console.error("❌ ルート取得失敗:", err);
      Alert.alert("ルート取得失敗", err.message);
    } finally {
      setLoading(false);
    }
  };

  // 📍 目的地を選択した際の確認ダイアログ
  const confirmDestination = (lat, lon, name) => {
    Alert.alert("目的地を設定しますか？", `${name.split(",")[0]}`, [
      { text: "キャンセル", style: "cancel" },
      { text: "設定する", onPress: () => fetchRoute(lat, lon) },
    ]);
  };

  // 初期状態（現在地取得中）
  if (!origin) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>位置情報を取得中...</Text>
      </View>
    );
  }

  // 🌍 メインUI構築
  return (
    <View style={styles.container}>
      {/* 🗺️ 地図表示 */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={true}
      >
        {/* 📍 目的地マーカー */}
        {destination && <Marker coordinate={destination} pinColor="blue" />}

        {/* 🔮 AIスコアによるルート色分け */}
        {routeCoords.length > 1 &&
          aiResult?.details?.length === routeCoords.length &&
          routeCoords.map((coord, index) => {
            if (index === routeCoords.length - 1) return null;
            const nextCoord = routeCoords[index + 1];
            const score = aiResult.details[index] ?? aiResult.avg_score ?? 0.5;

            // スコアに応じて色を変化
            let color = "gray";
            if (score > 0.7) color = "green";
            else if (score > 0.4) color = "orange";
            else color = "red";

            return (
              <Polyline
                key={`seg-${index}`}
                coordinates={[coord, nextCoord]}
                strokeWidth={6}
                strokeColor={color}
              />
            );
          })}

        {/* ⚙️ 各交差点にマーカーを表示 */}
        {intersectionData.map((item, idx) => (
          <Marker
            key={`ix-${idx}`}
            coordinate={item.point}
            pinColor="purple"
            title={`交差点 ${idx + 1}`}
            description={`車線: ${item.lanes} | レーン: ${item.turn}`}
          />
        ))}
      </MapView>

      {/* 🧠 AI診断結果ボックス */}
      {aiResult && (
        <View style={styles.aiBox}>
          <Text style={styles.aiText}>
            AI診断結果：スコア {aiResult.avg_score.toFixed(2)}（
            {aiResult.level || "評価中"}）
          </Text>
        </View>
      )}

      {/* 🔍 検索ボタン（閉じている時） */}
      {!searchVisible && (
        <TouchableOpacity style={styles.searchButton} onPress={() => toggleSearch(false)}>
          <Ionicons name="search" size={28} color="white" />
        </TouchableOpacity>
      )}

      {/* 🔎 検索パネル（開いている時） */}
      {searchVisible && (
        <Animated.View style={[styles.searchBox, { transform: [{ translateY: slideAnim }] }]}>
          <TextInput
            style={styles.input}
            placeholder="例: ローソン / スターバックス"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.searchButtons}>
            <Button title="検索" onPress={handleSearchPlace} />
            <Button title="× 閉じる" color="gray" onPress={() => toggleSearch(true)} />
          </View>
        </Animated.View>
      )}

      {/* 📋 検索結果リスト */}
      {places.length > 0 && (
        <View style={styles.listBox}>
          <FlatList
            data={places}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Text
                style={styles.listItem}
                onPress={() => confirmDestination(item.lat, item.lon, item.name)}
              >
                {item.name}
              </Text>
            )}
          />
        </View>
      )}

      {/* ⏳ ローディング中のオーバーレイ */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" />
        </View>
      )}
    </View>
  );
}

// 🎨 スタイル定義
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  aiBox: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 10,
    borderRadius: 10,
  },
  aiText: { color: "white", fontSize: 16 },
  searchButton: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    backgroundColor: "#007bff",
    borderRadius: 50,
    padding: 16,
    elevation: 5,
  },
  searchBox: {
    position: "absolute",
    top: 0,
    backgroundColor: "white",
    width: "100%",
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 10,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    marginBottom: 10,
    padding: 5,
  },
  searchButtons: { flexDirection: "row", justifyContent: "space-between" },
  listBox: {
    position: "absolute",
    bottom: 30,
    backgroundColor: "white",
    width: "90%",
    alignSelf: "center",
    maxHeight: 250,
    borderRadius: 10,
    elevation: 4,
  },
  listItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    fontSize: 14,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
});
