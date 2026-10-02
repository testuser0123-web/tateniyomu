const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync(__dirname+'/../dist/index.html','utf8').match(/<script>\n([\s\S]*?)<\/script>/)[1];
const {node,document,marked}=require('./text-dom.cjs');
const book={text:'あいうえお「かきくけこ」さしすせそ。たちつてと\nなにぬねの'.repeat(5),bookmarks:[{offset:14},{offset:81}],highlights:[{start:8,end:48}]};
const original=JSON.stringify(book);
const context=vm.createContext({book,document,pages:[],current:0});
vm.runInContext(script.slice(script.indexOf('function sidewaysRanges'),script.indexOf('function boundaries')),context);
vm.runInContext(script.slice(script.indexOf('function findPage'),script.indexOf('function render()')),context);
for(const capacity of [12,25,70]){
 context.pages=Array.from({length:Math.ceil(book.text.length/capacity)},(_,i)=>({start:i*capacity,end:Math.min(book.text.length,(i+1)*capacity)}));
 for(const bookmark of book.bookmarks){context.current=context.findPage(bookmark.offset);assert.ok(context.pageBookmarked());const page=context.pages[context.current];assert.ok(page.start<=bookmark.offset&&page.end>bookmark.offset);}
 let text='',highlight='';
 for(const page of context.pages){const el=node();context.fillPage(el,page);text+=el.children.map(x=>x.textContent).join('');highlight+=marked(el);}
 assert.equal(text,book.text);assert.equal(highlight,book.text.slice(8,48));assert.equal(JSON.stringify(book),original);
}
console.log('Annotations retain text offsets across 3 pagination sizes; cross-page highlights preserve the exact selected text.');
