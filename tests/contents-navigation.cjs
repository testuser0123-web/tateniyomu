const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../dist/index.html','utf8');
const handlers={}, turns=[];
let toggles=0;
const workspace={addEventListener(type,fn,capture){
  if(type==='click')assert.equal(capture,true);
  handlers[type]=fn;
}};
const context=vm.createContext({
  document:{querySelector:()=>workspace,body:{classList:{contains:()=>false}}},
  current:3,step:()=>1,go:page=>turns.push(page),getSelection:()=>({isCollapsed:true}),
  setImmersive:()=>toggles++
});
vm.runInContext(html.slice(html.indexOf('function classifyGesture'),html.indexOf("workspace.addEventListener('keydown'")),context);
const entry={closest:selector=>selector==='.book'||selector==='.contents-entry'?entry:null};
function gesture(dx,type='touch'){
  const event={target:entry,isPrimary:true,button:0,pointerId:1,pointerType:type,clientX:100,clientY:100};
  handlers.pointerdown(event);
  handlers.pointerup({...event,clientX:100+dx});
}
function clickBlocked(detail){
  let stopped=false,prevented=false;
  handlers.click({target:entry,detail,preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});
  assert.equal(stopped,prevented);
  return stopped;
}
for(const dx of [100,-100]){
  gesture(dx);
  assert.equal(clickBlocked(1),true);
}
assert.deepEqual(turns,[4,2]);
gesture(100); // A swipe may produce no click before the next activation.
assert.equal(clickBlocked(0),false);
for(const type of ['touch','mouse']){
  gesture(0,type);
  assert.equal(clickBlocked(1),false);
}
assert.deepEqual(turns,[4,2,4]);
assert.equal(toggles,0);
console.log('Contents swipes and native button activation passed.');
