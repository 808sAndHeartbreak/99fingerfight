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
export function chooseCommand(s) {
  const actor = s.active;
  const ranked = legalCommands(s).map((c, i) => {
    const next = applyCommand(s, c);
    let value = score(next, actor);
    if (c.type === "advance" && next.winner === null && next.active===actor) {
      value = Math.max(
        ...legalCommands(next).map((a) => score(applyCommand(next, a), actor)),
      );
    }

    if (c.type === "prop") {
      const id = s.players[actor].props[c.slot];
      if (id === "lock" && c.target !== actor) value += 3;
      if (id === "lock" && c.target === actor) value -= 10;
    }
    // Deterministic tie-breaking varies with turn; avoids repeatedly selecting the same hand.
    return { c, value: value + ((s.turn * 7 + i * 3) % 11) * 0.04 };
  });
  ranked.sort((a, b) => b.value - a.value);
  return ranked[0]?.c;
}
