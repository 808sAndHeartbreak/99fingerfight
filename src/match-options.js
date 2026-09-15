export const DEFAULT_MATCH_OPTIONS=Object.freeze({itemsEnabled:true,turnSeconds:30});
export function matchOptions(value={}) {
  if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('无效对局设置');
  const {itemsEnabled=true,turnSeconds=30}=value;
  if(typeof itemsEnabled!=='boolean'||![10,30,60].includes(turnSeconds))throw new Error('请选择有效的道具开关和回合时长');
  return {itemsEnabled,turnSeconds};
}
export const sameMatchOptions=(a,b)=>a.itemsEnabled===b.itemsEnabled&&a.turnSeconds===b.turnSeconds;
export const matchSummary=(options=DEFAULT_MATCH_OPTIONS)=>`${options.itemsEnabled?'道具启用':'无道具'} · ${options.turnSeconds} 秒 / 回合`;
