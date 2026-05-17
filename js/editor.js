// editor.js – Map Editor logic

class Editor {
  constructor(){
    this.ts = TILE_SIZE;
    this.map = this.defaultMap(32, 24);
    this.tool = 'paint';   // paint | erase | fill | place | delete
    this.selTile = 1;
    this.selObj  = null;   // {type, team} or null
    this.placing = false;
    this.painting= false;
    this.cam = {x:0, y:0};
    this.mouse = {wx:0, wy:0, tx:0, ty:0};
    this.history = [];     // undo stack (shallow copies of terrain)

    this.canvas = document.getElementById('ed-canvas');
    this.ctx    = this.canvas.getContext('2d');
    this.wrap   = document.getElementById('ed-wrap');
    this.statusTile = document.getElementById('st-tile');
    this.statusTool = document.getElementById('st-tool');

    this.resize();
    this.buildPalettes();
    this.bindEvents();
    // centre camera on the map's iso midpoint
    this._centerCamera();
    this.render();

    window.addEventListener('resize', ()=>this.resize());
  }

  defaultMap(w, h){
    const terrain = new Array(w*h).fill(1);
    // border of mountain
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      if(x===0||y===0||x===w-1||y===h-1) terrain[y*w+x]=5;
    }
    return {
      name:'New Map', width:w, height:h,
      terrain,
      objects:[
        {type:'CommandCenter',tx:2,ty:2,team:0,size:3},
        {type:'CommandCenter',tx:w-5,ty:h-5,team:1,size:3},
      ]
    };
  }

  resize(){
    const rect = this.wrap.getBoundingClientRect();
    this.canvas.width  = rect.width;
    this.canvas.height = rect.height;
    this.render();
  }

  _centerCamera(){
    const {width:mw,height:mh}=this.map;
    const midTx=mw/2, midTy=mh/2;
    const iso=tileToIso(midTx,midTy);
    this.cam.x=iso.x-this.canvas.width*.5;
    this.cam.y=iso.y-this.canvas.height*.5;
    this.clampCam();
  }

  // ── palette building ──────────────────────────────────────────────
  buildPalettes(){
    this.buildTilePalette();
    this.buildObjectPalette();
  }

  buildTilePalette(){
    const el = document.getElementById('tile-palette');
    el.innerHTML = '';
    Object.entries(TILES).forEach(([id, tile])=>{
      const item = document.createElement('div');
      item.className = 'pal-item' + (Number(id)===this.selTile?' sel':'');
      item.dataset.id = id;
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      renderTile(cv.getContext('2d'), Number(id), 0, 0, 64);
      item.appendChild(cv);
      const lbl = document.createElement('div');
      lbl.className = 'lbl'; lbl.textContent = tile.name;
      item.appendChild(lbl);
      item.addEventListener('click', ()=>{
        this.selTile = Number(id);
        this.selObj  = null;
        this.tool = 'paint';
        document.querySelectorAll('#tile-palette .pal-item').forEach(e=>e.classList.remove('sel'));
        item.classList.add('sel');
        document.querySelectorAll('#obj-palette .pal-item').forEach(e=>e.classList.remove('sel'));
        this.setTool('paint');
      });
      el.appendChild(item);
    });
  }

  buildObjectPalette(){
    const el = document.getElementById('obj-palette');
    el.innerHTML = '';

    const allObjs = [
      ...Object.keys(BUILDING_STATS).flatMap(t=>[
        {type:t,team:0,label:`${t} [P]`},
        {type:t,team:1,label:`${t} [E]`},
      ]),
      ...PROP_TYPES.map(t=>({type:t,team:-1,label:t})),
    ];

    allObjs.forEach(obj=>{
      const item = document.createElement('div');
      item.className = 'pal-item';
      const cv = document.createElement('canvas');
      const ps = 64;
      cv.width = cv.height = ps;
      const octx = cv.getContext('2d');
      octx.fillStyle='#0a1520'; octx.fillRect(0,0,ps,ps);
      if(BUILDING_STATS[obj.type]){
        const sz = BUILDING_STATS[obj.type].size;
        const ts = ps/sz;
        drawBuilding(octx, obj.type, obj.team, 0, 0, ps/sz);
      } else {
        drawProp(octx, obj.type, 8, 8, 48);
      }
      item.appendChild(cv);
      const lbl = document.createElement('div');
      lbl.className='lbl'; lbl.textContent=obj.label;
      item.appendChild(lbl);
      item.addEventListener('click', ()=>{
        this.selObj  = {type:obj.type, team:obj.team};
        this.tool    = 'place';
        document.querySelectorAll('#tile-palette .pal-item').forEach(e=>e.classList.remove('sel'));
        document.querySelectorAll('#obj-palette .pal-item').forEach(e=>e.classList.remove('sel'));
        item.classList.add('sel');
        this.setTool('place');
      });
      el.appendChild(item);
    });
  }

  setTool(t){
    this.tool = t;
    document.querySelectorAll('.tbtn').forEach(b=>b.classList.toggle('on', b.dataset.tool===t));
    if(this.statusTool) this.statusTool.textContent = t.toUpperCase();
  }

  // ── events ───────────────────────────────────────────────────────
  bindEvents(){
    const cv = this.canvas;
    cv.addEventListener('mousedown',  e=>this.onDown(e));
    cv.addEventListener('mousemove',  e=>this.onMove(e));
    cv.addEventListener('mouseup',    e=>this.onUp(e));
    cv.addEventListener('contextmenu',e=>{e.preventDefault(); this.onRight(e);});
    cv.addEventListener('wheel',      e=>this.onWheel(e), {passive:false});

    document.querySelectorAll('.tbtn').forEach(b=>{
      b.addEventListener('click',()=>{
        if(b.dataset.tool) this.setTool(b.dataset.tool);
      });
    });

    document.getElementById('btn-new')?.addEventListener('click',  ()=>this.newMap());
    document.getElementById('btn-export')?.addEventListener('click',()=>this.exportJSON());
    document.getElementById('btn-load')?.addEventListener('click',  ()=>this.loadDialog());
    document.getElementById('btn-play')?.addEventListener('click',  ()=>this.play());
    document.getElementById('btn-undo')?.addEventListener('click',  ()=>this.undo());
  }

  // iso camera clamp
  clampCam(){
    const {width:mw,height:mh}=this.map;
    const cw=this.canvas.width, ch=this.canvas.height;
    this.cam.x=Math.max(-(mh)*(ISO_W/2)-ISO_W, Math.min(this.cam.x, (mw)*(ISO_W/2)+ISO_W-cw));
    this.cam.y=Math.max(0, Math.min(this.cam.y, (mw+mh)*(ISO_H/2)+ISO_H*3-ch));
  }

  screenToTileIso(sx, sy){
    return screenToTile(sx, sy, this.cam.x, this.cam.y);
  }

  inBounds(tx, ty){
    return tx>=0 && ty>=0 && tx<this.map.width && ty<this.map.height;
  }

  onDown(e){
    if(e.button===1){ this._panStart={x:e.clientX+this.cam.x, y:e.clientY+this.cam.y}; return; }
    this.updateMouse(e);
    if(e.button===0){
      this.pushHistory();
      this.painting = true;
      this.applyTool();
    }
  }

  onMove(e){
    if(this._panStart){
      this.cam.x = this._panStart.x - e.clientX;
      this.cam.y = this._panStart.y - e.clientY;
      this.clampCam();
      this.render(); return;
    }
    this.updateMouse(e);
    if(this.painting) this.applyTool();
    else this.render();
  }

  onUp(e){
    this._panStart = null;
    this.painting = false;
  }

  onRight(e){
    this.updateMouse(e);
    const {tx,ty} = this.mouse;
    const idx = this.map.objects.findIndex(o=>{
      const sz = BUILDING_STATS[o.type]?.size || 1;
      return tx>=o.tx && tx<o.tx+sz && ty>=o.ty && ty<o.ty+sz;
    });
    if(idx !== -1){ this.pushHistory(); this.map.objects.splice(idx,1); this.render(); }
  }

  onWheel(e){
    e.preventDefault();
    this.cam.x += e.deltaX; this.cam.y += e.deltaY;
    this.clampCam(); this.render();
  }

  updateMouse(e){
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const {tx, ty} = screenToTile(sx, sy, this.cam.x, this.cam.y);
    this.mouse = {sx, sy, tx, ty};
    const id = this.inBounds(tx,ty) ? this.map.terrain[ty*this.map.width+tx] : -1;
    if(this.statusTile) this.statusTile.textContent = `(${tx},${ty}) ${TILES[id]?.name||'out of bounds'}`;
  }

  // ── tools ─────────────────────────────────────────────────────────
  applyTool(){
    const {tx,ty} = this.mouse;
    if(!this.inBounds(tx,ty)) return;
    if(this.tool==='paint'){
      this.map.terrain[ty*this.map.width+tx] = this.selTile;
      this.render();
    } else if(this.tool==='erase'){
      this.map.terrain[ty*this.map.width+tx] = 0;
      this.render();
    } else if(this.tool==='fill'){
      this.floodFill(tx,ty,this.selTile);
      this.render();
      this.painting=false;
    } else if(this.tool==='place' && this.selObj){
      this.placeObject(tx,ty);
    }
  }

  floodFill(tx, ty, newId){
    const {width:w, height:h, terrain} = this.map;
    const oldId = terrain[ty*w+tx];
    if(oldId===newId) return;
    const stack = [[tx,ty]];
    const visited = new Uint8Array(w*h);
    while(stack.length){
      const [x,y] = stack.pop();
      if(x<0||y<0||x>=w||y>=h||visited[y*w+x]||terrain[y*w+x]!==oldId) continue;
      visited[y*w+x]=1;
      terrain[y*w+x]=newId;
      stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
    }
  }

  placeObject(tx, ty){
    if(!this.selObj) return;
    const sz = BUILDING_STATS[this.selObj.type]?.size || 1;
    // check bounds
    if(tx+sz>this.map.width || ty+sz>this.map.height) return;
    // remove overlapping objects
    this.map.objects = this.map.objects.filter(o=>{
      const osz = BUILDING_STATS[o.type]?.size||1;
      return !(tx < o.tx+osz && tx+sz > o.tx && ty < o.ty+osz && ty+sz > o.ty);
    });
    this.map.objects.push({type:this.selObj.type, tx, ty, team:this.selObj.team, size:sz});
    this.render();
    this.painting=false;
  }

  // ── history ────────────────────────────────────────────────────────
  pushHistory(){
    this.history.push({
      terrain: [...this.map.terrain],
      objects: this.map.objects.map(o=>({...o})),
    });
    if(this.history.length>40) this.history.shift();
  }

  undo(){
    const h = this.history.pop();
    if(!h) return;
    this.map.terrain = h.terrain;
    this.map.objects = h.objects;
    this.render();
  }

  // ── map operations ─────────────────────────────────────────────────
  newMap(){
    const w = parseInt(prompt('Map width (tiles):', '32')||'32');
    const h = parseInt(prompt('Map height (tiles):', '24')||'24');
    if(isNaN(w)||isNaN(h)||w<8||h<8) return;
    this.map = this.defaultMap(Math.min(w,96), Math.min(h,72));
    this.cam = {x:0,y:0};
    this.history = [];
    this.render();
  }

  exportJSON(){
    const json = JSON.stringify(this.map);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json],{type:'application/json'}));
    a.download = (this.map.name||'map').replace(/\s+/g,'_')+'.json';
    a.click();
  }

  loadDialog(){
    const inp = document.createElement('input');
    inp.type='file'; inp.accept='.json';
    inp.onchange = e=>{
      const file = e.target.files[0]; if(!file) return;
      const reader = new FileReader();
      reader.onload = ev=>{
        try{
          const data = JSON.parse(ev.target.result);
          this.map = data; this.cam={x:0,y:0}; this.history=[];
          this.render();
        } catch(err){ alert('Invalid map file'); }
      };
      reader.readAsText(file);
    };
    inp.click();
  }

  play(){
    localStorage.setItem('rts_map', JSON.stringify(this.map));
    window.open('game.html','_blank');
  }

  // ── rendering (isometric) ─────────────────────────────────────────
  render(){
    const {ctx, canvas, map, cam} = this;
    const cw=canvas.width, ch=canvas.height;
    ctx.fillStyle='#020810'; ctx.fillRect(0,0,cw,ch);

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // visible tile range via iso viewport
    const hw=ISO_W/2, hh=ISO_H/2;
    const corners=[
      {ix:cam.x,    iy:cam.y},{ix:cam.x+cw, iy:cam.y},
      {ix:cam.x,    iy:cam.y+ch},{ix:cam.x+cw,iy:cam.y+ch},
    ];
    const ftxs=corners.map(c=>(c.ix/hw+c.iy/hh)/2);
    const ftys=corners.map(c=>(c.iy/hh-c.ix/hw)/2);
    const minTx=Math.max(0,            Math.floor(Math.min(...ftxs))-1);
    const maxTx=Math.min(map.width-1,  Math.ceil( Math.max(...ftxs))+1);
    const minTy=Math.max(0,            Math.floor(Math.min(...ftys))-1);
    const maxTy=Math.min(map.height-1, Math.ceil( Math.max(...ftys))+1);

    // tiles in diagonal order
    for(let sum=minTx+minTy; sum<=maxTx+maxTy; sum++){
      for(let tx=Math.max(minTx,sum-maxTy); tx<=Math.min(maxTx,sum-minTy); tx++){
        const ty=sum-tx;
        if(ty<minTy||ty>maxTy) continue;
        drawIsoTile(ctx, map.terrain[ty*map.width+tx], tx, ty);
      }
    }

    // objects sorted by depth
    const sorted=[...map.objects].sort((a,b)=>(a.tx+a.ty)-(b.tx+b.ty));
    sorted.forEach(obj=>{
      if(BUILDING_STATS[obj.type]){
        drawIsoBuilding(ctx, obj.type, obj.team, obj.tx, obj.ty);
      } else {
        const wx=(obj.tx+.5)*TILE_SIZE, wy=(obj.ty+.5)*TILE_SIZE;
        drawIsoProp(ctx, obj.type, wx, wy);
      }
    });

    // hover diamond
    const {tx, ty} = this.mouse;
    if(this.inBounds(tx,ty)){
      const sz=this.tool==='place'&&this.selObj?(BUILDING_STATS[this.selObj.type]?.size||1):1;
      const {x:hx,y:hy}=tileToIso(tx,ty);
      const fw=sz*(ISO_W/2), fh=sz*(ISO_H/2);
      ctx.strokeStyle='rgba(0,220,255,.8)'; ctx.lineWidth=1.5;
      ctx.fillStyle='rgba(0,220,255,.1)';
      ctx.beginPath();
      ctx.moveTo(hx,    hy);
      ctx.lineTo(hx+fw, hy+fh);
      ctx.lineTo(hx,    hy+sz*ISO_H);
      ctx.lineTo(hx-fw, hy+fh);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    ctx.restore();
  }
}

// ── boot ──────────────────────────────────────────────────────────────
window.addEventListener('load', ()=>{ window.editor = new Editor(); });
