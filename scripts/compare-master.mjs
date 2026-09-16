import {createGame,applyCommand,legalCommands} from '../src/engine.js';
import * as searchCandidate from '../experiments/ai-master-candidate.js';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const baselineRevision='5365951';
mkdirSync(new URL('../test-results/',import.meta.url),{recursive:true});
const baselineUrl=new URL('../test-results/master-baseline.mjs',import.meta.url);
writeFileSync(baselineUrl,execFileSync('git',['show',`${baselineRevision}:src/ai-search.js`],{encoding:'utf8'}).replaceAll("'./engine.js'","'../src/engine.js'").replaceAll("'./catalog.js'","'../src/catalog.js'"));
const baseline=await import(baselineUrl.href);
const [start='2001',count='8',label='comparison',variant='search']=process.argv.slice(2),mode='items',itemsEnabled=true;
if(!/^\d+$/.test(start)||!/^\d+$/.test(count)||+count<1||+count>1000||!/^[a-z0-9-]+$/.test(label))throw Error('Usage: node scripts/compare-master.mjs <start seed> <seed count 1..1000> <label> [search|score]');
if(!['search','score'].includes(variant))throw Error('Variant must be search or score');
let candidate=searchCandidate;
if(variant==='score'){
 const source=readFileSync(baselineUrl,'utf8'),original="if(w.id==='unify')return p.nine?WIN/4:85;";
 if(!source.includes(original))throw Error('Baseline evaluation changed');
 const scoreUrl=new URL('../test-results/master-score-candidate.mjs',import.meta.url);
 writeFileSync(scoreUrl,source.replace(original,"if(w.id==='unify')return p.nine?(items?180:WIN/4):85;"));
 candidate=await import(scoreUrl.href);
}
const games=[],times={candidate:[],baseline:[]};
for(let seed=+start;seed<+start+(+count);seed++)for(let seat=0;seat<2;seat++){
 let s=createGame(seed*7919,{itemsEnabled,turnSeconds:30}),steps=0;
 while(s.winner===null&&steps<500){
  steps++;
  const kind=s.active===seat?'candidate':'baseline',ai=kind==='candidate'?candidate:baseline,legal=legalCommands(s),t=performance.now();
  const c=legal.length===1?legal[0]:itemsEnabled?ai.chooseMasterCommand(s):ai.chooseNoItemCommand(s,'master');
  times[kind].push(performance.now()-t);
  if(!c)throw Error('missing command');s=applyCommand(s,c);s.log=[];
 }
 const g={seed,seat,winner:s.winner,win:s.winner===seat,steps,turn:s.turn};games.push(g);console.log(JSON.stringify(g));
}
for(const k in times){times[k].sort((a,b)=>a-b);const a=times[k];times[k]={count:a.length,mean:a.reduce((x,y)=>x+y,0)/a.length,p95:a[Math.floor(a.length*.95)],max:a.at(-1),over2500:a.filter(x=>x>2500).length};}
const result={baselineRevision,variant,mode,games,wins:games.filter(g=>g.win).length,losses:games.filter(g=>g.winner!==null&&!g.win).length,draws:games.filter(g=>g.winner===null).length,times};writeFileSync(`test-results/master-${label}-${mode}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
