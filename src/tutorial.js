import {createGame, applyCommand} from './engine.js';

export const LESSONS = [
 {title:'走完一个攻防回合',result:'手雷原伤害 30，被 [5] 护盾减半，只扣 15 HP；格挡后 [5] 退为 [1]。真实伤害可以绕过数字护盾。把对手 HP 清空即可获胜。接着看看另一种胜利方式。',steps:[
  {title:'先用 [9] 碰对手的 [5]',detail:'现在模拟对局中的两个回合：先点自己的 [9]，再点对手的 [5]。加和只留个位，14 变 [4]。',command:{type:'add',hand:0,targetHand:0},target:'#hand-0-0',selectedTarget:'#hand-1-0'},
  {title:'查看图鉴，再交给对手',detail:'不同数字组合能合成不同技能。先查看下方 [2] + [2] 图鉴；本回合已计算一次，点击结束回合，看看对手如何行动。',command:{type:'end'},requiresInfo:'recipe:2',target:'#end-turn'},
  {title:'轮到对手',detail:'对手也会选择自己的手去碰你的手。',command:{type:'advance'},auto:true},
  {title:'对手用 [5] 碰你的 [6]',detail:'[5] + [6] = 11，只有对手出手的数字变为 [1]，你的数字不变。',command:{type:'add',hand:0,targetHand:1},auto:true},
  {title:'对手结束回合',detail:'现在轮回你行动。',command:{type:'end'},auto:true},
  {title:'轮到你，收到道具',detail:'每隔三个己方回合随机获得一个道具，这次获得增幅。',command:{type:'advance'},auto:true},
  {title:'用增幅把 [4] 变为 [5]',detail:'每隔三个己方回合随机获得一个道具。这次收到了增幅：点左侧增幅，再点自己的 [4]。道具与计算没有先后限制。',command:{type:'prop',slot:0,target:0,targetHand:0},target:'[data-prop="0"]',selectedTarget:'#hand-0-0'},
  {title:'再碰对手的 [1]，凑成双 [6]',detail:'现在用自己的 [5] 碰对手的 [1]，得到 [6]。另一只手本来就是 [6]，可以合成手雷了。',command:{type:'add',hand:0,targetHand:0},target:'#hand-0-0',selectedTarget:'#hand-1-0'},
  {title:'合成手雷，体验护盾',detail:'对手的 [5] 自动格挡一半普通伤害，格挡后变 [1]。选择碎片手雷，再确认释放；也可以取消选择。',command:{type:'forge',weapon:'frag'},target:'[data-forge="frag"]'},
  {title:'观察伤害与护盾',detail:'结算后你的双手才会归 [1]。',command:{type:'attack'},auto:true},
 ]},
 {title:'两次归一，直接获胜',result:'九九归一，胜利！每回合计算一次，道具与合成顺序自由；做完后记得结束回合。现在可以开始正式对战了。',steps:[
  {title:'再看一种特殊胜利方式',detail:'累计使用两次归一，便能无视剩余 HP 获胜。这里模拟你已经凑到 [8] / [9]：先用 [8] 碰对手的 [1]，得到双 [9]。',command:{type:'add',hand:0,targetHand:0},target:'#hand-0-0',selectedTarget:'#hand-1-0'},
  {title:'第一次使用归一',detail:'[9] + [9] 可以合成归一。它会清除自己的减益、让双方数字归 [1]，并记住这次使用。',command:{type:'forge',weapon:'unify'},target:'[data-forge="unify"]'},
  {title:'归一生效',detail:'第一次使用后，需要再次凑齐双 [9]。',command:{type:'attack'},auto:true},
  {title:'第一次已完成，再来一次便获胜',detail:'正式对局需要继续计算，重新凑齐双 [9]。为了快速演示，这里跳过积攒数字的过程；下一步会把你的双手变为 [9] / [9]。',command:{type:'demo'},target:'#tutorial-demo'},
  {title:'再次使用归一，赢下对局',detail:'再次合成并确认归一。无论对手还剩多少 HP，你都会获胜。',command:{type:'forge',weapon:'unify'},target:'[data-forge="unify"]'},
  {title:'九九归一',detail:'胜利。',command:{type:'attack'},auto:true},
 ]},
];

// Only the tutorial owns the narrated shortcut; normal rules and online play never accept it.
export class TutorialSession {
 constructor(chapter=0) {
  this.chapter=chapter;this.step=0;this.notices=new Set();this.seenInfo=new Set();this.disposed=false;
  this.state=createGame(7);this.state.phase='action';this.state.events=[];
  const [p,e]=this.state.players;p.props=[];
  if(chapter===0){this.state.turn=5;p.turns=3;e.turns=2;p.hands=[9,6];e.hands=[5,5];}
  else {p.hands=[8,9];e.hands=[1,1];}
  this.state.log=['教学模拟：正式开局双方都是 [1] / [1]、99 HP。',chapter===0?'模拟当前数字：蓝方 [9] / [6]，红方 [5] / [5]。':'特殊胜利演示：蓝方 [8] / [9]，红方 [1] / [1]。'];
 }
 get lesson(){return LESSONS[this.chapter];}
 get done(){return this.step>=this.lesson.steps.length;}
 get guide(){return this.lesson.steps[this.step];}
 get canProceed(){return !this.guide?.requiresInfo || this.seenInfo.has(this.guide.requiresInfo);}
 inspect(key){if(key!==this.guide?.requiresInfo)return false;this.seenInfo.add(key);return true;}
 getParticipants(){return [];}
 getSnapshot(){return structuredClone(this.state);}
 subscribe(listener){listener(this.getSnapshot());return ()=>{};}
 async send(command){
  if(this.disposed)throw new Error('教学已关闭');
  if(!this.canProceed)throw new Error('先查看下方 [2] + [2] 图鉴');
  if(this.done||!Object.entries(this.guide.command).every(([k,v])=>command[k]===v))throw new Error(this.guide?.title||'练习完成，点击继续');
  if(command.type==='demo'){
   if(command.actor!==this.state.active||command.revision!==this.state.revision)throw new Error('对局已更新，请重新操作');
   this.state=structuredClone(this.state);this.state.players[0].hands=[9,9];this.state.revision++;this.state.events=[];
   this.state.log.push('教学演示快进：跳过积攒数字，蓝方再次凑齐 [9] / [9]。');
  }else this.state=applyCommand(this.state,command);
  this.step++;return this.getSnapshot();
 }
 dispose(){this.disposed=true;}
}
