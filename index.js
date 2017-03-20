#!/usr/local/bin/node
const fs = require('fs');
const path = require('path');
const httpProxy = require('http-proxy');
const yaml = require('js-yaml');

let targetPort = false;
let listenAddress = false;

if (process.argv.length === 2) {
  console.log('\nNo args. Loading settings file.');
  if (!fs.existsSync('./settings.yaml')) {
    console.error("Can't open ./settings.yaml\n");
    process.exit(1);
  }
  const settings = yaml.safeLoad(fs.readFileSync('settings.yaml'));
  targetPort = parseInt(settings.targetPort);
  listenAddress = settings.listenAddress;
} else {
  if (process.argv.length < 4) {
    console.error(`\nUsage: ${path.relative(__dirname, __filename)} <listen on> <target port>\n`)
    process.exit(1);
  } else {
    listenAddress = process.argv[2] || "";

    const portRaw = process.argv[3] || "";
    targetPort = parseInt(portRaw);
  }
}

if (!!!listenAddress) {
  console.error(`Invalid listen address "${listenAddress}"`);
  process.exit();
}

if (!!!targetPort) {
  console.error(`Invalid port "${targetPort}"`);
  process.exit();
}

const opts = {target:`http://localhost:${targetPort}`};

const p = httpProxy
  .createProxyServer(opts)
  .on('error', (err, req, res) => {
    switch (err.code) {
      case 'ECONNREFUSED':
        // treat connection refused as if the target endpoint isn't alive/responding
        res.writeHead(502, {'Content-Type': 'text/plain'});
        res.end('Proxy error. Application is unavailable.');
        console.error('Proxy error. Application is unavailable.', err);
        break;

      case 'ECONNRESET':
        // connection reset happens when the request is received,
        // but won't be finished (client closed, target unavailable).
        // treat as non error.
        res.writeHead(500, {'Content-Type': 'text/plain'});
        res.end('Connection reset');
        console.log('Connection reset', err);
        break;

      default:
        console.error(err);
        this.close();
        process.exit();
    }
  })
  .listen(listenAddress);

console.log(`\nReverse Proxy started:\n"${opts.target}" -> "${listenAddress}"\n`);

const handleSignal = () => {
  p.close();
  process.exit();
};
process.on('SIGINT', handleSignal);
process.on('SIGTERM', handleSignal);
