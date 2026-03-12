// ─────────────────────────────────────────────
//  speedtest-card.js  v1.1
//  Cyber-themed Speedtest Lovelace card
//  Drop in config/www/ and add as resource
// ─────────────────────────────────────────────

const ST_HISTORY_KEY = "speedtest_card_history";
const ST_MAX_HISTORY = 100;

const C = {
  bg:"#0a0e1a", bg2:"#0d1929", bg3:"#0b1422",
  bdr:"#1e2d4a", bdr2:"#1a2a40",
  cyan:"#00d4ff", green:"#00ff9d", purple:"#a78bfa",
  blue:"#7ab8d4", steel:"#3a8fa8", dim:"#64748b",
  text:"#e2e8f0", navy:"#2a6a9a", orange:"#fb923c",
  yellow:"#fbbf24", red:"#ef4444", emerald:"#4ade80",
};

const MC = {
  download:{ color:C.cyan,    glow:"rgba(0,212,255,0.15)",   label:"DOWNLOAD", unit:"Mbps", icon:"↓", key:"dl"   },
  upload:  { color:C.emerald, glow:"rgba(74,222,128,0.15)",  label:"UPLOAD",   unit:"Mbps", icon:"↑", key:"ul"   },
  ping:    { color:C.yellow,  glow:"rgba(251,191,36,0.15)",  label:"PING",     unit:"ms",   icon:"◎", key:"ping" },
};

// ── helpers ──
function hex2rgb(h){ h=h.replace("#",""); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function loadHistory(){ try{ return JSON.parse(localStorage.getItem(ST_HISTORY_KEY)||"[]"); }catch{ return []; } }
function saveHistory(h){ try{ localStorage.setItem(ST_HISTORY_KEY,JSON.stringify(h.slice(-ST_MAX_HISTORY))); }catch{} }
function addEntry(dl,ul,ping,isp,server){
  const h=loadHistory(), last=h[h.length-1];
  if(last && last.dl===dl && last.ul===ul && last.ping===ping) return h;
  h.push({ts:Date.now(),dl,ul,ping,isp:isp||"",server:server||""});
  saveHistory(h); return h;
}
function filterH(h,hours){ if(!hours) return h; const c=Date.now()-hours*3600000; return h.filter(e=>e.ts>=c); }
function fmt(v){ return v>=100?v.toFixed(0):v>=10?v.toFixed(1):v.toFixed(2); }

// ── Arc gauge ──
function drawArc(canvas, value, max, color, glow){
  const dpr=window.devicePixelRatio||1;
  const sz=canvas.offsetWidth||180;
  canvas.width=sz*dpr; canvas.height=sz*0.58*dpr;
  canvas.style.height=(sz*0.58)+"px";
  const ctx=canvas.getContext("2d"); ctx.scale(dpr,dpr);
  const cx=sz/2, cy=sz*0.58, r=sz*0.41;
  const sA=Math.PI*1.1, eA=Math.PI*1.9;
  const pct=Math.min(value/max,1), vA=sA+(eA-sA)*pct;
  ctx.beginPath(); ctx.arc(cx,cy,r+4,sA,eA);
  ctx.strokeStyle=glow.replace("0.15","0.05"); ctx.lineWidth=2; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx,cy,r,sA,eA);
  ctx.strokeStyle="rgba(255,255,255,0.04)"; ctx.lineWidth=sz*0.068; ctx.lineCap="round"; ctx.stroke();
  if(pct>0.01){
    ctx.save(); ctx.shadowColor=color; ctx.shadowBlur=16;
    const g=ctx.createLinearGradient(cx-r,cy,cx+r,cy);
    g.addColorStop(0,color+"66"); g.addColorStop(1,color);
    ctx.beginPath(); ctx.arc(cx,cy,r,sA,vA);
    ctx.strokeStyle=g; ctx.lineWidth=sz*0.068; ctx.lineCap="round"; ctx.stroke(); ctx.restore();
    const tx=cx+Math.cos(vA)*r, ty=cy+Math.sin(vA)*r;
    const rgb=hex2rgb(color);
    [8,5,2].forEach((rr,i)=>{ ctx.beginPath(); ctx.arc(tx,ty,rr,0,Math.PI*2); ctx.fillStyle=`rgba(${rgb},${[0.15,0.35,1][i]})`; ctx.fill(); });
  }
  for(let i=0;i<=10;i++){
    const a=sA+(eA-sA)*(i/10),isM=i%5===0,inn=r-sz*0.09,out=r-sz*0.04;
    ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*inn,cy+Math.sin(a)*inn); ctx.lineTo(cx+Math.cos(a)*out,cy+Math.sin(a)*out);
    ctx.strokeStyle=isM?"rgba(255,255,255,0.18)":"rgba(255,255,255,0.06)"; ctx.lineWidth=isM?2:1; ctx.stroke();
  }
}

// ── Sparkline ──
function drawSpark(canvas, data, color){
  const dpr=window.devicePixelRatio||1;
  const W=canvas.offsetWidth||200, H=canvas.offsetHeight||44;
  canvas.width=W*dpr; canvas.height=H*dpr;
  const ctx=canvas.getContext("2d"); ctx.scale(dpr,dpr);
  if(data.length<2) return;
  const mn=Math.min(...data)*0.95, mx=Math.max(...data)*1.05||1;
  const pts=data.map((v,i)=>[i*(W/(data.length-1)), H-4-(v-mn)/(mx-mn)*(H-8)]);
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,color+"55"); g.addColorStop(1,color+"00");
  ctx.beginPath(); ctx.moveTo(pts[0][0],H);
  pts.forEach(([x,y])=>ctx.lineTo(x,y));
  ctx.lineTo(pts[pts.length-1][0],H); ctx.closePath(); ctx.fillStyle=g; ctx.fill();
  ctx.beginPath(); pts.forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y));
  ctx.strokeStyle=color; ctx.lineWidth=1.8; ctx.lineJoin="round";
  ctx.shadowColor=color; ctx.shadowBlur=6; ctx.stroke(); ctx.shadowBlur=0;
  const [lx,ly]=pts[pts.length-1];
  ctx.beginPath(); ctx.arc(lx,ly,3,0,Math.PI*2); ctx.fillStyle=color; ctx.shadowColor=color; ctx.shadowBlur=8; ctx.fill();
}

// ── Full chart ──
function drawChart(canvas, datasets, labels, hoverIdx){
  const dpr=window.devicePixelRatio||1;
  const W=canvas.offsetWidth||680, H=canvas.offsetHeight||160;
  canvas.width=W*dpr; canvas.height=H*dpr;
  const ctx=canvas.getContext("2d"); ctx.scale(dpr,dpr);
  ctx.fillStyle="#060a14"; ctx.fillRect(0,0,W,H);
  const PAD={top:14,right:20,bottom:28,left:48};
  const IW=W-PAD.left-PAD.right, IH=H-PAD.top-PAD.bottom;
  const n=datasets[0].data.length;
  const dmax=Math.max(...datasets.flatMap(d=>d.data))*1.12||1;

  // store state on canvas
  canvas._chartState={PAD,IW,IH,n,dmax,datasets,labels,H,W};

  for(let g=0;g<=4;g++){
    const y=PAD.top+IH-(g/4)*IH;
    ctx.beginPath(); ctx.moveTo(PAD.left,y); ctx.lineTo(PAD.left+IW,y);
    ctx.strokeStyle="rgba(255,255,255,0.04)"; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle="#1a3050"; ctx.font=`9px 'Courier New'`; ctx.textAlign="right";
    ctx.fillText(((g/4)*dmax).toFixed(0),PAD.left-6,y+4);
  }
  const step=Math.max(1,Math.floor(n/7));
  labels.forEach((lbl,i)=>{
    if(i%step!==0) return;
    const x=PAD.left+(i/(n-1))*IW;
    ctx.fillStyle="#162230"; ctx.font=`9px 'Courier New'`; ctx.textAlign="center";
    ctx.fillText(lbl,x,H-6);
    ctx.beginPath(); ctx.moveTo(x,PAD.top); ctx.lineTo(x,PAD.top+IH);
    ctx.strokeStyle="rgba(255,255,255,0.025)"; ctx.stroke();
  });

  datasets.forEach(({data,color})=>{
    const pts=data.map((v,i)=>[PAD.left+(i/(n-1))*IW, PAD.top+IH-(v/dmax)*IH]);
    const grad=ctx.createLinearGradient(0,PAD.top,0,PAD.top+IH);
    grad.addColorStop(0,color+"2a"); grad.addColorStop(1,color+"00");
    ctx.beginPath(); ctx.moveTo(pts[0][0],PAD.top+IH);
    pts.forEach(([x,y])=>ctx.lineTo(x,y));
    ctx.lineTo(pts[n-1][0],PAD.top+IH); ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
    ctx.beginPath(); pts.forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y));
    ctx.strokeStyle=color; ctx.lineWidth=2; ctx.lineJoin="round";
    ctx.shadowColor=color; ctx.shadowBlur=8; ctx.stroke(); ctx.shadowBlur=0;
    const [lx,ly]=pts[pts.length-1];
    ctx.beginPath(); ctx.arc(lx,ly,4,0,Math.PI*2); ctx.fillStyle=color;
    ctx.shadowColor=color; ctx.shadowBlur=12; ctx.fill(); ctx.shadowBlur=0;
  });

  // hover overlay
  if(hoverIdx != null){
    const x=PAD.left+(hoverIdx/(n-1))*IW;
    // vertical line
    ctx.save(); ctx.setLineDash([3,4]);
    ctx.beginPath(); ctx.moveTo(x,PAD.top); ctx.lineTo(x,PAD.top+IH);
    ctx.strokeStyle="rgba(255,255,255,0.12)"; ctx.lineWidth=1; ctx.stroke(); ctx.restore();
    datasets.forEach(({data,color})=>{
      const v=data[hoverIdx];
      const y=PAD.top+IH-(v/dmax)*IH;
      const rgb=hex2rgb(color);
      ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2); ctx.fillStyle=`rgba(${rgb},0.18)`; ctx.fill();
      ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fillStyle=color;
      ctx.shadowColor=color; ctx.shadowBlur=14; ctx.fill(); ctx.shadowBlur=0;
      ctx.save(); ctx.setLineDash([3,4]);
      ctx.beginPath(); ctx.moveTo(x,y+5); ctx.lineTo(x,PAD.top+IH);
      ctx.strokeStyle=`rgba(${rgb},0.18)`; ctx.lineWidth=1; ctx.stroke(); ctx.restore();
    });
  }
}

// ── Tooltip ──
function attachTooltip(canvas, tooltipEl, crosshairEl){
  function getIdx(e){
    const rect=canvas.getBoundingClientRect();
    const mx=(e.clientX!=null?e.clientX:e.touches[0].clientX)-rect.left;
    const my=(e.clientY!=null?e.clientY:e.touches[0].clientY)-rect.top;
    const st=canvas._chartState; if(!st) return null;
    const {PAD,IW,IH,n}=st;
    if(mx<PAD.left||mx>PAD.left+IW||my<0||my>st.H) return null;
    return Math.max(0,Math.min(n-1,Math.round((mx-PAD.left)/IW*(n-1))));
  }
  function show(e){
    const idx=getIdx(e); if(idx==null){ hide(); return; }
    const st=canvas._chartState;
    const {PAD,IW,n,dmax,datasets,labels,H,W}=st;
    const x=PAD.left+(idx/(n-1))*IW;
    crosshairEl.style.left=x+"px"; crosshairEl.classList.add("visible");
    const rows=datasets.map(({data,color,label})=>{
      const v=data[idx], fv=v>=100?v.toFixed(0):v.toFixed(1);
      return `<div class="tt-row"><div class="tt-label"><div class="tt-dot" style="background:${color};box-shadow:0 0 5px ${color}"></div>${label}</div><div class="tt-val" style="color:${color}">${fv}</div></div>`;
    }).join("");
    tooltipEl.innerHTML=`<div class="tt-ts">${labels[idx]||""}</div>${rows}`;
    const ttW=tooltipEl.offsetWidth||160;
    let tx=x; if(tx-ttW/2<8)tx=ttW/2+8; if(tx+ttW/2>W-8)tx=W-ttW/2-8;
    tooltipEl.style.left=tx+"px"; tooltipEl.style.top=(st.PAD.top+2)+"px";
    tooltipEl.classList.add("visible");
    drawChart(canvas, datasets, labels, idx);
  }
  function hide(){
    tooltipEl.classList.remove("visible");
    crosshairEl.classList.remove("visible");
    const st=canvas._chartState;
    if(st) drawChart(canvas, st.datasets, st.labels, null);
  }
  canvas.addEventListener("mousemove",show);
  canvas.addEventListener("mouseleave",hide);
  canvas.addEventListener("touchmove",e=>{e.preventDefault();show(e);},{passive:false});
  canvas.addEventListener("touchend",hide);
}

// ── CSS ──
const CSS = `
  :host { display:block; }
  *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
  .card {
    font-family:'Courier New',monospace; background:#0a0e1a; border-radius:20px; padding:22px;
    color:#e2e8f0; border:1px solid #1e2d4a; position:relative; overflow:hidden;
    box-shadow:0 0 0 1px rgba(0,212,255,0.05),0 30px 80px rgba(0,0,0,0.6),0 0 60px rgba(0,212,255,0.04);
  }
  .topbar { position:absolute;top:0;left:-100%;right:0;height:2px;width:200%; background:linear-gradient(90deg,transparent 0%,#00d4ff 35%,#00ff9d 50%,#a78bfa 65%,transparent 100%); animation:scanline 4s linear infinite; }
  @keyframes scanline{0%{transform:translateX(-30%)}100%{transform:translateX(30%)}}
  .grid-bg { position:absolute;inset:0;pointer-events:none; background-image:linear-gradient(rgba(0,212,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.025) 1px,transparent 1px); background-size:32px 32px; }
  .grid-bg::after { content:'';position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 40%,#0a0e1a 100%); }
  .header { display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;position:relative;gap:10px;flex-wrap:wrap; }
  .title { display:flex;align-items:center;gap:12px;font-weight:800;font-size:15px;color:#00d4ff;letter-spacing:3px;text-transform:uppercase; }
  .pulse { width:10px;height:10px;border-radius:50%;background:#00ff9d;box-shadow:0 0 10px #00ff9d,0 0 20px rgba(0,255,157,0.3);animation:pulse 1.6s ease-in-out infinite;flex-shrink:0; }
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.25;transform:scale(0.7)}}
  .header-right { display:flex;gap:8px;align-items:center;flex-wrap:wrap; }
  .badge { background:#0d1929;border:1px solid #1e3a5a;border-radius:8px;padding:5px 13px;font-size:11px;color:#64b5f6; }
  .badge span { color:#00d4ff;font-weight:600; }
  .details-btn { background:linear-gradient(135deg,rgba(0,212,255,0.1),rgba(0,212,255,0.05));border:1px solid rgba(0,212,255,0.35);border-radius:9px;padding:6px 16px;color:#00d4ff;font-family:inherit;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all 0.2s;box-shadow:0 0 14px rgba(0,212,255,0.08),inset 0 1px 0 rgba(0,212,255,0.1); }
  .details-btn:hover { background:linear-gradient(135deg,rgba(0,212,255,0.2),rgba(0,212,255,0.1));box-shadow:0 0 22px rgba(0,212,255,0.2);transform:translateY(-1px); }
  .gauges { display:flex;gap:14px;margin-bottom:16px; }
  .gauge-box { flex:1;background:linear-gradient(160deg,#0f1928,#0a0e1a);border:1px solid #1a2840;border-radius:16px;padding:18px 14px 16px;display:flex;flex-direction:column;align-items:center;gap:6px;position:relative;overflow:hidden;transition:border-color 0.3s,box-shadow 0.3s; }
  .gauge-box:hover { box-shadow:0 0 28px var(--glow);border-color:var(--gc); }
  .gauge-box::before { content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--gc),transparent);opacity:0.8; }
  .gauge-box::after  { content:'';position:absolute;top:0;left:0;right:0;height:60px;background:linear-gradient(180deg,var(--glow),transparent);opacity:0.25;pointer-events:none; }
  .gauge-label { font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:var(--gc);font-weight:700;display:flex;align-items:center;gap:6px;z-index:1; }
  canvas.arc { display:block;z-index:1; }
  .gauge-value-wrap { text-align:center;margin-top:-8px;z-index:1; }
  .gauge-value { font-size:32px;font-weight:700;color:var(--gc);line-height:1;letter-spacing:-1px;text-shadow:0 0 20px var(--glow); }
  .gauge-unit  { font-size:10px;color:#3a6080;letter-spacing:2.5px;text-transform:uppercase;margin-top:3px; }
  .gauge-divider { width:100%;height:1px;background:linear-gradient(90deg,transparent,#1a2840,transparent);margin:6px 0 4px; }
  .gauge-sub { display:flex;gap:0;width:100%;z-index:1; }
  .gauge-sub-item { flex:1;text-align:center;border-right:1px solid #0e1a28; }
  .gauge-sub-item:last-child { border-right:none; }
  .gauge-sub-label { font-size:8px;color:#2a4560;letter-spacing:1.5px;text-transform:uppercase; }
  .gauge-sub-val   { font-size:11px;color:#3a5570;font-weight:600;margin-top:2px; }
  .sparks { display:flex;gap:14px;margin-bottom:0; }
  .spark-wrap { flex:1; }
  .spark-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:5px; }
  .spark-label   { font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--gc); }
  .spark-current { font-size:11px;font-weight:700; }
  .spark-canvas-wrap { background:linear-gradient(180deg,#0d1929,#080d18);border:1px solid #1a2840;border-radius:8px;padding:6px;overflow:hidden; }
  canvas.spark { display:block;width:100%; }
  .footer { margin-top:14px;display:flex;justify-content:space-between;font-size:10px;color:#1a2e48;letter-spacing:1px;padding-top:10px;border-top:1px solid #0e1a28; }

  /* Modal */
  .modal-overlay { position:fixed;inset:0;background:rgba(4,8,16,0.88);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(8px);animation:fadeIn 0.2s ease; }
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  .modal { background:linear-gradient(160deg,#0d1929,#090e1c);border:1px solid #1e2d4a;border-radius:20px;padding:26px;width:740px;max-width:96vw;max-height:88vh;overflow-y:auto;box-shadow:0 0 0 1px rgba(0,212,255,0.08),0 40px 100px rgba(0,0,0,0.9),0 0 80px rgba(0,212,255,0.07);animation:slideUp 0.22s cubic-bezier(0.22,1,0.36,1);scrollbar-width:thin;scrollbar-color:#1e3a5a transparent;position:relative; }
  .modal::before { content:'';position:absolute;top:0;left:0;right:0;height:2px;border-radius:20px 20px 0 0;background:linear-gradient(90deg,transparent,#00d4ff 30%,#00ff9d 50%,#a78bfa 70%,transparent); }
  @keyframes slideUp{from{opacity:0;transform:translateY(20px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}
  .modal-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:20px; }
  .modal-title  { font-size:14px;font-weight:800;color:#00d4ff;letter-spacing:3px;text-transform:uppercase;display:flex;align-items:center;gap:10px; }
  .modal-close  { background:transparent;border:1px solid #1e3a5a;border-radius:8px;color:#3a5570;font-size:15px;width:32px;height:32px;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:center; }
  .modal-close:hover { border-color:#ef4444;color:#ef4444;box-shadow:0 0 10px rgba(239,68,68,0.2); }
  .period-row { display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap; }
  .period-btn { background:transparent;border:1px solid #1a2840;border-radius:7px;color:#3a5570;font-family:inherit;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:6px 13px;cursor:pointer;transition:all 0.15s; }
  .period-btn.active { background:rgba(0,212,255,0.1);border-color:rgba(0,212,255,0.4);color:#00d4ff;box-shadow:0 0 10px rgba(0,212,255,0.1); }
  .period-btn:hover:not(.active) { border-color:#3a5570;color:#7ab8d4; }
  .stats-row { display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap; }
  .stat-card { flex:1;min-width:100px;background:linear-gradient(160deg,#0d1929,#08101e);border:1px solid #1a2840;border-radius:12px;padding:14px 16px;position:relative;overflow:hidden; }
  .stat-card::before { content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--sc),transparent);opacity:0.5; }
  .stat-card-label { font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#2a4560;margin-bottom:6px; }
  .stat-card-val   { font-size:19px;font-weight:700;color:var(--sc);line-height:1;margin-bottom:4px;text-shadow:0 0 16px var(--sc-glow); }
  .stat-card-unit  { font-size:9px;color:#2a4560;letter-spacing:1.5px;vertical-align:super; }
  .stat-card-sub   { font-size:9px;color:#2a4060; }
  .stat-card-sub b { color:#3a5570; }
  .chart-section { margin-bottom:20px; }
  .chart-title { font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#2a4560;margin-bottom:8px;display:flex;align-items:center;gap:10px; }
  .chart-title .cdot { width:6px;height:6px;border-radius:50%;background:var(--cc);box-shadow:0 0 6px var(--cc);flex-shrink:0; }
  .chart-title::after { content:'';flex:1;height:1px;background:linear-gradient(90deg,#1a2840,transparent); }
  .chart-wrap { position:relative; }
  canvas.chart { display:block;width:100%;border-radius:10px;border:1px solid #1a2840;background:linear-gradient(180deg,#0a0e1a,#060a14);cursor:crosshair; }
  .tt-crosshair { position:absolute;pointer-events:none;top:0;bottom:0;width:1px;background:linear-gradient(180deg,transparent,rgba(255,255,255,0.12) 20%,rgba(255,255,255,0.12) 80%,transparent);opacity:0;transition:opacity 0.1s;z-index:10; }
  .tt-crosshair.visible { opacity:1; }
  .chart-tooltip { position:absolute;pointer-events:none;background:linear-gradient(135deg,#0d1929,#111e35);border:1px solid #1e3a5a;border-radius:10px;padding:10px 14px;font-size:11px;color:#e2e8f0;white-space:nowrap;z-index:100;opacity:0;transition:opacity 0.12s ease;box-shadow:0 8px 32px rgba(0,0,0,0.6),0 0 0 1px rgba(0,212,255,0.08); }
  .chart-tooltip.visible { opacity:1; }
  .chart-tooltip::after { content:'';position:absolute;bottom:-5px;left:50%;width:8px;height:8px;background:#111e35;border-right:1px solid #1e3a5a;border-bottom:1px solid #1e3a5a;transform:translateX(-50%) rotate(45deg); }
  .tt-ts  { font-size:9px;color:#2a4560;letter-spacing:1px;margin-bottom:7px;text-transform:uppercase; }
  .tt-row { display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:3px; }
  .tt-row:last-child { margin-bottom:0; }
  .tt-label { font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#3a5570;display:flex;align-items:center;gap:5px; }
  .tt-dot   { width:6px;height:6px;border-radius:50%;flex-shrink:0; }
  .tt-val   { font-weight:700;font-size:12px; }
  .legend { display:flex;gap:16px;margin-top:6px; }
  .legend-item { display:flex;align-items:center;gap:5px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#2a4560; }
  .legend-dot { width:8px;height:3px;border-radius:2px; }
  .hist-label { font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#2a4560;margin-bottom:8px;display:flex;align-items:center;gap:10px; }
  .hist-label::after { content:'';flex:1;height:1px;background:linear-gradient(90deg,#1a2840,transparent); }
  .hist-wrap { border-radius:10px;border:1px solid #1a2840;overflow:hidden; }
  table { width:100%;border-collapse:collapse;font-size:11px; }
  thead tr { background:linear-gradient(90deg,#0b1422,#0d1929); }
  th { padding:10px 14px;text-align:left;color:#2a4560;font-size:9px;letter-spacing:1.8px;text-transform:uppercase;border-bottom:1px solid #1a2840;white-space:nowrap; }
  tbody tr { border-bottom:1px solid #0a1220;transition:background 0.1s; }
  tbody tr:last-child { border-bottom:none; }
  tbody tr:hover { background:rgba(0,212,255,0.03); }
  td { padding:9px 14px;white-space:nowrap; }
  .td-ts{color:#2a4060;font-size:10px;} .td-dl{color:#00d4ff;font-weight:600;} .td-ul{color:#4ade80;font-weight:600;} .td-pg{color:#fbbf24;font-weight:600;} .td-srv{color:#a78bfa;font-size:10px;}
  .empty-state { text-align:center;padding:40px;color:#2a4060;font-size:12px;letter-spacing:1px; }
`;

// ── Custom Element ──
class SpeedtestCard extends HTMLElement {
  constructor(){
    super();
    this.attachShadow({mode:"open"});
    this._config={};
    this._history=loadHistory();
    this._period=24;
    this._dl=0; this._ul=0; this._ping=0;
    this._ts=null; this._isp=""; this._server="";
  }

  setConfig(config){
    this._config={
      entity_download:"sensor.speedtest_download",
      entity_upload:  "sensor.speedtest_upload",
      entity_ping:    "sensor.speedtest_ping",
      max_download:1000, max_upload:500, max_ping:200,
      ...config
    };
    this._render();
  }

  set hass(hass){
    this._hass=hass;
    const dl  =parseFloat(hass.states[this._config.entity_download]?.state)||0;
    const ul  =parseFloat(hass.states[this._config.entity_upload]?.state)||0;
    const ping=parseFloat(hass.states[this._config.entity_ping]?.state)||0;
    const attr=hass.states[this._config.entity_download]?.attributes||{};
    const isp   =attr.server?.name||attr.source||"";
    const server=attr.server?.location||"";
    const ts    =hass.states[this._config.entity_download]?.last_updated;
    if(dl>0||ul>0||ping>0) this._history=addEntry(dl,ul,ping,isp,server);
    this._dl=dl; this._ul=ul; this._ping=ping;
    this._isp=isp; this._server=server; this._ts=ts;
    this._updateDisplay();
  }

  _render(){
    const s=this.shadowRoot;
    s.innerHTML=`<style>${CSS}</style>
    <div class="card">
      <div class="topbar"></div><div class="grid-bg"></div>
      <div class="header">
        <div class="title"><div class="pulse"></div>Speedtest</div>
        <div class="header-right">
          <div class="badge" id="badge-ts">Last run: <span>—</span></div>
          <button class="details-btn" id="btn-details">⊞ Details</button>
        </div>
      </div>
      <div class="gauges">
        ${Object.entries(MC).map(([m,mc])=>`
          <div class="gauge-box" style="--gc:${mc.color};--glow:${mc.glow}">
            <div class="gauge-label">${mc.icon} ${mc.label}</div>
            <canvas class="arc" id="arc-${m}" style="width:100%;max-width:190px"></canvas>
            <div class="gauge-value-wrap">
              <div class="gauge-value" id="val-${m}" style="color:${mc.color}">—</div>
              <div class="gauge-unit">${mc.unit}</div>
            </div>
            <div class="gauge-divider"></div>
            <div class="gauge-sub" id="sub-${m}">
              <div class="gauge-sub-item"><div class="gauge-sub-label">avg</div><div class="gauge-sub-val">—</div></div>
              <div class="gauge-sub-item"><div class="gauge-sub-label">max</div><div class="gauge-sub-val">—</div></div>
              <div class="gauge-sub-item"><div class="gauge-sub-label">min</div><div class="gauge-sub-val">—</div></div>
            </div>
          </div>`).join("")}
      </div>
      <div class="sparks">
        ${Object.entries(MC).map(([m,mc])=>`
          <div class="spark-wrap" style="--gc:${mc.color}">
            <div class="spark-header">
              <div class="spark-label">${mc.icon} ${mc.label}</div>
              <div class="spark-current" id="spark-cur-${m}" style="color:${mc.color}">—</div>
            </div>
            <div class="spark-canvas-wrap"><canvas class="spark" id="spark-${m}" height="44"></canvas></div>
          </div>`).join("")}
      </div>
      <div class="footer">
        <span id="footer-isp">${this._config.entity_download}</span>
        <span id="footer-server"></span>
      </div>
    </div>`;

    s.getElementById("btn-details").addEventListener("click",()=>this._openModal());
    this._updateDisplay();
  }

  _updateDisplay(){
    const s=this.shadowRoot; if(!s) return;
    const vals={download:this._dl, upload:this._ul, ping:this._ping};
    const maxes={download:this._config.max_download||1000, upload:this._config.max_upload||500, ping:this._config.max_ping||200};

    Object.entries(MC).forEach(([m,mc])=>{
      const v=vals[m]||0;
      const el=s.getElementById(`val-${m}`);
      if(el) el.textContent=m==="ping"?v.toFixed(1):fmt(v);
      const arc=s.getElementById(`arc-${m}`);
      if(arc) requestAnimationFrame(()=>drawArc(arc,v,maxes[m],mc.color,mc.glow));
    });

    // sub-stats
    const h24=filterH(this._history,24);
    if(h24.length>1){
      Object.entries(MC).forEach(([m,mc])=>{
        const arr=h24.map(e=>e[mc.key]).filter(v=>v>0); if(!arr.length) return;
        const avg=arr.reduce((a,b)=>a+b,0)/arr.length, mx=Math.max(...arr), mn=Math.min(...arr);
        const el=s.getElementById(`sub-${m}`);
        if(el) el.innerHTML=`
          <div class="gauge-sub-item"><div class="gauge-sub-label">avg</div><div class="gauge-sub-val">${fmt(avg)}</div></div>
          <div class="gauge-sub-item"><div class="gauge-sub-label">max</div><div class="gauge-sub-val">${fmt(mx)}</div></div>
          <div class="gauge-sub-item"><div class="gauge-sub-label">min</div><div class="gauge-sub-val">${fmt(mn)}</div></div>`;
      });
    }

    // sparklines
    if(this._history.length>1){
      const recent=this._history.slice(-30);
      Object.entries(MC).forEach(([m,mc])=>{
        const data=recent.map(e=>e[mc.key]);
        const sp=s.getElementById(`spark-${m}`);
        if(sp) requestAnimationFrame(()=>drawSpark(sp,data,mc.color));
        const cur=s.getElementById(`spark-cur-${m}`);
        if(cur) cur.textContent=m==="ping"?`${vals[m].toFixed(1)} ms`:`${fmt(vals[m])} Mbps`;
      });
    }

    if(this._ts){
      const d=new Date(this._ts);
      const ts=d.toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
      const bEl=s.getElementById("badge-ts"); if(bEl) bEl.innerHTML=`Last run: <span>${ts}</span>`;
    }
    const ispEl=s.getElementById("footer-isp");
    const srvEl=s.getElementById("footer-server");
    if(ispEl&&this._isp) ispEl.textContent=this._isp;
    if(srvEl&&this._server) srvEl.textContent=this._server;
  }

  _openModal(){
    const s=this.shadowRoot;
    const old=s.getElementById("st-modal"); if(old) old.remove();
    const overlay=document.createElement("div");
    overlay.className="modal-overlay"; overlay.id="st-modal";

    const periods=[{h:6,l:"6 h"},{h:24,l:"24 h"},{h:72,l:"3 d"},{h:168,l:"7 d"},{h:720,l:"30 d"},{h:0,l:"All"}];

    overlay.innerHTML=`
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title"><div class="pulse"></div>Speed History</div>
          <button class="modal-close" id="m-close">✕</button>
        </div>
        <div class="period-row" id="period-row">
          ${periods.map(p=>`<button class="period-btn${p.h===this._period?" active":""}" data-h="${p.h}">${p.l}</button>`).join("")}
        </div>
        <div id="modal-body"></div>
      </div>`;

    overlay.addEventListener("click",e=>{ if(e.target===overlay) overlay.remove(); });
    overlay.querySelector("#m-close").addEventListener("click",()=>overlay.remove());
    overlay.querySelectorAll(".period-btn").forEach(btn=>{
      btn.addEventListener("click",()=>{
        this._period=parseInt(btn.dataset.h);
        overlay.querySelectorAll(".period-btn").forEach(b=>b.classList.toggle("active",b===btn));
        this._renderModalBody(overlay.querySelector("#modal-body"));
      });
    });
    s.appendChild(overlay);
    this._renderModalBody(overlay.querySelector("#modal-body"));
  }

  _renderModalBody(body){
    const hist=filterH(this._history,this._period||0);
    if(hist.length<2){
      body.innerHTML=`<div class="empty-state">⊘ Not enough data for this period.<br><br>Run a speedtest to populate history.</div>`;
      return;
    }
    const dls=hist.map(e=>e.dl), uls=hist.map(e=>e.ul), pings=hist.map(e=>e.ping);
    const avg=arr=>arr.reduce((a,b)=>a+b,0)/arr.length;
    const lbls=hist.map(e=>new Date(e.ts).toLocaleString([],{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}));

    body.innerHTML=`
      <div class="stats-row">
        <div class="stat-card" style="--sc:#00d4ff;--sc-glow:rgba(0,212,255,0.3)">
          <div class="stat-card-label">↓ Download</div>
          <div class="stat-card-val">${fmt(avg(dls))} <span class="stat-card-unit">Mbps avg</span></div>
          <div class="stat-card-sub">Best <b>${fmt(Math.max(...dls))}</b> · Worst <b>${fmt(Math.min(...dls))}</b></div>
        </div>
        <div class="stat-card" style="--sc:#4ade80;--sc-glow:rgba(74,222,128,0.3)">
          <div class="stat-card-label">↑ Upload</div>
          <div class="stat-card-val">${fmt(avg(uls))} <span class="stat-card-unit">Mbps avg</span></div>
          <div class="stat-card-sub">Best <b>${fmt(Math.max(...uls))}</b> · Worst <b>${fmt(Math.min(...uls))}</b></div>
        </div>
        <div class="stat-card" style="--sc:#fbbf24;--sc-glow:rgba(251,191,36,0.3)">
          <div class="stat-card-label">◎ Ping</div>
          <div class="stat-card-val">${avg(pings).toFixed(1)} <span class="stat-card-unit">ms avg</span></div>
          <div class="stat-card-sub">Best <b>${Math.min(...pings).toFixed(1)} ms</b> · Worst <b>${Math.max(...pings).toFixed(1)} ms</b></div>
        </div>
        <div class="stat-card" style="--sc:#a78bfa;--sc-glow:rgba(167,139,250,0.3)">
          <div class="stat-card-label">Tests</div>
          <div class="stat-card-val">${hist.length}</div>
          <div class="stat-card-sub">in selected period</div>
        </div>
      </div>

      <div class="chart-section">
        <div class="chart-title" style="--cc:#00d4ff"><div class="cdot"></div>Download &amp; Upload <span style="color:#1a3050;margin-left:4px;font-size:9px">Mbps</span></div>
        <div class="chart-wrap">
          <canvas class="chart" id="chart-dlul" height="160"></canvas>
          <div class="tt-crosshair" id="cross-dlul"></div>
          <div class="chart-tooltip" id="tt-dlul"></div>
        </div>
        <div class="legend">
          <div class="legend-item"><div class="legend-dot" style="background:#00d4ff"></div>Download</div>
          <div class="legend-item"><div class="legend-dot" style="background:#4ade80"></div>Upload</div>
        </div>
      </div>

      <div class="chart-section">
        <div class="chart-title" style="--cc:#fbbf24"><div class="cdot"></div>Ping <span style="color:#1a3050;margin-left:4px;font-size:9px">ms</span></div>
        <div class="chart-wrap">
          <canvas class="chart" id="chart-ping" height="110"></canvas>
          <div class="tt-crosshair" id="cross-ping"></div>
          <div class="chart-tooltip" id="tt-ping"></div>
        </div>
      </div>

      <div class="hist-label">Test Log</div>
      <div class="hist-wrap"><table>
        <thead><tr><th>Timestamp</th><th>↓ Download</th><th>↑ Upload</th><th>◎ Ping</th><th>Server</th></tr></thead>
        <tbody>${[...hist].reverse().slice(0,50).map(e=>`<tr>
          <td class="td-ts">${new Date(e.ts).toLocaleString([],{dateStyle:"short",timeStyle:"short"})}</td>
          <td class="td-dl">${fmt(e.dl)} Mbps</td>
          <td class="td-ul">${fmt(e.ul)} Mbps</td>
          <td class="td-pg">${e.ping.toFixed(1)} ms</td>
          <td class="td-srv">${e.isp||e.server||"—"}</td>
        </tr>`).join("")}</tbody>
      </table></div>`;

    requestAnimationFrame(()=>{
      const c1=body.querySelector("#chart-dlul");
      const c2=body.querySelector("#chart-ping");
      const ds1=[{data:dls,color:"#00d4ff",label:"Download"},{data:uls,color:"#4ade80",label:"Upload"}];
      const ds2=[{data:pings,color:"#fbbf24",label:"Ping"}];
      if(c1){ drawChart(c1,ds1,lbls); attachTooltip(c1,body.querySelector("#tt-dlul"),body.querySelector("#cross-dlul")); }
      if(c2){ drawChart(c2,ds2,lbls); attachTooltip(c2,body.querySelector("#tt-ping"),body.querySelector("#cross-ping")); }
    });
  }

  getCardSize(){ return 4; }
  static getStubConfig(){ return {entity_download:"sensor.speedtest_download",entity_upload:"sensor.speedtest_upload",entity_ping:"sensor.speedtest_ping"}; }
}

customElements.define("speedtest-card",SpeedtestCard);
window.customCards=window.customCards||[];
window.customCards.push({type:"speedtest-card",name:"Speedtest Card",description:"Cyber-themed speedtest gauges with history charts and hover tooltips.",preview:false});
