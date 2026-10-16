const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../dist/index.html','utf8'),s=html.match(/<script>\n([\s\S]*?)<\/script>/)[1];new vm.Script(s);
const ctx=vm.createContext({FORMATS:{bunko:{},shinsho:{},novel:{}}});
const slice=(a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
for(const [a,b] of [['function makeExportData','function selectedExport'],['function validateBundle',"$('export-book').onclick"],['function cleanCover','function paintCover']])vm.runInContext(slice(a,b),ctx);
const books=[{title:'一',text:'あいうえお',position:2,bookmarks:[{offset:1}],highlights:[{start:0,end:2}]},{title:'二',text:'かきくけこさしす',author:'著者',position:5,bookmarks:[],highlights:[]}];
const settings={font:'gothic',size:24,format:'shinsho',theme:'dark',animation:false};
for(let mask=0;mask<8;mask++){const opts={notes:!!(mask&1),position:!!(mask&2),layout:!!(mask&4),preferences:!!(mask&4)};const data=ctx.makeBulkExportData(books,settings,opts);assert.equal('settings' in data,opts.layout);const items=ctx.validateBundle(JSON.parse(JSON.stringify(data)));assert.equal(items.length,2);items.forEach((item,i)=>{assert.equal(item.book.text,books[i].text);assert.equal(item.book.title,books[i].title);assert.equal('position' in item.book,opts.position);if(opts.position)assert.equal(item.book.position,books[i].position);assert.equal('bookmarks' in item.book,opts.notes);assert.equal(item.settings.font,opts.layout?'gothic':undefined);});assert.equal(items[1].book.author,'著者');}
const single=ctx.makeExportData(books[0],settings,2,{notes:true});assert.equal(ctx.validateBundle(JSON.parse(JSON.stringify(single))).length,1);
for(const bad of [{format:'tateniyomu',version:1,books:[]},{format:'tateniyomu',version:1,books:'x'},{format:'other',version:1,books:[books[0]]},{format:'tateniyomu',version:1,books:[{title:'x',text:''}]}])assert.throws(()=>ctx.validateBundle(bad));
assert.ok(html.includes('id="import-book" type="file" accept=".tatebook,.json,application/json" multiple hidden'));
console.log('Bulk export bundles round-trip through import for all option combinations; single-book files still import.');
