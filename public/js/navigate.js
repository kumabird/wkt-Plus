/**
 * 動画ID・検索語をURLに直接出さずに遷移するための共通スクリプト。
 *
 * 使い方(動画リンク):
 *   <a href="/wkt/watch/VIDEOID" class="wkt-watch-link" data-video-id="VIDEOID">...</a>
 * のように data-video-id 属性を持つ要素に対して、クリック時にPOSTでトークンを
 * 発行し、/wkt/watch/t/<token> へ遷移する。data-video-idが無い場合やAPIが
 * 失敗した場合は、通常のhref遷移にフォールバックする。
 *
 * JS側で動的に動画リンクへ遷移したい場合は wktNavigateToVideo(videoId) を呼ぶ。
 */
(function () {
  "use strict";

  async function wktNavigateToVideo(videoId, newTab, extra) {
    if (!videoId) return;
    extra = extra || {};
    try {
      const res = await fetch("/wkt/watch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: videoId,
          list: extra.list,
          server: extra.server,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        let url;
        if (data.token) {
          url = "/wkt/watch/t/" + encodeURIComponent(data.token);
        } else {
          url = "/wkt/watch/" + encodeURIComponent(videoId);
          const qs = new URLSearchParams();
          if (extra.list) qs.set("list", extra.list);
          if (extra.server) qs.set("server", extra.server);
          const qsStr = qs.toString();
          if (qsStr) url += "?" + qsStr;
        }
        if (newTab) {
          window.open(url, "_blank");
        } else {
          window.location.href = url;
        }
        return;
      }
    } catch (e) {
      console.error("動画への遷移トークン発行に失敗しました:", e);
    }
    // フォールバック: 従来通りのURLへ
    let fallbackUrl = "/wkt/watch/" + encodeURIComponent(videoId);
    const qs = new URLSearchParams();
    if (extra.list) qs.set("list", extra.list);
    if (extra.server) qs.set("server", extra.server);
    const qsStr = qs.toString();
    if (qsStr) fallbackUrl += "?" + qsStr;
    if (newTab) {
      window.open(fallbackUrl, "_blank");
    } else {
      window.location.href = fallbackUrl;
    }
  }

  function handleClick(e) {
    const el = e.target.closest(".wkt-watch-link");
    if (!el) return;
    const videoId = el.getAttribute("data-video-id");
    if (!videoId) return;
    e.preventDefault();
    const newTab = e.ctrlKey || e.metaKey || e.button === 1;
    wktNavigateToVideo(videoId, newTab, {
      list: el.getAttribute("data-list") || undefined,
      server: el.getAttribute("data-server") || undefined,
    });
  }

  document.addEventListener("click", handleClick);

  // グローバル公開(JS側から動的に生成したリンクの遷移にも使えるように)
  window.wktNavigateToVideo = wktNavigateToVideo;
})();
