import { PROPS, PROP_WEIGHT_TOTAL, propForTicket, MAX_HP, handPropNumber, weaponById, matchingWeapons } from "./catalog.js";

export const RULES_VERSION = 6;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const mod10 = (n) => (n + 10) % 10;
const log = (s, message) => {
  s.log.push(`[回合 ${Math.ceil(s.turn/2)}] ${message}`);
  s.log = s.log.slice(-30);
};
const name = (p) => (p === 0 ? "蓝方" : "红方");

function draw(s, p, source="道具效果") {
  if (p.props.length >= 3) return null;
  const id=propForTicket(randomInt(s, PROP_WEIGHT_TOTAL)), owner=s.players.indexOf(p);
  p.props.push(id);
  s.events.push({type:"draw",owner,item:id,source});
  log(s,`${name(owner)}${source}获得「${PROPS[id].name}」。`);
  return id;
}
export const supplyIn = p => (3 - (p.turns % 3)) % 3 + 1;
export function calculationOutcome(s, command) {
  const actor=command.actor ?? s.active,p=s.players[actor],enemy=s.players[1-actor];
  const value=mod10(p.hands[command.hand]+enemy.hands[command.targetHand]);
  const writes=p.mirror?[{owner:1-actor,hand:command.targetHand,value}]:p.echo?[0,1].map(hand=>({owner:actor,hand,value})):[{owner:actor,hand:command.hand,value}];
  return {value,writes,echo:!!p.echo,mirror:!!p.mirror};
}
function begin(s) {
  const p = s.players[s.active];
  p.turns++;
  if (p.turns % 3 === 1) {
    if(!draw(s,p,"回合补给")){s.events.push({type:"supply-full",owner:s.active});log(s,`${name(s.active)}补给时背包已满，本次不获得道具。`);}
  }
  s.phase = "start";
  s.synthesis = "pending";
  s.skipping = p.skip > 0;
  if (s.skipping) { p.skip--; log(s, `${name(s.active)}本回合无法行动，之后还需跳过 ${p.skip} 回合。`); }
  if (p.seven > 0) { p.seven--; damage(s,s.active,7,true,"七伤拳"); }
  if (s.winner === null && p.dark) damage(s,s.active,5,true,"玄冥神掌");
  if (s.winner === null && p.poison > 0) { p.poison--; damage(s,s.active,2,false,"中毒"); }
}
export function createGame(seed = 1) {
  assert(Number.isInteger(seed), "种子必须是整数");
  const s = {
    rulesVersion: RULES_VERSION,
    revision: 0,
    rng: seed >>> 0,
    active: 0,
    turn: 1,
    phase: "start",
    synthesis: "pending",
    winner: null,
    log: ["对决开始，双方生命 99，双手从 1 开始。"],
    events: [],
    players: [0, 1].map(() => ({
      hp: MAX_HP,
      echo:false,
      mirror:false,
      silenced:false,
      skip:0, seven:0, dark:false, foam:0, knuckles:0, peace:0, peaceSince:0, wine:0, adrenaline:0, adrenalineSince:0, weak:0, poison:0, nine:0,
      hands: [1, 1],
      locks: [false, false],
      props: [],
      weapon: null,
      turns: 0,
    })),
  };
  begin(s);
  return s;
}
export const synthesisOptions = s => matchingWeapons(s.players[s.active].hands);
export function touchCommands(s) {
  return [0,1].flatMap(hand => [0,1].flatMap(targetHand => !s.players[s.active].locks[hand] && !s.players[1-s.active].locks[targetHand] ? [{type:"add",hand,targetHand}] : []));
}
function enterAction(s) {
  s.phase = "action";
  if (!s.players[s.active].weapon && !touchCommands(s).length) {
    log(s, `${name(s.active)}无合法计算目标，自动结束回合。`);
    endTurn(s);
  }
}
function checkWinner(s) {
  if (s.winner !== null) return;
  const dead = s.players.findIndex((p) => p.hp <= 0);
  if (dead !== -1) {
    s.winner = 1 - dead;
    s.phase = "over";
    log(s, `${name(s.winner)}获胜！`);
  }
}
function randomInt(s, count) {
  // Rejection sampling avoids modulo bias while preserving deterministic replays.
  const limit = Math.floor(4294967296 / count) * count;
  do { s.rng = (Math.imul(s.rng,1664525)+1013904223) >>> 0; } while(s.rng >= limit);
  return s.rng % count;
}
function damage(s, owner, amount, trueDamage, source) {
  if(s.winner !== null) return;
  const target=s.players[owner];
  amount=Math.max(0,amount+(s.players[1-owner].adrenaline>0?5:0));
  let value=Math.max(0,amount-(target.adrenaline>0?5:0)),blocked=amount>0&&value===0?"肾上腺素":null;
  if(value>0 && target.peace>0) {value=0;blocked="和平";}
  else if(value>0 && !trueDamage) {
    if(target.hands.every(n=>n===5)) {value=0;blocked="绝对防御";}
    else if(target.foam>0) {target.foam--;value=0;blocked="盾墙";}
    else if(target.hands.includes(5)) {target.hands[target.hands.indexOf(5)]=1;value=Math.ceil(value/2);blocked="五指护盾";}
  }
  const actual=Math.min(target.hp,value);
  target.hp-=actual;
  s.events.push({type:"damage",owner,amount:actual,raw:amount,trueDamage,source,blocked,hands:[...target.hands],foam:target.foam});
  log(s,`${source}对${name(owner)}造成 ${actual} 点${trueDamage?"真实":"普通"}伤害${blocked?`（${blocked}）`:""}。`);
  checkWinner(s);
}
function endTurn(s) {
  const ending=s.players[s.active];
  if(ending.peace>0 && ending.turns>ending.peaceSince) ending.peace--;
  if(ending.weak>0) ending.weak--;
  if(ending.adrenaline>0 && ending.turns>ending.adrenalineSince) ending.adrenaline--;
  s.players[s.active].locks = [false, false];
  s.players[s.active].echo=false;s.players[s.active].mirror=false;s.players[s.active].silenced=false;
  checkWinner(s);
  if (s.winner !== null) return;
  s.active = 1 - s.active;
  s.turn++;
  begin(s);
}
function handIndex(n) {
  assert(n === 0 || n === 1, "无效的手势");
}
function playerIndex(n) {
  assert(n === 0 || n === 1, "无效的目标");
}

/** Authoritative, immutable reducer. Same state + command = same result. No DOM/time/network. */
export function applyCommand(state, command) {
  assert(command && typeof command === "object", "无效指令");
  assert(state.rulesVersion === RULES_VERSION, "规则版本不匹配");
  assert(state.winner === null, "对局已结束");
  assert(command.actor === state.active, "还没轮到你");
  assert(command.revision === state.revision, "对局已更新，请重新操作");
  const s = structuredClone(state),
    p = s.players[s.active],
    enemy = s.players[1 - s.active];
  s.events=[];
  switch (command.type) {
    case "advance":
      assert(s.phase === "start" || s.phase === "planning", "当前不能进入下一阶段");
      if (s.phase === "start") { if(s.skipping) endTurn(s); else s.phase = "planning"; }
      else if (synthesisOptions(s).length) s.phase = "synthesis";
      else { s.synthesis = "skipped"; log(s, `${name(s.active)}无合法组合，略过合成。`); enterAction(s); }
      break;
    case "decline":
      assert(s.phase === "synthesis", "当前不能放弃合成");
      s.synthesis = "declined";
      log(s, `${name(s.active)}放弃合成，进入计算。`);
      enterAction(s);
      break;
    case "forge": {
      assert(s.phase === "synthesis", "只能在行动阶段的技能选择中合成");
      const w = synthesisOptions(s).find(w => w.id === command.weapon);
      assert(w, "不满足该武器的组合条件");
      p.weapon = w.id;
      p.hands = [1,1];
      s.synthesis = "forged";
      log(s, `${name(s.active)}合成「${w.name}」，双手重置为 1。`);
      enterAction(s);
      break;
    }
    case "add": {
      assert(s.phase === "action" && !p.weapon, "当前不能计算");
      handIndex(command.hand);
      handIndex(command.targetHand);
      assert(
        !p.locks[command.hand] && !enemy.locks[command.targetHand],
        "这只手已被封印",
      );
      const a=p.hands[command.hand],b=enemy.hands[command.targetHand],result=calculationOutcome(s,command);
      for(const write of result.writes)s.players[write.owner].hands[write.hand]=write.value;
      s.events.push({type:"calculate",actor:s.active,hand:command.hand,targetHand:command.targetHand,...result});
      log(s,`${name(s.active)}计算：${a} + ${b} → ${result.value}${result.mirror?"（镜像：写入对手目标手）":result.echo?"（回响：写入己方双手）":""}。`);
      endTurn(s);
      break;
    }
    case "prop": {
      assert(s.phase === "planning", "道具只能在道具阶段使用");
      assert(!p.silenced,"本回合被沉默，不能使用道具");
      assert(Number.isInteger(command.slot)&&command.slot>=0&&command.slot<p.props.length,"道具不存在");
      const id=p.props[command.slot],prop=PROPS[id];
      assert(prop,"无效道具");
      playerIndex(command.target);
      if(prop.target==="self"||prop.target==="all")assert(command.target===s.active,"该道具只能由自己发动");
      if(prop.target==="enemy")assert(command.target===1-s.active,"该道具只能对对手使用");
      const target=s.players[command.target];
      if(prop.target==="hand")handIndex(command.targetHand);
      p.props.splice(command.slot,1);
      s.events.push({type:"prop",actor:s.active,item:id,target:command.target,targetHand:command.targetHand});
      log(s,`${name(s.active)}使用「${prop.name}」${prop.target==="hand"?`：${name(command.target)}${command.targetHand?"右":"左"}手`:""}。`);
      if(prop.target==="hand") {
        if(id==="lock")target.locks[command.targetHand]=true;
        else target.hands[command.targetHand]=handPropNumber(id,target.hands,command.targetHand);
      } else if(id==="echo")p.echo=true;
      else if(id==="mirror")p.mirror=true;
      else if(id==="silence")enemy.silenced=true;
      else if(id==="wine")p.wine++;
      else if(id==="adrenaline"){if(!p.adrenaline)p.adrenalineSince=p.turns;p.adrenaline+=3;endTurn(s);}
      else if(id==="balance") {
        const counts=s.players.map(player=>player.props.length);
        s.players.forEach(player=>player.props=[]);
        s.players.forEach((player,i)=>{for(let n=0;n<counts[i];n++)draw(s,player,"制衡");});
      } else if(id==="boon")s.players.forEach(player=>{while(player.props.length<3)draw(s,player,"天降的宝札");});
      else if(id==="greed"){draw(s,p,"强欲");draw(s,p,"强欲");log(s,`${name(s.active)}强欲生效，立即结束回合。`);endTurn(s);}
      else if(id==="grace"){const amount=Math.min(MAX_HP-p.hp,p.hands[0]+p.hands[1]);p.hp+=amount;log(s,`${name(s.active)}恩惠恢复 ${amount} 生命。`);}
      else if(id==="ruin")damage(s,1-s.active,enemy.hands[0]+enemy.hands[1],true,"破坏");
      checkWinner(s);
      break;
    }
    case "attack": {
      assert(s.phase === "action" && p.weapon, "没有可以使用的武器");
      const w = weaponById(p.weapon);
      assert(w,"无效技能");
      log(s,`${name(s.active)}发动「${w.name}」。`);
      const id=w.id, target=1-s.active;
      if(id==="serious") { enemy.hands=[1,1];enemy.foam=0;p.skip++; }
      const direct=["serious","drunken","scissors","fan","claw","buddha","dragon","sorrow","frag","dual","sniper","taser"];
      if(direct.includes(id)) {
        const base=id==="sorrow"?MAX_HP-p.hp:w.damage;
        const hits=id==="drunken"?5+randomInt(s,6):id==="claw"?2:id==="dual"?4:1;
        const wine=p.wine*10;p.wine=0;
        for(let i=0;i<hits&&s.winner===null;i++)damage(s,target,base+Number(p.knuckles)*10+(i===0?wine:0)-(p.weak>0?5:0),["serious","claw","sniper"].includes(id),w.name);
      }
      if(s.winner===null) {
        if(id==="seven")enemy.seven+=7;
        if(id==="scissors")enemy.hands=enemy.hands.map(n=>mod10(n-1));
        if(id==="fan"&&enemy.props.length) {const item=enemy.props.splice(randomInt(s,enemy.props.length),1)[0];log(s,`${name(target)}失去「${PROPS[item].name}」。`);}
        if(id==="buddha")enemy.hands=[1,1];
        if(id==="buddha"||id==="taser")enemy.skip+=3;
        if(id==="dark")enemy.dark=true;
        if(id==="foam")p.foam+=2;
        if(id==="knuckles")p.knuckles=Number(p.knuckles)+1;
        if(id==="peace")s.players.forEach(player=>{if(!player.peace)player.peaceSince=player.turns;player.peace+=3;});
        if(id==="serpent"){enemy.weak+=5;enemy.poison+=5;}
        if(id==="dual")while(p.props.length<3)draw(s,p,"双枪");
        if(id==="steal") {p.props.push(...enemy.props.slice(0,3-p.props.length));enemy.props=[];p.knuckles=Number(p.knuckles)+Number(enemy.knuckles);enemy.knuckles=0;
          if(enemy.peace>0){if(!p.peace)p.peaceSince=p.turns;p.peace+=enemy.peace;enemy.peace=0;}
          p.wine+=enemy.wine;enemy.wine=0;
          if(enemy.adrenaline>0){if(!p.adrenaline)p.adrenalineSince=p.turns;p.adrenaline+=enemy.adrenaline;enemy.adrenaline=0;}}
        if(id==="unify") {
          p.hands=[1,1];enemy.hands=[1,1];p.nine++;
          p.locks=[false,false];p.silenced=false;p.skip=0;p.seven=0;p.dark=false;p.weak=0;p.poison=0;
          if(p.nine===2) {s.winner=s.active;s.phase="over";s.winReason="九九归一";log(s,`${name(s.active)}九九归一，立即获胜！`);}
        }
      }
      p.weapon = null;
      endTurn(s);
      break;
    }
    case "surrender":
      s.winner = 1 - s.active;
      s.phase = "over";
      log(s, `${name(s.active)}认输。`);
      break;
    default:
      throw new Error("未知指令");
  }
  s.revision++;
  return s;
}

export function legalCommands(s) {
  if (s.winner !== null) return [];
  const base = { actor: s.active, revision: s.revision };
  const p = s.players[s.active];
  const commands = [];
  if (s.phase === "start") commands.push({ type: "advance" });
  else if (s.phase === "planning") {
    commands.push({type:"advance"});
    if(!p.silenced)p.props.forEach((id,slot)=>{
      const prop=PROPS[id];
      if(prop.target==="hand")[0,1].forEach(target=>[0,1].forEach(targetHand=>commands.push({type:"prop",slot,target,targetHand})));
      else commands.push({type:"prop",slot,target:prop.target==="enemy"?1-s.active:s.active});
    });
  } else if (s.phase === "synthesis") {
    synthesisOptions(s).forEach(w => commands.push({type:"forge",weapon:w.id}));
    commands.push({type:"decline"});
  }
  else if (s.phase === "action") {
    if(p.weapon) commands.push({type:"attack"});
    else commands.push(...touchCommands(s));
  }
  return commands.map(c => ({...c,...base}));
}
