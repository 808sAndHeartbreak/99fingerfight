import {createGame, applyCommand} from './engine.js';

export const LESSONS = [
  {title:'触碰与计算', setup:'练习场已把你的左手设为 8，对手双手设为 4。正式对局双方从 1 / 1、99 生命开始。', result:'8 + 4 = 12 → 留个位 2。只有主动碰出的手改变；行动后交换回合。', steps:[
    {title:'没有道具，准备行动', detail:'没有道具时，1 秒后自动进入行动。', command:{type:'advance'}, target:'#advance'},
    {title:'用自己的 8 碰对手任意一只手', detail:'先点自己的 8，再点对手的 4。结果只保留个位。', command:{type:'add',hand:0,targetHand:0}, target:'#hand-0-0', selectedTarget:'#hand-1-0, #hand-1-1'},
  ]},
  {title:'道具与合成', setup:'练习场：你的双手为 1 / 2，背包有增幅；对手剩余 5 生命。', result:'合成后双手归 1，并自动释放技能。对手生命归零，你就获胜！', steps:[
    {title:'使用增幅，把蓝方左手变成 2', detail:'点左侧「增幅」，再点自己的左手。悬停道具可查看完整效果。', command:{type:'prop',slot:0,target:0,targetHand:0}, target:'[data-prop="0"]', selectedTarget:'#hand-0-0'},
    {title:'道具已用完，准备选招', detail:'现在是 2 / 2，可以合成剪刀。道具只改变数字，不会立即合成。', command:{type:'advance'}, target:'#advance'},
    {title:'确认合成「剪刀」', detail:'点击剪刀就会自动攻击。正式对局放弃合成会直接结束回合。', command:{type:'forge',weapon:'scissors'}, target:'[data-forge="scissors"]'},
    {title:'剪刀自动释放', detail:'无需再次点击，技能正在释放。', command:{type:'attack'}, target:''},
  ]},
  {title:'九九归一', setup:'练习场已准备 9 / 9 和一枚九标记。正式对局需要自己凑出两次 9 / 9。', result:'第二枚九标记触发九九归一，无论生命剩余多少都直接获胜。你已学会基本操作！', steps:[
    {title:'没有道具，准备归一', detail:'练习已准备一枚九标记。正式对局要两次合成并发动归一。', command:{type:'advance'}, target:'#advance'},
    {title:'用 9 / 9 合成「归一」', detail:'归一会让双方数字回到 1 / 1，九标记会保留。', command:{type:'forge',weapon:'unify'}, target:'[data-forge="unify"]'},
    {title:'归一自动释放，获得第二枚九标记', detail:'第一枚是积累，第二枚直接获胜。', command:{type:'attack'}, target:''},
  ]},
];

// Practice fixtures stay outside the shared rules and online session protocol.
export class TutorialSession {
  constructor(chapter=0) {
    this.chapter=chapter; this.step=0; this.disposed=false;
    this.state=createGame(99); this.state.phase='planning'; this.state.events=[];
    const [p,e]=this.state.players;
    p.props=[];
    if(chapter===0){p.hands=[8,1];e.hands=[4,4];}
    if(chapter===1){p.hands=[1,2];p.props=['add'];e.hp=5;}
    if(chapter===2){p.hands=[9,9];p.nine=1;}
    this.state.log=[this.lesson.setup];
  }
  get lesson(){return LESSONS[this.chapter];}
  get done(){return this.step>=this.lesson.steps.length;}
  get guide(){return this.lesson.steps[this.step];}
  getParticipants(){return [];}
  getSnapshot(){return structuredClone(this.state);}
  subscribe(listener){listener(this.getSnapshot());return ()=>{};}
  async send(command){
    if(this.disposed)throw new Error('教学已关闭');
    if(this.done||!Object.entries(this.guide.command).every(([key,value])=>(this.chapter===0 && key==='targetHand' ? [0,1].includes(command[key]) : command[key]===value)))
      throw new Error(this.guide?.title || '本节完成，点击继续');
    this.state=applyCommand(this.state,command);this.step++;
    return this.getSnapshot();
  }
  dispose(){this.disposed=true;}
}
