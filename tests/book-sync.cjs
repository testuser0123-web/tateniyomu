const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../dist/index.html','utf8'),s=html.match(/<script>\n([\s\S]*?)<\/script>/)[1];new vm.Script(s);
const ctx=vm.createContext({FORMATS:{bunko:{},shinsho:{},novel:{}}});
const slice=(a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
for(const [a,b] of [['function makeExportData','function selectedExport'],['function validateBundle',"$('export-book').onclick"],['function cleanCover','function paintCover'],['function editMapping',"$('edit-form').onsubmit"]])vm.runInContext(slice(a,b),ctx);
const plain=v=>JSON.parse(JSON.stringify(v));
const roundTrip=b=>ctx.validateBundle(plain(ctx.makeExportData(b,{},b.position,{notes:true,position:true})))[0].book;
const base={id:'book-1',versions:{text:['t0'],meta:['m0']},title:'題',text:'あいうえおかきくけこ',bookmarks:[{offset:1}],highlights:[],position:2,positionAt:100,updatedAt:100};

// The id, revision history and update time survive export → import.
const file=roundTrip(base);assert.equal(file.id,'book-1');assert.deepEqual(plain(file.versions),{text:['t0'],meta:['m0']});assert.equal(file.updatedAt,100);assert.equal(file.positionAt,100);
assert.throws(()=>ctx.validateImport({format:'tateniyomu',version:1,book:{...base,id:'../x'}}));

// Editing appends a revision only to the group that changed.
const pc=ctx.stampVersions(base,{...base,text:'あいうえおカキクけこ',updatedAt:200});
assert.equal(pc.versions.text.length,2);assert.deepEqual(plain(pc.versions.meta),['m0']);

// The phone still has the base: the PC edit fast-forwards, notes outside the edit are kept and moved, and the newer position wins.
const phone={...base,bookmarks:[{offset:1},{offset:9}],highlights:[{start:0,end:2}],positionAt:150};
let r=ctx.mergeBooks(phone,roundTrip({...pc,bookmarks:[{offset:3}],position:8,positionAt:200}));
assert.equal(r.conflicts.length,0);assert.equal(r.book.text,pc.text);assert.deepEqual(plain(r.book.versions),plain(pc.versions));
assert.deepEqual(plain(r.book.bookmarks),[{offset:1},{offset:3},{offset:9}]);assert.deepEqual(plain(r.book.highlights),[{start:0,end:2}]);assert.equal(r.book.position,8);assert.equal(r.book.positionAt,200);
// A position moved earlier on the other device does not replace a more recent one.
assert.equal(ctx.mergeBooks({...phone,position:4,positionAt:300},roundTrip({...pc,position:8,positionAt:200})).book.position,4);

// Importing an older copy into a newer book keeps the newer text.
r=ctx.mergeBooks(pc,roundTrip(base));assert.equal(r.conflicts.length,0);assert.equal(r.book.text,pc.text);assert.equal(r.book.versions.text.at(-1),pc.versions.text.at(-1));

// Different fields changed on each side merge without a conflict.
const phoneMeta=ctx.stampVersions(base,{...base,title:'新しい題'});
r=ctx.mergeBooks(phoneMeta,roundTrip(pc));assert.equal(r.conflicts.length,0);assert.equal(r.book.title,'新しい題');assert.equal(r.book.text,pc.text);

// Both sides changed the text: a conflict, settled by overwriting or by keeping the local copy.
const phoneText=ctx.stampVersions(base,{...base,text:'あいうえおさしすせそ'});
r=ctx.mergeBooks(phoneText,roundTrip(pc));assert.deepEqual(plain(r.conflicts),['text']);assert.equal(r.book,undefined);
const over=ctx.mergeBooks(phoneText,roundTrip(pc),'incoming').book;assert.equal(over.text,pc.text);
const kept=ctx.mergeBooks(phoneText,roundTrip(pc),'local').book;assert.equal(kept.text,phoneText.text);
// After settling, the same file no longer conflicts.
assert.equal(ctx.mergeBooks(over,roundTrip(pc)).conflicts.length,0);assert.equal(ctx.mergeBooks(kept,roundTrip(pc)).conflicts.length,0);
assert.equal(ctx.mergeBooks(kept,roundTrip(pc)).book.text,phoneText.text);

// Identical content merges even with unrelated histories; a file without notes keeps the local ones.
const same={...base,versions:{text:['x'],meta:['y']}};delete same.bookmarks;
r=ctx.mergeBooks(base,ctx.validateImport(plain(ctx.makeExportData(same,{},0,{}))).book);assert.equal(r.conflicts.length,0);assert.deepEqual(plain(r.book.bookmarks),[{offset:1}]);assert.equal(r.book.position,2);

// Books saved before ids existed share the "legacy" revision and conflict only if their content differs.
const legacy=b=>{const c={...b};delete c.versions;return c;};
assert.equal(ctx.mergeBooks({...legacy(base),versions:ctx.cleanVersions()},roundTrip(legacy(base))).conflicts.length,0);
assert.deepEqual(plain(ctx.mergeBooks({...legacy(base),versions:ctx.cleanVersions()},roundTrip(legacy({...base,title:'別'}))).conflicts),['meta']);

// Bulk export keeps each book's id.
const bulk=ctx.validateBundle(plain(ctx.makeBulkExportData([base,{...base,id:'book-2'}],{},{})));assert.deepEqual(bulk.map(x=>x.book.id),['book-1','book-2']);
assert.ok(html.includes('id="import-conflict-dialog"'));
console.log('Books keep their ids across export/import; edits fast-forward, notes merge, and real conflicts are reported.');
