"use strict";
const fs = require("fs");
const path = require("path");
const { pool, isEnabled } = require("./pool.js");

/**
 * 起動時に一度だけ呼び出し、テーブルが無ければ作成する。
 * DATABASE_URLが未設定の場合は何もせず解決する。
 */
async function initDb() {
  if (!isEnabled()) {
    return;
  }
  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  try {
    await pool.query(schemaSql);
    console.log("[db] スキーマ初期化が完了しました (Neon)");
  } catch (err) {
    console.error("[db] スキーマ初期化に失敗しました:", err.message);
  }
}

module.exports = { initDb };
