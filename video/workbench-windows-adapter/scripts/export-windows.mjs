// Local Windows adapter: dereference directory junctions and render without rsync or shell wrappers.
import {bundle} from '@remotion/bundler';
import {renderMedia,selectComposition} from '@remotion/renderer';
import {cpSync,readdirSync,mkdirSync,realpathSync,readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [propsFile,output]=process.argv.slice(2);
const publicDir=path.join(root,'.render-public');mkdirSync(publicDir,{recursive:true});
for(const name of readdirSync(path.join(root,'public'))){if(name==='cardpreviews')continue;cpSync(realpathSync(path.join(root,'public',name)),path.join(publicDir,name),{recursive:true,dereference:true,force:true});}
const serveUrl=await bundle({entryPoint:path.join(root,'src/remotion/index.ts'),publicDir,webpackOverride:c=>({...c,resolve:{...c.resolve,symlinks:false,alias:{...(c.resolve?.alias||{}),'@proj':path.join(root,'proj'),'@demos':path.join(root,'demosrc')}}})});
let browserExecutable=process.env.CHROME_PATH;
const base=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData/Local'),'ms-playwright');
if(!browserExecutable&&existsSync(base)){for(const d of readdirSync(base).filter(x=>x.startsWith('chromium_headless_shell-')).sort().reverse()){const p=path.join(base,d,'chrome-headless-shell-win64/chrome-headless-shell.exe');if(existsSync(p)){browserExecutable=p;break;}}}
const inputProps=JSON.parse(readFileSync(propsFile,'utf8'));
const composition=await selectComposition({serveUrl,id:'Main',inputProps,browserExecutable});
let prior=-1;
await renderMedia({serveUrl,composition,inputProps,browserExecutable,outputLocation:path.resolve(root,output),codec:'h264',crf:18,concurrency:3,chromiumOptions:{gl:'angle'},onProgress:({renderedFrames})=>{const q=Math.floor(renderedFrames/90);if(q!==prior){prior=q;console.log(`Rendered ${renderedFrames}/${composition.durationInFrames}`);}}});
console.log('DONE');
