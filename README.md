🛰️ Lane Preview Navigation

AIがルート上の道路状況を診断して、走行の快適度や注意点を可視化する地図アプリです。
React Native（Expo）でフロントエンドを構築し、FastAPI + PyTorch を用いた深層学習モデルでルートの安全スコアを予測します。

🚀 機能概要

📍 現在地取得	Expo Location APIを使用してGPSから現在位置を取得
🗺️ 経路表示	OpenRouteService APIを利用し、目的地までのルートを表示
🚦 交差点解析	Overpass APIを使い、ルート上の交差点・道路タイプ・車線数などを自動解析
🧠 AI診断（深層学習）	FastAPI経由でPyTorchモデルに交差点情報を送信し、「快適／注意／危険」レベルを自動判定
🎨 可視化	ルートを色分け（緑＝快適、橙＝注意、赤＝危険）して地図上に表示
🔍 店舗検索	OpenStreetMapのNominatim APIで目的地を検索


🧰 技術構成
フロントエンド
フレームワーク	React Native (Expo)
地図表示	react-native-maps
位置情報	expo-location
API通信	fetch / REST API
UIアイコン	Ionicons
スタイル	StyleSheet (React Native)

バックエンド
フレームワーク	FastAPI
言語	Python
AIモデル	PyTorch
モデル学習	train_model.py
APIエンドポイント	/ai/route-diagnosis（ルールベース） / /ai/route-diagnosis-dl（深層学習モデル）
デプロイ	Docker / Render（予定）

📂 ディレクトリ構成
lane-preview-nav/
├── backend/
│   ├── main.py               # FastAPIメインサーバー
│   ├── train_model.py        # PyTorchモデル学習スクリプト
│   ├── models/
│   │   └── route_nn_model.pth  # 学習済みモデル
│   └── data/
│       └── training_data.csv   # 訓練データ
│
├── app/
│   ├── MapWithRoute.js       # 地図＆ルート診断メイン画面
│   ├── config.js             # BACKEND_URLなど設定
│   └── ...                   # Expo関連ファイル
│
├── docker-compose.yml         # Backendコンテナ構成
├── Dockerfile                 # FastAPI用Docker定義
└── README.md                  # プロジェクト概要（本ファイル）

🧠 AIモデル概要

入力特徴量
lanes（車線数）, curvature（カーブの曲率）,
intersection_density（交差点密度）, elevation_diff（高低差）

出力
score（0〜1で快適度を表す）

0.7以上 → 快適

0.4〜0.7 → 注意

0.4未満 → 危険

モデル構造

nn.Sequential(
    nn.Linear(4, 16),
    nn.ReLU(),
    nn.Linear(16, 8),
    nn.ReLU(),
    nn.Linear(8, 1),
    nn.Sigmoid()
)

🧭 使用API
API	用途
OpenRouteService	経路情報の取得
Overpass API	道路情報（車線数・道路種別など）取得
Nominatim API	施設名検索
FastAPI (自作)	AI診断APIエンドポイント
🐳 開発・実行方法
1️⃣ バックエンド起動（Docker内）
docker-compose up --build

2️⃣ モデル学習（初回のみ）
docker exec -it ai_backend bash
python train_model.py

3️⃣ フロントエンド起動（Expo）
npx expo start

4️⃣ 動作確認

アプリを起動 → 現在地が取得されたら目的地を検索 →
ルート表示＆AI診断が実行されます。

🧩 今後の展望

強化学習による最適ルート推薦

交通量・天候データとの連動

走行履歴を用いた個人最適化

クラウド学習（継続的モデルアップデート）
