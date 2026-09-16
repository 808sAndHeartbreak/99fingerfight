import {createGame,applyCommand,legalCommands} from '../src/engine.js';
import {AI_LEVELS,chooseCommand} from '../src/ai.js';
import {writeFileSync,mkdirSync} from 'node:fs';
mkdirSync('test-results',{recursive:true});
const [lower,higher,start='401',count='8',mode='items']=process.argv.slice(2),itemsEnabled=mode==='items',games=[],times=[];
if(!AI_LEVELS[lower]||!AI_LEVELS[higher]||!['items','noitems'].includes(mode)||!Number.isInteger(+start)||!Number.isInteger(+count)||+count<1||+count>1000)throw Error('Usage: node scripts/compare-ai-levels.mjs lower higher start count [items|noitems]');
for(let seed=+start;seed<+start+(+count);seed++)for(let seat=0;seat<2;seat++){
 let s=createGame(seed*7919,{itemsEnabled}),steps=0;
 // Use legal, varied opening prefixes in deterministic no-item matches.
 if(!itemsEnabled){let rng=seed;for(let k=0;k<6+seed%8&&s.winner===null;k++){const legal=legalCommands(s).filter(c=>c.type!=='end'||s.calculated||s.acted);rng=(Math.imul(rng,1664525)+1013904223)>>>0;s=applyCommand(s,legal[rng%legal.length]);}}
 while(s.winner===null&&steps<400){const t=performance.now();const c=chooseCommand(s,s.active===seat?higher:lower);times.push(performance.now()-t);s=applyCommand(s,c);s.log=[];steps++;}
 const g={seed,seat,winner:s.winner,win:s.winner===seat,steps};games.push(g);console.log(JSON.stringify(g));
}
const out={lower,higher,mode,start:+start,count:+count,games,wins:games.filter(g=>g.win).length,losses:games.filter(g=>g.winner!==null&&!g.win).length,unresolved:games.filter(g=>g.winner===null).length,maxMs:times.reduce((a,b)=>Math.max(a,b),0)};writeFileSync(`test-results/four-${lower}-${higher}-${mode}.json`,JSON.stringify(out,null,2));console.log(JSON.stringify(out));
