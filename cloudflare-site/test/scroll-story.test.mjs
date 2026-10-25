import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('scroll story maps real chapter geometry to bounded, reversible progress',()=>{
 const window={};vm.runInNewContext(readFileSync('public/story.js','utf8'),{window});
 const map=window.SolborneStory.position;
 assert.equal(map([{top:100,height:500},{top:600,height:500}],800).index,0);
 const later=map([{top:-600,height:500},{top:-100,height:500},{top:400,height:500}],800);
 assert.equal(later.index,1);assert.ok(later.progress>=0&&later.progress<=1);
 const earlier=map([{top:-100,height:500},{top:400,height:500}],800);assert.equal(earlier.index,0);
 assert.equal(map([],800).index,0);assert.equal(map([{top:-9999,height:0}],0).progress,1);
});
