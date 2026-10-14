/** No-op copy build: www/ is the source of truth (also Capacitor webDir + Pages). */
const fs = require('fs');
const path = require('path');
const www = path.join(__dirname, '..', 'www');
if (!fs.existsSync(www)) fs.mkdirSync(www, { recursive: true });
const files = fs.readdirSync(www).filter((f) => fs.statSync(path.join(www, f)).isFile() || true);
console.log(`hashi-bridges build ok: www ready (${files.length} top-level entries)`);
