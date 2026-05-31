# SysViz

ソフトウェアアーキテクチャの Mermaid 図を 3D 空間に可視化する Web アプリ。

フローチャート・シーケンス図の `.mmd` ファイルを読み込み、ノード・接続線・パーティクルフローを Three.js でインタラクティブに描画する。ローカルファイル、外部データマニフェスト、GitLab リポジトリのいずれかをデータソースとして利用できる。

## アプリの仕様と挙動

- **プロジェクト選択** — 複数システム（Flask / FastAPI 等）をプロジェクト単位で切り替え
- **図切り替え** — レイヤードアーキテクチャ・コンポーネント図・データフロー・依存関係・シーケンス図などをダイアグラム単位で選択
- **3D 描画** — ノードを Tag ベースの 3D 形状（sphere / cylinder / rounded-box）で表示、subgraph を半透明ボックスでグループ化
- **パーティクルフロー** — 接続線に沿って光のパーティクルが流れ、データの流れ方向を表現
- **タイムライン再生** — ノードが順にアクティブになるアニメーションを再生 / 停止 / 一時停止で制御
- **カメラ制御** — OrbitControls による自由回転・ズーム・パン、アクティブノードへの自動追従
- **AI チャットパネル** — 現在の図について LLM に質問・解説を要求可能
- **GitLab 連携** — GitLab プロジェクトの図を直接読み込み・リフレッシュ
- **埋め込みモード** — `vite.config.embed.ts` による `embed.tsx` ビルドで外部サイトに組み込み可能
- **CI 解析スクリプト** — `ci/sysviz-analyze.py` でリポジトリを解析し Mermaid 図を自動生成

## 構成

```text
public/data/           → 内蔵サンプル Mermaid 図（Flask / FastAPI）
src/
  components/          → React UI（Canvas3D / ChatPanel / ProjectSelector / DiagramSwitcher）
  hooks/               → useChat / useGitLab / useVisualizationController
  lib/
    three/             → Three.js レンダリングエンジン
      parser/          → Mermaid パーサー（.mmd → 中間表現）
      rendering/       → ClusterRenderer / ConnectionLines / ParticleTraffic / SubgraphRenderer 等
    views/             → ViewConfig 生成・プロジェクトレジストリ
    llm/               → LLM サービス・コンテキストビルダー・ラベル翻訳
    gitlab/            → GitLab API 連携
  types/               → 可視化型定義
ci/                    → Python 製リポジトリ解析・Mermaid 生成スクリプト
```

### 技術スタック

| 層 | 技術 |
|---|---|
| UI | React 18 + Tailwind CSS 4 + Lucide Icons |
| 3D | Three.js r152 |
| 図のパース | Mermaid.js |
| AI チャット | LLM API（設定で切り替え） |
| バージョン管理連携 | GitLab REST API |
| ビルド | Vite 6 + TypeScript |
| CI 解析 | Python（dagre ベースレイアウト） |
