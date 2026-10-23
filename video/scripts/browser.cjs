const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
exports.findChrome=()=>{
 if(process.env.CHROME_PATH&&fs.existsSync(process.env.CHROME_PATH))return process.env.CHROME_PATH;
 const base=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData/Local'),'ms-playwright');
 if(fs.existsSync(base)){const dirs=fs.readdirSync(base).filter(x=>x.startsWith('chromium_headless_shell-')).sort((a,b)=>Number(b.split('-').pop())-Number(a.split('-').pop()));for(const d of dirs){const p=path.join(base,d,'chrome-headless-shell-win64/chrome-headless-shell.exe');if(fs.existsSync(p))return p;}}
 for(const p of ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'])if(fs.existsSync(p))return p;
 return undefined;
};
