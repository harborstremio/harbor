import assert from 'node:assert/strict';
import test from 'node:test';
import { retainSourceMatchGroups, type SourceMatchPreview } from '../src/lib/games/source-groups.ts';

function entry(id: string): SourceMatchPreview {
  return { source: { id, name: id, url: `https://${id}.example/feed`, enabled: true, checkedAt: 1, format: 'community', skipped: 0, entries: [] },
    release: { id, title: 'Example game', kind: 'game' }, match: 'title', deferred: { signature: id.repeat(64), rows: [0] } };
}

test('later higher-ranked matches append without moving or replacing an open publisher', () => {
  const a=entry('a'),b=entry('b'),first=retainSourceMatchGroups([a],[]);
  const second=retainSourceMatchGroups([b,a],first);
  assert.deepEqual(second.map(group=>group.source.id),['a','b']);assert.equal(second[0],first[0]);
  assert.equal(retainSourceMatchGroups([b,a],second)[1],second[1]);
});
test('removed publishers disappear and refreshed source identities invalidate held groups', () => {
  const a=entry('a'),b=entry('b'),first=retainSourceMatchGroups([a,b],[]);
  assert.deepEqual(retainSourceMatchGroups([b],first).map(group=>group.source.id),['b']);
  const refreshed={...a,source:{...a.source,checkedAt:2}},next=retainSourceMatchGroups([refreshed,b],first);
  assert.notEqual(next[0],first[0]);assert.equal(next[1],first[1]);
  assert.equal(next[0].source,refreshed.source);
});
test('changed release metadata, matches and physical file rows cannot reuse an obsolete group', () => {
  const a=entry('a'),first=retainSourceMatchGroups([a],[]);
  for(const changed of [{...a,release:{...a.release,title:'Updated'}},{...a,match:'identity' as const},
    {...a,deferred:{...a.deferred,rows:[1]}},{...a,deferred:{...a.deferred,signature:'b'.repeat(64)}}]){
    assert.notEqual(retainSourceMatchGroups([changed],first)[0],first[0]);
  }
});
test('duplicate physical rows remain exact and stable between cumulative updates', () => {
  const a=entry('a'),copy={...a,deferred:{...a.deferred,rows:[3]}},b=entry('b');
  const first=retainSourceMatchGroups([a,copy],[]),second=retainSourceMatchGroups([b,a,copy],first);
  assert.equal(second[0],first[0]);assert.deepEqual((second[0].matches[0] as SourceMatchPreview).deferred.rows,[0,3]);
  assert.deepEqual(a.deferred.rows,[0]);
});
test('a new visit with no held groups honors canonical ranking', () => {
  const a=entry('a'),b=entry('b');assert.deepEqual(retainSourceMatchGroups([b,a],[]).map(group=>group.source.id),['b','a']);
});
