// node build.mjs -> data.js dari data.json, sinkron slot <audio> VO, ducking musik, deteksi logo asli
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const d = JSON.parse(readFileSync("data.json", "utf8"));
d.meta.logoExists = existsSync(d.meta.logoFile);
writeFileSync("data.js", "window.RAKERNAS_DATA = " + JSON.stringify(d, null, 2) + ";\n");

let html = readFileSync("index.html", "utf8");
for (const s of d.vo.slots) {
  html = html.replace(new RegExp(`(<audio id="vo-${s.scene}"[^>]*?)data-start="[^"]*" data-duration="[^"]*"`), `$1data-start="${s.start}" data-duration="${s.dur}"`);
}
const { high, low, ramp } = d.vo.duck;
const pts = [{ t: 0, v: high }];
for (const s of d.vo.slots) {
  if (s.duck === false) continue;
  pts.push({ t: +(s.start - ramp).toFixed(2), v: high }, { t: s.start, v: low });
  pts.push({ t: +(s.start + s.dur).toFixed(2), v: low }, { t: +(s.start + s.dur + ramp).toFixed(2), v: high });
}
const attr = JSON.stringify({ version: 1, lanes: [{ target: "volume", points: pts }] }).replace(/"/g, "&quot;");
html = html.replace(/(<audio id="bgm"[^>]*?data-automation=")[^"]*(")/s, `$1${attr}$2`);
writeFileSync("index.html", html);
console.log("data.js ditulis; logo asli:", d.meta.logoExists, "; ducking:", pts.length, "titik");
