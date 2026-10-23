const {bundle}=require('@remotion/bundler');
const {selectComposition,renderStill,openBrowser}=require('@remotion/renderer');
const path=require('node:path');
const fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const frames=process.argv.slice(2).map(Number);
(async()=>{
 const url=await bundle({entryPoint:path.join(root,'src/index.ts')});
 const browser=await openBrowser('chrome',{browserExecutable:require('./browser.cjs').findChrome(),chromiumOptions:{gl:'angle'}});
 const inputProps={bgm:true};
 const comp=await selectComposition({serveUrl:url,id:'YingxiaoPromo',inputProps,puppeteerInstance:browser});
 for(const frame of frames){await renderStill({serveUrl:url,composition:comp,frame,output:path.join(root,`out/qa/f${frame}.png`),inputProps,puppeteerInstance:browser,chromiumOptions:{gl:'angle'}});console.log('still',frame);}
 await browser.close({silent:true});
})().catch(e=>{console.error(e);process.exit(1)});
