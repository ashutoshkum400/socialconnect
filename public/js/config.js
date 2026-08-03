(function () {
  var RENDER_BACKEND = 'https://socialconnect-g0it.onrender.com';
  var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  window.API_BASE = isLocal ? '' : RENDER_BACKEND;

  window.SOCKET_URL = isLocal ? undefined : RENDER_BACKEND;

  window.SOCKET_IO_VERSION = '4.6.1';
})();
