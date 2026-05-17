// tiles.js – terrain tile definitions & isometric drawing

const TILE_SIZE = 48;   // world-space pixels per tile (physics / movement)
const ISO_W    = 64;    // isometric tile diamond visual width
const ISO_H    = 32;    // isometric tile diamond visual height (ISO_W/2)

const TILES = {
  0:{name:'Void',       pass:false, slow:1},
  1:{name:'Grass',      pass:true,  slow:1},
  2:{name:'Dirt',       pass:true,  slow:1},
  3:{name:'Sand',       pass:true,  slow:1.4},
  4:{name:'Water',      pass:false, slow:1},
  5:{name:'Mountain',   pass:false, slow:1},
  6:{name:'Tech Floor', pass:true,  slow:.8},
  7:{name:'Lava',       pass:false, slow:1},
  8:{name:'Snow',       pass:true,  slow:1.5},
  9:{name:'Forest',     pass:false, slow:1},
};

const TILE_IDS = Object.keys(TILES).map(Number);

function trand(id,s){let x=(id*7+s*13)&0xffff;x^=x<<7;x^=x>>9;return(x&0xfff)/0xfff;}

// ─── Coordinate helpers ───────────────────────────────────────────────
// Tile integer coords → iso screen (top/N vertex), before camera
function tileToIso(tx, ty){
  return { x:(tx-ty)*(ISO_W/2), y:(tx+ty)*(ISO_H/2) };
}

// World-pixel coords → iso screen, before camera
function worldToIso(wx, wy){
  return {
    x: (wx-wy) * ISO_W/(2*TILE_SIZE),
    y: (wx+wy) * ISO_H/(2*TILE_SIZE),
  };
}

// Iso screen → world-pixel coords
function isoToWorld(ix, iy){
  const hw=ISO_W/2, hh=ISO_H/2;
  const ftx=(ix/hw+iy/hh)/2;
  const fty=(iy/hh-ix/hw)/2;
  return { x:ftx*TILE_SIZE, y:fty*TILE_SIZE };
}

// Screen-space click (adding camera) → integer tile coords
function screenToTile(sx, sy, camX, camY){
  const ix=sx+camX, iy=sy+camY;
  const hw=ISO_W/2, hh=ISO_H/2;
  const ftx=(ix/hw+iy/hh)/2;
  const fty=(iy/hh-ix/hw)/2;
  return { tx:Math.floor(ftx), ty:Math.floor(fty) };
}

// ─── Isometric tile drawing ───────────────────────────────────────────
// ctx must already have the camera translate applied.
function drawIsoTile(ctx, id, tx, ty){
  const {x:cx, y:cy} = tileToIso(tx, ty);
  const hw=ISO_W/2, hh=ISO_H/2;

  ctx.save();
  // Clip to diamond shape
  ctx.beginPath();
  ctx.moveTo(cx,    cy);          // N
  ctx.lineTo(cx+hw, cy+hh);       // E
  ctx.lineTo(cx,    cy+ISO_H);    // S
  ctx.lineTo(cx-hw, cy+hh);       // W
  ctx.closePath();
  ctx.clip();
  _fillIsoTile(ctx, id, cx, cy, hw, hh);
  ctx.restore();

  // Diamond outline
  ctx.strokeStyle='rgba(0,0,0,0.1)'; ctx.lineWidth=0.5;
  ctx.beginPath();
  ctx.moveTo(cx,    cy);
  ctx.lineTo(cx+hw, cy+hh);
  ctx.lineTo(cx,    cy+ISO_H);
  ctx.lineTo(cx-hw, cy+hh);
  ctx.closePath();
  ctx.stroke();

  // Elevated tiles: SW + SE side faces
  if(id===5) _drawSide(ctx, cx, cy, hw, hh, '#383838','#242424', 22);
  if(id===9) _drawSide(ctx, cx, cy, hw, hh, '#1a3015','#112010',  8);
}

function _drawSide(ctx, cx, cy, hw, hh, sw, se, elev){
  ctx.fillStyle=sw;
  ctx.beginPath();
  ctx.moveTo(cx-hw, cy+hh);
  ctx.lineTo(cx,    cy+ISO_H);
  ctx.lineTo(cx,    cy+ISO_H+elev);
  ctx.lineTo(cx-hw, cy+hh+elev);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle=se;
  ctx.beginPath();
  ctx.moveTo(cx,    cy+ISO_H);
  ctx.lineTo(cx+hw, cy+hh);
  ctx.lineTo(cx+hw, cy+hh+elev);
  ctx.lineTo(cx,    cy+ISO_H+elev);
  ctx.closePath(); ctx.fill();
}

function _fillIsoTile(ctx, id, cx, cy, hw, hh){
  const fill=(col)=>{ ctx.fillStyle=col; ctx.fillRect(cx-hw,cy,ISO_W,ISO_H); };
  switch(id){
    case 0: fill('#030608'); break;
    case 1: fill('#2b571a');
      ctx.fillStyle='#3a7022';
      for(let i=0;i<6;i++) ctx.fillRect(cx-hw+trand(1,i*3)*ISO_W,cy+trand(1,i*7+1)*ISO_H,2,1);
      break;
    case 2: fill('#7a4e2b');
      ctx.fillStyle='#8f5f38';
      for(let i=0;i<5;i++) ctx.fillRect(cx-hw+trand(2,i*5)*ISO_W*.9,cy+trand(2,i*11+2)*ISO_H*.9,3+trand(2,i)*4,1);
      break;
    case 3: fill('#c8a96e');
      ctx.fillStyle='#d4b87a';
      for(let i=0;i<4;i++) ctx.fillRect(cx-hw+trand(3,i*7)*ISO_W*.85,cy+trand(3,i*13)*ISO_H*.85,6,1);
      break;
    case 4:{
      const g=ctx.createLinearGradient(cx-hw,cy,cx+hw,cy+ISO_H);
      g.addColorStop(0,'#0e2a5a'); g.addColorStop(1,'#1a4499');
      ctx.fillStyle=g; ctx.fillRect(cx-hw,cy,ISO_W,ISO_H);
      ctx.strokeStyle='rgba(80,160,255,.25)'; ctx.lineWidth=0.8;
      for(let i=0;i<2;i++){
        ctx.beginPath();
        ctx.moveTo(cx-hw*.5, cy+hh*(.5+i*.8));
        ctx.quadraticCurveTo(cx, cy+hh*(.3+i*.8), cx+hw*.5, cy+hh*(.5+i*.8));
        ctx.stroke();
      }
      break;}
    case 5: fill('#555');
      ctx.fillStyle='#cce8ff'; ctx.fillRect(cx-hw*.28,cy,ISO_W*.56,ISO_H*.38);
      ctx.fillStyle='#aad0ee'; ctx.fillRect(cx-hw*.14,cy+ISO_H*.1,ISO_W*.28,ISO_H*.15);
      break;
    case 6: fill('#0c1724');
      ctx.strokeStyle='#0d4060'; ctx.lineWidth=0.5;
      for(let i=1;i<3;i++){
        ctx.beginPath(); ctx.moveTo(cx-hw+i*hw*.5,cy+i*hh*.5); ctx.lineTo(cx,cy+i*hh); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx+hw-i*hw*.5,cy+i*hh*.5); ctx.lineTo(cx,cy+i*hh); ctx.stroke();
      }
      ctx.fillStyle='#1a6090';
      ctx.fillRect(cx-3,cy+2,2,2); ctx.fillRect(cx+1,cy+2,2,2);
      break;
    case 7:{
      const rg=ctx.createRadialGradient(cx,cy+hh,0,cx,cy+hh,hh);
      rg.addColorStop(0,'#ff7700'); rg.addColorStop(1,'#7a1500');
      ctx.fillStyle=rg; ctx.fillRect(cx-hw,cy,ISO_W,ISO_H);
      ctx.strokeStyle='#cc2200'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(cx-hw*.3,cy+hh*.3); ctx.lineTo(cx,cy+hh*.8); ctx.lineTo(cx+hw*.3,cy+hh*.5); ctx.stroke();
      break;}
    case 8: fill('#cce0f0');
      ctx.fillStyle='#e8f4ff';
      for(let i=0;i<5;i++) ctx.fillRect(cx-hw+trand(8,i*7)*ISO_W*.88,cy+trand(8,i*11+3)*ISO_H*.88,3,2);
      break;
    case 9: fill('#19301a');
      ctx.fillStyle='#254d20';
      [[.28,.35],[.72,.35],[.5,.72]].forEach(([fx,fy])=>{
        ctx.beginPath(); ctx.arc(cx-hw+fx*ISO_W,cy+fy*ISO_H,ISO_W*.12,0,Math.PI*2); ctx.fill();
      });
      ctx.fillStyle='#3d7a30';
      [[.28,.35],[.72,.35],[.5,.72]].forEach(([fx,fy])=>{
        ctx.beginPath(); ctx.arc(cx-hw+fx*ISO_W-1,cy+fy*ISO_H-2,ISO_W*.07,0,Math.PI*2); ctx.fill();
      });
      break;
    default: fill('#111');
  }
}

// ─── Flat square tile drawing (palette previews) ──────────────────────
const _sqCache = {};
function drawTile(ctx, id, x, y, size=TILE_SIZE){
  const k=`${id}_${size}`;
  if(!_sqCache[k]){
    const c=document.createElement('canvas'); c.width=c.height=size;
    renderTile(c.getContext('2d'),id,0,0,size);
    _sqCache[k]=c;
  }
  ctx.drawImage(_sqCache[k],x,y,size,size);
}

function renderTile(ctx,id,x,y,s){
  const half=s/2;
  switch(id){
    case 0: ctx.fillStyle='#030608'; ctx.fillRect(x,y,s,s); break;
    case 1: ctx.fillStyle='#2b571a'; ctx.fillRect(x,y,s,s);
      ctx.fillStyle='#3a7022';
      for(let i=0;i<9;i++) ctx.fillRect(x+trand(1,i*3)*s,y+trand(1,i*7+1)*s,1+trand(1,i)*2,1);
      break;
    case 2: ctx.fillStyle='#7a4e2b'; ctx.fillRect(x,y,s,s);
      ctx.fillStyle='#8f5f38';
      for(let i=0;i<6;i++) ctx.fillRect(x+trand(2,i*5)*s*.9,y+trand(2,i*11+2)*s*.9,3+trand(2,i)*4,1);
      break;
    case 3: ctx.fillStyle='#c8a96e'; ctx.fillRect(x,y,s,s);
      ctx.fillStyle='#d4b87a';
      for(let i=0;i<5;i++) ctx.fillRect(x+trand(3,i*7)*s*.85,y+trand(3,i*13)*s*.85,6+trand(3,i)*6,1);
      break;
    case 4:{const g=ctx.createLinearGradient(x,y,x+s,y+s);
      g.addColorStop(0,'#0e2a5a'); g.addColorStop(1,'#1a4499');
      ctx.fillStyle=g; ctx.fillRect(x,y,s,s);
      ctx.strokeStyle='rgba(80,160,255,.28)'; ctx.lineWidth=1;
      for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(x,y+s*(.22+i*.25));ctx.quadraticCurveTo(x+half,y+s*(.15+i*.25),x+s,y+s*(.22+i*.25));ctx.stroke();}
      break;}
    case 5: ctx.fillStyle='#4a4a4a'; ctx.fillRect(x,y,s,s);
      ctx.fillStyle='#cce8ff'; ctx.fillRect(x+s*.3,y+s*.1,s*.4,s*.25);
      break;
    case 6: ctx.fillStyle='#0c1724'; ctx.fillRect(x,y,s,s);
      ctx.strokeStyle='#0d4060'; ctx.lineWidth=0.6;
      for(let i=0;i<=4;i++){ctx.beginPath();ctx.moveTo(x+i*s/4,y);ctx.lineTo(x+i*s/4,y+s);ctx.stroke();ctx.beginPath();ctx.moveTo(x,y+i*s/4);ctx.lineTo(x+s,y+i*s/4);ctx.stroke();}
      ctx.fillStyle='#1a6090';
      [[2,2],[s-4,2],[2,s-4],[s-4,s-4]].forEach(([ox,oy])=>ctx.fillRect(x+ox,y+oy,2,2));
      break;
    case 7:{const rg=ctx.createRadialGradient(x+half,y+half,0,x+half,y+half,half*.9);
      rg.addColorStop(0,'#ff7700'); rg.addColorStop(1,'#7a1500');
      ctx.fillStyle=rg; ctx.fillRect(x,y,s,s);
      ctx.strokeStyle='#cc2200'; ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(x+s*.25,y);ctx.lineTo(x+s*.45,y+s*.5);ctx.lineTo(x+s*.75,y+s*.8);ctx.stroke();
      break;}
    case 8: ctx.fillStyle='#cce0f0'; ctx.fillRect(x,y,s,s);
      ctx.fillStyle='#e8f4ff';
      for(let i=0;i<6;i++) ctx.fillRect(x+trand(8,i*7)*s*.88,y+trand(8,i*11+3)*s*.88,3+trand(8,i)*4,3);
      break;
    case 9: ctx.fillStyle='#19301a'; ctx.fillRect(x,y,s,s);
      const cc=[[.28,.28],[.72,.28],[.28,.72],[.72,.72],[.5,.5]];
      ctx.fillStyle='#254d20';
      cc.forEach(([cx2,cy2])=>{ctx.beginPath();ctx.arc(x+cx2*s,y+cy2*s,s*.18,0,Math.PI*2);ctx.fill();});
      ctx.fillStyle='#3d7a30';
      cc.forEach(([cx2,cy2])=>{ctx.beginPath();ctx.arc(x+cx2*s-.03*s,y+cy2*s-.03*s,s*.1,0,Math.PI*2);ctx.fill();});
      break;
    default: ctx.fillStyle='#111'; ctx.fillRect(x,y,s,s);
  }
  ctx.strokeStyle='rgba(0,0,0,.18)'; ctx.lineWidth=.5;
  ctx.strokeRect(x+.25,y+.25,s-.5,s-.5);
}
