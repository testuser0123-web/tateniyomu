const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../dist/index.html','utf8'),script=html.match(/<script>\n([\s\S]*?)<\/script>/)[1];new vm.Script(script);
const context=vm.createContext({TextDecoder,Uint8Array});vm.runInContext(script.slice(script.indexOf('function decodeTextFile'),script.indexOf("$('choose-text-file').onclick")),context);
for(const [bytes,expected,encoding] of [[Buffer.from('日本語の本文'),'日本語の本文','utf-8'],[Buffer.from('efbbbf','hex'),'', 'utf-8'],[Buffer.from('93fa967b8cea','hex'),'日本語','shift_jis'],[Buffer.from('plain text'),'plain text','utf-8']]){const r=context.decodeTextFile(bytes);assert.equal(r.text,expected);assert.equal(r.encoding,encoding);}
assert.throws(()=>context.decodeTextFile(Buffer.from('fffe4100','hex')));
assert.throws(()=>context.decodeTextFile(Buffer.from('81','hex')));
assert.throws(()=>context.decodeTextFile(Buffer.from('93fa967b8cea','hex'),'utf-8'));
assert.equal(context.decodeTextFile(Buffer.from('93fa967b8cea','hex'),'shift_jis').text,'日本語');
console.log('UTF-8, BOM, Shift_JIS, ASCII, invalid bytes and manual override passed.');
