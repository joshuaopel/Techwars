// game.js – Full RTS game engine

const TS = TILE_SIZE; // tile size in pixels

// ─── Vector ──────────────────────────────────────────────────────────
class V2 {
  constructor(x=0,y=0){ this.x=x; this.y=y; }
  add(v){ return new V2(this.x+v.x,this.y+v.y); }
  sub(v){ return new V2(this.x-v.x,this.y-v.y); }
  mul(s){ return new V2(this.x*s,this.y*s); }
  len(){ return Math.hypot(this.x,this.y); }
  norm(){ const l=this.len(); return l>0?this.mul(1/l):new V2(); }
  dist(v){ return this.sub(v).len(); }
  angle(){ return Math.atan2(this.y,this.x); }
  static lerp(a,b,t){ return new V2(a.x+(b.x-a.x)*t, a.y+(b.y-a.y)*t); }
}

// ─── Unit ─────────────────────────────────────────────────────────────
let _uid = 0;
class Unit {
  constructor(type, x, y, team){
    this.id   = ++_uid;
    this.type = type;
    this.pos  = new V2(x,y);
    this.team = team;
    this.angle= Math.PI * (team===1 ? 1 : 0); // face opponent
    const s   = UNIT_STATS[type];
    this.hp   = s.hp; this.maxHp = s.hp;
    this.spd  = s.spd;
    this.range= s.range;
    this.dmg  = s.dmg;
    this.cdMax= s.cd;
    this.cd   = Math.random()*s.cd;
    this.state= 'idle';     // idle | moving | attacking
    this.targetPos  = null;
    this.targetUnit = null;
    this.selected   = false;
    this.dead       = false;
    this.flashTimer = 0;
    this.deathTimer = 0;
    // formation slot
    this.formOff    = new V2();
  }
}

// ─── Building (static) ────────────────────────────────────────────────
class Building {
  constructor(type, tx, ty, team){
    this.type  = type;
    this.tx    = tx;
    this.ty    = ty;
    this.team  = team;
    this.px    = tx*TS;  // pixel x (top-left)
    this.py    = ty*TS;
    const s    = BUILDING_STATS[type];
    this.size  = s.size;
    this.hp    = s.hp; this.maxHp = s.hp;
    this.range = s.range || 0;
    this.dmg   = s.dmg   || 0;
    this.cdMax = s.cd    || 0;
    this.cd    = 0;
    this.dead  = false;
    this.flashTimer = 0;
    // center pixel
    this.cx = this.px + this.size*TS*.5;
    this.cy = this.py + this.size*TS*.5;
    // production
    this.queue      = [];   // [{type, elapsed, total}]
    this.rallyPoint = null; // V2 world pos
  }
}

// ─── Projectile ───────────────────────────────────────────────────────
class Projectile {
  constructor(x,y,tx,ty,dmg,team,kind){
    this.x=x; this.y=y;
    this.dmg=dmg; this.team=team; this.kind=kind;
    const dx=tx-x, dy=ty-y, d=Math.hypot(dx,dy)||1;
    const spd = {bullet:380,shell:260,missile:200,beam:500}[kind]||300;
    this.vx=dx/d*spd; this.vy=dy/d*spd;
    this.angle=Math.atan2(dy,dx);
    this.targetX=tx; this.targetY=ty;
    this.dead=false;
    this.hitRadius=kind==='shell'?30:kind==='missile'?20:8;
  }
}

// ─── Particle ──────────────────────────────────────────────────────────
class Particle {
  constructor(x,y,vx,vy,col,life,r){
    this.x=x;this.y=y;this.vx=vx;this.vy=vy;this.col=col;this.life=life;this.maxLife=life;this.r=r;
  }
}

// ─── projectile kind per unit type ────────────────────────────────────
const UNIT_PROJ = {Scout:'bullet',Tank:'shell',Heavy:'beam',Artillery:'missile'};

// ─── production ───────────────────────────────────────────────────────
const PROD_TIME = { Scout:8, Tank:15, Heavy:25, Artillery:20 };
const CAN_PRODUCE = {
  CommandCenter: ['Scout','Tank'],
  Factory:       ['Scout','Tank','Heavy','Artillery'],
};

// ─── Game ──────────────────────────────────────────────────────────────
class Game {
  constructor(canvas, mapData){
    this.cv  = canvas;
    this.ctx = canvas.getContext('2d');
    this.map = mapData;
    this.ts  = TS;

    // camera
    this.cam = { x:0, y:0 };
    this.worldW = mapData.width  * TS;
    this.worldH = mapData.height * TS;

    this.units      = [];
    this.buildings  = [];
    this.projectiles= [];
    this.particles  = [];

    this.selected         = [];   // selected units
    this.selectedBuilding = null; // player building currently focused
    this._lastBldPanel    = null; // tracks when to rebuild prod buttons DOM
    this.dragBox    = null; // {sx,sy,ex,ey}
    this.keys       = {};
    this.mouse      = {x:0,y:0};
    this._panStart  = null;

    this.over       = false;
    this.winner     = null;
    this.tick       = 0;
    this.lastTime   = 0;

    // minimap
    this.mmCanvas   = document.getElementById('minimap');
    this.mmCtx      = this.mmCanvas.getContext('2d');
    this.mmScale    = 3; // pixels per tile on minimap

    this.initMap();
    this.bindInput();
    this.resize();
    window.addEventListener('resize',()=>this.resize());

    // center camera on player base
    const pBase = this.buildings.find(b=>b.team===0&&b.type==='CommandCenter');
    if(pBase){ this.cam.x=pBase.cx-this.cv.width*.5; this.cam.y=pBase.cy-this.cv.height*.5; }
    this.clampCam();

    requestAnimationFrame(t=>this.loop(t));
  }

  resize(){
    this.cv.width  = window.innerWidth;
    this.cv.height = window.innerHeight;
    const mmS = this.mmScale;
    this.mmCanvas.width  = this.map.width  * mmS;
    this.mmCanvas.height = this.map.height * mmS;
    this.clampCam();
  }

  clampCam(){
    const cw=this.cv.width, ch=this.cv.height;
    this.cam.x = Math.max(0, Math.min(this.cam.x, Math.max(0,this.worldW-cw)));
    this.cam.y = Math.max(0, Math.min(this.cam.y, Math.max(0,this.worldH-ch)));
  }

  // ── map init ──────────────────────────────────────────────────────
  initMap(){
    const m = this.map;
    // spawn buildings
    m.objects.forEach(obj=>{
      if(BUILDING_STATS[obj.type]){
        this.buildings.push(new Building(obj.type, obj.tx, obj.ty, obj.team));
      }
    });
    // spawn starting units near command centers
    const p0 = this.buildings.find(b=>b.team===0&&b.type==='CommandCenter');
    const p1 = this.buildings.find(b=>b.team===1&&b.type==='CommandCenter');
    if(p0) this.spawnStartUnits(p0.cx, p0.cy, 0);
    if(p1) this.spawnStartUnits(p1.cx, p1.cy, 1);
  }

  spawnStartUnits(cx, cy, team){
    const types = ['Tank','Scout','Scout'];
    types.forEach((t,i)=>{
      const angle = (i/types.length)*Math.PI*2;
      const r = TS*2.5;
      const u = new Unit(t, cx+Math.cos(angle)*r, cy+Math.sin(angle)*r, team);
      this.units.push(u);
    });
  }

  // ── input ─────────────────────────────────────────────────────────
  bindInput(){
    window.addEventListener('keydown',e=>{ this.keys[e.code]=true; });
    window.addEventListener('keyup',  e=>{ this.keys[e.code]=false; });

    const cv=this.cv;
    cv.addEventListener('mousedown', e=>this.onDown(e));
    cv.addEventListener('mousemove', e=>this.onMove(e));
    cv.addEventListener('mouseup',   e=>this.onUp(e));
    cv.addEventListener('contextmenu',e=>{ e.preventDefault(); this.onRight(e); });
    cv.addEventListener('wheel',     e=>this.onWheel(e),{passive:false});

    // minimap click
    this.mmCanvas.addEventListener('click',e=>{
      const r=this.mmCanvas.getBoundingClientRect();
      const mx=(e.clientX-r.left)/this.mmScale*this.ts;
      const my=(e.clientY-r.top) /this.mmScale*this.ts;
      this.cam.x=mx-this.cv.width*.5;
      this.cam.y=my-this.cv.height*.5;
      this.clampCam();
    });

    document.getElementById('btn-restart')?.addEventListener('click',()=>location.reload());
    document.getElementById('btn-editor')?.addEventListener('click',()=>window.location.href='editor.html');
  }

  screenToWorld(sx,sy){ return new V2(sx+this.cam.x, sy+this.cam.y); }
  worldToScreen(wx,wy){ return new V2(wx-this.cam.x, wy-this.cam.y); }

  unitAt(wx, wy){
    for(let i=this.units.length-1;i>=0;i--){
      const u=this.units[i];
      if(u.dead) continue;
      if(u.pos.dist(new V2(wx,wy)) < this.ts*.5) return u;
    }
    return null;
  }

  onDown(e){
    const w = this.screenToWorld(e.clientX, e.clientY);
    if(e.button===1){ this._panStart={ox:e.clientX+this.cam.x,oy:e.clientY+this.cam.y}; return; }
    if(e.button===0){
      if(this.over) return;
      const hit = this.unitAt(w.x,w.y);
      if(hit && hit.team===0){
        // select unit, deselect building
        this.selectedBuilding=null; this._lastBldPanel=null;
        if(!e.shiftKey) this.selected.forEach(u=>u.selected=false), this.selected=[];
        if(!hit.selected){ hit.selected=true; this.selected.push(hit); }
      } else {
        // check player building click
        const hitBld = this.buildings.find(b=>{
          if(b.dead||b.team!==0) return false;
          return w.x>=b.px&&w.x<b.px+b.size*TS&&w.y>=b.py&&w.y<b.py+b.size*TS;
        });
        if(hitBld){
          this.selectedBuilding=hitBld;
          if(!e.shiftKey) this.selected.forEach(u=>u.selected=false), this.selected=[];
        } else {
          this.selectedBuilding=null; this._lastBldPanel=null;
          if(!e.shiftKey) this.selected.forEach(u=>u.selected=false), this.selected=[];
          this.dragBox = { sx:e.clientX, sy:e.clientY, ex:e.clientX, ey:e.clientY };
        }
      }
    }
  }

  onMove(e){
    this.mouse={x:e.clientX, y:e.clientY};
    if(this._panStart){
      this.cam.x = this._panStart.ox - e.clientX;
      this.cam.y = this._panStart.oy - e.clientY;
      this.clampCam(); return;
    }
    if(this.dragBox){ this.dragBox.ex=e.clientX; this.dragBox.ey=e.clientY; }
  }

  onUp(e){
    this._panStart=null;
    if(e.button===0 && this.dragBox){
      const db=this.dragBox;
      const sx=Math.min(db.sx,db.ex), ex=Math.max(db.sx,db.ex);
      const sy=Math.min(db.sy,db.ey), ey=Math.max(db.sy,db.ey);
      if(ex-sx>4 || ey-sy>4){
        // select all player units in box
        this.units.forEach(u=>{
          if(u.dead||u.team!==0) return;
          const sp=this.worldToScreen(u.pos.x,u.pos.y);
          if(sp.x>=sx&&sp.x<=ex&&sp.y>=sy&&sp.y<=ey){
            if(!u.selected){ u.selected=true; this.selected.push(u); }
          }
        });
      }
      this.dragBox=null;
    }
  }

  onRight(e){
    if(this.over) return;
    const w = this.screenToWorld(e.clientX, e.clientY);

    // building selected + no unit orders → set rally point
    if(this.selectedBuilding && !this.selectedBuilding.dead && this.selected.length===0){
      this.selectedBuilding.rallyPoint = new V2(w.x, w.y);
      this.spawnClickParticles(w.x, w.y, '#00ffaa');
      return;
    }

    const enemy = this.unitAt(w.x,w.y);
    const enemyBuilding = this.buildings.find(b=>{
      if(b.dead||b.team===0) return false;
      return w.x>=b.px&&w.x<b.px+b.size*TS&&w.y>=b.py&&w.y<b.py+b.size*TS;
    });

    if(this.selected.length===0) return;

    if(enemy && enemy.team===1){
      this.selected.forEach(u=>{
        u.targetUnit=enemy; u.targetPos=null; u.state='attacking';
      });
      this.spawnClickParticles(w.x,w.y,'#ff4422');
    } else if(enemyBuilding){
      // convert building to pseudo-target
      this.selected.forEach(u=>{
        u.targetUnit=null;
        u.targetPos=new V2(enemyBuilding.cx,enemyBuilding.cy);
        u._buildingTarget=enemyBuilding;
        u.state='attacking';
      });
      this.spawnClickParticles(w.x,w.y,'#ff4422');
    } else {
      // move order – formation
      const center = new V2(w.x,w.y);
      const n = this.selected.length;
      const cols = Math.ceil(Math.sqrt(n));
      this.selected.forEach((u,i)=>{
        const row=Math.floor(i/cols), col=i%cols;
        const off = new V2((col-(cols-1)*.5)*TS*1.1, row*TS*1.1);
        u.targetPos = center.add(off);
        u.targetUnit = null; u._buildingTarget = null;
        u.state = 'moving';
      });
      this.spawnClickParticles(w.x,w.y,'#00aaff');
    }
  }

  onWheel(e){
    e.preventDefault();
    this.cam.x += e.deltaX; this.cam.y += e.deltaY;
    this.clampCam();
  }

  // ── game loop ─────────────────────────────────────────────────────
  loop(t){
    const dt = Math.min((t-this.lastTime)/1000, 0.05);
    this.lastTime=t;
    this.tick++;
    if(!this.over){ this.update(dt); }
    this.render();
    requestAnimationFrame(ts=>this.loop(ts));
  }

  // ── update ────────────────────────────────────────────────────────
  update(dt){
    // camera pan via keyboard
    const spd=280;
    if(this.keys['KeyW']||this.keys['ArrowUp'])    this.cam.y-=spd*dt;
    if(this.keys['KeyS']||this.keys['ArrowDown'])  this.cam.y+=spd*dt;
    if(this.keys['KeyA']||this.keys['ArrowLeft'])  this.cam.x-=spd*dt;
    if(this.keys['KeyD']||this.keys['ArrowRight']) this.cam.x+=spd*dt;
    this.clampCam();

    // escape to deselect
    if(this.keys['Escape']){
      this.selected.forEach(u=>u.selected=false); this.selected=[];
      this.selectedBuilding=null; this._lastBldPanel=null;
      this.keys['Escape']=false;
    }

    this.updateUnits(dt);
    this.updateBuildings(dt);
    this.updateProduction(dt);
    this.updateProjectiles(dt);
    this.updateParticles(dt);
    this.updateEnemyAI(dt);
    this.checkWin();
    this.renderMinimap();
  }

  updateUnits(dt){
    const alive = u=>!u.dead;
    this.units.forEach(u=>{ if(!alive(u)) return; this.updateUnit(u,dt); });
    // remove dead units (keep for death animation)
    this.units.forEach(u=>{
      if(u.dead){ u.deathTimer-=dt; }
    });
    // remove fully expired
    this.units = this.units.filter(u=>!u.dead||u.deathTimer>0);
  }

  updateUnit(u, dt){
    u.cd   = Math.max(0, u.cd-dt);
    u.flashTimer = Math.max(0, u.flashTimer-dt);

    // separation force
    const sep = new V2();
    this.units.forEach(other=>{
      if(other===u||other.dead) return;
      const d=u.pos.dist(other.pos);
      const minD = TS*.6;
      if(d<minD&&d>0){
        const push=u.pos.sub(other.pos).norm().mul((minD-d)*.5);
        sep.x+=push.x; sep.y+=push.y;
      }
    });
    u.pos.x+=sep.x*dt*4; u.pos.y+=sep.y*dt*4;

    if(u.state==='moving'){
      if(!u.targetPos){ u.state='idle'; return; }
      const d=u.pos.dist(u.targetPos);
      if(d<4){ u.pos=u.targetPos; u.state='idle'; u.targetPos=null; return; }
      const dir=u.targetPos.sub(u.pos).norm();
      u.angle = dir.angle();
      u.pos.x += dir.x*u.spd*dt;
      u.pos.y += dir.y*u.spd*dt;
    }

    if(u.state==='attacking'){
      // resolve target
      const tgt = u.targetUnit;
      const bldTgt = u._buildingTarget;

      if(tgt && tgt.dead){ u.targetUnit=null; u._buildingTarget=null; u.state='idle'; return; }
      if(bldTgt && bldTgt.dead){ u._buildingTarget=null; u.targetPos=null; u.state='idle'; return; }

      let targetPos, targetAlive;
      if(tgt){
        targetPos = tgt.pos;
        targetAlive = !tgt.dead;
      } else if(bldTgt){
        targetPos = new V2(bldTgt.cx, bldTgt.cy);
        targetAlive = !bldTgt.dead;
      } else if(u.targetPos){
        targetPos = u.targetPos;
        targetAlive = true;
        // attack any nearby enemy
        const nearEnemy = this.units.find(e=>!e.dead&&e.team!==u.team&&u.pos.dist(e.pos)<u.range);
        if(nearEnemy){ u.targetUnit=nearEnemy; return; }
        const nearBld = this.buildings.find(b=>!b.dead&&b.team!==u.team&&u.pos.dist(new V2(b.cx,b.cy))<u.range);
        if(nearBld){ u._buildingTarget=nearBld; return; }
      } else { u.state='idle'; return; }

      const dist = u.pos.dist(targetPos);
      if(dist>u.range){
        const dir=targetPos.sub(u.pos).norm();
        u.angle=dir.angle();
        u.pos.x+=dir.x*u.spd*dt;
        u.pos.y+=dir.y*u.spd*dt;
      } else {
        // face target, fire
        u.angle = targetPos.sub(u.pos).angle();
        if(u.cd<=0){
          this.fireUnit(u, targetPos, tgt||bldTgt);
          u.cd=u.cdMax;
        }
      }
    }

    // clamp to world
    u.pos.x=Math.max(TS,Math.min(this.worldW-TS,u.pos.x));
    u.pos.y=Math.max(TS,Math.min(this.worldH-TS,u.pos.y));

    // idle units: auto-attack nearby enemies
    if(u.state==='idle'){
      const e=this.units.find(e=>!e.dead&&e.team!==u.team&&u.pos.dist(e.pos)<u.range*.8);
      if(e){ u.targetUnit=e; u.state='attacking'; }
    }
  }

  fireUnit(u, targetPos, targetObj){
    const kind=UNIT_PROJ[u.type]||'bullet';
    const p=new Projectile(u.pos.x,u.pos.y,targetPos.x,targetPos.y,u.dmg,u.team,kind);
    p._targetObj=targetObj;
    this.projectiles.push(p);
  }

  updateBuildings(dt){
    this.buildings.forEach(b=>{
      if(b.dead||!b.range) return;
      b.cd=Math.max(0,b.cd-dt);
      b.flashTimer=Math.max(0,(b.flashTimer||0)-dt);
      // turret: attack nearest enemy
      const enemies = b.team===0
        ? this.units.filter(u=>!u.dead&&u.team===1&&new V2(b.cx,b.cy).dist(u.pos)<b.range)
        : this.units.filter(u=>!u.dead&&u.team===0&&new V2(b.cx,b.cy).dist(u.pos)<b.range);
      if(enemies.length&&b.cd<=0){
        const tgt=enemies[0];
        const p=new Projectile(b.cx,b.cy,tgt.pos.x,tgt.pos.y,b.dmg,b.team,'bullet');
        p._targetObj=tgt;
        this.projectiles.push(p);
        b.cd=b.cdMax;
      }
    });
  }

  updateProduction(dt){
    this.buildings.forEach(b=>{
      if(b.dead||b.team!==0||!b.queue||b.queue.length===0) return;
      const job=b.queue[0];
      job.elapsed=Math.min(job.elapsed+dt, job.total);
      if(job.elapsed>=job.total){
        b.queue.shift();
        this.spawnProducedUnit(b, job.type);
      }
    });
  }

  queueUnit(bld, type){
    if(bld.dead||bld.team!==0) return;
    if(!(CAN_PRODUCE[bld.type]||[]).includes(type)) return;
    if(bld.queue.length>=5) return;
    bld.queue.push({type, elapsed:0, total:PROD_TIME[type]});
  }

  spawnProducedUnit(bld, type){
    const rally = bld.rallyPoint
      ? new V2(bld.rallyPoint.x, bld.rallyPoint.y)
      : new V2(bld.cx, bld.cy + bld.size*TS*.9);
    const u = new Unit(type, bld.cx, bld.cy, bld.team);
    u.targetPos = rally;
    u.state = 'moving';
    this.units.push(u);
    this.showMessage(type.toUpperCase()+' DEPLOYED', 'var(--ok)');
  }

  showMessage(text, color='var(--accent)'){
    const el=document.getElementById('msgs');
    if(!el) return;
    const m=document.createElement('div');
    m.className='msg'; m.style.color=color; m.textContent=text;
    el.appendChild(m);
    setTimeout(()=>m.remove(), 2800);
  }

  updateProjectiles(dt){
    this.projectiles.forEach(p=>{
      if(p.dead) return;
      p.x+=p.vx*dt; p.y+=p.vy*dt;

      // hit check
      if(p._targetObj && !p._targetObj.dead){
        const tx=p._targetObj.cx||p._targetObj.pos?.x;
        const ty=p._targetObj.cy||p._targetObj.pos?.y;
        if(Math.hypot(p.x-tx,p.y-ty)<p.hitRadius){
          this.applyDamage(p._targetObj, p.dmg, p);
          p.dead=true;
        }
      } else {
        // generic hit any enemy
        const w=new V2(p.x,p.y);
        const hitUnit=this.units.find(u=>!u.dead&&u.team!==p.team&&u.pos.dist(w)<p.hitRadius);
        if(hitUnit){ this.applyDamage(hitUnit,p.dmg,p); p.dead=true; return; }
        const hitBld=this.buildings.find(b=>!b.dead&&b.team!==p.team&&Math.hypot(p.x-b.cx,p.y-b.cy)<p.hitRadius*2);
        if(hitBld){ this.applyDamage(hitBld,p.dmg,p); p.dead=true; return; }
      }

      // out of world
      if(p.x<0||p.y<0||p.x>this.worldW||p.y>this.worldH) p.dead=true;
    });
    this.projectiles=this.projectiles.filter(p=>!p.dead);
  }

  applyDamage(obj, dmg, proj){
    obj.hp -= dmg;
    obj.flashTimer = 0.12;
    const x=obj.cx||obj.pos?.x||proj.x;
    const y=obj.cy||obj.pos?.y||proj.y;
    this.spawnHitParticles(x,y,proj.kind);
    if(obj.hp<=0){
      obj.dead=true;
      this.spawnExplosion(x,y);
      if(obj.selected){ obj.selected=false; this.selected=this.selected.filter(u=>u!==obj); }
      if(obj.deathTimer!==undefined) obj.deathTimer=0.4;
    }
  }

  spawnHitParticles(x,y,kind){
    const col=kind==='beam'?'#ff8888':kind==='missile'?'#88ffaa':'#ffdd88';
    for(let i=0;i<5;i++){
      const a=Math.random()*Math.PI*2, spd=30+Math.random()*80;
      this.particles.push(new Particle(x,y,Math.cos(a)*spd,Math.sin(a)*spd,col,.3,2+Math.random()*3));
    }
  }

  spawnExplosion(x,y){
    for(let i=0;i<18;i++){
      const a=Math.random()*Math.PI*2, spd=40+Math.random()*160;
      const cols=['#ff8800','#ffcc00','#ff4400','#ffffff'];
      this.particles.push(new Particle(x,y,Math.cos(a)*spd,Math.sin(a)*spd,cols[i%cols.length],.6+Math.random()*.5,3+Math.random()*6));
    }
  }

  spawnClickParticles(x,y,col){
    for(let i=0;i<6;i++){
      const a=Math.random()*Math.PI*2, spd=20+Math.random()*60;
      this.particles.push(new Particle(x,y,Math.cos(a)*spd,Math.sin(a)*spd,col,.4,2));
    }
  }

  updateParticles(dt){
    this.particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=80*dt;p.life-=dt;});
    this.particles=this.particles.filter(p=>p.life>0);
  }

  // ── enemy AI ──────────────────────────────────────────────────────
  updateEnemyAI(dt){
    const playerUnits  = this.units.filter(u=>!u.dead&&u.team===0);
    const playerBlds   = this.buildings.filter(b=>!b.dead&&b.team===0);
    const aiUnits      = this.units.filter(u=>!u.dead&&u.team===1&&u.state==='idle');

    // every 3 seconds, give idle enemy units orders
    if(this.tick % 180 === 0){
      aiUnits.forEach(u=>{
        // attack nearest player unit, else go for command center
        const near = playerUnits.sort((a,b)=>u.pos.dist(a.pos)-u.pos.dist(b.pos))[0];
        const cmd  = playerBlds.find(b=>b.type==='CommandCenter');
        if(near){ u.targetUnit=near; u.state='attacking'; }
        else if(cmd){ u._buildingTarget=cmd; u.targetPos=new V2(cmd.cx,cmd.cy); u.state='attacking'; }
      });
    }
  }

  checkWin(){
    const p0Cmd = this.buildings.find(b=>b.type==='CommandCenter'&&b.team===0&&!b.dead);
    const p1Cmd = this.buildings.find(b=>b.type==='CommandCenter'&&b.team===1&&!b.dead);
    if(!p0Cmd){ this.endGame(false); }
    else if(!p1Cmd){ this.endGame(true); }
  }

  endGame(won){
    if(this.over) return;
    this.over=true;
    this.winner=won?0:1;
    const el=document.getElementById('overlay');
    const h=document.getElementById('overlay-title');
    const msg=document.getElementById('overlay-msg');
    if(el){
      el.classList.add('show');
      h.textContent  = won ? 'VICTORY' : 'DEFEAT';
      h.style.color  = won ? 'var(--ok)' : 'var(--danger)';
      msg.textContent= won ? 'Enemy base destroyed.' : 'Your base has fallen.';
    }
  }

  // ── rendering ─────────────────────────────────────────────────────
  render(){
    const {ctx,cv,cam} = this;
    ctx.fillStyle='#020810'; ctx.fillRect(0,0,cv.width,cv.height);

    ctx.save();
    ctx.translate(-cam.x,-cam.y);

    this.renderTerrain();
    this.renderBuildings();
    this.renderSelectionCircles();
    this.renderUnits();
    this.renderProjectiles();
    this.renderParticles();
    this.renderHealthBars();
    this.renderRallyPoint();
    this.renderDragBox();

    ctx.restore();

    this.renderHUD();
  }

  renderTerrain(){
    const {ctx,map,ts,cam,cv} = this;
    const x0=Math.max(0,Math.floor(cam.x/ts));
    const y0=Math.max(0,Math.floor(cam.y/ts));
    const x1=Math.min(map.width, Math.ceil((cam.x+cv.width)/ts));
    const y1=Math.min(map.height,Math.ceil((cam.y+cv.height)/ts));
    for(let ty=y0;ty<y1;ty++) for(let tx=x0;tx<x1;tx++){
      drawTile(ctx, map.terrain[ty*map.width+tx], tx*ts, ty*ts, ts);
    }
  }

  renderBuildings(){
    this.buildings.forEach(b=>{
      if(b.dead) return;
      const flash = b.flashTimer>0 ? b.flashTimer/0.12 : 0;
      this.ctx.save();
      if(flash>0){
        this.ctx.globalAlpha=.7+.3*flash;
      }
      drawBuilding(this.ctx, b.type, b.team, b.px, b.py, this.ts);
      if(flash>0){
        this.ctx.globalAlpha=flash*.6;
        this.ctx.fillStyle='#fff';
        this.ctx.fillRect(b.px,b.py,b.size*this.ts,b.size*this.ts);
        this.ctx.globalAlpha=1;
      }
      this.ctx.restore();
    });
  }

  renderSelectionCircles(){
    const {ctx,ts} = this;
    this.units.forEach(u=>{
      if(u.dead||!u.selected) return;
      ctx.strokeStyle='rgba(0,220,255,.85)';
      ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.ellipse(u.pos.x, u.pos.y, ts*.42, ts*.22, 0, 0, Math.PI*2); ctx.stroke();
    });
  }

  renderUnits(){
    const {ctx,ts} = this;
    const sorted = [...this.units].sort((a,b)=>a.pos.y-b.pos.y);
    sorted.forEach(u=>{
      if(u.dead && u.deathTimer<=0) return;
      ctx.save();
      ctx.translate(u.pos.x, u.pos.y);
      const flash = u.flashTimer>0 ? u.flashTimer/0.12 : 0;
      if(u.dead) ctx.globalAlpha=u.deathTimer/0.4;
      drawUnitAt(ctx, u.type, u.team, u.angle, ts, flash*.7);
      ctx.restore();
    });
  }

  renderProjectiles(){
    this.projectiles.forEach(p=>drawProjectile(this.ctx, p));
  }

  renderParticles(){
    const {ctx} = this;
    this.particles.forEach(p=>{
      const a=p.life/p.maxLife;
      ctx.globalAlpha=a*.9;
      ctx.fillStyle=p.col;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha=1;
  }

  renderHealthBars(){
    const {ctx,ts} = this;
    const drawBar=(x,y,w,hp,maxHp,offset=0)=>{
      const bw=w, bh=4;
      const bx=x-bw*.5, by=y-ts*.55-bh-offset;
      ctx.fillStyle='#111';
      ctx.fillRect(bx,by,bw,bh);
      const pct=hp/maxHp;
      ctx.fillStyle=pct>.5?'#44ff88':pct>.25?'#ffaa00':'#ff4422';
      ctx.fillRect(bx,by,bw*pct,bh);
      ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=.5;
      ctx.strokeRect(bx,by,bw,bh);
    };
    this.units.forEach(u=>{
      if(u.dead) return;
      drawBar(u.pos.x,u.pos.y,ts*.8,u.hp,u.maxHp);
    });
    this.buildings.forEach(b=>{
      if(b.dead) return;
      drawBar(b.cx,b.cy,b.size*ts*.85,b.hp,b.maxHp,b.size*ts*.5-ts*.55);
    });
  }

  renderDragBox(){
    if(!this.dragBox) return;
    const {ctx,cam} = this;
    const {sx,sy,ex,ey}=this.dragBox;
    const x=Math.min(sx,ex)+cam.x, y=Math.min(sy,ey)+cam.y;
    const w=Math.abs(ex-sx), h=Math.abs(ey-sy);
    ctx.strokeStyle='rgba(0,200,255,.8)'; ctx.lineWidth=1;
    ctx.fillStyle='rgba(0,200,255,.08)';
    ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h);
  }

  renderHUD(){
    const bld = this.selectedBuilding && !this.selectedBuilding.dead ? this.selectedBuilding : null;
    const u   = this.selected[0] && !this.selected[0].dead ? this.selected[0] : null;
    const unitPanel = document.getElementById('unit-panel');
    const bldPanel  = document.getElementById('bld-panel');

    if(bld){
      if(unitPanel) unitPanel.style.display='none';
      if(bldPanel)  bldPanel.style.display='flex';
      this.updateBuildingPanel(bld);
    } else {
      if(unitPanel) unitPanel.style.display='flex';
      if(bldPanel)  bldPanel.style.display='none';
      if(u){
        const pc=document.getElementById('portrait');
        if(pc){ const pctx=pc.getContext('2d'); pctx.clearRect(0,0,pc.width,pc.height); drawPortrait(pctx,u.type,u.team,pc.width,pc.height); }
        const pct=u.hp/u.maxHp;
        const fill=document.getElementById('unit-hp-fill');
        if(fill){ fill.style.width=(pct*100)+'%'; fill.className='bar-fill hp-fill'+(pct<.25?' crit':pct<.5?' low':''); }
        const nm=document.getElementById('uname');
        if(nm) nm.textContent=u.type.toUpperCase()+' │ HP '+u.hp+'/'+u.maxHp;
      } else {
        const nm=document.getElementById('uname');
        if(nm) nm.textContent='SELECT A UNIT';
      }
    }
  }

  updateBuildingPanel(bld){
    // portrait
    const pc=document.getElementById('bld-portrait');
    if(pc){
      const pctx=pc.getContext('2d');
      pctx.fillStyle='#0a1520'; pctx.fillRect(0,0,pc.width,pc.height);
      drawBuilding(pctx, bld.type, bld.team, 0, 0, pc.width/(bld.size||1));
    }
    // name & HP
    const nm=document.getElementById('bld-name');
    if(nm) nm.textContent=bld.type.toUpperCase()+' │ HP '+Math.max(0,bld.hp)+'/'+bld.maxHp;
    const fill=document.getElementById('bld-hp-fill');
    if(fill){
      const pct=bld.hp/bld.maxHp;
      fill.style.width=(pct*100)+'%';
      fill.className='bar-fill hp-fill'+(pct<.25?' crit':pct<.5?' low':'');
    }
    // production buttons – only rebuild DOM when building changes
    if(this._lastBldPanel!==bld){
      this._lastBldPanel=bld;
      const btnsEl=document.getElementById('prod-btns');
      if(btnsEl){
        btnsEl.innerHTML='';
        const canProd=CAN_PRODUCE[bld.type]||[];
        if(canProd.length===0){
          btnsEl.innerHTML='<span style="font-size:.65rem;opacity:.45">No production</span>';
        }
        canProd.forEach(type=>{
          const btn=document.createElement('button');
          btn.className='prod-btn';
          const cv=document.createElement('canvas');
          cv.width=cv.height=30;
          const bctx=cv.getContext('2d');
          bctx.fillStyle='#0a1520'; bctx.fillRect(0,0,30,30);
          bctx.save(); bctx.translate(15,15);
          drawUnitAt(bctx,type,bld.team,0,28);
          bctx.restore();
          const lbl=document.createElement('div'); lbl.textContent=type; lbl.style.cssText='font-size:8px;color:var(--text)';
          const t=document.createElement('div'); t.textContent=PROD_TIME[type]+'s'; t.style.cssText='font-size:8px;color:var(--accent)';
          btn.append(cv,lbl,t);
          btn.onclick=()=>this.queueUnit(bld,type);
          btnsEl.appendChild(btn);
        });
      }
    }
    // queue list – rebuild every frame (shows live timer)
    const qEl=document.getElementById('prod-queue');
    if(qEl){
      qEl.innerHTML='';
      if(bld.queue.length===0){
        qEl.innerHTML='<span style="font-size:.65rem;opacity:.4">— idle —</span>';
      } else {
        bld.queue.forEach((job,i)=>{
          const row=document.createElement('div');
          row.className='queue-row';
          const pct=i===0?job.elapsed/job.total:0;
          const tLeft=i===0?(job.total-job.elapsed).toFixed(1)+'s':'–';
          row.innerHTML=`
            <span class="q-name">${job.type}</span>
            ${i===0
              ?`<div class="bar q-bar"><div class="bar-fill" style="width:${pct*100}%;background:var(--accent)"></div></div>
                <span class="q-time">${tLeft}</span>`
              :`<span class="q-time" style="opacity:.4">queued</span>`
            }
            <button class="cancel-btn" title="Cancel">×</button>`;
          row.querySelector('.cancel-btn').onclick=()=>{ bld.queue.splice(i,1); this._lastBldPanel=null; };
          qEl.appendChild(row);
        });
      }
    }
  }

  renderRallyPoint(){
    const bld=this.selectedBuilding;
    if(!bld||bld.dead||!bld.rallyPoint) return;
    const {ctx} = this;
    const rp=bld.rallyPoint;
    // dashed line from building centre to rally
    ctx.setLineDash([5,5]);
    ctx.strokeStyle='rgba(0,255,170,.35)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(bld.cx,bld.cy); ctx.lineTo(rp.x,rp.y); ctx.stroke();
    ctx.setLineDash([]);
    // crosshair marker
    ctx.strokeStyle='#00ffaa'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(rp.x-9,rp.y); ctx.lineTo(rp.x+9,rp.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rp.x,rp.y-9); ctx.lineTo(rp.x,rp.y+9); ctx.stroke();
    ctx.beginPath(); ctx.arc(rp.x,rp.y,5,0,Math.PI*2); ctx.stroke();
  }

  renderMinimap(){
    const {mmCtx,map,ts,mmScale:ms} = this;
    const mw=map.width, mh=map.height;
    // terrain
    for(let ty=0;ty<mh;ty+=2) for(let tx=0;tx<mw;tx+=2){
      const id=map.terrain[ty*mw+tx];
      const col=['#030608','#2b571a','#7a4e2b','#c8a96e','#0e2a5a','#4a4a4a','#0c1724','#7a1500','#cce0f0','#19301a'][id]||'#222';
      mmCtx.fillStyle=col; mmCtx.fillRect(tx*ms,ty*ms,ms*2,ms*2);
    }
    // buildings
    this.buildings.forEach(b=>{
      if(b.dead) return;
      mmCtx.fillStyle=TEAM_COL[b.team].pri;
      mmCtx.fillRect(b.tx*ms,b.ty*ms,b.size*ms,b.size*ms);
    });
    // units
    this.units.forEach(u=>{
      if(u.dead) return;
      mmCtx.fillStyle=TEAM_COL[u.team].pri;
      const ux=u.pos.x/ts*ms, uy=u.pos.y/ts*ms;
      mmCtx.fillRect(ux-1,uy-1,3,3);
    });
    // viewport
    const vx=this.cam.x/ts*ms, vy=this.cam.y/ts*ms;
    const vw=this.cv.width/ts*ms, vh=this.cv.height/ts*ms;
    mmCtx.strokeStyle='rgba(200,220,255,.5)'; mmCtx.lineWidth=1;
    mmCtx.strokeRect(vx,vy,vw,vh);
  }
}

// ─── default procedural map ───────────────────────────────────────────
function generateDefaultMap(){
  const W=40,H=32;
  const terrain=new Array(W*H).fill(1);
  // border mountain
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(x<1||y<1||x>=W-1||y>=H-1) terrain[y*W+x]=5;
  }
  // tech floor corridors
  for(let x=5;x<W-5;x++){ terrain[Math.floor(H/2)*W+x]=6; terrain[(Math.floor(H/2)+1)*W+x]=6; }
  // water patch center-ish
  for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) terrain[(Math.floor(H*.45)+dy)*W+(Math.floor(W*.55)+dx)]=4;
  // sand patches
  for(let dy=-1;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) terrain[(8+dy)*W+(W-10+dx)]=3;
  // forests
  [[4,12],[4,H-8],[W-6,8],[W-6,H-8]].forEach(([fx,fy])=>{
    for(let dy=0;dy<3;dy++) for(let dx=0;dx<3;dx++) terrain[(fy+dy)*W+(fx+dx)]=9;
  });
  const objects=[
    {type:'CommandCenter',tx:2,ty:2,team:0,size:3},
    {type:'Turret',tx:6,ty:2,team:0,size:2},
    {type:'Turret',tx:2,ty:6,team:0,size:2},
    {type:'Factory',tx:2,ty:10,team:0,size:2},
    {type:'CommandCenter',tx:W-5,ty:H-5,team:1,size:3},
    {type:'Turret',tx:W-8,ty:H-5,team:1,size:2},
    {type:'Turret',tx:W-5,ty:H-8,team:1,size:2},
    {type:'Factory',tx:W-5,ty:H-12,team:1,size:2},
    {type:'Crystal',tx:W>>1,ty:4,team:-1,size:1},
    {type:'Crystal',tx:W>>1,ty:H-4,team:-1,size:1},
    {type:'Rock',tx:10,ty:15,team:-1,size:1},
    {type:'Rock',tx:W-12,ty:15,team:-1,size:1},
    {type:'Debris',tx:18,ty:8,team:-1,size:1},
  ];
  return {version:1,name:'Default Map',width:W,height:H,terrain,objects};
}

// ─── boot ──────────────────────────────────────────────────────────────
window.addEventListener('load',()=>{
  const canvas = document.getElementById('gc');
  let mapData;
  try{
    const stored = localStorage.getItem('rts_map');
    mapData = stored ? JSON.parse(stored) : generateDefaultMap();
  } catch(e){ mapData = generateDefaultMap(); }
  window.game = new Game(canvas, mapData);
});
