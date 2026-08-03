// Deploy diagnostic: check https://socialconnect-oh9q.onrender.com
const fs = require('fs');
const OUT = 'deploy-check.txt';

const results = [];
function log(...args) {
  results.push(args.join(' '));
  console.log(...args);
}

async function probe(url, redirects = 0) {
  try {
    log(`\n--- Probe ${url} (redirect count: ${redirects}) ---`);
    const res = await fetch(url, { redirect: 'manual', timeout: 60000 });
    log(`STATUS: ${res.status} ${res.statusText}`);
    log(`SERVER: ${res.headers.get('server')}`);
    const loc = res.headers.get('location');
    log(`LOCATION: ${loc || '(none)'}`);
    const cf = res.headers.get('cf-ray');
    log(`CF-RAY: ${cf || '(none)'}`);
    const contentType = res.headers.get('content-type');
    log(`CONTENT-TYPE: ${contentType || '(none)'}`);
    if (res.status >= 300 && res.status < 400 && loc) {
      if (redirects < 5) {
        const next = new URL(loc, url).toString();
        await probe(next, redirects + 1);
      } else {
        log('!!! REDIRECT LOOP DETECTED - too many redirects !!!');
      }
    } else {
      const text = await res.text();
      log(`BODY LENGTH: ${text.length}`);
      const title = (text.match(/<title>(.*?)<\/title>/) || [])[1];
      log(`TITLE: ${title || '(none)'}`);
      const sample = text.slice(0, 300).replace(/\s+/g, ' ');
      log(`BODY SAMPLE: ${sample}`);
    }
  } catch (err) {
    log(`ERROR: ${err.message}${err.cause ? ' | cause: ' + err.cause.code : ''}`);
  }
}

(async () => {
  await probe('https://socialconnect-oh9q.onrender.com');

  log('\n\n--- Also checking the custom domain if configured ---');
  await probe('https://www.biko.work.gd/');

  fs.writeFileSync(OUT, results.join('\n'), 'utf-8');
  log(`\n[DONE] Results written to ${OUT}`);
})();

