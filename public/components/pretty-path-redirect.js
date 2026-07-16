(function () {
  var path = window.location.pathname;
  var search = window.location.search;
  var hash = window.location.hash;
  var moved = false;

  if (path.indexOf('/pages/') === 0) {
    path = path.slice('/pages'.length);
    moved = true;
  }
  if (path.indexOf('/minigames-emporium/') === 0) {
    path = '/mini-games-emporium/' + path.slice('/minigames-emporium/'.length);
    moved = true;
  }
  if (path.indexOf('/mini-games-emporium/games/') === 0) {
    path = '/mini-games-emporium/' + path.slice('/mini-games-emporium/games/'.length);
    moved = true;
  }

  var prettyPrefixes = ['/chocobo-racing/race/', '/mini-games-emporium/drt/bracket/'];
  for (var i = 0; i < prettyPrefixes.length; i++) {
    var prefix = prettyPrefixes[i];
    if (path.indexOf(prefix) === 0 && path.length > prefix.length) {
      var id = path.slice(prefix.length).replace(/\/+$/, '');
      if (id) {
        window.location.replace(prefix + '?s=' + encodeURIComponent(id) + hash);
        return;
      }
    }
  }

  if (moved) {
    window.location.replace(path + search + hash);
  }
})();
