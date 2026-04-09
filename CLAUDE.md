# SysViz - System Visualizer

OSSプロジェクトの内部動作を3D可視化するWebアプリ。

## デザインルール

**実装・変更時に必ず `agents/sysviz-design.md` を参照すること。**

特に以下のタイミングでチェック:
- 新しいノード形状・色を追加する時 → 形状バリエーション、カラーパレットの節を確認
- 接続線を追加・変更する時 → 接続タイプ別の描画ルールを確認
- UIの見た目を変更する時 → Glassmorphism、色彩哲学を確認
- 新しいシステムの可視化データを定義する時 → データ定義フォーマットに従う

### 色彩の基本方針
**ソフトミュートパステル**。ネオン・原色・高彩度は禁止。彩度控えめ、明度中〜高め。

## 技術スタック

- Three.js r152 + Tailwind CSS CDN + vanilla ES6 modules
- ビルドなし、CDN読み込みのみ
- 参考: https://github.com/rohitg00/k8sgames
