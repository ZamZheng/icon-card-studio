import {parseArgs} from 'node:util';
import {render} from '../src/render.mjs';
try{
  const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},logo:{type:'string'},portrait:{type:'string'},preview:{type:'boolean'},diagnostic:{type:'boolean'}}});
  const result=await render(values);console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
}catch(error){console.error(error.message);process.exitCode=1;}
