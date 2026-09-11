import { applyCommand, legalCommands } from "./engine.js";
import { WEAPONS, weaponById, matchingWeapons } from "./catalog.js";

function skillValue(w,p) {
  return ({drunken:37.5,claw:10,seven:35,dark:30,foam:15,knuckles:22,peace:12,serpent:25,steal:10,unify:p.nine?200:35,dual:20,sorrow:99-p.hp,buddha:40,taser:28})[w.id] ?? w.damage;
}
function potential(p) {
  const distance = Math.min(
    ...WEAPONS.map(w => Math.min(...[w.recipe, [...w.recipe].reverse()].map(recipe => p.hands.reduce((sum,n,i) => sum + Math.min((recipe[i]-n+10)%10,(n-recipe[i]+10)%10),0)))) ,
  );
  return (
    matchingWeapons(p.hands).reduce((best,w) => Math.max(best,skillValue(w,p) + 16),0) +
    (p.weapon ? skillValue(weaponById(p.weapon),p) * 2 + 12 : 0) -
    distance * 1.8 +
    (p.hands.includes(5) ? 3 : 0)
  );
}
function score(s, actor) {
  if (s.winner !== null) return s.winner === actor ? 10000 : -10000;
  const p = s.players[actor],
    e = s.players[1 - actor];
  return (
    (p.hp - e.hp) * 5 +
    potential(p) -
    potential(e) * 0.9 +
    (p.props.length - e.props.length) * 2 +
    (p.nine-e.nine)*100+(p.foam-e.foam)*7+(Number(p.knuckles)-Number(e.knuckles))*35+(e.skip-p.skip)*12+(e.seven-p.seven)*5+(Number(e.dark)-Number(p.dark))*40+
    (p.resilience-e.resilience)*8+(p.wine-e.wine)*12+(p.adrenaline-e.adrenaline)*14+(p.peace-e.peace)*8+(e.weak-p.weak)*6+(e.poison-p.poison)*2+(p.echo?7:0)+(p.mirror?3:0)-(p.silenced?6:0)+(e.silenced?6:0)
  );
}

export const AI_LEVELS = Object.freeze({easy:'简单',advanced:'进阶',master:'大师'});
const key = c => JSON.stringify([c.type,c.slot,c.target,c.targetHand,c.hand,c.weapon]);
// Simulation uses hypothetical random streams, never the live deck/RNG.
function simulate(s,c) {
 let next=applyCommand(s,c);
 if(next.winner===null && next.players[next.active].weapon)
  next=applyCommand(next,{type:'attack',actor:next.active,revision:next.revision});
 return next;
}
function moves(s) {
 const legal=legalCommands(s);
 return legal.filter(c=>c.type!=='prop'||s.players[s.active].props[c.slot]!=='lock'||c.target!==s.active);
}
function ranked(s,actor) {
 return moves(s).map(c=>{const next=simulate(s,c);return {c,next,value:score(next,actor)-(c.type==='end'&&!s.calculated?2:0)};}).sort((a,b)=>b.value-a.value);
}
function responseValue(s,actor) {
 let next=s;
 for(let step=0;step<6&&next.winner===null&&next.active!==actor;step++) {
  const best=ranked(next,next.active)[0];if(!best)break;next=best.next;
 }
 return score(next,actor);
}
function searchTurn(first,actor) {
 let frontier=[first],finished=[];
 for(let depth=0;depth<4;depth++) {
  const expanded=[];
  for(const node of frontier) {
   if(node.next.winner!==null||node.next.active!==actor){finished.push(node);continue;}
   for(const n of ranked(node.next,actor).slice(0,5))expanded.push(n);
  }
  if(!expanded.length){frontier=[];break;}
  const seen=new Set();frontier=expanded.sort((a,b)=>b.value-a.value).filter(n=>{
   const k=JSON.stringify([n.next.active,n.next.calculated,n.next.players]);if(seen.has(k))return false;seen.add(k);return true;
  }).slice(0,4);
 }
 for(const node of frontier) {
  let next=node.next;
  if(next.winner===null&&next.active===actor&&next.phase==='action')next=simulate(next,{type:'end',actor,revision:next.revision});
  finished.push({...node,next,value:score(next,actor)});
 }
 return Math.max(...finished.sort((a,b)=>b.value-a.value).slice(0,3).map(n=>responseValue(n.next,actor)));
}
export function chooseCommand(state,difficulty='advanced') {
 if(!AI_LEVELS[difficulty])difficulty='advanced';
 const s=structuredClone(state);s.rng=(Math.imul(s.revision+1,2654435761)^0x6a09e667)>>>0;
 const actor=s.active,legal=moves(s);if(!legal.length)return;
 if(legal.length===1)return legal[0];
 if(difficulty==='easy') {
  // Beginner makes simple local choices and frequently misses combinations.
  const turn=(s.turn*13+s.revision*7)>>>0;
  const pool=legal.filter(c=>c.type==='add'||c.type==='end'||(c.type==='forge'&&turn%4===0)||(c.type==='prop'&&turn%3===0));
  return (pool.length?pool:legal)[turn%(pool.length||legal.length)];
 }
 const options=ranked(s,actor);
 if(difficulty==='advanced') {
  // A short tactical continuation understands item -> combination and lethal skills.
  return options.map(n=>({c:n.c,value:n.next.winner!==null?score(n.next,actor):n.next.active===actor?Math.max(n.value,...ranked(n.next,actor).map(r=>r.value)) : n.value}))
   .sort((a,b)=>b.value-a.value)[0]?.c;
 }
 const roots=options.slice(0,8), totals=new Map(roots.map(n=>[key(n.c),0]));
 for(let sample=0;sample<2;sample++) {
  const scenario=structuredClone(s);scenario.rng=(0x9e3779b9+Math.imul(s.revision+1,2246822519)+sample*1013904223)>>>0;
  for(const root of roots) {
   const next=simulate(scenario,root.c);
   totals.set(key(root.c),totals.get(key(root.c))+searchTurn({c:root.c,next,value:score(next,actor)},actor));
  }
 }
 roots.sort((a,b)=>totals.get(key(b.c))-totals.get(key(a.c))||b.value-a.value);
 return roots[0]?.c;
}
