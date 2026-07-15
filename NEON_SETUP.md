# 履歴DB化 (Neon) セットアップ手順

このドキュメントでは、今回追加した以下の機能を有効にするための設定手順を説明します。

- 検索フォーム・動画リンクのPOST化（URLに検索語や動画IDを直接出さない仕組み）
- 再生履歴・検索履歴のNeon(PostgreSQL)データベースでの管理
- 全ページのタイトルを常に「wkt」に固定

## 1. 追加された仕組みの概要

| 機能 | 説明 |
|---|---|
| `db/pool.js` | `DATABASE_URL` 環境変数からNeonへのコネクションプールを作成 |
| `db/schema.sql` | 必要なテーブル定義（サーバー起動時に自動実行） |
| `db/init.js` | 起動時にスキーマを自動作成する |
| `db/navTokens.js` | 検索語・動画IDをURLに出さないためのワンタイムトークン発行/解決 |
| `db/history.js` | 再生履歴・検索履歴のCRUD |
| `db/clientId.js` | 匿名クライアントを識別するcookie(`wkt_client_id`)を発行するミドルウェア |

`DATABASE_URL` が未設定の場合でもアプリ自体は起動しますが、履歴保存・POSTトークン機能は自動的に無効化され、検索フォームは従来通りGETクエリにフォールバックします（アプリが落ちることはありません）。

## 2. Neon(PostgreSQL)のセットアップ手順

### 2-1. Neonアカウント作成 & プロジェクト作成

1. [https://neon.tech](https://neon.tech) にアクセスし、アカウントを作成（GitHubアカウントでのサインアップも可能）
2. ダッシュボードで **[New Project]** をクリック
3. プロジェクト名（例: `wkt-plus`）とリージョン（日本からのアクセスなら `Asia Pacific (Singapore)` 等、近いリージョンを推奨）を選択して作成

### 2-2. 接続文字列の取得

1. 作成したプロジェクトのダッシュボードを開く
2. **[Connection Details]**（接続の詳細）パネルを開く
3. Branch: `main`、Role: 作成したロール（デフォルトでOK）を選択
4. 表示される接続文字列をコピーする。以下のような形式です。

   ```
   postgresql://<user>:<password>@<endpoint-hostname>.neon.tech/<dbname>?sslmode=require
   ```

   これがそのまま `DATABASE_URL` 環境変数の値になります。

### 2-3. スキーマの作成方法

このアプリは **サーバー起動時に自動で** `db/schema.sql` の内容を実行し、テーブルが無ければ作成します（`CREATE TABLE IF NOT EXISTS` を使っているため、既存データを壊すことはありません）。特別な操作は不要です。

手動でテーブルを作りたい場合は、Neon のダッシュボードにある **[SQL Editor]** を開き、`db/schema.sql` の中身をそのまま貼り付けて実行してください。あるいはローカルに `psql` があれば以下のコマンドでも実行できます。

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

## 3. Renderでのデプロイ手順

### 3-1. 環境変数の設定

1. Render のダッシュボードで対象のWeb Serviceを開く
2. 左メニューの **[Environment]** を開く
3. **[Add Environment Variable]** で以下を追加

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | Neonからコピーした接続文字列 |

4. **[Save Changes]** を押すと自動的に再デプロイが走ります（手動デプロイが必要な場合は **[Manual Deploy] → [Deploy latest commit]**）

### 3-2. 依存パッケージについて

今回 `pg` パッケージを `package.json` の `dependencies` に追加しました。Renderは `npm install` を自動実行するため、追加の作業は不要です。

### 3-3. 起動ログの確認

デプロイ後、Renderの **[Logs]** タブで以下のようなログが出ていればNeonへの接続・スキーマ作成が成功しています。

```
[db] スキーマ初期化が完了しました (Neon)
```

もし以下のようなログが出ている場合は `DATABASE_URL` が正しく設定されていません。

```
[db] DATABASE_URL が設定されていません。履歴/POSTトークン機能は無効化されます。
```

## 4. 動作確認チェックリスト

- [ ] トップページ・各ページのタブタイトルが常に「wkt」になっている
- [ ] ホーム画面の検索ボックスから検索すると、URLに検索語が直接出ない（`/wkt/s/t/xxxxxxxx` のような形式になる）
- [ ] 検索結果や動画一覧から動画をクリックすると、URLに動画IDが直接出ない（`/wkt/watch/t/xxxxxxxx` のような形式になる）
- [ ] 動画を再生すると `/wkt/cl/history` に再生履歴が表示される（別ブラウザ/シークレットウィンドウでは表示されないことも確認 = クライアントごとに履歴が分かれている）
- [ ] 検索すると `/wkt/cl/shistory`（検索履歴ページ）に検索語が追加される
- [ ] 履歴ページの「全て削除」ボタンで履歴が消える

## 5. トラブルシューティング

### Neonへの接続がタイムアウトする

- NeonのFree Planはアイドル時にコンピュートがスリープします。初回アクセス時に数百ms〜数秒のコールドスタートが発生することがありますが、これは仕様です。
- `?sslmode=require` が接続文字列に含まれているか確認してください（Neonは基本的にSSL接続必須です）。

### 履歴が保存されない・表示されない

- `wkt_client_id` というcookieがブラウザに保存されているか確認してください（サーバー側が初回アクセス時に自動発行します）。
- ブラウザのプライベート/シークレットモードでは、タブを閉じるとcookieが消えるため履歴も引き継がれません（仕様通りの動作です）。
- サーバーログに `[history]` や `再生履歴の保存に失敗` といったエラーが出ていないか確認してください。

### 検索や動画リンクが従来のURL形式（`?q=`や動画IDがそのまま）になる

- `DATABASE_URL` が設定されていない場合の正常なフォールバック動作です。Neonの接続文字列を設定してください。

## 6. データの手動確認方法（任意）

Neonダッシュボードの **[SQL Editor]** で以下のようなクエリを実行すると、保存されているデータを直接確認できます。

```sql
-- 直近の再生履歴を確認
SELECT * FROM watch_history ORDER BY watched_at DESC LIMIT 20;

-- 直近の検索履歴を確認
SELECT * FROM search_history ORDER BY searched_at DESC LIMIT 20;

-- 有効なPOSTトークンの件数を確認
SELECT kind, count(*) FROM nav_tokens WHERE expires_at > now() GROUP BY kind;
```
