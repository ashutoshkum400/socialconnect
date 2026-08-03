(function () {
  var RENDER_BACKEND = 'https://socialconnect-g0it.onrender.com';
  var RENDER_HOST = 'socialconnect-g0it.onrender.com';
  var CUSTOM_DOMAINS = ['biko.work.gd', 'www.biko.work.gd'];
  var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  var isSameOriginAsBackend = isLocal ||
    location.hostname === RENDER_HOST ||
    CUSTOM_DOMAINS.includes(location.hostname);

  if (isSameOriginAsBackend) {
    window.API_BASE = '';
    window.SOCKET_URL = undefined;
  } else {
    window.API_BASE = RENDER_BACKEND;
    window.SOCKET_URL = RENDER_BACKEND;
  }

  window.SOCKET_IO_VERSION = '4.6.1';
})();
