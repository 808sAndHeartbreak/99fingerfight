import {createGame, applyCommand} from './engine.js';

export const LESSONS = [
  {title:'触碰与计算', setup:'练习场已把你的左手设为 8，对手双手设为 4。正式对局双方从 1 / 1、99 生命开始。', result:'8 + 4 = 12 → 留个位 2。只有主动碰出的手改变。每回合可计算一次，准备好后点击结束回合。', steps:[
    {title:'用自己的 8 碰对手任意一只手', detail:'先点自己的 8，再点对手的 4。结果只保留个位。', command:{type:'add',hand:0,targetHand:0}, target:'#hand-0-0', selectedTarget:'#hand-1-0, #hand-1-1'},
    {title:'数字组合能合成不同技能', detail:'下方的合成图鉴列出了数字配方：例如 2 + 2 能合成剪刀。点击或悬停配方可查看技能；接下来练习用道具凑出组合。现在点击倒计时旁的「结束回合」。', command:{type:'end'}, target:'#end-turn, #recipe-shelf'},
  ]},
  {title:'道具与合成', setup:'练习场：你的双手为 1 / 2，背包有增幅；对手为 99 生命。', result:'合成后双手归 1，并自动释放技能。计算机会还在：每回合计算一次，道具、计算和合成没有先后限制。', steps:[
    {title:'使用增幅，把蓝方左手变成 2', detail:'点左侧「增幅」，再点自己的左手。悬停道具可查看完整效果。', command:{type:'prop',slot:0,target:0,targetHand:0}, target:'[data-prop="0"]', selectedTarget:'#hand-0-0'},
    {title:'确认合成「剪刀」', detail:'点击剪刀就会自动攻击。每回合可计算一次，道具、计算和合成没有先后限制。', command:{type:'forge',weapon:'scissors'}, target:'[data-forge="scissors"]'},
    {title:'剪刀自动释放', detail:'无需再次点击，技能正在释放。', command:{type:'attack'}, target:''},
  ]},
  {title:'5 的护盾',setup:'你的双手是 6 / 6；对手有一只 5。',result:'护盾把 30 点普通伤害减至 15，随后 5 变为 1。技能使用后，仍可计算一次。',steps:[
    {title:'用手雷试试护盾',detail:'对手的 5 是护盾：普通伤害减半后变回 1。手雷伤害为 30，试试会扣多少 HP。',command:{type:'forge',weapon:'frag'},target:'[data-forge="frag"]'},
    {title:'护盾格挡',detail:'30 → 15；护盾消耗，数字变回 1。',command:{type:'attack'},target:''},
    {title:'释放后还能计算一次',detail:'选自己的手，再碰对手。每回合只计算一次；形成组合还可继续合成。',command:{type:'add',hand:0,targetHand:0},target:'#hand-0-0',selectedTarget:'#hand-1-0, #hand-1-1'},
    {title:'完成操作后结束回合',detail:'计算次数已用完，没有可用道具或技能时，「结束回合」会高亮。正式对局每回合 30 秒，动画播放时暂停计时。',command:{type:'end'},target:'#end-turn'},
  ]},
  {title:'清空 HP 获胜',setup:'你的双手为 2 / 2，对手只剩 5 HP。',result:'对手 HP 归零，你赢了！接下来试试另一种不依赖伤害的胜利方式。',steps:[
    {title:'合成剪刀，完成最后一击',detail:'剪刀造成 5 点伤害。点击合成并使用，观察对手 HP。',command:{type:'forge',weapon:'scissors'},target:'[data-forge="scissors"]'},
    {title:'最后一击',detail:'对手 HP 归零。',command:{type:'attack'},target:''},
  ]},
  {title:'九九归一', setup:'练习场已准备 9 / 9 和一枚九标记。正式对局需要自己凑出两次 9 / 9。', result:'第二枚九标记触发九九归一，无论生命剩余多少都直接获胜。你已学会基本操作！', steps:[
    {title:'用 9 / 9 合成「归一」', detail:'本节已为你准备一枚九标记。归一让双方数字回到 1 / 1，再获得一枚九标记就直接获胜。', command:{type:'forge',weapon:'unify'}, target:'[data-forge="unify"]'},
    {title:'归一自动释放，获得第二枚九标记', detail:'第一枚是积累，第二枚直接获胜。', command:{type:'attack'}, target:''},
  ]},
];

// Practice fixtures stay outside the shared rules and online session protocol.
export class TutorialSession {
  constructor(chapter=0) {
    this.chapter=chapter; this.step=0; this.notices=new Set(); this.disposed=false;
    this.state=createGame(99); this.state.phase='action'; this.state.events=[];
    const [p,e]=this.state.players;
    p.props=[];
    if(chapter===0){p.hands=[8,1];e.hands=[4,4];}
    if(chapter===1){p.hands=[1,2];p.props=['add'];}
    if(chapter===2){p.hands=[6,6];e.hands=[5,1];}
    if(chapter===3){p.hands=[2,2];e.hp=5;}
    if(chapter===4){p.hands=[9,9];p.nine=1;}
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
    if(this.done||!Object.entries(this.guide.command).every(([key,value])=>([0,2].includes(this.chapter) && key==='targetHand' ? [0,1].includes(command[key]) : command[key]===value)))
      throw new Error(this.guide?.title || '本节完成，点击继续');
    this.state=applyCommand(this.state,command);this.step++;
    return this.getSnapshot();
  }
  dispose(){this.disposed=true;}
}
