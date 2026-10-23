import {SHOTS,CAPTIONS,SFX,Caption,Transitions,Main,TOTAL,MIX_GAIN,voiceFrom} from './Main';
import {C} from './Scenes';
export const WORKBENCH={
 name:'映销 · 90秒复赛宣传片',fps:30,width:1920,height:1080,total:TOTAL,background:C.bg,revision:'20261022-final',
 shots:SHOTS.map(s=>({id:s.id,label:s.label,from:s.from,duration:s.duration,component:s.component,props:{duration:s.duration},durationProp:'duration'})),
 transitions:SHOTS.slice(1,-1).map(s=>({id:'t-'+s.id,label:'柔和换章',from:s.from,duration:10,component:Transitions,props:{duration:10},durationProp:'duration'})),
 captions:CAPTIONS.map((c,i)=>({id:'caption-'+i,label:c.text,from:c.from,duration:c.duration,component:Caption,props:{text:c.text,duration:c.duration,fontSize:64,color:C.ink},durationProp:'duration',cardId:'caption',schema:[{type:'textarea',key:'text',label:'字幕',default:c.text},{type:'number',key:'fontSize',label:'字号',default:64,min:56,max:90},{type:'color',key:'color',label:'颜色',default:C.ink}]})),
 sfx:[...CAPTIONS.map(c=>({from:voiceFrom(c.from),duration:c.duration,src:c.src,volume:MIX_GAIN,label:'中文旁白'})),...SFX.map(s=>({...s,volume:s.volume*MIX_GAIN}))],
 bgm:[{from:0,duration:TOTAL,src:'audio/bgm-workbench.wav',volume:MIX_GAIN}],
 order:['transitions','captions','overlays'],original:Main,
};
