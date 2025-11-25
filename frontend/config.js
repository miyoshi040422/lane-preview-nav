// frontend/config.js
import Constants from "expo-constants";
import { Platform } from "react-native";

const localhost =
  Platform.OS === "android"
    ? "http://10.0.2.2:8000" // Androidエミュレータ
    : "http://127.0.0.1:8000"; // Web or iOS

// Docker内で動作する場合（ai_backendコンテナ）
const dockerURL = "http://ai_backend:8000";

// Wi-Fi経由でスマホ実機からアクセスする場合
// （同一LAN上のPCのローカルIPアドレスに置き換えてください）
const localNetworkURL = "http://10.109.2.107:8000"; //日によって変わる

export const BACKEND_URL =
  Constants.expoConfig?.extra?.backendUrl ||
  (process.env.NODE_ENV === "production"
    ? dockerURL
    : localNetworkURL);
