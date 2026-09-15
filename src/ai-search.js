import {applyCommand, legalCommands} from './engine.js';
import {matchingWeapons} from './catalog.js';

// All forecasts use independent hypothetical draws. No live RNG is consulted.
const WIN=100000;
const itemValues={add:9,sub:10,double:9,civil:9,echo:23,mirror:9,lock:6,silence:8,wine:8,balance:4,greed:7,grace:5,ruin:9};
function attackValue(damage,enemy,trueDamage=false,hits=1) {
  if(enemy.peace)return 0;
  if(!trueDamage && enemy.hands.every(n=>n===5))return 0;
  let shields=enemy.hands.filter(n=>n===5).length,foam=enemy.foam,total=0;
  for(let i=0;i<hits;i++) {
    if(!trueDamage && foam){foam--;continue;}
    total+=!trueDamage&&shields-- > 0?Math.ceil(damage/2):damage;
  }
  return Math.min(enemy.hp,total);
}
function skillValue(w,p,e) {
  if(w.id==='unify')return p.nine?WIN/4:85;
  const special={seven:e.seven?12:35,dark:e.dark?0:38,peace:p.hp<25?18:4,foam:18,knuckles:32+12*p.knuckles,steal:e.props.reduce((n,id)=>n+itemValues[id],0)+30*e.knuckles+8*e.wine,serpent:18};
  if(w.id in special)return special[w.id];
  const hits={drunken:7,claw:2,dual:4}[w.id]||1;
  const base=w.id==='sorrow'?99-p.hp:w.damage;
  const bonus=p.knuckles*10-(p.weak?5:0);
  let value=attackValue(Math.max(0,base+bonus),e,['serious','claw','sniper'].includes(w.id),hits);
  if(p.wine)value+=attackValue(p.wine*10,e,['serious','claw','sniper'].includes(w.id));
  if(w.id==='buddha'||w.id==='taser')value+=50;
  if(w.id==='dual')value+=(3-p.props.length)*8;
  if(w.id==='fan')value+=e.props.length?8:0;
  if(w.id==='serious')value-=18;
  return value;
}
function position(p,e) {
  const pair=matchingWeapons(p.hands).reduce((best,w)=>Math.max(best,skillValue(w,p,e)),0);
  // Reachable pairs depend on the opponent's actual digits, not numeric distance.
  let nextPair=0;
  for(let h=0;h<2;h++)for(let t=0;t<2;t++) {
    if(p.locks[h]||e.locks[t])continue;
    const n=(p.hands[h]+e.hands[t])%10;
    if(p.echo||n===p.hands[1-h]) {
      const hands=p.echo?[n,n]:p.hands.map((v,i)=>i===h?n:v);
      nextPair=Math.max(nextPair,...matchingWeapons(hands).map(w=>skillValue(w,p,e)));
    }
  }
  return p.hp+pair*.55+nextPair*.2+p.nine*85+p.props.reduce((n,id)=>n+itemValues[id],0)
    +p.knuckles*34+p.wine*8+Math.min(p.foam,4)*7+p.peace*2
    -p.skip*19-Math.min(p.seven,5)*5-(p.dark?26:0)-p.poison*1.5-p.weak*2
    -(p.silenced?Math.min(12,p.props.length*5):0);
}
function evaluate(s,actor) {
  if(s.winner!==null)return s.winner===actor?WIN:-WIN;
  return position(s.players[actor],s.players[1-actor])-position(s.players[1-actor],s.players[actor]);
}
function step(s,c,budget) {
  budget.left--;
  let n=applyCommand(s,c);
  if(n.winner===null&&n.players[n.active].weapon)n=applyCommand(n,{type:'attack',actor:n.active,revision:n.revision});
  // Resolve automatic handoffs, including control and periodic damage.
  for(let i=0;i<24&&n.winner===null&&n.phase==='start';i++)n=applyCommand(n,{type:'advance',actor:n.active,revision:n.revision});
  n.log=[];n.events=[];
  return n;
}
function stateKey(s) {return JSON.stringify([s.active,s.turn,s.calculated,s.acted,s.rng,s.players]);}
function turnPlans(s,actor,budget,width=18,depth=7) {
  let frontier=[{s,first:null,value:evaluate(s,actor)}],finished=[];
  const seen=new Set();
  for(let d=0;d<depth&&frontier.length&&budget.left>0;d++) {
    const next=[];
    for(const node of frontier) {
      for(const c of legalCommands(node.s)) {
        if(budget.left<=0)break;
        if(c.type==='prop'&&node.s.players[actor].props[c.slot]==='lock'&&c.target===actor)continue;
        const n=step(node.s,c,budget),key=stateKey(n);
        if(seen.has(key))continue;
        seen.add(key);
        const child={s:n,first:node.first||c,value:evaluate(n,actor),length:d+1};
        if(n.winner===actor)return [child];
        if(n.winner!==null||n.active!==actor||n.turn!==s.turn)finished.push(child);
        else next.push(child);
      }
    }
    next.sort((a,b)=>b.value-a.value);
    frontier=next.slice(0,width);
  }
  // Every candidate is evaluated after handing over, never as an unfinished combo.
  for(const node of frontier) {
    if(budget.left<=0)break;
    const c=legalCommands(node.s).find(c=>c.type==='end');
    if(c){const n=step(node.s,c,budget);finished.push({...node,s:n,value:evaluate(n,actor)});}
  }
  return finished.sort((a,b)=>b.value-a.value||a.length-b.length);
}

export function chooseMasterCommand(state) {
  const actor=state.active,legal=legalCommands(state);
  if(legal.length<2)return legal[0];
  const candidates=new Map();
  // Two independent draw scenarios; value the opponent's best complete turn.
  for(let sample=0;sample<2;sample++) {
    const s=structuredClone(state);s.log=[];s.events=[];
    s.rng=(0x9e3779b9+Math.imul(s.revision+1,2246822519)+sample*1013904223)>>>0;
    const budget={left:16000};
    const plans=turnPlans(s,actor,budget);
    const selected=[];
    // Keep alternatives for each opening move, so one attractive combo cannot
    // hide every defensive opening before the opponent gets a reply.
    const counts=new Map();
    for(const plan of plans) {
      const key=JSON.stringify(plan.first),count=counts.get(key)||0;
      if(count>=2)continue;
      counts.set(key,count+1);selected.push(plan);
      if(selected.length===16)break;
    }
    const values=new Map();
    for(const plan of selected) {
      let value=plan.value;
      if(plan.s.winner===null && budget.left>0) {
        const responder=plan.s.active;
        const replyBudget={left:Math.min(700,budget.left)};
        const replies=turnPlans(plan.s,responder,replyBudget,8,6);
        budget.left-=Math.min(700,budget.left)-replyBudget.left;
        if(replies.length) {
          const reply=replies[0];value=evaluate(reply.s,actor);
          // Look past the reply to recover a prepared winning combination.
          if(reply.s.winner===null&&reply.s.active===actor) {
            const follow=turnPlans(reply.s,actor,{left:250},5,4);
            if(follow[0])value=value*.35+evaluate(follow[0].s,actor)*.65;
          }
        }
      }
      const key=JSON.stringify(plan.first);
      if(!values.has(key)||value>values.get(key).value)values.set(key,{command:plan.first,value});
    }
    for(const [key,result] of values) {
      const old=candidates.get(key)||{command:result.command,values:[]};
      old.values.push(result.value);candidates.set(key,old);
    }
  }
  const robust=n=>n.values.reduce((a,b)=>a+b,0)/n.values.length*.7+Math.min(...n.values)*.3;
  return [...candidates.values()].sort((a,b)=>robust(b)-robust(a))[0]?.command||legal[0];
}
