// node fit-music.mjs  -> menyesuaikan assets/music/source/bgm-api-original.mp3 ke timeline (data.json) -> assets/music/bgm-main.mp3
import { readFileSync, mkdirSync, existsSync, copyFileSync, writeFileSync } from "node:fs";
import { fitMusic } from "./lib/fitmusic.mjs";
const d = JSON.parse(readFileSync("data.json", "utf8"));
mkdirSync("assets/music/source", { recursive: true });
const src = "assets/music/source/bgm-api-original.mp3";
if (!existsSync(src)) copyFileSync("assets/music/bgm-main.mp3", src);   // simpan trek asli API sebelum diubah
const s7 = d.timing.scenes.find((x) => x.id === "s7");
const r = fitMusic({ src, out: "assets/music/bgm-main.fit.mp3", total: d.timing.total, dropTarget: s7.end - 1, bpmHint: d.elevenlabs.music.bpm || 95, xfade: Math.max(3, d.elevenlabs.music.crossfade || 4) });
copyFileSync("assets/music/bgm-main.fit.mp3", "assets/music/bgm-main.mp3");
d.audio.musicDur = { ...(d.audio.musicDur || {}), "bgm-main": +r.dur.toFixed(2) };
d.audio.musicFit = { loopSec: +r.loop.toFixed(2), bpm: +r.bpm.toFixed(2), originalDropSec: r.drop };
writeFileSync("data.json", JSON.stringify(d, null, 2) + "\n");
console.log("bgm-main.mp3:", r.dur.toFixed(1), "dtk");
