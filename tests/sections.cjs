const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../dist/index.html','utf8');
const script=html.match(/<script>\n([\s\S]*?)<\/script>/)[1];new vm.Script(script);
const {node,document}=require('./text-dom.cjs');const measure=node();measure.classList={add(){},remove(){}};Object.defineProperties(measure,{scrollWidth:{get(){return Array.from(this.textContent).length>80?102:100;}},scrollHeight:{get(){return 100;}}});
const context=vm.createContext({Intl,setTimeout,document,$:()=>measure,revision:1,FORMATS:{bunko:{},shinsho:{},novel:{}}});
vm.runInContext(script.slice(script.indexOf('function sidewaysRanges'),script.indexOf('async function paginate')),context);
vm.runInContext(script.slice(script.indexOf('function placeIllustrations'),script.indexOf('function fillPage')),context);
context.illustrationNames=new Set(['a']);
// Mirrors paginate(): pages end at both sides of each section, then illustrations and the contents are placed.
async function layout(text,toc=false){const ranges=context.getMarkupRanges(text),images=ranges.filter(r=>r.type==='image');const pages=await context.splitPages(text,100,100,18,1,[...images.filter(r=>r.strict).map(r=>r.start),...ranges.sections.flatMap(s=>[s.start,s.end]),...ranges.pageBreaks.map(b=>b.start)]);const placed=context.placeIllustrations(text,context.placeSections(text,pages,ranges.sections,ranges.pageBreaks),images);return toc?context.addContents(text,placed,ranges.sections,100,100):placed;}
const same=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
const shape=pages=>pages.map(p=>p.title?'P':p.contents?'C':p.image?'['+p.image+']':p.section?'S':'T');
const shown=(text,from,to)=>context.typesetRuns(text.slice(from,to),from,text).filter(r=>r.kind!=='writing-marker').map(r=>r.text).join('');
(async()=>{
  // The markers and the blank lines after the title are hidden; the title itself is shown.
  const text='前の文。\n\n§§第二章　海§§\n\n次の文。';
  const [s]=context.sectionRanges(text);
  assert.equal(text.slice(s.contentStart,s.contentEnd),'第二章　海');
  assert.equal(text.slice(s.end),'次の文。');
  assert.equal(shown(text,0,text.length),'前の文。\n\n第二章　海次の文。');
  same(context.sectionRanges('§§§§ §§ §§\n§§'),[]);

  // The page before ends at the title even with room left, the title has its own page, and the order is kept.
  let pages=await layout(text);
  same(shape(pages),['T','S','T']);
  assert.equal(text.slice(pages[1].start,pages[1].end),'§§第二章　海§§\n\n');
  assert.equal(pages.map(p=>text.slice(p.start,p.end)).join(''),text);

  // A long chapter still ends its last page at the title.
  const long='あ'.repeat(120)+'\n§§二§§\n'+'い'.repeat(10);
  pages=await layout(long);
  same(shape(pages),['T','T','S','T']);
  assert.equal(pages[1].end,long.indexOf('§'));

  // A title at the very start, consecutive titles and a trailing title never leave blank pages.
  same(shape(await layout('§§一§§\n本文')),['S','T']);
  same(shape(await layout('§§上§§\n§§一§§\n本文\n§§終§§\n')),['S','S','T','S']);
  // Blank lines left alone before a title join the page before it.
  const blank='あ'.repeat(80)+'\n\n\n§§二§§\n後';
  pages=await layout(blank);
  same(shape(pages),['T','S','T']);
  assert.equal(pages[0].end,blank.indexOf('§'));

  // Ruby and bold work inside a title; markup crossing a title is left as written.
  const ruby='§§[[邂逅]]<<かいこう>>と**夜**§§\n';
  const ranges=context.getMarkupRanges(ruby);
  same(ranges.filter(r=>r.type==='ruby').length,1);
  same(ranges.decorations.length,1);
  assert.equal(context.getMarkupRanges('**前§§題§§後**').decorations.length,0);
  assert.equal(context.getMarkupRanges('$!img(a)§§題§§').filter(r=>r.type==='image').length,1);

  // <br> breaks a title into lines; it only counts inside a title and is never split from itself.
  const broken='§§第二章<br>海辺の<BR/>町§§\n本文<br>';
  same(context.typesetRuns(broken,0,broken).filter(r=>r.kind==='title-break').map(r=>r.text),['<br>','<BR/>']);
  assert.equal(context.typesetRuns('本文<br>',0,'本文<br>').some(r=>r.kind==='title-break'),false);
  assert.ok(!context.boundaries(broken).some(i=>i>broken.indexOf('<br>')&&i<broken.indexOf('<br>')+4));
  same(shape(await layout(broken)),['S','T']);

  // ^ at the start of a title line moves that line to the top and is hidden; elsewhere it is ordinary text.
  const aligned='§§^第二章<br>海^辺<br>^町§§\n^本文';
  same(context.typesetRuns(aligned,0,aligned).filter(r=>r.kind!=='writing-marker'&&r.kind!=='title-break').map(r=>r.text).join(''),'第二章海^辺町^本文');
  const titlePage={start:0,end:aligned.indexOf('^本文'),section:true};
  same(context.sectionLines(aligned,titlePage).map(l=>[aligned.slice(l.start,l.end),l.top]),[['§§^第二章',true],['<br>海^辺',false],['<br>^町§§\n',true]]);
  same(context.sectionLines('§§一§§',{start:0,end:6}).map(l=>l.top),[false]);

  // §§§§ ends the page; it is hidden with the whitespace after it, and is never an empty title.
  const forced='前の文。\n§§§§\n\n次の文。';
  same(context.getMarkupRanges(forced).sections,[]);
  assert.equal(shown(forced,0,forced.length),'前の文。\n次の文。');
  pages=await layout(forced);
  same(shape(pages),['T','T']);
  assert.equal(pages[0].end,forced.indexOf('§'));
  assert.equal(pages.map(p=>forced.slice(p.start,p.end)).join(''),forced);
  // Only blank lines are hidden: the indent of the next paragraph stays, and trailing whitespace at the end goes with the marker.
  for(const marker of ['§§二§§','§§§§']){
    const indented=marker+'\n　\n\n　次の段落。',[r]=[...context.sectionRanges(indented),...context.pageBreakRanges(indented)];
    assert.equal(indented.slice(r.end),'　次の段落。');
    const tail=marker+'\n　 \n';
    assert.equal([...context.sectionRanges(tail),...context.pageBreakRanges(tail)][0].end,tail.length);
  }
  // Only exactly four count; § runs of other lengths stay as written.
  same(context.pageBreakRanges('a§§§b§§§§§c').length,0);
  // No blank pages: a break at the end, before a title, after a title, or twice in a row.
  same(shape(await layout('本文\n§§§§\n')),['T']);
  same(shape(await layout('本文\n§§§§\n§§二§§\n後')),['T','S','T']);
  same(shape(await layout('§§一§§\n§§§§\n本文')),['S','T']);
  same(shape(await layout('前\n§§§§\n§§§§\n後')),['T','T']);
  same(shape(await layout('§§§§\n本文')),['T']);
  pages=await layout('前\n§§§§\n§§二§§\n後',true);
  same(shape(pages),['C','T','S','T']);
  assert.equal(pages[0].contents[0].page,2);

  // Illustrations around a title keep their places.
  same(shape(await layout('前\n$!img(a)\n§§二§§\n後')),['T','[a]','S','T']);

  // The contents come first and point at each section page; they fill more pages when needed.
  const book='序\n§§一§§\n本文\n§§二§§\n本文';
  pages=await layout(book,true);
  same(shape(pages),['C','T','S','T','S','T']);
  same(pages[0].contents.map(x=>[book.slice(x.start,x.end),x.page]),[['一',2],['二',4]]);
  assert.ok(pages[0].first);
  context.pages=pages;assert.equal(context.findPage(0),1,'reading positions never land on the contents');
  // A title page comes first, the contents after it, and the page numbers count it.
  const titled=[{title:true,start:0,end:0},...(await layout(book))];
  pages=context.addContents(book,titled,context.getMarkupRanges(book).sections,100,100);
  same(shape(pages),['P','C','T','S','T','S','T']);
  same(pages[1].contents.map(x=>x.page),[3,5]);
  for(const x of pages[1].contents)assert.ok(pages[x.page].section);
  same(pages.map(context.frontPage),[true,true,false,false,false,false,false]);
  context.pages=pages;assert.equal(context.findPage(0),2);
  // The title page splits a lead-in at the last full-width space; half-width spaces and edge spaces do not split.
  same(context.splitTitle('蓮ノ空女学院スクールアイドルクラブ１０１期活動記録　叶えた夢のそのムコウに'),{lead:'蓮ノ空女学院スクールアイドルクラブ１０１期活動記録',main:'叶えた夢のそのムコウに'});
  same(context.splitTitle('シリーズ　第二巻　海辺の町'),{lead:'シリーズ　第二巻',main:'海辺の町'});
  for(const t of ['雨あがりの栞','Hello World','　前に空白','後ろに空白　'])same(context.splitTitle(t),{lead:'',main:t.trim()});
  const many=Array.from({length:12},(_,i)=>'§§第'+i+'章のとても長い見出し§§\n本文').join('\n');
  pages=await layout(many,true);
  const contents=pages.filter(p=>p.contents);
  assert.ok(contents.length>1);
  assert.equal(contents.flatMap(p=>p.contents).length,12);
  for(const x of contents.flatMap(p=>p.contents))assert.ok(pages[x.page].section&&many.slice(pages[x.page].start).startsWith('§§'+many.slice(x.start,x.end)));
  same(shape(await layout('本文だけ',true)),['T']);
  assert.equal(context.kanjiNumber(105),'一〇五');

  // A rendered contents entry is a button holding the title without its markers.
  const el=node();context.fillContents(el,pages[0],many);
  assert.equal(el.children[0].textContent,'目次');
  assert.equal(el.children.length,pages[0].contents.length+1);
  assert.equal(el.children[1].type,'button');
  assert.equal(el.children[1].textContent,'第0章のとても長い見出し');
  console.log('Section title pages and the table of contents passed.');
})().catch(e=>{console.error(e);process.exit(1);});
