function node(tag=''){return {tag,style:{},children:[],get textContent(){return this.children.map(n=>n.textContent).join('');},set textContent(text){this.children=[{textContent:text}];},append(n){this.children.push(n);},replaceChildren(){this.children=[];}};}
const document={createElement:node,createTextNode:text=>({textContent:text})};
function marked(n){return n.tag==='mark'?n.textContent:(n.children||[]).map(marked).join('');}
module.exports={node,document,marked};
