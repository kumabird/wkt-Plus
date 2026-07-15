"use strict";
/**
 * Neon(PostgreSQL) への接続プールを提供するモジュール。
 *
 * 環境変数 DATABASE_URL (Neonの接続文字列) が必須です。
 * 例: postgresql://user:password@ep-xxxx.aws.neon.tech/dbname?sslmode=require
 *
 * DATABASE_URL が設定されていない場合、このモジュールを使う機能
 * (履歴保存・POSTトークン化)はすべて無効化され、エラーを出さずに
 * 従来通り動作するようフォールバックします(server.jsやroutesで判定)。
 */
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL || "";

let pool = null;

if (connectionString) {
  pool = new Pool({
    connectionString,
    // Neonは基本的にSSL必須。ローカルの自己証明書問題を避けるためrejectUnauthorized:falseにしておく。
    ssl: connectionString.includes("sslmode=disable")
      ? false
      : { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX || 5),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on("error", (err) => {
    // アイドル中のクライアントで起きた予期しないエラーはプロセスを落とさずログのみ
    console.error("[db] Unexpected error on idle client", err);
  });
} else {
  console.warn(
    "[db] DATABASE_URL が設定されていません。履歴/POSTトークン機能は無効化されます。"
  );
}

function isEnabled() {
  return pool !== null;
}

async function query(text, params) {
  if (!pool) {
    throw new Error("DATABASE_URL が設定されていないためDBを利用できません");
  }
  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
  isEnabled,
};
