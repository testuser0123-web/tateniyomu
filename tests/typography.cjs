const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const {node,document,marked}=require('./text-dom.cjs');
const s=fs.readFileSync(__dirname+'/../dist/index.html','utf8').match(/<script>\n([\s\S]*?)<\/script>/)[1];
const ctx=vm.createContext({document,Intl});vm.runInContext(s.slice(s.indexOf('function typesetRuns'),s.indexOf('// Measure actual')),ctx);
const text='「……」――── 12月3日 2026年 Bloom Garden party A組 ... --';
const runs=ctx.typesetRuns(text);assert.equal(runs.map(r=>r.text).join(''),text);
assert.equal(runs.find(r=>r.text==='12').kind,'tcy');
assert.equal(runs.find(r=>r.text==='3').kind,'upright-digits');
assert.equal(runs.find(r=>r.text==='2026').kind,'upright-digits');
assert.equal(runs.find(r=>r.text==='Bloom Garden party').kind,'latin-words');
assert.equal(runs.find(r=>r.text==='A').kind,'latin-single');
assert.equal(runs.find(r=>r.text==='…').kind,'vertical-symbol');
assert.ok(!ctx.boundaries('あ12い').includes(2));
const el=node();ctx.appendTypeset(el,text,0,[{start:2,end:18}]);assert.equal(el.textContent,text);assert.equal(marked(el),text.slice(2,18));
console.log('Vertical typography preserves source text, selection offsets and highlighted numeric/symbol runs.');

const rules=ctx.typesetRuns('前――後');assert.equal(rules.filter(r=>r.kind==='vertical-rule').length,1);assert.equal(rules.find(r=>r.kind==='vertical-rule').text,'――');
const ruleNode=node();ctx.appendTypeset(ruleNode,'――',0,[{start:1,end:2}]);assert.equal(ruleNode.children.length,1);assert.equal(ruleNode.children[0].style.height,'2.11em');assert.equal(ruleNode.textContent,'――');assert.equal(marked(ruleNode),'―');
console.log('Consecutive rules use one continuous drawing box and retain partial highlight offsets.');
