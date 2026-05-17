// sprites.js – procedural unit, building & prop drawing

const TEAM_COL = {
  '-1':{ pri:'#888',sec:'#444',glow:'#aaa',hud:'#aaa' },
  0:   { pri:'#00aaff',sec:'#004488',glow:'#55ddff',hud:'#00aaff' },
  1:   { pri:'#ff4422',sec:'#880000',glow:'#ff8866',hud:'#ff4422' },
};

const UNIT_TYPES = ['Scout','Tank','Heavy','Artillery'];

const UNIT_STATS = {
  Scout:     { hp:60,  spd:90,  range:160, dmg:12, cd:0.8, size:.7 },
  Tank:      { hp:150, spd:55,  range:200, dmg:28, cd:1.2, size:1.0 },
  Heavy:     { hp:280, spd:35,  range:180, dmg:50, cd:1.8, size:1.2 },
  Artillery: { hp:100, spd:40,  range:320, dmg:65, cd:2.5, size:1.1 },
};

const BUILDING_STATS = {
  CommandCenter:{ hp:800, size:3 },
  Turret:       { hp:200, size:2, range:220, dmg:20, cd:1.0 },
  Factory:      { hp:350, size:2 },
  Wall:         { hp:250, size:1 },
};

const PROP_TYPES = ['Rock','Crystal','Debris'];

// ─── helpers ─────────────────────────────────────────────────────────
function rrect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}
function snapDir(a){ return Math.round(a/(Math.PI/4))*(Math.PI/4); }

function _darken(hex, f){
  let h=hex.slice(1);
  if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const n=parseInt(h,16);
  const r=Math.max(0,Math.min(255,((n>>16)&255)*f))|0;
  const g=Math.max(0,Math.min(255,((n>>8)&255)*f))|0;
  const b=Math.max(0,Math.min(255,(n&255)*f))|0;
  return `rgb(${r},${g},${b})`;
}

// ─── Heavy tank sprite sheet ──────────────────────────────────────────
// img/heavy_tank.png: 2048×256 PNG, 8 frames × 256×256.
// Frame order (left → right): W  NW  N  NE  E  SE  S  SW
const _HEAVY_FW = 256, _HEAVY_FH = 256;
const _HEAVY_DW = 110, _HEAVY_DH = 110; // scaled draw size in game

let _heavySS = null, _heavyReady = false;
const _heavyCache = {};

(function(){
  const img = new Image();
  img.onload  = ()=>{ _heavyReady = true; };
  img.onerror = ()=>{ console.warn('img/heavy_tank.png not found – using procedural fallback'); };
  img.src = 'img/heavy_tank.png';
  _heavySS = img;
})();

// JS angle (0=E, π/4=SE … ±π=W) → sprite frame index.
// In iso space, moving "east on screen" = world angle −π/4 (NE in world).
// Corrected mapping shifts +1 so that world angle −π/4 → frame 4 (E sprite).
// Sprite frames: 0=W 1=NW 2=N 3=NE 4=E 5=SE 6=S 7=SW
// dir→frame:     E   SE   S   SW   W   NW   N   NE
//                0    1   2    3   4    5   6    7
function _heavyFrameIdx(angle){
  const a = ((angle % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
  const dir = Math.round(a / (Math.PI/4)) % 8;
  return [5, 6, 7, 0, 1, 2, 3, 4][dir];
}

// Cached offscreen canvas per (frame, team) — built once when first needed.
function _heavyCachedFrame(frame, team){
  const key = frame + '_' + team;
  if(_heavyCache[key]) return _heavyCache[key];
  const tmp = document.createElement('canvas');
  tmp.width = _HEAVY_DW; tmp.height = _HEAVY_DH;
  const tc = tmp.getContext('2d');
  tc.drawImage(_heavySS, frame * _HEAVY_FW, 0, _HEAVY_FW, _HEAVY_FH, 0, 0, _HEAVY_DW, _HEAVY_DH);
  // Team 1 (enemy): apply red tint via source-atop so transparent areas stay transparent
  if(team === 1){
    tc.globalCompositeOperation = 'source-atop';
    tc.globalAlpha = 0.42;
    tc.fillStyle = '#ff2200';
    tc.fillRect(0, 0, _HEAVY_DW, _HEAVY_DH);
  }
  return (_heavyCache[key] = tmp);
}

// ─── UNIT drawing (top-down canonical, caller applies iso squish) ─────
// Drawn centered at (0,0) facing east, before any iso transform.
function drawUnitAt(ctx, type, team, angle, tileSize, flashAlpha=0){
  const c = TEAM_COL[team] || TEAM_COL[0];
  const s = tileSize * (UNIT_STATS[type]?.size ?? 1);
  ctx.save();
  ctx.rotate(snapDir(angle));
  ({Scout:drawScout,Tank:drawTank,Heavy:drawHeavy,Artillery:drawArtillery}[type]||drawScout)(ctx,s,c);
  if(flashAlpha>0){
    ctx.globalAlpha=flashAlpha;ctx.fillStyle='#fff';
    ctx.beginPath();ctx.ellipse(0,0,s*.5,s*.4,0,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  }
  ctx.restore();
}

function drawScout(ctx,s,c){
  const hw=s*.5;
  ctx.shadowColor=c.glow; ctx.shadowBlur=5; ctx.fillStyle=c.sec;
  [[0,-.42],[0,.42]].forEach(([ex,ey])=>{ctx.beginPath();ctx.ellipse(ex*s,ey*s,s*.1,s*.2,0,0,Math.PI*2);ctx.fill();});
  ctx.shadowBlur=0;
  ctx.fillStyle=c.sec; rrect(ctx,-hw*.52,-s*.28,s*.58,s*.56,s*.07); ctx.fill();
  ctx.fillStyle=c.pri; rrect(ctx,-hw*.4,-s*.18,s*.46,s*.36,s*.05); ctx.fill();
  ctx.fillStyle=c.sec; ctx.fillRect(hw*.22,-s*.05,s*.38,s*.1);
  ctx.fillStyle=c.pri; ctx.fillRect(hw*.48,-s*.04,s*.12,s*.08);
  ctx.fillStyle='#aaeeff'; ctx.globalAlpha=.6;
  ctx.beginPath(); ctx.ellipse(-s*.05,0,s*.12,s*.08,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
}
function drawTank(ctx,s,c){
  const hw=s*.5;
  ctx.fillStyle='#222';
  [[-hw*.45,-hw*.42],[hw*.45-s*.14,-hw*.42]].forEach(([tx,ty])=>{rrect(ctx,tx,ty,s*.14,s*.84,s*.04);ctx.fill();});
  ctx.fillStyle='#333';
  for(let i=0;i<4;i++){ctx.fillRect(-hw*.45+s*.02,-hw*.4+i*s*.18,s*.1,s*.06);ctx.fillRect(hw*.33+s*.01,-hw*.4+i*s*.18,s*.1,s*.06);}
  ctx.fillStyle=c.sec; rrect(ctx,-hw*.38,-hw*.36,s*.76,s*.72,s*.06); ctx.fill();
  ctx.fillStyle=c.pri; rrect(ctx,-hw*.28,-hw*.24,s*.56,s*.48,s*.05); ctx.fill();
  ctx.fillStyle=c.sec; ctx.beginPath();ctx.arc(0,0,s*.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=c.pri; ctx.beginPath();ctx.arc(0,0,s*.15,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=c.sec; ctx.fillRect(s*.1,-s*.06,s*.42,s*.12);
  ctx.fillStyle='#111'; ctx.fillRect(s*.42,-s*.04,s*.12,s*.08);
  ctx.fillStyle='rgba(255,255,255,.12)'; rrect(ctx,-hw*.25,-hw*.2,s*.5,.1*s,s*.02); ctx.fill();
}
function drawHeavy(ctx,s,c){
  const hw=s*.5;
  ctx.fillStyle='#222';
  [[-hw*.52,-hw*.5],[hw*.38,-hw*.5]].forEach(([tx,ty])=>{rrect(ctx,tx,ty,s*.14,s,s*.04);ctx.fill();});
  ctx.fillStyle=c.sec; rrect(ctx,-hw*.42,-hw*.44,s*.84,s*.88,s*.08); ctx.fill();
  ctx.fillStyle=c.pri; rrect(ctx,-hw*.32,-hw*.32,s*.64,s*.64,s*.06); ctx.fill();
  [-s*.16,s*.16].forEach(oy=>{
    ctx.fillStyle=c.sec;ctx.beginPath();ctx.arc(0,oy,s*.14,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=c.pri;ctx.beginPath();ctx.arc(0,oy,s*.09,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=c.sec;ctx.fillRect(s*.08,oy-s*.04,s*.46,s*.08);
    ctx.fillStyle='#111';ctx.fillRect(s*.42,oy-s*.03,s*.14,s*.06);
  });
  ctx.fillStyle='rgba(255,255,255,.1)'; rrect(ctx,-hw*.3,-hw*.28,s*.6,s*.12,s*.02); ctx.fill();
}
function drawArtillery(ctx,s,c){
  const hw=s*.5;
  ctx.fillStyle='#222';
  [[-hw*.42,-hw*.36],[hw*.28,-hw*.36]].forEach(([tx,ty])=>{rrect(ctx,tx,ty,s*.14,s*.72,s*.04);ctx.fill();});
  ctx.fillStyle=c.sec; rrect(ctx,-hw*.35,-hw*.28,s*.7,s*.56,s*.06); ctx.fill();
  ctx.fillStyle=c.pri; rrect(ctx,-hw*.25,-hw*.18,s*.5,s*.36,s*.05); ctx.fill();
  ctx.fillStyle=c.sec; ctx.fillRect(-s*.05,-s*.07,s*.82,s*.14);
  ctx.fillStyle='#111'; ctx.fillRect(s*.62,-s*.06,s*.2,s*.12);
  ctx.fillStyle=c.sec;
  [[-s*.04,-s*.34],[-s*.04,s*.26]].forEach(([ox,oy])=>ctx.fillRect(-hw*.32+ox,oy,s*.12,s*.08));
  ctx.fillStyle=c.pri; ctx.beginPath();ctx.arc(s*.1,0,s*.07,0,Math.PI*2);ctx.fill();
}

// ─── ISO unit rendering ───────────────────────────────────────────────
function drawIsoUnitAt(ctx, type, team, angle, worldX, worldY, tileSize, flashAlpha, alpha){
  const {x:sx,y:sy} = worldToIso(worldX, worldY);
  const midY = sy + ISO_H * 0.5;

  // Ground shadow
  ctx.save();
  ctx.translate(sx, midY);
  ctx.scale(1, 0.42);
  ctx.globalAlpha = (alpha||1) * 0.32;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(0,0,tileSize*0.36,tileSize*0.36,0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  if(type === 'Heavy' && _heavyReady){
    // ── Sprite-sheet path ─────────────────────────────────────────
    // Sprite is pre-rendered in perspective — do NOT apply iso squish.
    // Anchor so ~85% of frame height sits above the ground centre (midY).
    const frame  = _heavyFrameIdx(angle);
    const cached = _heavyCachedFrame(frame, team);
    const dx = sx - _HEAVY_DW / 2;
    const dy = midY - _HEAVY_DH * 0.85;
    ctx.save();
    if(alpha != null) ctx.globalAlpha = alpha;
    ctx.drawImage(cached, dx, dy);
    if(flashAlpha > 0){
      const ftmp = document.createElement('canvas');
      ftmp.width = _HEAVY_DW; ftmp.height = _HEAVY_DH;
      const fc = ftmp.getContext('2d');
      fc.drawImage(cached, 0, 0);
      fc.globalCompositeOperation = 'source-atop';
      fc.globalAlpha = flashAlpha * 0.8;
      fc.fillStyle = '#ffffff';
      fc.fillRect(0, 0, _HEAVY_DW, _HEAVY_DH);
      ctx.drawImage(ftmp, dx, dy);
    }
    ctx.restore();
  } else {
    // ── Procedural path ───────────────────────────────────────────
    // Top-down art projected onto iso plane via y-squish.
    ctx.save();
    ctx.translate(sx, midY - 11);
    ctx.scale(1, 0.62);
    if(alpha != null) ctx.globalAlpha = alpha;
    drawUnitAt(ctx, type, team, angle, tileSize, flashAlpha);
    ctx.restore();
  }
}

// ─── Factory building sprite ──────────────────────────────────────────
// img/Factory.png: 1025×1025 single isometric view.
// N vertex of the 2×2 footprint diamond is at (50%, 29%) in the frame.
// Scale so the footprint diamond width matches 2×ISO_W = 128px in-game
// → draw size ≈ 200px.
const _FACTORY_DW = 420, _FACTORY_DH = 420;
const _FACTORY_ANCHOR_X = 0.50; // fraction of DW where N vertex sits (horiz)
const _FACTORY_ANCHOR_Y = 0.29; // fraction of DH where N vertex sits (vert)

let _factorySS = null, _factoryReady = false;
const _factoryCache = {};

(function(){
  const img = new Image();
  img.onload  = ()=>{ _factoryReady = true; Object.keys(_factoryCache).forEach(k=>delete _factoryCache[k]); };
  img.onerror = ()=>{ console.warn('img/Factory.png not found – using procedural fallback'); };
  img.src = 'img/Factory.png';
  _factorySS = img;
})();

function _getFactoryCached(team){
  const key = 'f_' + team;
  if(_factoryCache[key]) return _factoryCache[key];
  const tmp = document.createElement('canvas');
  tmp.width = _FACTORY_DW; tmp.height = _FACTORY_DH;
  const tc = tmp.getContext('2d');
  tc.drawImage(_factorySS, 0, 0, _FACTORY_DW, _FACTORY_DH);
  if(team === 1){
    tc.globalCompositeOperation = 'source-atop';
    tc.globalAlpha = 0.35;
    tc.fillStyle = '#ff2200';
    tc.fillRect(0, 0, _FACTORY_DW, _FACTORY_DH);
  }
  return (_factoryCache[key] = tmp);
}

// ─── ISO BUILDINGS ─────────────────────────────────────────────────────
// Draws a 3-faced isometric box: top face + SW wall + SE wall.
// tx/ty = top-left tile of the building footprint.
function drawIsoBuilding(ctx, type, team, tx, ty){
  const c    = TEAM_COL[team] || TEAM_COL['-1'];
  const size = BUILDING_STATS[type]?.size || 1;

  // N corner of footprint in iso space
  const {x:nx, y:ny} = tileToIso(tx, ty);

  // ── Factory sprite (replaces procedural box entirely) ──────────────
  if(type === 'Factory' && _factoryReady){
    const cached = _getFactoryCached(team);
    ctx.drawImage(cached,
      nx - _FACTORY_DW * _FACTORY_ANCHOR_X,
      ny - _FACTORY_DH * _FACTORY_ANCHOR_Y,
      _FACTORY_DW, _FACTORY_DH);
    return;
  }

  const fw = size*(ISO_W/2); // half-width of diamond footprint
  const fh = size*(ISO_H/2); // half-height of diamond footprint
  const bldH = size * ISO_H * 1.1; // building height above ground

  const topY = ny - bldH;

  // SW face (left wall)
  ctx.fillStyle = _darken(c.sec, 0.55);
  ctx.beginPath();
  ctx.moveTo(nx-fw,  ny+fh);
  ctx.lineTo(nx,     ny+size*ISO_H);
  ctx.lineTo(nx,     topY+size*ISO_H);
  ctx.lineTo(nx-fw,  topY+fh);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.3)'; ctx.lineWidth=1;
  ctx.stroke();

  // SE face (right wall)
  ctx.fillStyle = _darken(c.sec, 0.38);
  ctx.beginPath();
  ctx.moveTo(nx,     ny+size*ISO_H);
  ctx.lineTo(nx+fw,  ny+fh);
  ctx.lineTo(nx+fw,  topY+fh);
  ctx.lineTo(nx,     topY+size*ISO_H);
  ctx.closePath(); ctx.fill();
  ctx.stroke();

  // Top face (diamond)
  ctx.fillStyle = c.pri;
  ctx.beginPath();
  ctx.moveTo(nx,     topY);
  ctx.lineTo(nx+fw,  topY+fh);
  ctx.lineTo(nx,     topY+size*ISO_H);
  ctx.lineTo(nx-fw,  topY+fh);
  ctx.closePath(); ctx.fill();
  ctx.stroke();

  // Glow border on top
  ctx.shadowColor = c.glow; ctx.shadowBlur = 6;
  ctx.strokeStyle = c.pri; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(nx,     topY);
  ctx.lineTo(nx+fw,  topY+fh);
  ctx.lineTo(nx,     topY+size*ISO_H);
  ctx.lineTo(nx-fw,  topY+fh);
  ctx.closePath(); ctx.stroke();
  ctx.shadowBlur = 0;

  // Building-specific top details
  _drawBldTopDetails(ctx, type, team, c, nx, topY, fw, fh, size);
}

function _drawBldTopDetails(ctx, type, team, c, nx, topY, fw, fh, size){
  const cx2 = nx;
  const cy2 = topY + fh; // center of top face

  ctx.save();
  // Project details onto the iso top face
  // Use the iso transform so detail drawing looks right on the face
  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset temporarily...
  // Instead draw directly with iso coordinates
  ctx.restore();

  switch(type){
    case 'CommandCenter':
      // Central glow core
      ctx.shadowColor=c.glow; ctx.shadowBlur=12;
      ctx.fillStyle=c.glow;
      ctx.beginPath(); ctx.ellipse(nx, topY+fh, fw*.18, fh*.28, 0, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
      // antenna
      ctx.strokeStyle=c.pri; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(nx,topY); ctx.lineTo(nx,topY-size*12); ctx.stroke();
      ctx.fillStyle=c.glow;
      ctx.beginPath(); ctx.arc(nx,topY-size*12,size*3,0,Math.PI*2); ctx.fill();
      // four corner dots on face
      ctx.fillStyle=c.pri;
      [[fw*.5,fh*.5],[fw*.5,-fh*.5],[-fw*.5,-fh*.5],[-fw*.5,fh*.5]].forEach(([ox,oy])=>{
        ctx.beginPath(); ctx.arc(nx+ox,topY+fh+oy,size*1.5,0,Math.PI*2); ctx.fill();
      });
      break;

    case 'Turret':
      // Barrel pointing E on the top face
      ctx.strokeStyle=c.pri; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(nx,topY+fh); ctx.lineTo(nx+fw*.8,topY+fh*.6); ctx.stroke();
      ctx.fillStyle=c.sec;
      ctx.beginPath(); ctx.ellipse(nx,topY+fh,fw*.22,fh*.35,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=c.pri;
      ctx.beginPath(); ctx.ellipse(nx,topY+fh,fw*.13,fh*.2,0,0,Math.PI*2); ctx.fill();
      ctx.shadowColor=c.glow; ctx.shadowBlur=8;
      ctx.fillStyle=c.glow; ctx.globalAlpha=.5;
      ctx.beginPath(); ctx.ellipse(nx,topY+fh,fw*.06,fh*.1,0,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1; ctx.shadowBlur=0;
      break;

    case 'Factory':
      // Two chimney-style pillars
      [-.3,.3].forEach(ox=>{
        ctx.fillStyle=c.sec;
        ctx.beginPath();
        ctx.ellipse(nx+ox*fw,topY+fh*.6,fw*.1,fh*.15,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=c.pri;
        ctx.beginPath();
        ctx.ellipse(nx+ox*fw,topY+fh*.55,fw*.06,fh*.09,0,0,Math.PI*2); ctx.fill();
      });
      // Door slot
      ctx.fillStyle=_darken(c.sec,0.3);
      ctx.beginPath(); ctx.ellipse(nx,topY+fh*1.1,fw*.15,fh*.22,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(0,200,255,.35)';
      ctx.beginPath(); ctx.ellipse(nx,topY+fh*1.1,fw*.1,fh*.15,0,0,Math.PI*2); ctx.fill();
      break;

    case 'Wall':
      // Cross pattern
      ctx.strokeStyle=c.sec; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(nx-fw*.4,topY+fh); ctx.lineTo(nx+fw*.4,topY+fh); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(nx,topY+fh*.3); ctx.lineTo(nx,topY+fh*1.7); ctx.stroke();
      break;
  }
}

// ─── PROPS ───────────────────────────────────────────────────────────
// For iso rendering: draw prop at iso screen position with slight squish
function drawIsoProp(ctx, type, worldX, worldY){
  const {x:sx,y:sy} = worldToIso(worldX, worldY);
  ctx.save();
  ctx.translate(sx, sy + ISO_H*0.5 - 4);
  ctx.scale(1, 0.62);
  ({Rock:drawRock,Crystal:drawCrystal,Debris:drawDebris}[type]||drawRock)(ctx,0,0,TILE_SIZE);
  ctx.restore();
}

function drawRock(ctx,px,py,ts){
  ctx.fillStyle='#5a5a5a';
  ctx.beginPath();
  ctx.moveTo(px+ts*.5,py+ts*.15);ctx.lineTo(px+ts*.8,py+ts*.4);ctx.lineTo(px+ts*.75,py+ts*.8);
  ctx.lineTo(px+ts*.25,py+ts*.8);ctx.lineTo(px+ts*.18,py+ts*.4);ctx.closePath();ctx.fill();
  ctx.fillStyle='#777';
  ctx.beginPath();ctx.moveTo(px+ts*.5,py+ts*.15);ctx.lineTo(px+ts*.6,py+ts*.38);ctx.lineTo(px+ts*.4,py+ts*.38);ctx.closePath();ctx.fill();
}
function drawCrystal(ctx,px,py,ts){
  [[ts*.5,ts*.18,ts*.58,ts*.7,ts*.42,ts*.7,'#00ddff'],
   [ts*.3,ts*.25,ts*.38,ts*.75,ts*.22,ts*.75,'#00aacc'],
   [ts*.68,ts*.28,ts*.76,ts*.72,ts*.6,ts*.72,'#0088aa']].forEach(([x1,y1,xr,yr,xl,yl,col])=>{
    ctx.fillStyle=col;ctx.globalAlpha=.75;
    ctx.beginPath();ctx.moveTo(px+x1,py+y1);ctx.lineTo(px+xr,py+yr);ctx.lineTo(px+xl,py+yl);ctx.closePath();ctx.fill();
  });
  ctx.globalAlpha=1;
  ctx.shadowColor='#00ffff';ctx.shadowBlur=8;
  ctx.fillStyle='#aaffff';
  ctx.beginPath();ctx.arc(px+ts*.5,py+ts*.32,ts*.04,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;
}
function drawDebris(ctx,px,py,ts){
  ctx.fillStyle='#444';ctx.strokeStyle='#666';ctx.lineWidth=1;
  ctx.save();ctx.translate(px+ts*.5,py+ts*.5);ctx.rotate(.4);
  ctx.fillRect(-ts*.38,-ts*.12,ts*.76,ts*.24);ctx.strokeRect(-ts*.38,-ts*.12,ts*.76,ts*.24);
  ctx.fillRect(-ts*.1,-ts*.35,ts*.2,ts*.7);ctx.strokeRect(-ts*.1,-ts*.35,ts*.2,ts*.7);
  ctx.restore();
}

// ─── Flat building (palette previews) ─────────────────────────────────
function drawBuilding(ctx, type, team, px, py, ts){
  const c = TEAM_COL[team] || TEAM_COL['-1'];
  const size = BUILDING_STATS[type]?.size||1;
  const bs = size*ts;
  ({CommandCenter:drawCommandCenter,Turret:drawTurretBuilding,Factory:drawFactory,Wall:drawWall}
    [type]||drawWall)(ctx,px,py,bs,ts,c);
}
function drawCommandCenter(ctx,px,py,bs,ts,c){
  ctx.fillStyle=c.sec; _rrect(ctx,px+bs*.04,py+bs*.04,bs*.92,bs*.92,ts*.1); ctx.fill();
  ctx.fillStyle=c.pri; _rrect(ctx,px+bs*.1,py+bs*.1,bs*.8,bs*.8,ts*.08); ctx.fill();
  ctx.fillStyle=c.sec; _rrect(ctx,px+bs*.2,py+bs*.2,bs*.6,bs*.6,ts*.06); ctx.fill();
  ctx.fillStyle='#0a1520'; _rrect(ctx,px+bs*.25,py+bs*.25,bs*.5,bs*.5,ts*.04); ctx.fill();
  ctx.fillStyle=c.pri; ctx.fillRect(px+bs*.47,py+bs*.04,bs*.06,bs*.22);
  ctx.shadowColor=c.glow;ctx.shadowBlur=12;
  ctx.fillStyle=c.pri;ctx.beginPath();ctx.arc(px+bs*.5,py+bs*.5,bs*.12,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;
}
function _rrect(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
function drawTurretBuilding(ctx,px,py,bs,ts,c){
  ctx.fillStyle='#333';_rrect(ctx,px+bs*.08,py+bs*.08,bs*.84,bs*.84,ts*.06);ctx.fill();
  ctx.fillStyle=c.sec;_rrect(ctx,px+bs*.15,py+bs*.15,bs*.7,bs*.7,ts*.05);ctx.fill();
  ctx.fillStyle=c.pri;ctx.beginPath();ctx.arc(px+bs*.5,py+bs*.5,bs*.28,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=c.sec;ctx.beginPath();ctx.arc(px+bs*.5,py+bs*.5,bs*.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=c.pri;ctx.fillRect(px+bs*.5,py+bs*.47,bs*.42,bs*.06);
}
function drawFactory(ctx,px,py,bs,ts,c){
  ctx.fillStyle=c.sec;_rrect(ctx,px+bs*.06,py+bs*.06,bs*.88,bs*.88,ts*.06);ctx.fill();
  ctx.fillStyle='#0a1520';_rrect(ctx,px+bs*.12,py+bs*.12,bs*.76,bs*.76,ts*.04);ctx.fill();
  ctx.fillStyle=c.pri;
  [[.25,.1,.1,.35],[.6,.1,.1,.35]].forEach(([ox,oy,w,h])=>ctx.fillRect(px+bs*ox,py+bs*oy,bs*w,bs*h));
}
function drawWall(ctx,px,py,bs,ts,c){
  ctx.fillStyle=c.sec;ctx.fillRect(px+bs*.05,py+bs*.05,bs*.9,bs*.9);
  ctx.fillStyle=c.pri;ctx.fillRect(px+bs*.12,py+bs*.12,bs*.76,bs*.76);
}

// ─── Projectile drawing ────────────────────────────────────────────────
const PROJ_COL={bullet:'#ffee00',shell:'#ff9900',missile:'#00ffaa',beam:'#ff4444'};
function drawProjectile(ctx, proj){
  // Convert world pos to iso
  const {x:sx,y:sy}=worldToIso(proj.x,proj.y);
  const col=PROJ_COL[proj.kind]||'#fff';
  ctx.save();
  ctx.translate(sx,sy+ISO_H*.5);
  // Flatten angle to look right on iso plane
  ctx.scale(1,0.5);
  ctx.rotate(proj.angle);
  ctx.shadowColor=col;ctx.shadowBlur=6;ctx.fillStyle=col;
  if(proj.kind==='beam'){ ctx.fillRect(-10,-2,20,4); }
  else if(proj.kind==='missile'){ ctx.fillRect(-6,-2,12,4);ctx.fillStyle='#fff';ctx.fillRect(5,-1,3,2); }
  else { ctx.beginPath();ctx.arc(0,0,proj.kind==='shell'?4:3,0,Math.PI*2);ctx.fill(); }
  ctx.shadowBlur=0;
  ctx.restore();
}

// ─── Portrait (flat HUD canvas) ────────────────────────────────────────
function drawPortrait(ctx, type, team, w, h){
  ctx.fillStyle='#0a1520'; ctx.fillRect(0,0,w,h);
  ctx.save(); ctx.translate(w*.5,h*.5);
  drawUnitAt(ctx, type, team, 0, Math.min(w,h)*.65);
  ctx.restore();
}
