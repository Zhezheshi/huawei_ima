import React from 'react';
import {AbsoluteFill,Sequence,Audio,staticFile,useCurrentFrame,interpolate} from 'remotion';
import narration from './narration.json';
import captions from './captions.json';
import {SCENES,C,FONT} from './Scenes';

export const TOTAL=2700;
export const MIX_GAIN=2;
// Measured 2026-10-22: Remotion 4.0.484 / AAC 48kHz / MP4, three voice probes: +1.27f.
export const OUTPUT_AUDIO_OFFSET_F=1.27;
export const voiceFrom=(from:number)=>Math.max(0,Math.round(from-OUTPUT_AUDIO_OFFSET_F));
const PEAK_F:Record<string,number>={'audio/soft.mp3':13.595,'audio/sweep.mp3':10.0938,'audio/impact.mp3':18.9737,'audio/shimmer.mp3':27.8925,'audio/click.mp3':15.3663};
const sfxFrom=(target:number,src:string)=>Math.max(0,Math.round(target-(PEAK_F[src]||0)-OUTPUT_AUDIO_OFFSET_F));
export const SHOTS=narration.map((s,i)=>({...s,component:SCENES[i],label:['品牌','创作难题','创作简报','营销策略','证据检索','图文创作','平台适配','独立审核','对话修改','交付导出','场景覆盖','品牌收尾'][i]}));
export type CaptionData={from:number;duration:number;text:string;src:string;shot:string};
export const CAPTIONS:CaptionData[]=captions;
export const Caption:React.FC<{text?:string;duration?:number;fontSize?:number;color?:string}>=({text='',duration=90,fontSize=64,color=C.ink})=>{const f=useCurrentFrame();return <AbsoluteFill style={{justifyContent:'flex-end',alignItems:'center',paddingBottom:37,fontFamily:FONT,pointerEvents:'none'}}><div style={{position:'absolute',bottom:0,left:0,right:0,height:144,background:'linear-gradient(0deg,#f6f5f4 70%,#f6f5f400)'}}/><div style={{position:'relative',fontSize,fontWeight:500,color,lineHeight:1.5,whiteSpace:'nowrap',padding:'7px 25px',borderRadius:14,background:'#f6f5f4f5',opacity:interpolate(f,[0,3],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}>{text}</div></AbsoluteFill>};
export const SFX=[
 {from:sfxFrom(SHOTS[0].from+26,'audio/soft.mp3'),src:'audio/soft.mp3',volume:.15,duration:39},
 {from:sfxFrom(SHOTS[1].from+10,'audio/sweep.mp3'),src:'audio/sweep.mp3',volume:.12,duration:25},
 {from:sfxFrom(SHOTS[2].from+24,'audio/soft.mp3'),src:'audio/soft.mp3',volume:.14,duration:39},
 {from:sfxFrom(SHOTS[4].from+24,'audio/sweep.mp3'),src:'audio/sweep.mp3',volume:.12,duration:25},
 {from:sfxFrom(SHOTS[6].from+44,'audio/soft.mp3'),src:'audio/soft.mp3',volume:.13,duration:39},
 {from:sfxFrom(SHOTS[7].from+44,'audio/sweep.mp3'),src:'audio/sweep.mp3',volume:.13,duration:25},
 {from:sfxFrom(SHOTS[8].from+88,'audio/click.mp3'),src:'audio/click.mp3',volume:.17,duration:33},
 {from:sfxFrom(SHOTS[8].from+150,'audio/click.mp3'),src:'audio/click.mp3',volume:.13,duration:33},
 {from:sfxFrom(SHOTS[9].from+44,'audio/soft.mp3'),src:'audio/soft.mp3',volume:.14,duration:39},
 {from:SHOTS[11].from+4,src:'audio/riser.wav',volume:.20,duration:42},
 {from:sfxFrom(SHOTS[11].from+42,'audio/impact.mp3'),src:'audio/impact.mp3',volume:.24,duration:123},
 {from:sfxFrom(SHOTS[11].from+70,'audio/shimmer.mp3'),src:'audio/shimmer.mp3',volume:.14,duration:100},
];
export const Transitions:React.FC<{duration?:number}>=({duration=12})=>{const f=useCurrentFrame();const t=interpolate(f,[0,duration],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});return <AbsoluteFill style={{background:C.bg,opacity:(1-t)*.75,pointerEvents:'none'}}/>};
export const Main:React.FC<{bgm?:boolean}>=({bgm=true})=><AbsoluteFill style={{background:C.bg}}>
 {SHOTS.map((s,i)=><Sequence key={s.id} from={s.from} durationInFrames={s.duration}><s.component duration={s.duration}/></Sequence>)}
 {SHOTS.slice(1,-1).map(s=><Sequence key={'t'+s.id} from={s.from} durationInFrames={10}><Transitions duration={10}/></Sequence>)}
 {CAPTIONS.map((c,i)=><React.Fragment key={i}><Sequence from={c.from} durationInFrames={c.duration}><Caption text={c.text} duration={c.duration}/></Sequence><Sequence from={voiceFrom(c.from)} durationInFrames={c.duration}><Audio src={staticFile(c.src)} volume={MIX_GAIN}/></Sequence></React.Fragment>)}
 {SFX.map((s,i)=><Sequence key={'s'+i} from={s.from} durationInFrames={s.duration}><Audio src={staticFile(s.src)} volume={s.volume*MIX_GAIN}/></Sequence>)}
 {bgm&&<Audio src={staticFile('audio/bgm.wav')} volume={f=>MIX_GAIN*interpolate(f,[0,60,2490,2650,2699],[0,.105,.105,.14,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}/>}
 </AbsoluteFill>;
