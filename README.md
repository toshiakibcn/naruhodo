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

`.env.local` に `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` のいずれかを設定してください。いずれも未設定の場合、翻訳実行時にAPIキー未設定のエラーが表示されます。

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いて確認できます。

## 構成

- `src/app/api/translate/route.ts` — 翻訳・添削のAPIルート。Anthropic / OpenAI / DeepSeek のうち設定されているものを呼び出します
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
   - `OPENAI_API_KEY`（または `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY`）
   - `SITE_USERNAME`
   - `SITE_PASSWORD`
4. 本番デプロイ
   ```bash
   npx vercel --prod
   ```
   `NEXT_PUBLIC_`で始まる変数はビルド時に埋め込まれるため、環境変数を追加・変更した後は**ビルドキャッシュを使わずに再デプロイ**してください（ダッシュボードの「Redeploy」ではキャッシュが再利用され反映されないことがあります。`vercel --prod`をCLIで実行するのが確実です）。

APIキーとパスワードはVercelのダッシュボード上で直接入力してください（CLIから`vercel env add`でも設定できます）。

## 翻訳APIをCloudflare Workerに切り出す（任意）

`worker/` ディレクトリに、`/api/translate` と同じ機能を持つCloudflare Workerが用意されています。ブラウザから直接Workerを呼ぶ構成にすると、Vercelの関数を経由しない分レイテンシが下がります。未設定の場合は今まで通りNext.js内の`/api/translate`が使われるので、この節は任意です。

### Workerのデプロイ

```bash
cd worker
npm install
npx wrangler login          # ブラウザでCloudflareにログイン
```

`wrangler.toml`の`ALLOWED_ORIGIN`を、実際にデプロイしたVercelのURLに合わせて確認してください（デフォルトは`https://naruhodo-phi.vercel.app`）。

シークレットを設定します（値の入力はプロンプトで直接行うので、ターミナルで実行してください）。

```bash
npx wrangler secret put OPENAI_API_KEY     # またはANTHROPIC_API_KEY / DEEPSEEK_API_KEY
npx wrangler secret put WORKER_SECRET      # 好きなランダム文字列（フロントとの共有鍵）
```

デプロイ:

```bash
npx wrangler deploy
```

表示された `https://naruhodo-api.<あなたのサブドメイン>.workers.dev` をメモしてください。

### Next.js（Vercel）側の設定

Vercelの Environment Variables に以下を追加し、再デプロイしてください。

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | WorkerのURL（例: `https://naruhodo-api.xxxx.workers.dev`） |
| `NEXT_PUBLIC_WORKER_SECRET` | `wrangler secret put WORKER_SECRET` で設定したのと同じ値 |

### セキュリティについての注意

`NEXT_PUBLIC_`が付く環境変数はブラウザのJavaScriptから丸見えになります。そのためWorkerは以下の2段構えで保護しています。

- **Originチェック**: `ALLOWED_ORIGIN`と一致しないリクエストは403
- **共有シークレット**: `WORKER_SECRET`と一致しない場合は401

ただし`WORKER_SECRET`はブラウザのJSバンドルから理論上抽出可能なため、Next.js側のBasic認証（`SITE_PASSWORD`）ほど強固ではありません。「Naruhodoのページに到達できた人だけがWorkerを呼べる」程度の防御と理解してください。より強く守りたい場合は、フロントからではなくNext.jsサーバー経由でWorkerを呼ぶ構成に変更してください。
