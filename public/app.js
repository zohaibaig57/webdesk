let sessionId=null, socket=null, lastImage=null;
const $=id=>document.getElementById(id);
async function api(path,opts={}){const r=await fetch(path,{headers:{"Content-Type":"application/json"},...opts});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"Request failed");return data}
function showBrowser(){ $("home").classList.add("hidden");$("browser").classList.remove("hidden");}
function connectStream(){if(socket)socket.close();const proto=location.protocol==="https:"?"wss":"ws";socket=new WebSocket(`${proto}://${location.host}/stream?id=${sessionId}`);socket.binaryType="blob";socket.onmessage=e=>{if(typeof e.data!=="string"){const url=URL.createObjectURL(e.data);const old=$("screen").dataset.url;$("screen").src=url;$("screen").dataset.url=url;if(old)URL.revokeObjectURL(old);$("screen").style.display="block";$("loading").style.display="none";}};socket.onclose=()=>{};}
async function start(url){try{$("loading").textContent="Starting desktop browser…";showBrowser();const d=await api("/api/session",{method:"POST",body:JSON.stringify({url})});sessionId=d.id;$("address").value=d.url;$("tabTitle").textContent=d.title||"Website";connectStream();}catch(e){alert(e.message);$("browser").classList.add("hidden");$("home").classList.remove("hidden");}}
async function action(type,extra={}){if(!sessionId)return;try{const d=await api(`/api/${sessionId}/action`,{method:"POST",body:JSON.stringify({type,...extra})});if(d.url)$("address").value=d.url;if(d.title)$("tabTitle").textContent=d.title;}catch(e){console.error(e)}}
$("startForm").addEventListener("submit",e=>{e.preventDefault();start($("startUrl").value.trim())});
$("navForm").addEventListener("submit",async e=>{e.preventDefault();try{const d=await api(`/api/${sessionId}/navigate`,{method:"POST",body:JSON.stringify({url:$("address").value.trim()})});$("address").value=d.url;$("tabTitle").textContent=d.title; }catch(err){alert(err.message)}});
document.querySelectorAll("[data-url]").forEach(b=>b.addEventListener("click",()=>start(b.dataset.url)));
$("back").onclick=$("mback").onclick=()=>action("back");$("forward").onclick=()=>action("forward");$("reload").onclick=$("mreload").onclick=()=>action("reload");$("mhome").onclick=()=>{if(sessionId)location.reload()};
$("newTab").onclick=()=>start("https://www.google.com");
async function exit(){if(sessionId)await fetch(`/api/${sessionId}`,{method:"DELETE"});if(socket)socket.close();sessionId=null;$("browser").classList.add("hidden");$("home").classList.remove("hidden");$("screen").style.display="none";}
$("exit").onclick=exit;
$("full").onclick=$("mfull").onclick=()=>{const el=$("screenWrap");if(!document.fullscreenElement)el.requestFullscreen?.();else document.exitFullscreen?.()};
const screen=$("screen");
function coords(e){const r=screen.getBoundingClientRect();return{x:Math.round((e.clientX-r.left)*1366/r.width),y:Math.round((e.clientY-r.top)*768/r.height)}}
screen.addEventListener("click",e=>action("click",coords(e)));
screen.addEventListener("wheel",e=>{e.preventDefault();action("wheel",{deltaY:e.deltaY*1.5})},{passive:false});
document.addEventListener("keydown",e=>{if(!sessionId||["INPUT","TEXTAREA"].includes(document.activeElement.tagName))return;if(e.key==="Tab")e.preventDefault();action("key",{key:e.key===" "?"Space":e.key})});
screen.addEventListener("contextmenu",e=>{e.preventDefault();action("click",{...coords(e),button:"right"})});
screen.addEventListener("pointerdown",e=>{if(e.pointerType==="touch")return;screen.setPointerCapture(e.pointerId)});
