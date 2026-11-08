const { chromium } = require('playwright'); const path=require('path'); const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
await p.goto('file://'+path.join(__dirname,'index.html')+'?cut=0');await p.waitForFunction('window.__ready');await p.evaluate('document.fonts.ready');
const m=await p.evaluate('window.__meta');const dir=process.argv[2];fs.mkdirSync(dir,{recursive:true});
for(const s of m.scenes){const t=s.start+s.dur*(s.id==='s9'?0.9:s.id==='s1'?0.95:0.88);await p.evaluate(t=>window.seek(t),t);await p.screenshot({path:path.join(dir,s.id+'.png')});}
await b.close();})();
