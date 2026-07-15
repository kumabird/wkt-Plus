"use strict";
const crypto = require("crypto");
const { query, isEnabled } = require("./pool.js");

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24時間

function generateToken() {
  // URLセーフな短いトークン (12byte -> 16文字程度のbase64url)
  return crypto.randomBytes(9).toString("base64url");
}

/**
 * kind: 'search' | 'watch'
 * payload: { q } または { videoId }
 * 戻り値: token文字列
 */
async function createToken(kind, payload) {
  if (!isEnabled()) {
    throw new Error("DB無効のためトークンを発行できません");
  }
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await query(
    `INSERT INTO nav_tokens (token, kind, payload, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [token, kind, payload, expiresAt]
  );
  return token;
}

/**
 * トークンから元のpayloadを取得する。期限切れ/存在しない場合はnull。
 */
async function resolveToken(kind, token) {
  if (!isEnabled()) {
    return null;
  }
  if (!token || typeof token !== "string" || token.length > 64) {
    return null;
  }
  const result = await query(
    `SELECT payload, expires_at FROM nav_tokens WHERE token = $1 AND kind = $2`,
    [token, kind]
  );
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0];
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return null;
  }
  return row.payload;
}

/**
 * 期限切れトークンの掃除。定期実行想定。
 */
async function cleanupExpiredTokens() {
  if (!isEnabled()) {
    return;
  }
  try {
    await query(`DELETE FROM nav_tokens WHERE expires_at < now()`);
  } catch (err) {
    console.error("[db] トークン掃除に失敗:", err.message);
  }
}

module.exports = {
  createToken,
  resolveToken,
  cleanupExpiredTokens,
};
