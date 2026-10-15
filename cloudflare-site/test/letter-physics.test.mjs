import test from 'node:test';
import assert from 'node:assert/strict';
import {step} from '../public/studio-motion/letter-physics.js';
test('thrown letters move with momentum then settle exactly at home',()=>{
 const s={x:80,y:-40,vx:300,vy:-200};step(s,.016);assert.ok(s.x>80);
 for(let i=0;i<800;i++)step(s,.016);
 assert.deepEqual(s,{x:0,y:0,vx:0,vy:0});
});
test('long background frame does not destabilise a spring',()=>{
 const s={x:100,y:40,vx:0,vy:0};step(s,100);assert.ok(s.x>90&&s.x<100);assert.ok(Number.isFinite(s.y));
});
