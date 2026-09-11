import {createGame,applyCommand} from '../src/engine.js';
import {chooseCommand} from '../src/ai.js';
const pairs=[['advanced','easy'],['master','advanced']];
for(const pair of pairs){let wins=[0,0],stalls=0,ms=0,calls=0;const start=Date.now();
 for(let seed=1;seed<=30;seed++)for(const swapped of [false,true]){
  const levels=swapped?[...pair].reverse():pair;let s=createGame(seed),steps=0;
  while(s.winner===null&&steps++<600){const t=Date.now();const c=chooseCommand(s,levels[s.active]);ms+=Date.now()-t;calls++;s=applyCommand(s,c);}
  if(s.winner===null)stalls++;else wins[swapped?1-s.winner:s.winner]++;
 }
 console.log(JSON.stringify({pair,wins,stalls,meanDecisionMs:ms/calls,elapsed:Date.now()-start}));
}
