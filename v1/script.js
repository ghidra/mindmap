/*****************************************************************************************
 * Mind‑Map Tool – Vanilla JS
 * Split into standalone script (requires index.html & style.css)
 *****************************************************************************************/

// ---------- Data ---------- //
let nodes = JSON.parse(localStorage.getItem('mindmap')) || [];
let currentPath = [];               // stack of node ids tracing the drill‑down path
let draggingFrom = null;            // id of node being linked from
let draggingNode = null;            // reference to node currently dragged
let offsetX = 0, offsetY = 0;       // cursor offsets while dragging

// ---------- DOM ---------- //
const canvas       = document.getElementById('canvas');
const svg          = document.getElementById('connections');
const clearBtn     = document.getElementById('clearBtn');
const exportBtn    = document.getElementById('exportBtn');
const importInput  = document.getElementById('importInput');
const breadcrumbEl = document.getElementById('breadcrumb');

// ---------- Helpers ---------- //
const saveMap = () => localStorage.setItem('mindmap', JSON.stringify(nodes));

function getCurrentArray() {
  let arr = nodes;
  for (const id of currentPath) arr = arr.find(n => n.id === id).children;
  return arr;
}

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ---------- CRUD ---------- //
function handleCanvasClick(e){
  if(e.target!==canvas) return;
  const rect=canvas.getBoundingClientRect();
  const x=e.clientX-rect.left, y=e.clientY-rect.top;
  const arr=getCurrentArray();
  if(arr.some(n=>Math.hypot(n.x-x,n.y-y)<50)) return; // 50 px threshold
  arr.push({id:generateId(),x,y,title:'New Node',color:'#ffffff',expanded:true,connections:[],children:[]});
  render();
}

function connectNodes(fromId,toId){
  const arr=getCurrentArray();
  const from=arr.find(n=>n.id===fromId);
  if(from && !from.connections.includes(toId)) from.connections.push(toId);
}

// ---------- UI Rendering ---------- //
function render(){
  const arr=getCurrentArray();
  canvas.innerHTML='';
  svg.innerHTML='';
  // Nodes & internals
  arr.forEach(node=>renderNode(node,arr));
  // Connections (only within current level)
  arr.forEach(from=>{
    from.connections.forEach(tid=>{
      const to=arr.find(n=>n.id===tid);
      if(to){
        const line=document.createElementNS('http://www.w3.org/2000/svg','line');
        line.setAttribute('x1',from.x+60);
        line.setAttribute('y1',from.y+20);
        line.setAttribute('x2',to.x+60);
        line.setAttribute('y2',to.y+20);
        line.setAttribute('stroke','black');
        svg.appendChild(line);
      }
    });
  });
  updateBreadcrumb();
  saveMap();
}

function renderNode(node,arr){
  const el=document.createElement('div');
  el.className='node';
  el.style.left=node.x+'px';
  el.style.top =node.y+'px';
  el.style.backgroundColor=node.color;

  el.onmousedown=(ev)=>{
    if(['INPUT','BUTTON'].includes(ev.target.tagName)) return;
    draggingNode=node; offsetX=ev.offsetX; offsetY=ev.offsetY;
  };

  const titleInput=document.createElement('input');
  titleInput.type='text';
  titleInput.value=node.title;
  titleInput.oninput=e=>{node.title=e.target.value; saveMap();};
  el.appendChild(titleInput);

  const linkBtn=document.createElement('button');
  linkBtn.textContent='Link';
  linkBtn.onclick=ev=>{
    ev.stopPropagation();
    if(draggingFrom){ connectNodes(draggingFrom,node.id); draggingFrom=null; render(); }
    else draggingFrom=node.id;
  };
  el.appendChild(linkBtn);

  const toggleBtn=document.createElement('button');
  toggleBtn.textContent=node.expanded?'-':'+';
  toggleBtn.onclick=ev=>{ ev.preventDefault(); ev.stopPropagation(); node.expanded=!node.expanded; render(); };
  el.appendChild(toggleBtn);

  const colorInput=document.createElement('input');
  colorInput.type='color'; colorInput.value=node.color;
  colorInput.onchange=e=>{node.color=e.target.value; render();};
  el.appendChild(colorInput);

  const exBtn=document.createElement('button');
  exBtn.textContent='Examine';
  exBtn.onclick=ev=>{ev.stopPropagation(); currentPath.push(node.id); render();};
  el.appendChild(exBtn);

  if(node.children.length) el.append(' 📁');

  const addChildBtn = document.createElement('button');
  addChildBtn.textContent = '+ Child';
  addChildBtn.onclick = ev => {
    ev.stopPropagation();
    node.children.push({id: generateId(), title: 'Child', x: 50, y: 50, color: '#ffffff', expanded: true, connections: [], children: []});
    render();
  };
  el.appendChild(addChildBtn);

  if(node.expanded && node.children.length){
    const list=document.createElement('ul'); list.className='child-list';
    node.children.forEach((child,idx)=>{
      const li=document.createElement('li');
      const span=document.createElement('span'); span.textContent=child.title; li.appendChild(span);
      if(child.children.length) li.append(' 📁');
      const rm=document.createElement('button'); rm.textContent='x';
      rm.onclick=ev=>{ ev.stopPropagation(); node.children.splice(idx,1); render(); };
      li.appendChild(rm);
      li.onclick=ev=>{ ev.stopPropagation(); currentPath.push(child.id); render(); };
      list.appendChild(li);
    });
    el.appendChild(list);
  }

  canvas.appendChild(el);
}

function updateBreadcrumb(){
  breadcrumbEl.innerHTML='';
  const rootBtn=document.createElement('button');
  rootBtn.textContent='Root';
  rootBtn.onclick=()=>{currentPath=[]; render();};
  breadcrumbEl.appendChild(rootBtn);
  let walker=nodes; let pathAccum=[];
  currentPath.forEach((id,idx)=>{
    const n=walker.find(nn=>nn.id===id);
    if(!n) return; pathAccum.push(id); walker=n.children;
    const btn=document.createElement('button');
    btn.textContent=' > '+n.title;
    btn.onclick=()=>{currentPath=currentPath.slice(0,idx+1); render();};
    breadcrumbEl.appendChild(btn);
  });
}

// ---------- Event wiring ---------- //
canvas.addEventListener('click',handleCanvasClick);
clearBtn.onclick = () => { localStorage.removeItem('mindmap'); nodes=[]; currentPath=[]; render(); };
exportBtn.onclick= () => { const blob=new Blob([JSON.stringify(nodes,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='mindmap.json'; a.click(); };
importInput.onchange = e=>{ const file=e.target.files[0]; if(!file) return; const fr=new FileReader(); fr.onload=ev=>{ try{ nodes=JSON.parse(ev.target.result); currentPath=[]; render(); }catch(err){ alert('Invalid file'); } }; fr.readAsText(file); };

document.addEventListener('mouseup',()=>draggingNode=null);
document.addEventListener('mousemove',e=>{ if(!draggingNode) return; const rect=canvas.getBoundingClientRect(); draggingNode.x=e.clientX-rect.left-offsetX; draggingNode.y=e.clientY-rect.top-offsetY; render(); });

// ---------- Initial paint ---------- //
render();
