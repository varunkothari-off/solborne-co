import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {homepageErrors,assertHomepages} from '../scripts/home-contract.mjs';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('approved homepage and retained motion variant satisfy release contract',()=>assertHomepages());
test('guard rejects a duplicated hero',()=>{
 const broken=html.replace('</main>','<section class="hero"><h1>Again</h1></section></main>');
 assert.ok(homepageErrors(broken).includes('exactly one website hero required'));
});
test('guard rejects the old full-height canvas and missing visual examples',()=>{
 const broken=html.replace('canvas-compact','canvas-feature').replace('data-case="avasa"','data-case="missing"');
 const errors=homepageErrors(broken);assert.ok(errors.includes('compact canvas must be second'));assert.ok(errors.includes('avasa visual linked example required'));
});
test('guard rejects duplicate process and missing motion assets',()=>{
 const broken=html.replace('</main>','<section class="process-story"></section><section class="process-story"></section></main>').replace('/home-refinement.js','/old.js');
 assert.ok(homepageErrors(broken).includes('one unified process required'));assert.ok(homepageErrors(broken).includes('refinement assets must be loaded'));
});
