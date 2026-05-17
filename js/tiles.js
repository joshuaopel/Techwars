// tiles.js – terrain tile definitions & procedural drawing

const TILE_SIZE = 48;

const TILES = {
  0:{name:'Void',      pass:false, slow:1},
  1:{name:'Grass',     pass:true,  slow:1},
  2:{name:'Dirt',      pass:true,  slow:1},
  3:{name:'Sand',      pass:true,  slow:1.4},
  4:{name:'Water',     pass:false, slow:1},
  5:{name:'Mountain',  pass:false, slow:1},
  6:{name:'Tech Floor',pass:true,  slow:.8},
  7:{name:'Lava',      pass:false, slow:1},
  8:{name:'Snow',      pass:true,  slow:1.5},
  9:{name:'Forest',    pass:false, slow:1},
};

const TILE_IDS = Object.keys(TILES).map(Number);

/* deterministic pseudo-random from (tileId, seed) */
function trand(id, s){ let x=(id*7+s*13)&0xffff; x^=x<<7;x^=x>>9;return(x&0xfff)/0xfff; }

const _cache = {};
function getTileCanvas(id, size=TILE_SIZE){
  const k = `${id}_${size}`;
  if(_cache[k]) return _cache[k];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  renderTile(c.getContext('2d'), id, 0, 0, size);
  _cache[k] = c;
  return c;
}

function drawTile(ctx, id, x, y, size=TILE_SIZE){
  ctx.drawImage(getTileCanvas(id, size), x, y, size, size);
}

function renderTile(ctx, id, x, y, s){
  const half = s/2;
  switch(id){

    case 0: // Void
      ctx.fillStyle='#030608'; ctx.fillRect(x,y,s,s); break;

    case 1: // Grass
      ctx.fillStyle='#2b571a'; ctx.fillRect(x,y,s,s);
      ctx.fillStyle='#3a7022';
      for(let i=0;i<9;i++){
        const px=x+trand(1,i*3)*s, py=y+trand(1,i*7+1)*s;
        ctx.fillRect(px,py,1+trand(1,i)*2,1);
      }
      break;

    case 2: // Dirt
      ctx.fillStyle='#7a4e2b'; ctx.fillRect(x,y,s,s);
      ctx.fillStyle='#8f5f38';
      for(let i=0;i<6;i++){
        ctx.fillRect(x+trand(2,i*5)*s*.9,y+trand(2,i*11+2)*s*.9, 3+trand(2,i)*4, 1);
      }
      break;

    case 3: // Sand
      ctx.fillStyle='#c8a96e'; ctx.fillRect(x,y,s,s);
      ctx.fillStyle='#d4b87a';
      for(let i=0;i<5;i++){
        ctx.fillRect(x+trand(3,i*7)*s*.85,y+trand(3,i*13)*s*.85, 6+trand(3,i)*6, 1);
      }
      break;

    case 4:{ // Water – animated via tileId so each tile unique
      const g=ctx.createLinearGradient(x,y,x+s,y+s);
      g.addColorStop(0,'#0e2a5a'); g.addColorStop(1,'#1a4499');
      ctx.fillStyle=g; ctx.fillRect(x,y,s,s);
      ctx.strokeStyle='rgba(80,160,255,.28)'; ctx.lineWidth=1;
      for(let i=0;i<3;i++){
        const oy=y+s*(.22+i*.25);
        ctx.beginPath(); ctx.moveTo(x,oy);
        ctx.quadraticCurveTo(x+half,oy-s*.06,x+s,oy); ctx.stroke();
      }
      break;}

    case 5:{ // Mountain
      ctx.fillStyle='#4a4a4a'; ctx.fillRect(x,y,s,s);
      ctx.fillStyle='#5e5e5e';
      ctx.beginPath(); ctx.moveTo(x+half,y+s*.1); ctx.lineTo(x+s*.85,y+s*.9); ctx.lineTo(x+s*.15,y+s*.9); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#7a7a7a';
      ctx.beginPath(); ctx.moveTo(x+half,y+s*.1); ctx.lineTo(x+s*.6,y+s*.45); ctx.lineTo(x+s*.4,y+s*.45); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#cce8ff';
      ctx.beginPath(); ctx.moveTo(x+half,y+s*.1); ctx.lineTo(x+s*.53,y+s*.28); ctx.lineTo(x+s*.47,y+s*.28); ctx.closePath(); ctx.fill();
      break;}

    case 6:{ // Tech Floor
      ctx.fillStyle='#0c1724'; ctx.fillRect(x,y,s,s);
      ctx.strokeStyle='#0d4060'; ctx.lineWidth=.6;
      const step=s/4;
      for(let i=0;i<=4;i++){
        ctx.beginPath(); ctx.moveTo(x+i*step,y); ctx.lineTo(x+i*step,y+s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x,y+i*step); ctx.lineTo(x+s,y+i*step); ctx.stroke();
      }
      ctx.fillStyle='#1a6090';
      const d=2;
      [[d,d],[s-d-2,d],[d,s-d-2],[s-d-2,s-d-2]].forEach(([ox,oy])=>ctx.fillRect(x+ox,y+oy,2,2));
      break;}

    case 7:{ // Lava
      const rg=ctx.createRadialGradient(x+half,y+half,0,x+half,y+half,half*.9);
      rg.addColorStop(0,'#ff7700'); rg.addColorStop(1,'#7a1500');
      ctx.fillStyle=rg; ctx.fillRect(x,y,s,s);
      ctx.strokeStyle='#cc2200'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(x+s*.25,y); ctx.lineTo(x+s*.45,y+s*.5); ctx.lineTo(x+s*.75,y+s*.8); ctx.stroke();
      break;}

    case 8:{ // Snow
      ctx.fillStyle='#cce0f0'; ctx.fillRect(x,y,s,s);
      ctx.fillStyle='#e8f4ff';
      for(let i=0;i<6;i++) ctx.fillRect(x+trand(8,i*7)*s*.88,y+trand(8,i*11+3)*s*.88,3+trand(8,i)*4,3);
      break;}

    case 9:{ // Forest
      ctx.fillStyle='#19301a'; ctx.fillRect(x,y,s,s);
      const centers=[[.28,.28],[.72,.28],[.28,.72],[.72,.72],[.5,.5]];
      ctx.fillStyle='#254d20';
      centers.forEach(([cx,cy])=>{
        ctx.beginPath(); ctx.arc(x+cx*s,y+cy*s,s*.18,0,Math.PI*2); ctx.fill();
      });
      ctx.fillStyle='#3d7a30';
      centers.forEach(([cx,cy])=>{
        ctx.beginPath(); ctx.arc(x+cx*s-.03*s,y+cy*s-.03*s,s*.1,0,Math.PI*2); ctx.fill();
      });
      break;}

    default:
      ctx.fillStyle='#111'; ctx.fillRect(x,y,s,s);
  }
  /* subtle edge */
  ctx.strokeStyle='rgba(0,0,0,.18)'; ctx.lineWidth=.5;
  ctx.strokeRect(x+.25,y+.25,s-.5,s-.5);
}
