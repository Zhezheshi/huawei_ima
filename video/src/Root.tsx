import React from 'react';
import {Composition} from 'remotion';
import {Main} from './Main';
export const Root:React.FC=()=> <Composition id="YingxiaoPromo" component={Main} width={1920} height={1080} fps={30} durationInFrames={2700} defaultProps={{bgm:true}}/>;
