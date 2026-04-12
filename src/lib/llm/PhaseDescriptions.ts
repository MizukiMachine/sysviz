const PHASE_DESCRIPTIONS: Record<string, string> = {
  'flask-data-flow': `この可視化は、Flask WebアプリケーションにおけるHTTPリクエストの完全なライフサイクルを示しています。

## 順方向パス（リクエスト）
1. **Client** — ブラウザからHTTPリクエスト（GET /hello）を送信
2. **WSGI Entry** — Flask.__call__() がWSGIエントリポイントとして動作、environ辞書を受け取る
3. **Context Push** — AppContextを作成、request/session/g オブジェクトを利用可能にする
4. **Bind Request** — LocalProxy経由でrequest, session, g オブジェクトを現在のコンテキストにバインド
5. **before_request** — リクエスト前フックを実行（認証、ロギング等）
6. **URL Router** — url_map.match() でパスをエンドポイント + view_args に解決
7. **View Function** — ビジネスロジックを実行、レスポンスデータを生成

## エラー分岐
- **Error Handler** — ビュー関数で例外が発生した場合、エラーハンドラがキャッチ

## 戻りパス（レスポンス）
8. **Response Build** — データ/辞書/テンプレートからResponseオブジェクトを構築
9. **after_request** — レスポンス後フックでレスポンスを修正（ヘッダー、CORS等）
10. **Session Save** — セッションデータをSet-Cookieヘッダーにシリアライズ
11. **teardown** — teardown_requestフックでリソースをクリーンアップ
12. **Context Pop** — AppContextを破棄、HTTPレスポンスをクライアントに返却
13. **HTTP Response** — ブラウザが 200 OK とレンダリングされたページを受信

## 接続タイプ
- 青い破線（network）: 外部HTTP通信
- 紫の実線（sync）: 内部関数呼び出し
- 金色の点線（signal）: エラー/例外伝播

## ノード形状
- 球体 = 外部エンティティ（Browser）
- 円柱 = サーバー/ストレージ（WSGI, Session）
- 菱形 = 分岐/判定（URL Router, Context Push）
- 角丸ボックス = 処理ノード（View Function, Hooks）
- トーラス = 出力/境界（Response）`,

  'flask-sequence': `この可視化は、Flaskアプリケーションのリクエスト処理シーケンスを示しています。`,

  'flask-request-flow': `この可視化は、Flaskアプリケーションのシンプル化されたリクエストフローを示しています。`,

  'mermaid-data-flow': `この可視化は、Mermaid flowchart（.mmdファイル）から自動生成されたFlaskデータフロー図です。`,
};

export function getPhaseDescriptions(viewName: string): string {
  return PHASE_DESCRIPTIONS[viewName] || 'この可視化の詳細な説明はまだ登録されていません。';
}
