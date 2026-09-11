(() => {
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const timerEl = document.querySelector('#timer'), fill = document.querySelector('#timerFill');
  const roomEl = document.querySelector('#roomNumber'), startScreen = document.querySelector('#startScreen');
  const endScreen = document.querySelector('#endScreen'), startButton = document.querySelector('#startButton');
  const p = { wood:'#523727', green:'#50841a', sun:'#fdde28', paper:'#efeff1', wall:'#6c503d', floor:'#3c2d22', line:'#1e1712' };
  const keys = new Set(), sides = ['top','right','bottom','left'];
  let running = false, startTime = 0, last = 0, elapsed = 0, room = 0, runRooms = [], player;
  // Distinct room archetypes: each creates a different kind of navigation problem.
  const presets = [
    // A broken spiral: choose the right opening at each turn.
    [[150,85,535,58,'shelf'],[150,85,58,330,'shelf'],[335,180,520,58,'sofa'],[795,180,60,285,'shelf'],[335,405,350,58,'shelf'],[335,405,58,150,'sofa'],[500,500,300,58,'table'],[590,275,105,105,'web'],[235,475,100,100,'web']],
    // Offset sitting areas leave several deceptive, short-looking routes.
    [[145,105,210,70,'sofa'],[460,80,80,185,'shelf'],[655,105,250,70,'sofa'],[225,270,225,62,'table'],[585,320,75,200,'shelf'],[775,385,200,66,'sofa'],[315,485,185,65,'sofa'],[125,475,105,105,'web'],[820,230,102,102,'web'],[470,385,95,95,'web']],
    // An asymmetric apartment block with a central crossroad and dead-end pockets.
    [[110,110,78,250,'shelf'],[250,100,255,63,'sofa'],[535,190,205,64,'table'],[830,105,75,250,'shelf'],[275,285,75,210,'shelf'],[430,365,240,64,'sofa'],[705,455,230,62,'table'],[105,490,180,63,'sofa'],[415,205,100,100,'web'],[760,300,105,105,'web']],
    // A stepped diagonal of obstacles forces turns in different directions.
    [[145,100,205,62,'table'],[300,175,75,180,'shelf'],[405,250,215,62,'sofa'],[580,325,75,175,'shelf'],[685,415,235,62,'sofa'],[760,105,185,62,'table'],[125,420,190,62,'sofa'],[465,500,155,60,'table'],[190,235,102,102,'web'],[700,245,105,105,'web']],
    // Split chambers connected by uneven gaps rather than a single corridor.
    [[185,85,75,195,'shelf'],[350,105,250,64,'sofa'],[695,85,75,210,'shelf'],[865,130,165,62,'table'],[130,340,240,64,'sofa'],[455,285,75,255,'shelf'],[590,420,230,64,'sofa'],[860,365,75,180,'shelf'],[295,475,105,105,'web'],[735,290,102,102,'web'],[120,210,92,92,'web']]
  ];
  const shuffle = a => [...a].sort(() => Math.random() - .5);
  function varyLayout(layout){
    const flipX=Math.random()<.5, flipY=Math.random()<.5;
    return layout.map(([x,y,w,h,type])=>[flipX?W-x-w:x,flipY?H-y-h:y,w,h,type]);
  }
  const sidePoint = side => {
    const center = side === 'top' || side === 'bottom' ? 550 : 340;
    if(side === 'top') return { x:center-55, y:0, w:110, h:42, cx:center, cy:54 };
    if(side === 'bottom') return { x:center-55, y:H-42, w:110, h:42, cx:center, cy:H-54 };
    if(side === 'left') return { x:0, y:center-55, w:38, h:110, cx:50, cy:center };
    return { x:W-26, y:center-55, w:26, h:110, cx:W-38, cy:center };
  };
  function spawnFor(roomData){
    const d=sidePoint(roomData.entry), offsets=[0,-90,90,-180,180,-270,270];
    for(const offset of offsets){
      let x=d.cx, y=d.cy;
      if(roomData.entry==='top'){ x+=offset; y=112; }
      if(roomData.entry==='bottom'){ x+=offset; y=H-112; }
      if(roomData.entry==='left'){ x=112; y+=offset; }
      if(roomData.entry==='right'){ x=W-112; y+=offset; }
      const clear=roomData.layout.every(([ox,oy,ow,oh,type]) => type==='web'||x+16<=ox||x-16>=ox+ow||y+16<=oy||y-16>=oy+oh);
      if(clear) return {x,y};
    }
    return {x:d.cx,y:d.cy};
  }
  function pathLength(layout, entry, exit){
    const start=spawnFor({layout,entry}), target=sidePoint(exit), step=24;
    const cols=43, rows=23, index=(x,y)=>y*cols+x;
    const blocked=(x,y)=>layout.some(([ox,oy,ow,oh,type])=>type!=='web'&&x+16>ox&&x-16<ox+ow&&y+16>oy&&y-16<oy+oh);
    const sx=Math.round((start.x-54)/step), sy=Math.round((start.y-58)/step);
    const queue=[[sx,sy,0]], visited=new Set([index(sx,sy)]);
    while(queue.length){
      const [cx,cy,dist]=queue.shift(), x=54+cx*step, y=58+cy*step;
      if(Math.hypot(x-target.cx,y-target.cy)<46) return dist;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=cx+dx, ny=cy+dy, px=54+nx*step, py=58+ny*step, id=index(nx,ny);
        if(nx>=0&&nx<cols&&ny>=0&&ny<rows&&!visited.has(id)&&!blocked(px,py)){visited.add(id);queue.push([nx,ny,dist+1]);}
      }
    }
    return -1;
  }
  function chooseDoorPair(layout){
    const candidates=[];
    for(const entry of sides) for(const exit of sides) if(entry!==exit){ const score=pathLength(layout,entry,exit); if(score>0)candidates.push({entry,exit,score}); }
    const best=candidates.filter(c=>c.score>=Math.max(...candidates.map(x=>x.score))-10);
    return best[Math.floor(Math.random()*best.length)];
  }
  function reset(){
    runRooms = shuffle(presets).slice(0,4).map(base => { const layout=varyLayout(base); return {layout, ...chooseDoorPair(layout)}; });
    const final = chooseDoorPair([]); runRooms.push({layout:[], ...final}); room=0;
    const spawn=spawnFor(runRooms[0]); player={...spawn,r:16,angle:0}; elapsed=0; roomEl.textContent='1 / 5';
  }
  function begin(){ reset(); running=true; startTime=performance.now(); last=startTime; startScreen.classList.add('hidden'); endScreen.classList.add('hidden'); requestAnimationFrame(loop); }
  const activeRoom = () => runRooms[room];
  const obstacles = () => activeRoom().layout.map(([x,y,w,h,type])=>({x,y,w,h,type}));
  const intersects = (x,y,o) => x+player.r>o.x&&x-player.r<o.x+o.w&&y+player.r>o.y&&y-player.r<o.y+o.h;
  function inDoorway(x,y,side){ const d=sidePoint(side); return x>d.x-player.r&&x<d.x+d.w+player.r&&y>d.y-player.r&&y<d.y+d.h+player.r; }
  function collision(x,y){
    const r=activeRoom();
    if(x-player.r<38&&!inDoorway(x,y,r.exit)) return true;
    if(x+player.r>W-25&&!inDoorway(x,y,r.exit)) return true;
    if(y-player.r<42&&!inDoorway(x,y,r.exit)) return true;
    if(y+player.r>H-42&&!inDoorway(x,y,r.exit)) return true;
    return obstacles().some(o => o.type !== 'web' && intersects(x,y,o));
  }
  function webSlowdown(){ return obstacles().some(o=>o.type==='web'&&intersects(player.x,player.y,o)) ? .36 : 1; }
  function atExit(){ const d=sidePoint(activeRoom().exit); return Math.hypot(player.x-d.cx,player.y-d.cy)<42; }
  function enterNext(){ room++; const spawn=spawnFor(activeRoom()); player.x=spawn.x;player.y=spawn.y; roomEl.textContent=`${room+1} / 5`; }
  function update(dt){
    elapsed=(performance.now()-startTime)/1000; const remaining=Math.max(0,60-elapsed);
    fill.style.width=(remaining/60*100)+'%'; timerEl.textContent=`${Math.floor(remaining/60)}:${String(Math.ceil(remaining)%60).padStart(2,'0')}`;
    if(!remaining){ finish(false); return; }
    let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0), dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
    if(dx||dy){const l=Math.hypot(dx,dy);dx/=l;dy/=l;player.angle=Math.atan2(dy,dx);const speed=225*webSlowdown()*dt;if(!collision(player.x+dx*speed,player.y))player.x+=dx*speed;if(!collision(player.x,player.y+dy*speed))player.y+=dy*speed;}
    if(atExit()) room===4 ? finish(true) : enterNext();
  }
  function floor(){
    ctx.fillStyle=p.floor;ctx.fillRect(0,0,W,H);ctx.strokeStyle='#4d392b';ctx.lineWidth=2;
    for(let x=38;x<W;x+=92){ctx.beginPath();ctx.moveTo(x,43);ctx.lineTo(x,H-43);ctx.stroke()}for(let y=44;y<H;y+=82){ctx.beginPath();ctx.moveTo(38,y);ctx.lineTo(W,y);ctx.stroke()}
    ctx.fillStyle=p.wall;ctx.fillRect(0,0,W,42);ctx.fillRect(0,H-42,W,42);ctx.fillRect(0,0,38,H);ctx.fillStyle='#201812';ctx.fillRect(W-25,0,25,H);
  }
  function drawDoor(side, isExit, final){
    const d=sidePoint(side);ctx.save();ctx.fillStyle=final&&isExit?'#f4e7a2':'#1d1510';ctx.fillRect(d.x,d.y,d.w,d.h);
    if(final&&isExit){ctx.globalAlpha=.25;ctx.fillStyle=p.sun;ctx.beginPath();ctx.moveTo(d.cx,d.cy);if(side==='top'){ctx.lineTo(270,300);ctx.lineTo(830,300);}if(side==='bottom'){ctx.lineTo(270,380);ctx.lineTo(830,380);}if(side==='left'){ctx.lineTo(390,100);ctx.lineTo(390,580);}if(side==='right'){ctx.lineTo(710,100);ctx.lineTo(710,580);}ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle=p.sun;ctx.lineWidth=5;ctx.strokeRect(d.x+3,d.y+3,d.w-6,d.h-6);ctx.strokeStyle='#b79a3d';ctx.lineWidth=2;ctx.beginPath();if(side==='top'||side==='bottom'){ctx.moveTo(d.cx,d.y+3);ctx.lineTo(d.cx,d.y+d.h-3);ctx.moveTo(d.x+3,d.cy);ctx.lineTo(d.x+d.w-3,d.cy);}else{ctx.moveTo(d.x+3,d.cy);ctx.lineTo(d.x+d.w-3,d.cy);ctx.moveTo(d.cx,d.y+3);ctx.lineTo(d.cx,d.y+d.h-3);}ctx.stroke();}else{ctx.strokeStyle=isExit?'#c69e46':'#72513b';ctx.lineWidth=3;ctx.strokeRect(d.x+3,d.y+3,d.w-6,d.h-6);if(isExit){ctx.fillStyle='#d9b94c';ctx.font='10px DM Mono';ctx.fillText('EXIT',d.x+(d.w-25)/2,d.y+d.h/2+3);}}ctx.restore();
  }
  function obstacle(o){ctx.save();ctx.translate(o.x,o.y);ctx.fillStyle=p.line;ctx.fillRect(4,5,o.w,o.h);if(o.type==='web'){ctx.fillStyle='#6e675d';ctx.beginPath();ctx.arc(o.w/2,o.h/2,Math.min(o.w,o.h)/2,0,7);ctx.fill();ctx.strokeStyle='#c5bdb0';ctx.lineWidth=2;for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(o.w/2,o.h/2);ctx.lineTo(o.w/2+Math.cos(i*Math.PI/4)*o.w*.43,o.h/2+Math.sin(i*Math.PI/4)*o.h*.43);ctx.stroke()}ctx.beginPath();ctx.arc(o.w/2,o.h/2,o.w*.25,0,7);ctx.stroke();}else if(o.type==='sofa'){ctx.fillStyle='#3f5930';ctx.fillRect(0,9,o.w,o.h-9);ctx.fillStyle='#597443';ctx.fillRect(7,16,o.w-14,o.h-24);ctx.fillStyle='#26331d';ctx.fillRect(13,o.h-11,o.w-26,7)}else if(o.type==='shelf'){ctx.fillStyle='#392419';ctx.fillRect(0,0,o.w,o.h);for(let y=14;y<o.h;y+=35){ctx.fillStyle='#754b2d';ctx.fillRect(6,y,o.w-12,8);ctx.fillStyle=y%70?'#997148':'#6f8350';ctx.fillRect(12,y-12,o.w-25,11)}}else{ctx.fillStyle='#6e4228';ctx.fillRect(0,0,o.w,o.h);ctx.fillStyle='#9a6b3e';ctx.fillRect(8,7,o.w-16,o.h-14);ctx.fillStyle='#694127';ctx.fillRect(0,o.h-9,o.w,9);for(const x of [10,o.w-18]){ctx.fillStyle='#251a13';ctx.fillRect(x,o.h-3,8,10)}}ctx.restore()}
  function sunflower(){ctx.save();ctx.translate(player.x,player.y);ctx.rotate(player.angle);ctx.fillStyle='rgba(0,0,0,.32)';ctx.beginPath();ctx.ellipse(-2,18,14,6,0,0,7);ctx.fill();ctx.strokeStyle=p.green;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,10);ctx.lineTo(-2,30);ctx.stroke();ctx.fillStyle=p.green;ctx.beginPath();ctx.ellipse(-10,19,10,4,-.6,0,7);ctx.fill();for(let i=0;i<12;i++){ctx.fillStyle=p.sun;ctx.beginPath();ctx.ellipse(Math.cos(i*Math.PI/6)*12,Math.sin(i*Math.PI/6)*12,6,10,i*Math.PI/6,0,7);ctx.fill()}ctx.fillStyle='#5b3a20';ctx.beginPath();ctx.arc(0,0,9,0,7);ctx.fill();ctx.restore()}
  function draw(){floor();const r=activeRoom(),final=room===4;for(const o of obstacles())obstacle(o);drawDoor(r.entry,false,false);drawDoor(r.exit,true,final);sunflower();ctx.fillStyle='rgba(239,239,241,.8)';ctx.font='11px DM Mono';ctx.fillText(final?'THE LAST WINDOW':'COBWEBS SLOW YOU DOWN',55,73)}
  function finish(win){if(!running)return;running=false;const time=Math.min(elapsed,60).toFixed(1);endScreen.innerHTML=`<div class="card end-card"><span class="eyebrow">${win?'SUNLIGHT FOUND':'THE LIGHT FADED'}</span><h2>${win?'It blooms.':'It wilts.'}</h2><p>${win?`You carried it home in ${time} seconds. The window is warm, and the petals finally open.`:'The sunflower needed the window before the minute was gone. Try another route through the house.'}</p><button id="retry">${win?'Run again':'Try again'} <b>↻</b></button></div>`;endScreen.classList.remove('hidden');document.querySelector('#retry').onclick=begin}
  function loop(t){if(!running)return;const dt=Math.min(.04,(t-last)/1000);last=t;update(dt);draw();requestAnimationFrame(loop)}
  addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){keys.add(k);e.preventDefault()}});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));startButton.onclick=begin; reset(); draw();
})();
