/**
 * ページタイトルを常に「wkt」に固定するためのスクリプト。
 * 動画再生時などにJS側でdocument.titleが書き換えられるケースに備えて、
 * MutationObserverでtitle要素の変更を監視し、"wkt"以外になったら
 * 即座に上書きする。
 */
(function () {
  "use strict";

  var FIXED_TITLE = "wkt";

  function enforceTitle() {
    if (document.title !== FIXED_TITLE) {
      document.title = FIXED_TITLE;
    }
  }

  // 初回実行
  enforceTitle();

  // <title> 要素のテキスト変更を監視
  var titleEl = document.querySelector("title");
  if (titleEl && window.MutationObserver) {
    var observer = new MutationObserver(enforceTitle);
    observer.observe(titleEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  // document.title への直接代入もカバーするため、
  // 念のため一定間隔でもチェックする（保険的措置）
  setInterval(enforceTitle, 1000);
})();
