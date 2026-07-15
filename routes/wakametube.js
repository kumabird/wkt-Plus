const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const ytsr = require("ytsr");
const serverYt = require("../server/youtube.js");
const { createToken, resolveToken } = require("../db/navTokens.js");
const {
  addWatchHistory,
  getWatchHistory,
  clearWatchHistory,
  deleteWatchHistoryItem,
  addSearchHistory,
  getSearchHistory,
  clearSearchHistory,
  deleteSearchHistoryItem,
} = require("../db/history.js");
const { isEnabled: isDbEnabled } = require("../db/pool.js");

const limit = process.env.LIMIT || 50;

router.use("/watch", require("../controllers/tube/getvideo"));
router.use("/w", require("../controllers/tube/getvideo"));
router.use("/live", require("../controllers/tube/live"));
router.use("/yt", require("../controllers/tube/youtube"));

const REMOTE_VERSION_URL =
  "https://raw.githubusercontent.com/toka-kun/wkt-Plus/refs/heads/master/version.json";

function getLocalVersion() {
  try {
    const versionPath = path.join(__dirname, "../version.json");
    const versionData = JSON.parse(fs.readFileSync(versionPath, "utf8"));
    return versionData.version || "unknown";
  } catch (err) {
    console.error("version.json の読み込みに失敗:", err);
    return "unknown";
  }
}

async function getRemoteVersion() {
  const res = await fetch(REMOTE_VERSION_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch remote version: HTTP ${res.status}`);
  }

  const versionData = await res.json();
  return versionData.version || "unknown";
}

router.get("/", async (req, res) => {
  const version = getLocalVersion();

  try {
    const latestVersion = await getRemoteVersion();
    const isOutdated =
      version !== "unknown" &&
      latestVersion !== "unknown" &&
      version !== latestVersion;

    res.render("tube/home", {
      version,
      isOutdated
    });
  } catch (err) {
    console.error("最新 version.json の取得に失敗:", err);
    res.render("tube/home", {
      version,
      isOutdated: false
    });
  }
});

// 検索フォームのPOST送信を受け取り、検索語をDBに一時保存してトークンを発行、
// トークン付きURLへリダイレクトする。これによりブラウザのURLに検索語が
// 直接表示されないようにする。
router.post("/s", async (req, res) => {
  const query = req.body.q;
  const page = Number(req.body.p || 1);
  if (!query) {
    return res.redirect((req.baseUrl || "") + "/");
  }
  if (!isDbEnabled()) {
    // DB未設定時は従来通りGETクエリにフォールバックする
    return res.redirect(
      (req.baseUrl || "") + `/s?q=${encodeURIComponent(query)}&p=${page}`
    );
  }
  try {
    const token = await createToken("search", { q: query, p: page });
    if (req.clientId) {
      addSearchHistory(req.clientId, query).catch((e) =>
        console.error("[history] 検索履歴の保存に失敗:", e.message)
      );
    }
    res.redirect((req.baseUrl || "") + `/s/t/${token}`);
  } catch (err) {
    console.error("検索トークンの発行に失敗:", err);
    res.redirect(
      (req.baseUrl || "") + `/s?q=${encodeURIComponent(query)}&p=${page}`
    );
  }
});

// トークンから検索語を解決して表示する
router.get("/s/t/:token", async (req, res, next) => {
  const payload = await resolveToken("search", req.params.token).catch(() => null);
  if (!payload) {
    return res.status(404).render("error.ejs", {
      title: "エラー",
      content: "このリンクは無効か、有効期限が切れています。"
    });
  }
  req.query.q = payload.q;
  req.query.p = payload.p;
  next();
});

router.get("/s", async (req, res) => {
    let query = req.query.q;
    let page = Number(req.query.p || 1);
    try {
        // 先に検索結果を変数に入れる
        const searchResult = await serverYt.search(query, limit, page);
        
        // ★ 修正ポイント: 検索結果が null、results が無い、または 0件 の場合
        if (!searchResult || !searchResult.results || searchResult.results.length === 0) {
            // 自動的に /ss (views/tube/opu/search.ejs を処理するルート) へリダイレクトする
            const redirectUrl = (req.baseUrl || '') + `/ss?q=${encodeURIComponent(query)}&p=${page}`;
            return res.redirect(redirectUrl);
        }

        // 成功した場合は通常通り渡す
        res.render("tube/search.ejs", {
            res: searchResult,
            query: query,
            page
        });
    } catch (error) {
        console.error(error);
        try {
            res.status(500).render("error.ejs", {
                title: "ytsr Error",
                content: error
            });
        } catch (error) {
            console.error(error);
        }
    }
});

router.get("/ss", async (req, res) => {
        let query = req.query.q;
        let page = Number(req.query.p || 3);
    try {
                res.render("tube/opu/search.ejs", {
                        res: await ytsr(query, {limit, pages: page}),
                        query: query,
                        page
                });
        } catch (error) {
                console.error(error);
                res.status(500).render("error.ejs", {
                        title: "ytsr Error",
                        content: error
                });
        }
});

router.get("/p/:id", async (req, res) => {
  try {
    const data = await serverYt.getPlaylist(req.params.id);
    if (!data) {
      return res.status(404).render("error.ejs", {
        title: "再生リストが見つかりません",
        content: "再生リスト情報を取得できませんでした。"
      });
    }
    res.render("tube/playlist.ejs", { ...data, playlistId: req.params.id });
  } catch (err) {
    console.error("Failed to fetch playlist", req.params.id, err);
    res.status(500).render("error.ejs", {
      title: "エラー",
      content: "再生リストの取得に失敗しました:\n" + err.toString()
    });
  }
});

router.get("/c/:id/tab/:tabName", async (req, res) => {
  const { id, tabName } = req.params;
  const sort = req.query.sort || 'newest';
  try {
    const data = await serverYt.getChannelTab(id, tabName, sort);
    res.json(data);
  } catch (err) {
    console.error("Tab fetch failed:", tabName, err);
    res.status(500).json({ items: [], error: err.message });
  }
});

router.get("/c/:id", async (req, res) => {
  try {
    const data = await serverYt.getChannel(req.params.id);
    if (!data) {
      return res.status(404).render("error.ejs", {
        title: "チャンネルが見つかりません",
        content: "チャンネル情報を取得できませんでした。"
      });
    }
    res.render("tube/channel.ejs", { ...data, channelId: req.params.id });
  } catch (err) {
    console.error("Failed to fetch channel", req.params.id, err);
    res.status(500).render("error.ejs", {
      title: "Sorry. Something went wrong",
      content: "Failed to fetch channel information:\n" + err.toString()
    });
  }
});

// 動画リンククリック時のPOST遷移用: videoIdをDBに一時保存してトークンを発行する。
// フロントエンドのJS(public/js/navigate.js)からfetchで呼ばれる想定。
router.post("/watch-token", async (req, res) => {
  const videoId = req.body.videoId;
  const list = req.body.list;
  const server = req.body.server;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: "invalid videoId" });
  }
  if (!isDbEnabled()) {
    // DB未設定時はvideoIdをそのまま返し、フロント側で従来のURLを組み立てさせる
    return res.json({ fallbackVideoId: videoId, list, server });
  }
  try {
    const payload = { videoId };
    if (list) payload.list = list;
    if (server) payload.server = server;
    const token = await createToken("watch", payload);
    res.json({ token });
  } catch (err) {
    console.error("動画トークンの発行に失敗:", err);
    res.status(500).json({ fallbackVideoId: videoId, list, server });
  }
});

/* ---------------- 履歴API (Neon DB) ---------------- */

router.get("/api/history/watch", async (req, res) => {
  try {
    const items = await getWatchHistory(req.clientId);
    res.json({ items, dbEnabled: isDbEnabled() });
  } catch (err) {
    console.error("再生履歴の取得に失敗:", err);
    res.status(500).json({ items: [], error: err.message });
  }
});

router.post("/api/history/watch", async (req, res) => {
  const { videoId, channelId, channelName, videoTitle } = req.body;
  if (!videoId) return res.status(400).json({ error: "videoId is required" });
  try {
    await addWatchHistory(req.clientId, { videoId, channelId, channelName, videoTitle });
    res.json({ ok: true });
  } catch (err) {
    console.error("再生履歴の保存に失敗:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/history/watch/:videoId", async (req, res) => {
  try {
    await deleteWatchHistoryItem(req.clientId, req.params.videoId);
    res.json({ ok: true });
  } catch (err) {
    console.error("再生履歴の削除に失敗:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/history/watch", async (req, res) => {
  try {
    await clearWatchHistory(req.clientId);
    res.json({ ok: true });
  } catch (err) {
    console.error("再生履歴の全削除に失敗:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/history/search", async (req, res) => {
  try {
    const items = await getSearchHistory(req.clientId);
    res.json({ items, dbEnabled: isDbEnabled() });
  } catch (err) {
    console.error("検索履歴の取得に失敗:", err);
    res.status(500).json({ items: [], error: err.message });
  }
});

router.post("/api/history/search", async (req, res) => {
  const q = req.body.q;
  if (!q) return res.status(400).json({ error: "q is required" });
  try {
    await addSearchHistory(req.clientId, q);
    res.json({ ok: true });
  } catch (err) {
    console.error("検索履歴の保存に失敗:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/history/search/:query", async (req, res) => {
  try {
    await deleteSearchHistoryItem(req.clientId, decodeURIComponent(req.params.query));
    res.json({ ok: true });
  } catch (err) {
    console.error("検索履歴の削除に失敗:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/history/search", async (req, res) => {
  try {
    await clearSearchHistory(req.clientId);
    res.json({ ok: true });
  } catch (err) {
    console.error("検索履歴の全削除に失敗:", err);
    res.status(500).json({ error: err.message });
  }
});

router.use("/back", require("../controllers/tube/back"));
router.use("/redirect", require("../controllers/tube/redirect"));
router.use("/trend", require("../controllers/tube/trend"));
router.use("/cl", require("../controllers/tube/cl"));

module.exports = router;
