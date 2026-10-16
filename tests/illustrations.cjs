const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../dist/index.html','utf8');
const script=html.match(/<script>\n([\s\S]*?)<\/script>/)[1];new vm.Script(script);
const {node,document}=require('./text-dom.cjs');const measure=node();Object.defineProperties(measure,{scrollWidth:{get(){return Array.from(this.textContent).length>80?102:100;}},scrollHeight:{get(){return 100;}}});
const context=vm.createContext({Intl,setTimeout,document,$:()=>measure,revision:1,FORMATS:{bunko:{},shinsho:{},novel:{}}});
vm.runInContext(script.slice(script.indexOf('function sidewaysRanges'),script.indexOf('async function paginate')),context);
vm.runInContext(script.slice(script.indexOf('function placeIllustrations'),script.indexOf('function fillPage')),context);
vm.runInContext(script.slice(script.indexOf('const IMAGE_TYPES'),script.indexOf('function paintCover')),context);
vm.runInContext(script.slice(script.indexOf('function validateImport'),script.indexOf("$('export-book').onclick")),context);
context.illustrationNames=new Set(['a','b','夜の海']);
// Mirrors paginate(): strict commands force a page end, then illustration pages are placed.
async function layout(text){const images=context.getMarkupRanges(text).filter(r=>r.type==='image');const pages=await context.splitPages(text,100,100,18,1,images.filter(r=>r.strict).map(r=>r.start));return context.placeIllustrations(text,pages,images);}
const same=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
const shape=pages=>pages.map(p=>p.image?'['+p.image+']':'T');
const textOf=(text,pages)=>pages.filter(p=>!p.image).map(p=>text.slice(p.start,p.end)).join('');
(async()=>{
  // A command line disappears from the text, and only registered names count.
  const ranges=context.imageRanges('前\n!img(a)\n後 !img(x) $!img(b)',new Set(['a','b']));
  same(ranges.map(r=>[r.name,r.strict,r.end-r.start]),[['a',false,8],['b',true,8]]);
  const runs=context.typesetRuns('前\n!img(a)\n後',0,'前\n!img(a)\n後');
  assert.equal(runs.filter(r=>r.kind!=='writing-marker').map(r=>r.text).join(''),'前\n後');
  assert.ok(context.typesetRuns('!img(x)',0,'!img(x)').every(r=>r.kind!=='writing-marker'));

  // Natural placement: the page holding the command is filled first, the illustration follows it.
  const natural='あ'.repeat(30)+'\n!img(a)\n'+'い'.repeat(100);
  let pages=await layout(natural);
  same(shape(pages),['T','[a]','T']);
  assert.equal(textOf(natural,pages),natural);
  assert.ok(pages[0].end>natural.indexOf('い'),'text after the command shares the first page');

  // $!img keeps the exact order: the page ends at the command.
  const strict='あ'.repeat(30)+'\n$!img(a)\n'+'い'.repeat(100);
  pages=await layout(strict);
  same(shape(pages),['T','[a]','T','T']);
  assert.equal(pages[0].end,strict.indexOf('$'));
  assert.equal(textOf(strict,pages),strict);

  // A command at the top of a page goes before that page; several commands keep their order.
  pages=await layout('!img(a)\n!img(b)\n本文');
  same(shape(pages),['[a]','[b]','T']);
  pages=await layout('本文'+'\n!img(a)\n!img(夜の海)');
  same(shape(pages),['T','[a]','[夜の海]']);

  // Strict commands alone never leave blank text pages.
  pages=await layout('$!img(a)\n$!img(b)\n');
  same(shape(pages),['[a]','[b]']);
  pages=await layout('前\n$!img(a)\n$!img(b)\n後');
  same(shape(pages),['T','[a]','[b]','T']);

  // Unregistered names stay as written text.
  pages=await layout('前\n!img(x)\n後');
  same(shape(pages),['T']);

  // findPage maps every offset (including removed blank pages) to a page.
  context.pages=await layout('前\n$!img(a)\n$!img(b)\n後');
  assert.equal(context.pages[context.findPage(0)].start,0);
  assert.equal(context.pages[context.findPage(3)].image,'b');

  // Import validation keeps embedded images and rejects bad ones.
  const data={format:'tateniyomu',version:1,book:{title:'挿絵',text:'!img(a)',illustrations:[{name:'a',type:'image/png',data:'data:image/png;base64,aGVsbG8='},{id:'img-local-only',name:'b',type:'image/png'}]}};
  same(context.validateImport(data).book.illustrations,[{name:'a',type:'image/png',data:'data:image/png;base64,aGVsbG8='}]);
  for(const bad of [{name:'a(1)',type:'image/png',data:'data:image/png;base64,aGVsbG8='},{name:'a',type:'image/gif',data:'data:image/gif;base64,aGVsbG8='},{name:'a',type:'image/png',data:'data:image/jpeg;base64,aGVsbG8='},{name:' a',type:'image/png',data:'data:image/png;base64,aGVsbG8='}])
    assert.throws(()=>context.validateImport({...data,book:{...data.book,illustrations:[bad]}}));
  assert.throws(()=>context.validateImport({...data,book:{...data.book,illustrations:[data.book.illustrations[0],data.book.illustrations[0]]}}));
  assert.equal(context.cleanIllustrations([{name:'a',type:'image/png',id:'bad id'}]).length,0);
  console.log('Illustration commands, natural and strict placement, and import validation passed.');
})().catch(e=>{console.error(e);process.exit(1);});
