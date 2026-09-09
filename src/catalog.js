export const WEAPONS = Object.freeze([
  {"id": "serious", "recipe": [0, 0], "name": "认真一拳", "damage": 30, "detail": "对手双手归 1、清除盾墙，造成 30 点真实伤害；跳过自己下个回合"},
  {"id": "drunken", "recipe": [0, 0], "name": "醉拳", "damage": 5, "detail": "随机攻击 5～10 次，每次造成 5 点普通伤害"},
  {"id": "seven", "recipe": [0, 0], "name": "七伤拳", "damage": 0, "detail": "对手每回合开始受到 7 点真实伤害，持续 7 回合"},
  {"id": "scissors", "recipe": [2, 2], "name": "剪刀", "damage": 5, "detail": "造成 5 点普通伤害，对手双手各减 1（0 变 9）"},
  {"id": "fan", "recipe": [4, 4], "name": "花蝶扇", "damage": 10, "detail": "造成 10 点普通伤害，随机移除对手一个道具"},
  {"id": "claw", "recipe": [4, 4], "name": "爪击", "damage": 5, "detail": "攻击 2 次，每次造成 5 点真实伤害"},
  {"id":"peace", "recipe":[4,4], "name":"和平鸽", "damage":0, "detail":"双方各自接下来 3 个回合免疫所有伤害且不耗盾；重复使用延长回合"},
  {"id": "buddha", "recipe": [5, 5], "name": "如来神掌", "damage": 10, "detail": "造成 10 点普通伤害，对手双手归 1，跳过对手下 3 回合"},
  {"id": "dragon", "recipe": [5, 5], "name": "降龙十八掌", "damage": 50, "detail": "造成 50 点普通伤害"},
  {"id": "sorrow", "recipe": [5, 5], "name": "黯然销魂掌", "damage": 0, "detail": "造成等于自己已损失生命的普通伤害"},
  {"id": "dark", "recipe": [5, 5], "name": "玄冥神掌", "damage": 0, "detail": "对手每回合开始受到 5 点真实伤害，永久且不叠加"},
  {"id": "frag", "recipe": [6, 6], "name": "碎片手雷", "damage": 30, "detail": "造成 30 点普通伤害"},
  {"id": "foam", "recipe": [6, 6], "name": "泡沫手雷", "damage": 0, "detail": "获得盾墙，完全挡住两次普通伤害；重复获得次数 +2"},
  {"id": "knuckles", "recipe": [6, 6], "name": "指虎", "damage": 0, "detail": "永久获得每段直接技能伤害 +10，可重复叠加"},
  {"id": "steal", "recipe": [7, 7], "name": "窃取", "damage": 0, "detail": "夺走对手全部道具、和平与指虎；道具最多持有 3 个，溢出舍弃"},
  {"id":"serpent", "recipe":[7,7], "name":"双头蛇", "damage":0, "detail":"对手虚弱、中毒 5 回合：每段直接技能伤害 −5（最低 0），每回合开始受到 2 点普通伤害；重复施加延长回合"},
  {"id": "dual", "recipe": [8, 8], "name": "双枪", "damage": 5, "detail": "连续 4 次各造成 5 点普通伤害，随后补满自己的道具"},
  {"id": "sniper", "recipe": [8, 8], "name": "狙击枪", "damage": 30, "detail": "造成 30 点真实伤害"},
  {"id": "taser", "recipe": [8, 8], "name": "泰瑟枪", "damage": 1, "detail": "造成 1 点普通伤害，跳过对手下 3 回合"},
  {"id": "unify", "recipe": [9, 9], "name": "归一", "damage": 0, "detail": "双方双手归 1，清除自己的全部减益，获得一枚九；累计两枚立即获胜"},
].map(w=>Object.freeze({...w,image:`ink-mono/${w.id}.webp`})));
export const MAX_HP = 99;
export const PROPS = Object.freeze({
  add: { name:"增幅", detail:"任意一只手 +1，9 变为 0", target:"hand", image:"ink-mono/add.webp" },
  sub: { name:"退化", detail:"任意一只手 −1，0 变为 9", target:"hand", image:"ink-mono/sub.webp" },
  lock: { name:"封印", detail:"封印一只手，至其所属玩家回合结束", target:"hand", image:"ink-mono/lock.webp" },
  civil: { name:"内战", detail:"所选手减去其拥有者另一只手的数字，不足时加 10", target:"hand", image:"ink-mono/civil.webp" },
  double: { name:"倍增", detail:"所选手数字乘以 2，只保留个位", target:"hand", image:"ink-mono/double.webp" },
  echo: { name:"回响", detail:"下一次计算的结果同时写入自己的两只手", target:"self", image:"ink-mono/echo.webp" },
  mirror: { name:"镜像", detail:"下一次计算只改变对手目标手，自己的主动手不变", target:"self", image:"ink-mono/mirror.webp" },
  silence: { name:"沉默", detail:"对手下回合无法主动使用道具", target:"enemy", image:"ink-mono/silence.webp" },
  balance: { name:"制衡", detail:"双方弃掉所有道具，分别重新获得原数量的道具", target:"all", image:"ink-mono/balance.webp" },
  boon: { name:"天降的宝札", detail:"双方道具补满", target:"all", image:"ink-mono/boon.webp" },
  greed: { name:"强欲", detail:"获得两个道具，并立即结束回合", target:"self", image:"ink-mono/greed.webp" },
  grace: { name:"恩惠", detail:"回复自己双手数字总和的生命", target:"self", image:"ink-mono/grace.webp" },
  ruin: { name:"破坏", detail:"对对手造成其双手数字总和的伤害", target:"enemy", image:"ink-mono/ruin.webp" },
});
export const PROP_IDS = Object.freeze(Object.keys(PROPS));
// Weights apply per item, consistently across every source of random supplies.
export const PROP_WEIGHTS = Object.freeze(Object.fromEntries(PROP_IDS.map(id =>
  [id, ['double', 'add', 'sub'].includes(id) ? 4 : ['grace', 'greed', 'boon'].includes(id) ? 1 : 2]
)));
export const PROP_WEIGHT_TOTAL = Object.values(PROP_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
export function propForTicket(ticket) {
  if (!Number.isInteger(ticket) || ticket < 0 || ticket >= PROP_WEIGHT_TOTAL) throw new Error('无效抽取权重');
  for (const id of PROP_IDS) {
    if (ticket < PROP_WEIGHTS[id]) return id;
    ticket -= PROP_WEIGHTS[id];
  }
}
export function handPropNumber(id, hands, hand) {
  const n=hands[hand];
  const value=id==="add"?n+1:id==="sub"?n-1:id==="civil"?n-hands[1-hand]:id==="double"?n*2:n;
  return (value+10)%10;
}
export const weaponById = (id) => WEAPONS.find((w) => w.id === id);

export function matchesRecipe(hands, recipe) {
  return (hands[0] === recipe[0] && hands[1] === recipe[1]) || (hands[0] === recipe[1] && hands[1] === recipe[0]);
}
export const matchingWeapons = (hands, catalog = WEAPONS) => catalog.filter(w => matchesRecipe(hands, w.recipe));
