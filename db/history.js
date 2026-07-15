"use strict";
const { query, isEnabled } = require("./pool.js");

const WATCH_HISTORY_LIMIT = 100;
const SEARCH_HISTORY_LIMIT = 50;

/* ---------------- 再生履歴 ---------------- */

async function addWatchHistory(clientId, { videoId, channelId, channelName, videoTitle }) {
  if (!isEnabled()) return;
  await query(
    `INSERT INTO watch_history (client_id, video_id, channel_id, channel_name, video_title, watched_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (client_id, video_id)
     DO UPDATE SET
       channel_id = EXCLUDED.channel_id,
       channel_name = EXCLUDED.channel_name,
       video_title = EXCLUDED.video_title,
       watched_at = now()`,
    [clientId, videoId, channelId || null, channelName || null, videoTitle || null]
  );

  // 古い履歴を上限まで間引く
  await query(
    `DELETE FROM watch_history
     WHERE client_id = $1
       AND id NOT IN (
         SELECT id FROM watch_history
         WHERE client_id = $1
         ORDER BY watched_at DESC
         LIMIT $2
       )`,
    [clientId, WATCH_HISTORY_LIMIT]
  );
}

async function getWatchHistory(clientId, limit = WATCH_HISTORY_LIMIT) {
  if (!isEnabled()) return [];
  const result = await query(
    `SELECT video_id AS "videoId", channel_id AS "channelId",
            channel_name AS "channelName", video_title AS "videoTitle",
            watched_at AS "watchedAt"
     FROM watch_history
     WHERE client_id = $1
     ORDER BY watched_at DESC
     LIMIT $2`,
    [clientId, limit]
  );
  return result.rows;
}

async function clearWatchHistory(clientId) {
  if (!isEnabled()) return;
  await query(`DELETE FROM watch_history WHERE client_id = $1`, [clientId]);
}

async function deleteWatchHistoryItem(clientId, videoId) {
  if (!isEnabled()) return;
  await query(
    `DELETE FROM watch_history WHERE client_id = $1 AND video_id = $2`,
    [clientId, videoId]
  );
}

/* ---------------- 検索履歴 ---------------- */

async function addSearchHistory(clientId, queryText) {
  if (!isEnabled()) return;
  const trimmed = (queryText || "").trim();
  if (!trimmed) return;
  await query(
    `INSERT INTO search_history (client_id, query, searched_at)
     VALUES ($1, $2, now())
     ON CONFLICT (client_id, query)
     DO UPDATE SET searched_at = now()`,
    [clientId, trimmed]
  );

  await query(
    `DELETE FROM search_history
     WHERE client_id = $1
       AND id NOT IN (
         SELECT id FROM search_history
         WHERE client_id = $1
         ORDER BY searched_at DESC
         LIMIT $2
       )`,
    [clientId, SEARCH_HISTORY_LIMIT]
  );
}

async function getSearchHistory(clientId, limit = SEARCH_HISTORY_LIMIT) {
  if (!isEnabled()) return [];
  const result = await query(
    `SELECT query, searched_at AS "searchedAt"
     FROM search_history
     WHERE client_id = $1
     ORDER BY searched_at DESC
     LIMIT $2`,
    [clientId, limit]
  );
  return result.rows.map((r) => r.query);
}

async function clearSearchHistory(clientId) {
  if (!isEnabled()) return;
  await query(`DELETE FROM search_history WHERE client_id = $1`, [clientId]);
}

async function deleteSearchHistoryItem(clientId, queryText) {
  if (!isEnabled()) return;
  await query(
    `DELETE FROM search_history WHERE client_id = $1 AND query = $2`,
    [clientId, queryText]
  );
}

module.exports = {
  addWatchHistory,
  getWatchHistory,
  clearWatchHistory,
  deleteWatchHistoryItem,
  addSearchHistory,
  getSearchHistory,
  clearSearchHistory,
  deleteSearchHistoryItem,
};
