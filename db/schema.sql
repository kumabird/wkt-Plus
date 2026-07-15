-- wkt-Plus 用スキーマ (Neon / PostgreSQL)
-- server起動時に db/init.js から自動実行されます。
-- 手動で実行する場合は `psql "$DATABASE_URL" -f db/schema.sql` としてください。

-- POST遷移用の一時トークン
-- 検索クエリや動画IDをURLに直接出さないため、POST受信時にここへ保存し、
-- 発行したトークンでリダイレクトします。
CREATE TABLE IF NOT EXISTS nav_tokens (
    token       TEXT PRIMARY KEY,
    kind        TEXT NOT NULL,              -- 'search' | 'watch'
    payload     JSONB NOT NULL,             -- { "q": "..." } または { "videoId": "..." }
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nav_tokens_expires_at ON nav_tokens (expires_at);

-- 再生履歴 (クライアントごと)
CREATE TABLE IF NOT EXISTS watch_history (
    id            BIGSERIAL PRIMARY KEY,
    client_id     TEXT NOT NULL,
    video_id      TEXT NOT NULL,
    channel_id    TEXT,
    channel_name  TEXT,
    video_title   TEXT,
    watched_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watch_history_client ON watch_history (client_id, watched_at DESC);
-- 同一クライアント×同一動画の重複行を防ぐ (履歴更新時はUPSERTでwatched_atを更新)
CREATE UNIQUE INDEX IF NOT EXISTS uq_watch_history_client_video ON watch_history (client_id, video_id);

-- 検索履歴 (クライアントごと)
CREATE TABLE IF NOT EXISTS search_history (
    id           BIGSERIAL PRIMARY KEY,
    client_id    TEXT NOT NULL,
    query        TEXT NOT NULL,
    searched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_history_client ON search_history (client_id, searched_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_search_history_client_query ON search_history (client_id, query);
