// node build.mjs  ->  membuat data.js dari data.json dan memperbarui ducking musik di index.html
import { readFileSync, writeFileSync } from "node:fs";
const d = JSON.parse(readFileSync("data.json", "utf8"));
writeFileSync("data.js", "window.RAKERNAS_DATA = " + JSON.stringify(d, null, 2) + ";\n");

const { high, low, ramp } = d.vo.duck;
const pts = [{ t: 0, v: high }];
for (const s of d.vo.slots) {
  pts.push({ t: +(s.start - ramp).toFixed(2), v: high }, { t: s.start, v: low });
  pts.push({ t: +(s.start + s.dur).toFixed(2), v: low }, { t: +(s.start + s.dur + ramp).toFixed(2), v: high });
}
const attr = JSON.stringify({ version: 1, lanes: [{ target: "volume", points: pts }] }).replace(/"/g, "&quot;");
let html = readFileSync("index.html", "utf8");
html = html.replace(/(<audio id="bgm"[^>]*?data-automation=")[^"]*(")/s, `$1${attr}$2`);
writeFileSync("index.html", html);
console.log("data.js ditulis; ducking:", pts.length, "titik");
