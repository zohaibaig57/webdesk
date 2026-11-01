import express from "express";
import cors from "cors";
import { chromium } from "playwright";
import { WebSocketServer } from "ws";
import http from "http";
import crypto from "crypto";
import dns from "dns/promises";
import net from "net";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/stream" });
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const PORT = Number(process.env.PORT || 3000);
const sessions = new Map();
const MAX_SESSIONS = Number(process.env.MAX_SESSIONS || 5);
let browser;

function validPublicHost(host) {
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
  if (net.isIP(host)) {
    const parts = host.split(".").map(Number);
    if (parts.length === 4) {
      const [a,b] = parts;
      if (a===10 || a===127 || a===0 || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&b===168) || a>=224) return false;
    }
    if (host.includes(":") && (host==="::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80"))) return false;
    return true;
  }
  return true;
}
async function checkUrl(raw) {
  let url;
  try { url = new URL(raw.includes("://") ? raw : `https://${raw}`); } catch { throw new Error("Enter a valid website URL."); }
  if (!["http:","https:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS websites are allowed.");
  if (!validPublicHost(url.hostname)) throw new Error("Local and private network addresses are blocked.");
  try {
    const records = await dns.lookup(url.hostname, {all:true});
    if (records.some(r => !validPublicHost(r.address))) throw new Error("Private network destinations are blocked.");
  } catch (e) { if (e.message.includes("blocked")) throw e; }
  return url.toString();
}
async function getBrowser() {
  if (!browser) browser = await chromium.launch({headless:true, args:["--no-sandbox","--disable-dev-shm-usage"]});
  return browser;
}
async function getSession(id) {
  const s = sessions.get(id);
  if (!s) throw new Error("Browser session not found. Start a new session.");
  return s;
}
async function snapshot(s) {
  if (s.closed) return;
  try {
    const image = await s.page.screenshot({type:"jpeg",quality:65, timeout:5000});
    for (const ws of s.clients) if (ws.readyState===1) ws.send(image);
  } catch {}
}
async function closeSession(id) {
  const s=sessions.get(id); if (!s) return;
  s.closed=true; sessions.delete(id);
  for (const ws of s.clients) try { ws.close(); } catch {}
  try { await s.context.close(); } catch {}
}
app.post("/api/session", async (req,res) => {
  try {
    if (sessions.size >= MAX_SESSIONS) return res.status(429).json({error:"Server is busy. Please try again later."});
    const url=await checkUrl(req.body.url || "https://example.com");
    const b=await getBrowser();
    const context=await b.newContext({
      viewport:{width:1366,height:768},
      userAgent:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      deviceScaleFactor:1,
      isMobile:false,
      hasTouch:false,
      acceptDownloads:true
    });
    const page=await context.newPage();
    const id=crypto.randomUUID();
    const s={id,context,page,clients:new Set(),closed:false};
    sessions.set(id,s);
    page.on("close",()=>closeSession(id));
    await page.goto(url,{waitUntil:"domcontentloaded",timeout:45000}).catch(()=>{});
    res.json({id,url:page.url(),title:await page.title().catch(()=>"WebDesk")});
  } catch(e) { res.status(400).json({error:e.message || "Could not start browser."}); }
});
app.post("/api/:id/navigate", async(req,res)=>{
  try { const s=await getSession(req.params.id); const url=await checkUrl(req.body.url); await s.page.goto(url,{waitUntil:"domcontentloaded",timeout:45000}); res.json({url:s.page.url(),title:await s.page.title()}); }
  catch(e){res.status(400).json({error:e.message});}
});
app.post("/api/:id/action", async(req,res)=>{
  try {
    const s=await getSession(req.params.id); const {type,x,y,button,key,text,deltaY}=req.body;
    if(type==="click") await s.page.mouse.click(x,y,{button:button||"left"});
    else if(type==="move") await s.page.mouse.move(x,y);
    else if(type==="down") await s.page.mouse.down();
    else if(type==="up") await s.page.mouse.up();
    else if(type==="wheel") await s.page.mouse.wheel(0,deltaY||0);
    else if(type==="key") await s.page.keyboard.press(key);
    else if(type==="type") await s.page.keyboard.type(text||"");
    else if(type==="back") await s.page.goBack({waitUntil:"domcontentloaded",timeout:20000}).catch(()=>{});
    else if(type==="forward") await s.page.goForward({waitUntil:"domcontentloaded",timeout:20000}).catch(()=>{});
    else if(type==="reload") await s.page.reload({waitUntil:"domcontentloaded",timeout:30000}).catch(()=>{});
    else if(type==="fullscreen") {}
    await snapshot(s); res.json({ok:true,url:s.page.url(),title:await s.page.title().catch(()=>"")});
  } catch(e){res.status(400).json({error:e.message});}
});
app.delete("/api/:id",async(req,res)=>{await closeSession(req.params.id);res.json({ok:true});});
wss.on("connection",async(ws,req)=>{
  const id=new URL(req.url,"http://localhost").searchParams.get("id");
  const s=sessions.get(id); if(!s){ws.close();return;}
  s.clients.add(ws); ws.on("close",()=>s.clients.delete(ws)); await snapshot(s);
  const timer=setInterval(()=>snapshot(s),700);
  ws.on("close",()=>clearInterval(timer));
});
server.listen(PORT,()=>console.log(`WebDesk running at http://localhost:${PORT}`));
process.on("SIGINT",async()=>{for(const id of sessions.keys()) await closeSession(id); if(browser) await browser.close(); process.exit(0);});
