import {PROPS} from './catalog.js';
export const STATUS_NAMES=Object.freeze({echo:'回响',mirror:'镜像',silenced:'沉默',skip:'跳过',seven:'七伤',dark:'玄冥',foam:'盾墙',knuckles:'指虎',peace:'和平',weak:'虚弱',poison:'中毒',wine:'酒',adrenaline:'肾上腺素',resilience:'坚韧',nine:'九印'});
export function stateChanges(old,next) {
 const changes=[];
 for(const owner of [0,1]) {
  const a=old.players[owner],b=next.players[owner];
  for(const hand of [0,1]) {
   if(a.hands[hand]!==b.hands[hand])changes.push({owner,hand,kind:'number',label:`${a.hands[hand]} → ${b.hands[hand]}`});
   if(a.locks[hand]!==b.locks[hand])changes.push({owner,hand,kind:'lock',label:b.locks[hand]?'封印':'解除封印'});
  }
  for(const [key,name] of Object.entries(STATUS_NAMES))if(a[key]!==b[key]){
   const from=typeof a[key]==='boolean'?(a[key]?'生效':'无'):a[key],to=typeof b[key]==='boolean'?(b[key]?'生效':'解除'):b[key];
   changes.push({owner,key,kind:'status',label:`${name} ${from} → ${to}`});
  }
  const remaining=[...b.props];
  for(const id of a.props){const i=remaining.indexOf(id);if(i>=0)remaining.splice(i,1);else changes.push({owner,id,kind:'inventory',label:`− ${PROPS[id].name}`});}
  for(const id of remaining)changes.push({owner,id,kind:'inventory',label:`＋ ${PROPS[id].name}`});
 }
 return changes;
}
