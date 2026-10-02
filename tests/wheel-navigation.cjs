const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../dist/index.html','utf8');
const script=html.match(/<script>\n([\s\S]*?)<\/script>/)[1];
let now=0,modal=false,collapsed=true,renders=0,saves=0,listener;
const views=new Set();
const context=vm.createContext({
  book:{},pages:[{start:0},{start:100},{start:200}],current:0,position:0,
  settings:{animation:false},performance:{now:()=>now},
  document:{body:{classList:{contains:name=>views.has(name)}},querySelector:()=>modal?{}:null},
  getSelection:()=>({isCollapsed:collapsed}),$:()=>({}),
  render:()=>renders++,persist:()=>saves++,
  workspace:{addEventListener:(type,handler,options)=>{listener={type,handler,options};}}
});
vm.runInContext(script.slice(script.indexOf('let pageTurn=null;'),script.indexOf("$('page-animation').onchange")),context);
vm.runInContext(script.slice(script.indexOf('let lastWheelTurn='),script.indexOf("workspace.addEventListener('pointerdown'")),context);
assert.equal(listener.type,'wheel');
assert.equal(listener.options.passive,false);
function wheel(overrides={},target='page'){
  const event={deltaY:120,deltaX:0,deltaMode:0,defaultPrevented:false,
    target:{closest:selector=>selector==='.book'?(target==='page'||target==='button'?{}:null):(target==='button'?{}:null)},
    preventDefault(){this.defaultPrevented=true;},...overrides};
  listener.handler(event);return event;
}
assert.equal(wheel().defaultPrevented,true);
assert.equal(context.current,1);assert.equal(context.position,100);assert.equal(saves,1);
// A rapid wheel burst cannot skip pages; held scrolling can continue after the interval.
for(now=20;now<350;now+=20)wheel();
assert.equal(context.current,1);assert.equal(saves,1);
now=350;wheel();assert.equal(context.current,2);
now=700;wheel();assert.equal(context.current,2);assert.equal(saves,2);
now=1050;wheel({deltaY:-120});assert.equal(context.current,1);assert.equal(context.position,100);
now=1400;wheel({deltaY:-3,deltaMode:1});assert.equal(context.current,0);
now=1750;wheel({deltaY:-1,deltaMode:2});assert.equal(context.current,0);
now=2100;wheel({deltaY:1,deltaMode:2});assert.equal(context.current,1);
now=2450;wheel({deltaY:3,deltaMode:1});assert.equal(context.current,2);
assert.equal(renders,saves);
function ignored(overrides={},target='page'){
  const before=context.current,count=saves;
  now+=400;const event=wheel(overrides,target);
  assert.equal(event.defaultPrevented,!!overrides.defaultPrevented);
  assert.equal(context.current,before);assert.equal(saves,count);
}
// Native zoom, horizontal scrolling, controls, selection, and other screens retain their behavior.
context.current=1;
for(const modifier of ['ctrlKey','metaKey','altKey','shiftKey'])ignored({[modifier]:true});
ignored({deltaY:0});ignored({deltaY:10,deltaX:20});ignored({deltaY:10,deltaX:10});
ignored({defaultPrevented:true});ignored({},'toolbar');ignored({},'button');
collapsed=false;ignored();collapsed=true;
modal=true;ignored();modal=false;
for(const view of ['library-view','notes-view']){views.add(view);ignored();views.delete(view);}
context.book=null;ignored();context.book={};
const pages=context.pages;context.pages=[];ignored();context.pages=pages;
now+=400;wheel();assert.equal(context.current,2);
console.log('Wheel navigation, rate limit, page boundaries, saved position, and native-interaction exclusions passed.');
