---
name: sysviz-design
role: デザイン審査エージェント
description: sysvizプロジェクトの3D可視化デザインルールを管理し、実装がルールに準拠しているかチェックする。ノード・接続線・パーティクル・UI・色彩・レイアウトの全設計をカバー。
triggers:
  - 新しいノード・形状・色を追加する時
  - 接続線タイプを追加・変更する時
  - UIの見た目を変更する時
  - 新しいシステムの可視化データを定義する時
  - デザインの整合性を確認したい時
---

# sysviz デザイン審査エージェント

## 役割

sysvizプロジェクトにおける **全デザインルールの管理者**。
実装変更時にこのエージェントを参照し、ルールに準拠しているか確認すること。

## 対象プロジェクト

sysviz — 任意のシステム（Flask, gRPC, LiveKit等）の内部動作を3D可視化するWebアプリ。
技術スタック: Three.js r152 + Tailwind CSS CDN + vanilla ES6 modules（ビルドなし）。
参考プロジェクト: https://github.com/rohitg00/k8sgames（同技術スタック、~50K行、90+ファイル）。

---

# カラーパレット・色彩哲学

## 全体方針: ソフトミュートパステル

sysvizの色彩は一貫して**「ソフト・ミュート・パステル」**で統一している。
ネオン、原色、高彩度の色は使わず、すべての色を彩度控えめでまとめることで、複数ノードが並んでも統一感が出る設計。

**ルール**: 新しい色を追加する場合も、このパステル・ミュートのトーンを守ること。彩度を最大まで上げない、明度は中〜高めを維持する。

## パレット一覧

### 背景・環境色（温度感: ニュートラル〜わずかにウォーム）

| 色 | Hex | 用途 | 特徴 |
|---|---|---|---|
| オフホワイト | `#fafafa` | シーン背景 | 純白(#fff)より温かい、目に優しい |
| ピュアホワイト | `#ffffff` | フォグ、グラウンド | 距離によるフェードに使用 |
| スレートグレー | `#d1d5db` | グリッド線 | 控えめな補助線 |
| エッジグレー | `#cbd5e1` | ノードの輪郭線 | カートゥーン的アウトライン |
| ダークスレート | `#0f172a` | ラベルテキスト | 背景との対比は黒(#000)より柔らかい |

### ノード カテゴリ色（温度感: カラフルだがミュート）

| 色 | Hex | 用途 | 色相 | 特徴 |
|---|---|---|---|---|
| ソフトスカイブルー | `#6C9BD2` | Browser | 青 | 彩度を抑えた空色 |
| ソフトセージグリーン | `#7BC67E` | WSGI Server | 緑 | ペールグリーン寄り |
| ソフトアンバー | `#D4A76A` | Routing | 黄→金 | 温かみのあるゴールド |
| ソフトラベンダー | `#C77DBA` | View Function | 紫 | ミュートされた紫 |
| ソフトコーラル | `#D4826A` | Response | 橙→赤 | ペールオレンジ |

**共通**: どれも `S=40〜60%` 程度の中彩度。原色の `S=100%` ではない。明度も `L=60〜70%` で高め。これにより「ポップになりすぎず、落ち着いた学習ツール」の雰囲気になる。

### ステータス色（温度感: 機能的だが柔らかい）

| 色 | Hex | 用途 | 特徴 |
|---|---|---|---|
| ミュートグレー | `#94a3b8` | idle | slate系のグレー、冷たいグレーではない |
| フレッシュグリーン | `#22c55e` | active | ここだけやや鮮やか（目立たせる意図） |
| クラシックブルー | `#3b82f6` | complete | Tailwind blue-500、安定感 |
| ソフトレッド | `#ef4444` | error | 警告色だが原色レッドではない |

### ライティング色（温度感: ウォーム〜ニュートラル混在）

| 色 | Hex | 用途 | 特徴 |
|---|---|---|---|
| ピュアホワイト | `#ffffff` | Ambient 0.9 / Key 1.2 | ベースはニュートラル白 |
| クリーム | `#ffedd5` | Fill 0.45 | **暖色パステル** — 陰に温かみを加える |
| アイスブルーホワイト | `#f8fafc` | Rim 0.25 | **冷色パステル** — 輪郭を際立たせる |

**Key-Fill-Rim の温度対比**: メイン光がニュートラル、Fillで暖色、Rimで冷色を入れることで、単調にならない立体的な色味を実現。これが「いい感じ」の正体の一つ。

### 接続線・パーティクル色

| 色 | Hex | 用途 | 特徴 |
|---|---|---|---|
| ペールブルー | `#93c5fd` | network接続 | Tailwind blue-300、淡い |
| ソフトインディゴ | `#a5b4fc` | sync接続 | 内部処理、紫寄り |
| ソフトシアン | `#67e8f9` | async接続 | 非同期通信 |
| ソフトアンバー | `#fcd34d` | signal接続 | イベント/シグナル |
| ミュートグレー | `0xc9d1d9` | ownership接続 | ほとんど目立たない |
| ダークグレー | `0x8b949e` | storage接続 | 控えめ |
| ゴールド | `0xd29922` | config接続 | ここだけやや鮮やか（注意喚起） |
| ライトグレー | `0xd1d5db` | default接続 | 背景〜グリッドと同系色 |
| ペールブルー | `0x60a5fa` | defaultパーティクル | Tailwind blue-400 |
| フレッシュグリーン | `0x3fb950` | healthyパーティクル | 完了の爽快感 |
| ソフトレッド | `0xf85149` | errorパーティクル | 警告 |
| ゴールド | `0xd29922` | slowパーティクル | 注意 |

### UI色（Glassmorphism）

| 色 | 用途 | 特徴 |
|---|---|---|
| 半透明白 + blur(18px) | UI背景 | 背景が透けて統一感 |
| 白→スレートグラデ `#fff→#f1f5f9` | Play/Pauseボタン | 控えめなグラデ |
| クリーム→ペールオレンジ `#fff7ed→#ffedd5` | Stopボタン | Fill光と同系色で統一 |
| ブルーフォーカス `rgba(59,130,246,0.35)` | フォーカスリング | ステータスcompleteと同系色 |

## 色の組み合わせルール

1. **同一ノード内**: カテゴリ色(ボディ) + ステータス色(グロー/emissive) の2層で表現
2. **隣接ノード**: 色相が被らないよう自動的に分散（青→緑→金→紫→橙）
3. **UI要素**: シーン内の色と被らないよう、UIはニュートラル（白/グレー）ベース
4. **アクセントのみ鮮やか**: activeステータス(緑)とconfig(金)だけやや高彩度で、その他はすべてミュート
5. **暖色はFill光由来**: クリーム色(#ffedd5)がFill光として全体に掛かることで、冷たくなりすぎない

---

# 実装済みのデザイン詳細

## シーン・環境

| 項目 | 値 | 意図 |
|---|---|---|
| 背景色 | `0xfafafa`（オフホワイト） | クリーン×ミニマル、白背景 |
| フォグ | `FogExp2(0xffffff, 0.012)` | 奥のノードが自然にフェード、3Dの奥行き感 |
| グリッド | 40×40 / 20分割、`0xd1d5db` opacity 0.25 | 空間の参照点、控えめな補助線 |
| グラウンド | 白Plane、metalness 0.05 roughness 0.95 | 影の受け面、控えめな反射 |
| トーンマッピング | ACES Filmic、exposure 1.2 | 自然な光の表現 |

## 照明（3灯構成）

| ライト | 色 | 強度 | 位置 | 役割 |
|---|---|---|---|---|
| Ambient | `0xffffff` | 0.9 | - | 全体のベース明るさ |
| Key（Directional） | `0xffffff` | 1.2 | (20,40,20) | メインライト、影あり 2048x2048 |
| Fill（Directional） | `0xffedd5`（暖色） | 0.45 | (-16,12,18) | 陰の部分を温かみのある色で補完 |
| Rim（Directional） | `0xf8fafc`（冷色） | 0.25 | (-14,10,-12) | 輪郭を際立たせる |

**意図**: 3灯ライティング（Key+Fill+Rim）で映画的な質感。Fillが暖色なのがポイント。

## カメラ

| 項目 | 値 |
|---|---|
| 初期位置 | `(18, 14, 18)` — 右上斜め前方から全体を見下ろす |
| FOV | 45° |
| 操作 | OrbitControls（回転/ズーム/パン） |
| 回転速度 | 0.8、ズーム 1.2、パン 0.8 |
| 距離制限 | 5〜80 |
| 極角制限 | 0.1〜π/2.1（ほぼ真下不可、ほぼ真上不可） |
| 減衰 | dampingFactor 0.08（滑らかな操作感） |
| マウス操作 | 左=回転、中=ズーム、右=パン |
| 自動追従 | アクティブノードにeaseInOutCubicでカメラtarget移動（800ms） |
| リセット | 再生終了時に初期位置へ復帰 |

## ノード（ResourceMeshes）

### 形状バリエーション

各ノードは `shape` プロパティで形状を切り替える。`ResourceMeshes.js` の `CREATORS` マップで定義。

| shape | ジオメトリ | 対象ノードタイプ | 特徴 |
|---|---|---|---|
| `default` | RoundedBoxGeometry 2.8×1.3×0.6 角丸0.18 | 処理ノード（View Function等） | 角丸で柔らかい、スリムなカード的 |
| `sphere` | IcosahedronGeometry(1.0, 2) | エントリポイント（Browser等） | 球形、アプローチャブル |
| `cylinder` | CylinderGeometry(0.9, 0.9, 1.4, 32) | サーバー・ストア（WSGI等） | 積層イメージ |
| `diamond` | OctahedronGeometry(1.0, 0) | 分岐・判定（Routing等） | 決断ポイント |
| `torus` | TorusGeometry(0.7, 0.3, 16, 48) | 出力・境界（Response等） | リング、通過点 |

共通の構成要素（全形状共通）:
- **マテリアル**: MeshStandardMaterial、metalness 0.15、roughness 0.42、emissive=ステータス色 intensity 0.14
- **エッジライン**: EdgesGeometry + LineBasicMaterial `0xcbd5e1` opacity 0.85
- **グローリング**: RingGeometry ノード下 y=-0.5、sin波アニメ opacity 0.12〜0.16
- **ラベル**: Canvas sprite（ノード名42px + IN/OUT 24px）、`depthTest: false`
- **浮遊アニメーション**: floatOffset/glowOffset で位相をずらし同期しない揺れ

### ステータス色

| ステータス | 色 | 用途 |
|---|---|---|
| idle | `0x94a3b8`（グレー） | 待機中 |
| active | `0x22c55e`（緑） | 現在処理中 |
| complete | `0x3b82f6`（青） | 処理完了 |
| error | `0xef4444`（赤） | エラー |

ステータス色はグローリングとemissiveに反映。ボディ色は変化しない。

## 接続線（ConnectionLines）

### カーブ
- `QuadraticBezierCurve3` — 始点と終点の中間からy軸にアーチ
- アーチ高さ: `min(距離*0.3, 3)` — ノード間が離れても高すぎない
- セグメント数: 32（滑らかなカーブ）

### 接続タイプ別の描画

| type | マテリアル | 色 | flowSpeed | 用途 |
|---|---|---|---|---|
| `network` | LineDashedMaterial dash=0.3 gap=0.15 | `0x93c5fd` ペールブルー | 2.0 | 外部ネットワーク通信 |
| `sync` | LineBasicMaterial（実線） | `0xa5b4fc` ソフトインディゴ | 2.5 | 内部同期処理 |
| `async` | LineDashedMaterial dash=0.3 gap=0.2 | `0x67e8f9` ソフトシアン | 1.0 | 非同期/キュー |
| `signal` | LineDashedMaterial dash=0.08 gap=0.08 | `0xfcd34d` ソフトアンバー | 3.5 | イベント/シグナル |
| `ownership` | LineDashedMaterial | `0xc9d1d9` ミュートグレー | 2.0 | 所有関係 |
| `storage` | LineDashedMaterial | `0x8b949e` ダークグレー | 2.0 | ストレージ |
| `config` | LineDashedMaterial | `0xd29922` ゴールド | 2.0 | 設定 |

### トラフィック量による違い
- opacity: `min(0.25 + trafficVolume*0.05, 0.7)` — 通信量が多いほど濃く
- アクティブ時: opacity=0.7、speed=2.4倍
- 非アクティブ時: opacity=0.25未満、speed=0.45倍

### ハイライト
- 特定ノード選択時: 関連接続をMAX_OPACITY、それ以外を半減
- フォーカスが外れたらリセット

## パーティクル（ParticleTraffic）

### プール
- 2048個のパーティクルを事前確保（オブジェクトプール）
- 非アクティブ時はy=-1000に隠す

### シェーダー（カスタムWebGL）
**Vertex shader**: size×距離でポイントサイズ計算、最小1px保証
**Fragment shader**:
- 中心からの距離でsmoothstep（円形にフェード）
- `exp(-dist*4)*0.6` でグロー効果
- 最終alpha = (intensity + glow) × vAlpha

### パーティクルパラメータ

| 項目 | 値 |
|---|---|
| ベースサイズ | 3.0（±ランダム0.7〜1.3倍） |
| 速度 | 1.5〜4.0（ランダム） |
| スポーン間隔 | 0.05秒 / requestRate |
| トレイル長 | 3（後続パーティクル） |
| フェードイン | progress 0〜0.15 |
| フェードアウト | progress 0.85〜1.0 |

### トレイル
- リードパーティクルに続く2個のトレイル
- トレイル1: サイズ0.5倍、alpha減衰0.3
- トレイル2: サイズ0.38倍、alpha減衰0.6
- 色: リードより彩度を下げる（RGB×(1-t*0.2)）
- **意図**: 流れの尾が見え、動きの方向が分かる

### トラフィックタイプ色

| type | 色 | 用途 |
|---|---|---|
| default | `0x60a5fa`（青） | 通常通信 |
| healthy | `0x3fb950`（緑） | 正常完了 |
| error | `0xf85149`（赤） | エラー |
| slow | `0xd29922`（金） | レイテンシ高 |

### パーティクルラベル
- リードパーティクルのみ表示（trailIndex===0）
- Canvas sprite: 白背景角丸、24px Inter 600
- `depthTest: false`、`renderOrder: 12`（最前面）
- payloadテキスト（"HTTP request"、"environ dict"等）
- テクスチャキャッシュあり

### カーブ
- ノード間のQuadraticBezierCurve3
- アーチ高さ: `min(距離*0.25, 2.5)`（接続線より低め）

## プレイバックエンジン

### アーキテクチャ: データ駆動

PlaybackEngineは**汎用エンジン**。タイムラインはデータ側（FlaskFlow.js等）で定義し、コンストラクタ引数で渡す。

```
js/data/FlaskFlow.js     → FLASK_TIMELINE { duration, keyframes[] } を定義
js/engine/PlaybackEngine → timelineを受け取って再生する汎用エンジン
index.html               → importして PlaybackEngine(FLASK_TIMELINE, { callbacks }) で初期化
```

新システム追加時: `GrpcFlow.js` に `GRPC_TIMELINE` を定義するだけでPlaybackEngineは変更不要。

### タイムライン定義フォーマット

各システムのデータファイル内で以下を定義:

```javascript
export const <SYSTEM>_TIMELINE = {
    duration: 35,  // 秒
    keyframes: [
        { time: 0.0, type: 'resource', id: 'node-id', status: 'active', caption: '説明テキスト' },
        { time: 2.0, type: 'route', id: 'route-conn-id', active: true },
        { time: 5.8, type: 'route', id: 'route-conn-id', active: false },
        // ...
    ]
};
```

キーフレームの `caption` フィールドは任意。指定すると画面上部の字幕バーに表示。

### 字幕UI
- 位置: 画面上部中央（top: 32px）
- font-size: 22px, font-weight: 600
- Glassmorphism: 半透明白 + blur(18px)
- `caption-visible` クラスでフェードイン/アウト（transition 0.4s）

### 状態管理
- idle → playing → paused → idle
- idleからplay時: リワインドしてから再生
- 再生完了: 自動でidleに戻る
- 再生中はノードドラッグをロック（`renderer.lockDrag = true`）

## UI（HTML + CSS）

### デザイン言語: Glassmorphism
- 半透明白背景 + backdrop-filter: blur(18px)
- 白のグラデーション境界
- 大きなbox-shadow（18px 40px）
- 角丸20px（ヘッダー）、999px（再生バー＝カプセル型）

### システムセレクター（左上）
- 固定位置 top:20px left:20px
- ドロップダウンでシステム選択（現在Flaskのみ）
- カスタムSVG矢印アイコン

### 再生コントロール（下部中央）
- Play / Pause / Stop の3ボタン
- カプセル型バーで中央配置
- Play: 白→スレートグラデ
- Stop: オレンジ系グラデ（`#fff7ed`→`#ffedd5`）、テキスト`#9a3412`
- disabled時: opacity 0.45
- hover時: translateY(-1px) + shadow拡大
- レスポンシブ: 640px以下でpadding/gap/ボタンサイズ縮小

### キャンバス
- 全画面（100vw × 100vh）
- `touch-action: none`（モバイルでのブラウザ操作を抑制）

## ノードの選択・ホバー・ドラッグ

| 操作 | 動作 |
|---|---|
| 左クリック | ノード選択、emissive=ピンク(`0xfbcfe8`) intensity=0.3、scale=1.08倍 |
| ホバー | emissive=青(`0xbfdbfe`) intensity=0.18、カーソル=pointer |
| ドラッグ | ノードをXZ平面上で移動（OrbitControls一時無効化） |
| 右クリック | 無効化（コンテキストメニュー抑制） |
| ドラッグ閾値 | 4px（それ以上でドラッグ、未満でクリック） |

---

# レイアウトルール（現在有効 + 将来拡張）

## X軸 = 時間・フロー方向 [有効]
- 左→右にリクエスト/データが進む
- 戻りのフローは逆方向パーティクルで表現
- 分岐はX位置で同時並行を表現
- 現在: Browser(-10) → WSGI(-5) → Routing(0) → View(5) → Response(10) → Browser(15)

## Z軸 = 関心の深さ [将来]
- z=0: メインフロー（ハッピーパス）
- z=+2: エラー処理、リトライ等の脇道
- z=-2: バックグラウンド（ロギング、メトリクス等）

## Y軸 = レイヤー [将来・現在保留]
- y=+3: Client層 / y=0: App層 / y=-3: Infra層
- 現在は全ノード y=0 の1列配置

## 色 = カテゴリ + ステータス [有効]
- ベース色 = カテゴリ（Browser=青、WSGI=緑、Routing=金、View=紫、Response=オレンジ）
- グロー/emissive = ステータス（idle=グレー、active=緑、complete=青、error=赤）

## ノード形状 = 役割タイプ [有効]
- `default`(RoundedBox): 処理ノード
- `sphere`(Icosahedron): エントリポイント
- `cylinder`(Cylinder): サーバー・ストア
- `diamond`(Octahedron): 分岐・条件判定
- `torus`(Torus): 出力・境界
- `ResourceMeshes.js` の `CREATORS` マップで切り替え

## 接続線の種類 = データの性質 [有効]
- `sync` 実線+高速: 内部同期処理
- `network` 破線+中速: 外部ネットワーク通信
- `async` 破線+低速: 非同期/キュー
- `signal` 点線+高速: イベント/シグナル

## パーティクル = データの中身 [有効+将来拡張]
- 色: healthy/error/slow/default（有効）
- ラベル: payload内容（有効）
- トレイル: 3個後続（有効）
- サイズ: データ量の大小（将来）

## レイアウトテンプレート [将来]

| テンプレート | 配置 | 対象 |
|---|---|---|
| linear | 横一列 | Flask, Express |
| hub-spoke | 中心+放射 | DB中心CRUD |
| pipeline | 直列+分岐 | CI/CD |
| mesh | ネットワーク | マイクロサービス |
| ring | 円環 | イベントループ |

---

# データ定義フォーマット

各システムの可視化データは以下の構造で定義する:

```javascript
// js/data/<SystemName>Flow.js
export const <SYSTEM>_NODES = [
  {
    id: 'unique-id',
    name: '表示名',
    type: 'browser',          // browser/server/application/datastore/external
    shape: 'default',         // default/sphere/cylinder/diamond/torus
    status: 'idle',
    color: 0xRRGGBB,          // カテゴリ色
    x: 0, y: 0, z: 0,
    dataIn: '入力データ',
    dataOut: '出力データ',
    floatOffset: 0.0,         // 浮遊アニメ位相
    glowOffset: 0.3           // グロー位相
  }
];

export const <SYSTEM>_CONNECTIONS = [
  {
    id: 'conn-xxx',
    sourceId: 'from-id',
    targetId: 'to-id',
    type: 'network',          // network/sync/async/signal/ownership/storage/config
    trafficVolume: 2          // パーティクル密度
  }
];

export const <SYSTEM>_TIMELINE = {
  duration: 35,               // 再生時間（秒）
  keyframes: [
    { time: 0.0, type: 'resource', id: 'node-id', status: 'active', caption: '説明テキスト' },
    { time: 2.0, type: 'route', id: 'route-conn-id', active: true },
    { time: 5.8, type: 'route', id: 'route-conn-id', active: false },
  ]
};

export function buildTrafficRoutes(resourceMeshes) { ... }
```

## 新システム追加の手順

1. `js/data/<SystemName>Flow.js` を作成
2. `NODES`, `CONNECTIONS`, `TIMELINE`, `buildTrafficRoutes` を定義
3. `index.html` でimportし、PlaybackEngineに `TIMELINE` を渡す
4. PlaybackEngine、ClusterRenderer等のエンジン側は**変更不要**

# 実装優先度

1. **完了**: リニア配置 + 6ノードFlask可視化 + 形状バリエーション + 接続タイプ + 字幕 + データ駆動アーキテクチャ
2. **次**: ノード数拡張（Flask内部の詳細: コンテキスト、フック、シグナル等）
3. **その後**: Z軸（関心の深さ）によるエラー分岐・バックグラウンド表示
4. **将来**: Y軸レイヤー、レイアウトテンプレート
5. **最終**: 他システム対応（システムセレクターで動的切り替え）
