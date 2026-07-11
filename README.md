# Naruhodo!

AI解説付き翻訳ツールのMVP実装です。

## 機能

- テキスト翻訳（言語自動検出 + 解説付き）
- トーン別（カジュアル / フォーマル / ビジネス）の複数翻訳提案
- 添削モード（誤字脱字チェック・自然な表現への修正）
- 翻訳履歴のブラウザ内保存（サーバー保存なし）

## セットアップ

```bash
npm install
cp .env.local.example .env.local
```

`.env.local` に `ANTHROPIC_API_KEY` または `OPENAI_API_KEY` のどちらかを設定してください。両方未設定の場合、翻訳実行時にAPIキー未設定のエラーが表示されます。

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いて確認できます。

## 構成

- `src/app/api/translate/route.ts` — 翻訳・添削のAPIルート。Anthropic / OpenAI のどちらか設定されている方を呼び出します
- `src/lib/ai.ts` — LLMプロバイダーの抽象化
- `src/components/Translator.tsx` — メインUI
- `src/lib/history.ts` — localStorageによる翻訳履歴の保存
- `src/proxy.ts` — サイト全体へのBasic認証（`SITE_PASSWORD`未設定時は無効）

## デプロイ（Vercel）

このアプリには認証もレート制限も入っていないため、公開URLが知られると設定したAPIキーで誰でも翻訳を実行できてしまいます。**本番公開時は `SITE_PASSWORD` を必ず設定してください。**

1. Vercelにサインアップ / ログイン: https://vercel.com
2. このプロジェクトをGitHubリポジトリにpushするか、Vercel CLIでそのままデプロイ
   ```bash
   npx vercel login   # ブラウザで認証
   npx vercel         # プロジェクトをリンクしてプレビューデプロイ
   ```
3. Vercelダッシュボードの Project Settings → Environment Variables で以下を設定
   - `OPENAI_API_KEY`（または `ANTHROPIC_API_KEY`）
   - `SITE_USERNAME`
   - `SITE_PASSWORD`
4. 本番デプロイ
   ```bash
   npx vercel --prod
   ```

APIキーとパスワードはVercelのダッシュボード上で直接入力してください（CLIから`vercel env add`でも設定できます）。
