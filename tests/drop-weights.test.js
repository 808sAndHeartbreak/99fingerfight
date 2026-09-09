import test from 'node:test';
import assert from 'node:assert/strict';
import {PROP_IDS, PROP_WEIGHTS, PROP_WEIGHT_TOTAL, propForTicket} from '../src/catalog.js';
import {createGame, applyCommand} from '../src/engine.js';

test('each A/B/C item has exact 4/2/1 ticket weight, with no missing items', () => {
  const counts=Object.fromEntries(PROP_IDS.map(id=>[id,0]));
  for(let ticket=0;ticket<PROP_WEIGHT_TOTAL;ticket++)counts[propForTicket(ticket)]++;
  assert.equal(PROP_WEIGHT_TOTAL,29);
  assert.deepEqual(counts,PROP_WEIGHTS);
  for(const id of ['add','sub','double'])assert.equal(counts[id],4);
  for(const id of ['grace','greed','boon'])assert.equal(counts[id],1);
  assert.throws(()=>propForTicket(-1));assert.throws(()=>propForTicket(29));
});

test('weighted repeated draws are deterministic, inventory capped, input immutable', () => {
  const s=createGame(123);s.phase='planning';s.players[0].props=['boon'];
  const before=structuredClone(s),c={type:'prop',slot:0,target:0,actor:0,revision:s.revision};
  const a=applyCommand(s,c),b=applyCommand(s,c);
  assert.deepEqual(a,b);assert.deepEqual(s,before);
  assert.deepEqual(a.players.map(p=>p.props.length),[3,3]);
  assert.ok(a.events.filter(e=>e.type==='draw').every(e=>PROP_IDS.includes(e.item)));
});
