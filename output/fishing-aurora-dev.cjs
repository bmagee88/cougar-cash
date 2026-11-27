// CRA 5 passes an undefined LAN host when bound to loopback. Keep host checks
// enabled and supply localhost while serving this preview only on 127.0.0.1.
const configPath = require.resolve('react-scripts/config/webpackDevServer.config');
const makeConfig = require(configPath);
require.cache[configPath].exports = (proxy, host) => makeConfig(proxy, host || 'localhost');
require('react-scripts/scripts/start');
