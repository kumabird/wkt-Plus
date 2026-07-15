"use strict";
const crypto = require("crypto");

const COOKIE_NAME = "wkt_client_id";
const COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000; // 約400日 (Chromeのcookie上限に合わせる)

/**
 * 各ブラウザを識別するための匿名クライアントIDをcookieで発行するミドルウェア。
 * ログイン機能を持たないため、履歴の紐付けはこのcookieベースで行う。
 */
function clientIdMiddleware(req, res, next) {
  let clientId = req.cookies ? req.cookies[COOKIE_NAME] : null;
  if (!clientId) {
    clientId = crypto.randomUUID();
    res.cookie(COOKIE_NAME, clientId, {
      maxAge: COOKIE_MAX_AGE_MS,
      httpOnly: true,
      sameSite: "lax",
    });
  }
  req.clientId = clientId;
  next();
}

module.exports = { clientIdMiddleware, COOKIE_NAME };
