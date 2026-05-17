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

// ─── helpers ────────────────────────────────────────────────────────
function rrect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function snapDir(angle){
  return Math.round(angle/(Math.PI/4))*(Math.PI/4);
}

// ─── UNITS ──────────────────────────────────────────────────────────
// All drawn centered at (0,0) facing right (East), size=TILE_SIZE

function drawUnitAt(ctx, type, team, angle, tileSize, flashAlpha=0){
  const c = TEAM_COL[team] || TEAM_COL[0];
  const s = tileSize * (UNIT_STATS[type]?.size ?? 1);
  ctx.save();
  ctx.rotate(snapDir(angle));
  ({
    Scout:     drawScout,
    Tank:      drawTank,
    Heavy:     drawHeavy,
    Artillery: drawArtillery,
  }[type] || drawScout)(ctx, s, c);
  if(flashAlpha > 0){
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(0,0,s*.5,s*.4,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawScout(ctx, s, c){
  const hw=s*.5;
  // hover pods
  ctx.shadowColor=c.glow; ctx.shadowBlur=5;
  ctx.fillStyle=c.sec;
  [[ .0,-.42],[0,.42]].forEach(([ex,ey])=>{
    ctx.beginPath(); ctx.ellipse(ex*s,ey*s,s*.1,s*.2,0,0,Math.PI*2); ctx.fill();
  });
  ctx.shadowBlur=0;
  // body
  ctx.fillStyle=c.sec;
  rrect(ctx,-hw*.52,-s*.28,s*.58,s*.56,s*.07); ctx.fill();
  ctx.fillStyle=c.pri;
  rrect(ctx,-hw*.4,-s*.18,s*.46,s*.36,s*.05); ctx.fill();
  // barrel
  ctx.fillStyle=c.sec;
  ctx.fillRect(hw*.22,-s*.05,s*.38,s*.1);
  ctx.fillStyle=c.pri;
  ctx.fillRect(hw*.48,-s*.04,s*.12,s*.08);
  // cockpit
  ctx.fillStyle='#aaeeff'; ctx.globalAlpha=.6;
  ctx.beginPath(); ctx.ellipse(-s*.05,0,s*.12,s*.08,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
}

function drawTank(ctx, s, c){
  const hw=s*.5;
  // treads
  ctx.fillStyle='#222';
  [[-hw*.45,-hw*.42],[hw*.45-s*.14,-hw*.42]].forEach(([tx,ty])=>{
    rrect(ctx,tx,ty,s*.14,s*.84,s*.04); ctx.fill();
  });
  ctx.fillStyle='#333';
  for(let i=0;i<4;i++){
    ctx.fillRect(-hw*.45+s*.02,-hw*.4+i*s*.18,s*.1,s*.06);
    ctx.fillRect( hw*.33+s*.01,-hw*.4+i*s*.18,s*.1,s*.06);
  }
  // hull
  ctx.fillStyle=c.sec;
  rrect(ctx,-hw*.38,-hw*.36,s*.76,s*.72,s*.06); ctx.fill();
  ctx.fillStyle=c.pri;
  rrect(ctx,-hw*.28,-hw*.24,s*.56,s*.48,s*.05); ctx.fill();
  // turret ring
  ctx.fillStyle=c.sec;
  ctx.beginPath(); ctx.arc(0,0,s*.2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=c.pri;
  ctx.beginPath(); ctx.arc(0,0,s*.15,0,Math.PI*2); ctx.fill();
  // barrel
  ctx.fillStyle=c.sec;
  ctx.fillRect(s*.1,-s*.06,s*.42,s*.12);
  ctx.fillStyle='#111';
  ctx.fillRect(s*.42,-s*.04,s*.12,s*.08);
  // highlight
  ctx.fillStyle='rgba(255,255,255,.12)';
  rrect(ctx,-hw*.25,-hw*.2,s*.5,.1*s,s*.02); ctx.fill();
}

function drawHeavy(ctx, s, c){
  const hw=s*.5;
  // wide tracks
  ctx.fillStyle='#222';
  [[-hw*.52,-hw*.5],[hw*.38,-hw*.5]].forEach(([tx,ty])=>{
    rrect(ctx,tx,ty,s*.14,s,s*.04); ctx.fill();
  });
  // hull
  ctx.fillStyle=c.sec;
  rrect(ctx,-hw*.42,-hw*.44,s*.84,s*.88,s*.08); ctx.fill();
  ctx.fillStyle=c.pri;
  rrect(ctx,-hw*.32,-hw*.32,s*.64,s*.64,s*.06); ctx.fill();
  // twin turrets
  [-s*.16, s*.16].forEach(oy=>{
    ctx.fillStyle=c.sec;
    ctx.beginPath(); ctx.arc(0,oy,s*.14,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=c.pri;
    ctx.beginPath(); ctx.arc(0,oy,s*.09,0,Math.PI*2); ctx.fill();
    // barrel
    ctx.fillStyle=c.sec;
    ctx.fillRect(s*.08,oy-s*.04,s*.46,s*.08);
    ctx.fillStyle='#111';
    ctx.fillRect(s*.42,oy-s*.03,s*.14,s*.06);
  });
  // armor plate
  ctx.fillStyle='rgba(255,255,255,.1)';
  rrect(ctx,-hw*.3,-hw*.28,s*.6,s*.12,s*.02); ctx.fill();
}

function drawArtillery(ctx, s, c){
  const hw=s*.5;
  // narrow tracks
  ctx.fillStyle='#222';
  [[-hw*.42,-hw*.36],[hw*.28,-hw*.36]].forEach(([tx,ty])=>{
    rrect(ctx,tx,ty,s*.14,s*.72,s*.04); ctx.fill();
  });
  // long chassis
  ctx.fillStyle=c.sec;
  rrect(ctx,-hw*.35,-hw*.28,s*.7,s*.56,s*.06); ctx.fill();
  ctx.fillStyle=c.pri;
  rrect(ctx,-hw*.25,-hw*.18,s*.5,s*.36,s*.05); ctx.fill();
  // big barrel
  ctx.fillStyle=c.sec;
  ctx.fillRect(-s*.05,-s*.07,s*.82,s*.14);
  ctx.fillStyle='#111';
  ctx.fillRect(s*.62,-s*.06,s*.2,s*.12);
  // rear stabilisers
  ctx.fillStyle=c.sec;
  [[-s*.04,-s*.34],[-s*.04,s*.26]].forEach(([ox,oy])=>ctx.fillRect(-hw*.32+ox,oy,s*.12,s*.08));
  // scope
  ctx.fillStyle=c.pri;
  ctx.beginPath(); ctx.arc(s*.1,0,s*.07,0,Math.PI*2); ctx.fill();
}

// ─── BUILDINGS ──────────────────────────────────────────────────────
function drawBuilding(ctx, type, team, px, py, ts){
  const c = TEAM_COL[team] || TEAM_COL['-1'];
  const stats = BUILDING_STATS[type];
  const bsize = (stats?.size||1)*ts;
  ({
    CommandCenter: drawCommandCenter,
    Turret:        drawTurretBuilding,
    Factory:       drawFactory,
    Wall:          drawWall,
  }[type] || drawWall)(ctx, px, py, bsize, ts, c);
}

function drawCommandCenter(ctx, px, py, bs, ts, c){
  // outer shell
  ctx.fillStyle=c.sec;
  rrect(ctx,px+bs*.04,py+bs*.04,bs*.92,bs*.92,ts*.1); ctx.fill();
  ctx.fillStyle=c.pri;
  rrect(ctx,px+bs*.1,py+bs*.1,bs*.8,bs*.8,ts*.08); ctx.fill();
  // inner panel
  ctx.fillStyle=c.sec;
  rrect(ctx,px+bs*.2,py+bs*.2,bs*.6,bs*.6,ts*.06); ctx.fill();
  ctx.fillStyle='#0a1520';
  rrect(ctx,px+bs*.25,py+bs*.25,bs*.5,bs*.5,ts*.04); ctx.fill();
  // antenna
  ctx.fillStyle=c.pri;
  ctx.fillRect(px+bs*.47,py+bs*.04,bs*.06,bs*.22);
  ctx.beginPath(); ctx.arc(px+bs*.5,py+bs*.04,bs*.04,0,Math.PI*2);
  ctx.fillStyle=c.glow; ctx.fill();
  // glowing core
  ctx.shadowColor=c.glow; ctx.shadowBlur=12;
  ctx.fillStyle=c.pri;
  ctx.beginPath(); ctx.arc(px+bs*.5,py+bs*.5,bs*.12,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;
  // grid lines
  ctx.strokeStyle='rgba(0,170,255,.15)'; ctx.lineWidth=1;
  for(let i=1;i<3;i++){
    ctx.beginPath(); ctx.moveTo(px+bs*.1,py+bs*(.1+i*.27)); ctx.lineTo(px+bs*.9,py+bs*(.1+i*.27)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px+bs*(.1+i*.27),py+bs*.1); ctx.lineTo(px+bs*(.1+i*.27),py+bs*.9); ctx.stroke();
  }
}

function drawTurretBuilding(ctx, px, py, bs, ts, c){
  // base pad
  ctx.fillStyle='#333';
  rrect(ctx,px+bs*.08,py+bs*.08,bs*.84,bs*.84,ts*.06); ctx.fill();
  ctx.fillStyle=c.sec;
  rrect(ctx,px+bs*.15,py+bs*.15,bs*.7,bs*.7,ts*.05); ctx.fill();
  // body
  ctx.fillStyle=c.pri;
  ctx.beginPath(); ctx.arc(px+bs*.5,py+bs*.5,bs*.28,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=c.sec;
  ctx.beginPath(); ctx.arc(px+bs*.5,py+bs*.5,bs*.2,0,Math.PI*2); ctx.fill();
  // barrel (facing right)
  ctx.fillStyle=c.pri;
  ctx.fillRect(px+bs*.5,py+bs*.47,bs*.42,bs*.06);
  ctx.fillStyle='#111';
  ctx.fillRect(px+bs*.84,py+bs*.46,bs*.1,bs*.08);
  // glow
  ctx.shadowColor=c.glow; ctx.shadowBlur=8;
  ctx.fillStyle=c.glow; ctx.globalAlpha=.5;
  ctx.beginPath(); ctx.arc(px+bs*.5,py+bs*.5,bs*.1,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1; ctx.shadowBlur=0;
}

function drawFactory(ctx, px, py, bs, ts, c){
  ctx.fillStyle=c.sec;
  rrect(ctx,px+bs*.06,py+bs*.06,bs*.88,bs*.88,ts*.06); ctx.fill();
  ctx.fillStyle='#0a1520';
  rrect(ctx,px+bs*.12,py+bs*.12,bs*.76,bs*.76,ts*.04); ctx.fill();
  ctx.fillStyle=c.pri;
  // chimney stacks
  [[.25,.1,.1,.35],[.6,.1,.1,.35]].forEach(([ox,oy,w,h])=>ctx.fillRect(px+bs*ox,py+bs*oy,bs*w,bs*h));
  // door
  ctx.fillStyle=c.sec;
  rrect(ctx,px+bs*.35,py+bs*.55,bs*.3,bs*.38,ts*.02); ctx.fill();
  ctx.fillStyle='rgba(0,200,255,.3)';
  rrect(ctx,px+bs*.38,py+bs*.58,bs*.24,bs*.32,ts*.01); ctx.fill();
  // conveyor
  ctx.fillStyle=c.pri; ctx.globalAlpha=.5;
  for(let i=0;i<4;i++) ctx.fillRect(px+bs*.14,py+bs*(.38+i*.06),bs*.72,bs*.02);
  ctx.globalAlpha=1;
}

function drawWall(ctx, px, py, bs, ts, c){
  ctx.fillStyle=c.sec;
  ctx.fillRect(px+bs*.05,py+bs*.05,bs*.9,bs*.9);
  ctx.fillStyle=c.pri;
  ctx.fillRect(px+bs*.12,py+bs*.12,bs*.76,bs*.76);
  ctx.strokeStyle=c.sec; ctx.lineWidth=1;
  [[.5,.05,.5,.45],[.05,.5,.45,.5],[.55,.5,.95,.5],[.5,.55,.5,.95]].forEach(([x1,y1,x2,y2])=>{
    ctx.beginPath(); ctx.moveTo(px+bs*x1,py+bs*y1); ctx.lineTo(px+bs*x2,py+bs*y2); ctx.stroke();
  });
}

// ─── PROPS ──────────────────────────────────────────────────────────
function drawProp(ctx, type, px, py, ts){
  ({
    Rock:    drawRock,
    Crystal: drawCrystal,
    Debris:  drawDebris,
  }[type] || drawRock)(ctx, px, py, ts);
}

function drawRock(ctx, px, py, ts){
  ctx.fillStyle='#5a5a5a';
  ctx.beginPath();
  ctx.moveTo(px+ts*.5,py+ts*.15); ctx.lineTo(px+ts*.8,py+ts*.4); ctx.lineTo(px+ts*.75,py+ts*.8);
  ctx.lineTo(px+ts*.25,py+ts*.8); ctx.lineTo(px+ts*.18,py+ts*.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#777';
  ctx.beginPath(); ctx.moveTo(px+ts*.5,py+ts*.15); ctx.lineTo(px+ts*.6,py+ts*.38); ctx.lineTo(px+ts*.4,py+ts*.38); ctx.closePath(); ctx.fill();
}

function drawCrystal(ctx, px, py, ts){
  [[ts*.5,ts*.18,ts*.58,ts*.7,ts*.42,ts*.7,'#00ddff'],
   [ts*.3,ts*.25,ts*.38,ts*.75,ts*.22,ts*.75,'#00aacc'],
   [ts*.68,ts*.28,ts*.76,ts*.72,ts*.6,ts*.72,'#0088aa']].forEach(([x1,y1,xr,yr,xl,yl,col])=>{
    ctx.fillStyle=col; ctx.globalAlpha=.75;
    ctx.beginPath(); ctx.moveTo(px+x1,py+y1); ctx.lineTo(px+xr,py+yr); ctx.lineTo(px+xl,py+yl); ctx.closePath(); ctx.fill();
  });
  ctx.globalAlpha=1;
  ctx.shadowColor='#00ffff'; ctx.shadowBlur=8;
  ctx.fillStyle='#aaffff';
  ctx.beginPath(); ctx.arc(px+ts*.5,py+ts*.32,ts*.04,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;
}

function drawDebris(ctx, px, py, ts){
  ctx.fillStyle='#444'; ctx.strokeStyle='#666'; ctx.lineWidth=1;
  ctx.save(); ctx.translate(px+ts*.5,py+ts*.5); ctx.rotate(.4);
  ctx.fillRect(-ts*.38,-ts*.12,ts*.76,ts*.24); ctx.strokeRect(-ts*.38,-ts*.12,ts*.76,ts*.24);
  ctx.fillRect(-ts*.1,-ts*.35,ts*.2,ts*.7); ctx.strokeRect(-ts*.1,-ts*.35,ts*.2,ts*.7);
  ctx.restore();
}

// ─── PROJECTILES ────────────────────────────────────────────────────
const PROJ_COL = {
  bullet:  '#ffee00',
  shell:   '#ff9900',
  missile: '#00ffaa',
  beam:    '#ff4444',
};

function drawProjectile(ctx, proj){
  const col = PROJ_COL[proj.kind] || '#fff';
  ctx.save();
  ctx.translate(proj.x, proj.y);
  ctx.rotate(proj.angle);
  ctx.shadowColor=col; ctx.shadowBlur=6;
  ctx.fillStyle=col;
  if(proj.kind==='beam'){
    ctx.fillRect(-10,-2,20,4);
  } else if(proj.kind==='missile'){
    ctx.fillRect(-6,-2,12,4);
    ctx.fillStyle='#fff'; ctx.fillRect(5,-1,3,2);
  } else {
    ctx.beginPath(); ctx.arc(0,0,proj.kind==='shell'?4:3,0,Math.PI*2); ctx.fill();
  }
  ctx.shadowBlur=0;
  ctx.restore();
}

// ─── PORTRAIT (for HUD) ─────────────────────────────────────────────
function drawPortrait(ctx, type, team, w, h){
  ctx.fillStyle='#0a1520'; ctx.fillRect(0,0,w,h);
  ctx.save();
  ctx.translate(w*.5,h*.5);
  const ts = Math.min(w,h)*.7;
  drawUnitAt(ctx, type, team, 0, ts/( UNIT_STATS[type]?.size||1 ));
  ctx.restore();
}
