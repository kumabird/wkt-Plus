$(function () {
    $('#searchbox').autocomplete({
        source: function (request, response) {
            let searchTerm = request.term.trim();
            if (searchTerm.length > 0) {
                $.ajax({
                    url: '/wkt/back/suggest',
                    data: { keyword: searchTerm },
                    success: function (data) {
                        if (data.length > 0) {
                            response(data);
                        } else {
                            getSearchHistory(function (history) {
                                response(history);
                            });
                        }
                    },
                    error: function () {
                        getSearchHistory(function (history) {
                            response(history);
                        });
                    }
                });
            } else {
                getSearchHistory(function (history) {
                    response(history);
                });
            }
        },
        delay: 1,
        minLength: 0,
        select: function (event, ui) {
            $('#searchbox').val(ui.item.value);
            $('#searchForm').submit();
        }
    });

    // 検索履歴はサーバー側のNeon DBから取得する。
    function getSearchHistory(callback) {
        $.ajax({
            url: '/wkt/api/history/search',
            method: 'GET',
            dataType: 'json',
            success: function (data) {
                callback((data && data.items) || []);
            },
            error: function () {
                callback([]);
            }
        });
    }

    $('#searchbox').on('focus', function () {
        const q = document.getElementById('searchbox').value;
        if(q){
          $(this).autocomplete('search', q);
        }else{
          $(this).autocomplete('search', '');
        }
    });
});
