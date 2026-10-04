(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./core'));else root.CatRaceRenderer=factory(root.CatRaceCore);})(typeof globalThis!=='undefined'?globalThis:this,function(Core){
  'use strict';
  const W=390,H=844,C={ink:'#543568',pink:'#f28bb4',violet:'#baa3ef',sky:'#96e1f4',white:'#fffafa'};
  // Source rectangles measured on the generated atlas; the generator used unequal row heights.
  const RECTS=[[0,0,418,476],[418,0,418,476],[836,0,418,476],[0,476,418,468],[418,476,418,468],[836,476,418,468],[0,944,418,310],[418,944,418,310],[836,944,418,310]];
  class Renderer {
    constructor(canvas,images){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.images=images;this.buttons=[];this.scale=1;this.offsetX=0;this.offsetY=0;this.safeBottom=0;}
    resize(width,height,dpr=1,safeBottom=0,safeTop=0,safeLeft=0,safeRight=0){this.width=width;this.height=height;this.dpr=Math.min(2,dpr);this.canvas.width=Math.round(width*this.dpr);this.canvas.height=Math.round(height*this.dpr);this.scale=Math.min(width/W,(height-safeBottom-safeTop)/H);this.offsetX=(width-W*this.scale)/2;this.offsetY=safeTop+(height-safeBottom-safeTop-H*this.scale)/2;this.safeBottom=safeBottom;this.safeTop=safeTop;this.safeLeft=safeLeft;this.safeRight=safeRight;this.hudExtra=Math.min(44,Math.max(0,(width/this.scale-W)/2));}
    point(x,y){return {x:(x-this.offsetX)/this.scale,y:(y-this.offsetY)/this.scale};}
    hit(x,y){const p=this.point(x,y);return [...this.buttons].reverse().find(b=>p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h);}
    round(x,y,w,h,r=16,fill=C.white,stroke=null){const c=this.ctx;c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}}
    text(s,x,y,size=18,color=C.ink,weight=600,align='left'){const c=this.ctx;c.fillStyle=color;c.font=weight+' '+size+'px system-ui, "Microsoft YaHei", sans-serif';c.textAlign=align;c.textBaseline='middle';c.fillText(s,x,y);}
    sprite(index,x,y,w,h){if(index>=6)this.ctx.drawImage(this.images.atlas,(index-6)*418,944,418,310,x-w/2,y-h,w,h);else if(index>=3)this.ctx.drawImage(this.images.portrait,(index-3)*256,0,256,256,x-w/2,y-h,w,h);}
    catSprite(cat,x,y,w,h,race){const jumping=cat.jump>0;const frame=jumping?Math.min(3,Math.floor((1-cat.jump/Core.JUMP_TIME)*4)):race.mode==='racing'&&cat.finishTime===null?Math.floor(race.time*12)%8:0;const sheet=jumping?this.images.jump:this.images.run;const c=this.ctx,drift=Math.sin(Math.PI*cat.driftTime/.55),squash=cat.landing*.13;c.save();c.translate(x,y);c.rotate(cat.steer*drift*.16);c.scale(1+squash,1-squash);c.drawImage(sheet,frame*256,cat.skin*256,256,256,-w/2,-h,w,h);c.restore();if(cat.driftTime>0){c.strokeStyle='rgba(255,250,250,.7)';c.lineWidth=3;c.beginPath();c.moveTo(x-cat.steer*40,y-12);c.lineTo(x-cat.steer*65,y+8);c.stroke();}}
    shadow(x,y,w,alpha=.17){const c=this.ctx;c.save();c.fillStyle='rgba(78,52,118,'+alpha+')';c.beginPath();c.ellipse(x,y,w/2,w/7,0,0,Math.PI*2);c.fill();c.restore();}
    button(id,label,x,y,w,h,kind='pink',disabled=false){const c=this.ctx,g=c.createLinearGradient(0,y,0,y+h),radius=h>=80?27:18;g.addColorStop(0,disabled?'#dfc3dc':kind==='pink'?'#ffb2d0':kind==='violet'?'#d4c4ff':'#ffffff');g.addColorStop(1,disabled?'#c6abc6':kind==='pink'?'#ed77a8':kind==='violet'?'#ad91eb':'#fff7fb');this.round(x,y+5,w,h,radius,kind==='pink'?'#bf5c91':kind==='violet'?'#8260bd':'#ad91c7');this.round(x,y,w,h,radius,g,kind==='white'?'#d8c4e6':'#ffe6f7');this.text(label,x+w/2,y+h/2,w<70&&h<40?12.5:17,kind==='pink'?C.white:C.ink,800,'center');const labels={left:'向左换道（A 或左箭头）',right:'向右换道（D 或右箭头）',jump:'跳跃（空格）',boost:'按住加速（W 或上箭头），每秒消耗50体力',pause:'暂停比赛',audioSettings:'声音设置'};const point=this.screenSpace?this.point(x,y):{x,y};this.buttons.push({id,x:point.x,y:point.y,w:this.screenSpace?w/this.scale:w,h:this.screenSpace?h/this.scale:h,disabled,ariaLabel:labels[id]||label});}
    icon(kind,x,y,size=1,color=C.ink){const c=this.ctx;c.save();c.translate(x,y);c.scale(size,size);c.fillStyle=color;c.strokeStyle=color;c.lineWidth=3;c.lineJoin='round';if(kind==='pause'){this.round(-10,-12,7,24,3,color);this.round(3,-12,7,24,3,color);}else{if(kind==='right')c.scale(-1,1);if(kind==='jump')c.rotate(Math.PI/2);const points=kind==='boost'?[[-1,-19],[-13,1],[-3,1],[-8,19],[13,-6],[3,-6],[8,-19]]:[[-17,0],[-1,-15],[-1,-7],[14,-7],[14,7],[-1,7],[-1,15]];c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();c.fill();c.stroke();}c.restore();}
    controlButton(id,label,x,y,w,h,kind,disabled=false){this.button(id,'',x,y,w,h,kind,disabled);this.icon(id,x+w/2,y+32,id==='boost'?1.1:1.05,kind==='pink'?'#fffaf6':C.ink);this.text(label,x+w/2,y+69,20,kind==='pink'?'#fffaf6':C.ink,900,'center');}
    title(x){const c=this.ctx;c.save();c.font='900 49px "Microsoft YaHei", system-ui, sans-serif';c.textAlign='left';c.textBaseline='middle';c.lineJoin='round';for(let i=0;i<4;i++){c.save();c.translate(x+i*49,45);c.rotate([-.065,.02,-.045,.035][i]);c.lineWidth=11;c.strokeStyle='#39254e';c.strokeText('猫猫冲冲'[i],0,3);c.lineWidth=8;c.strokeStyle='#5d3a75';c.strokeText('猫猫冲冲'[i],0,0);c.fillStyle=i===2?'#ff9ec5':'#fff9ef';c.fillText('猫猫冲冲'[i],0,0);c.restore();}c.restore();}
    flag(x,y){const c=this.ctx;c.save();c.translate(x,y);c.rotate(.14);c.strokeStyle=C.ink;c.lineWidth=3;c.lineCap='round';c.beginPath();c.moveTo(0,13);c.lineTo(0,-13);c.stroke();for(let row=0;row<3;row++)for(let col=0;col<4;col++){c.fillStyle=(row+col)%2?'#fff8fa':C.ink;c.fillRect(1+col*4.5,-13+row*5,4.5,5);}c.restore();}
    audioControl(){this.screenLayer(()=>this.button('audioSettings','声',this.width-(this.safeRight||0)-108,(this.safeTop||0)+12,44,44,'white'));}
    shade(alpha){const c=this.ctx;c.fillStyle='rgba(67,43,88,'+alpha+')';c.fillRect(-this.offsetX/this.scale,-this.offsetY/this.scale,this.width/this.scale,this.height/this.scale);}
    project(z,lane=1){const q=1/(1+Math.max(0,z)/29);return {x:W/2+(lane-1)*115*q+(this.cameraX||0)*q,y:252+425*q,scale:q};}
    polygon(points,fill){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=fill;c.fill();}
    scene(race){const c=this.ctx;
      if(this.images.background){const im=this.images.background;c.drawImage(im,0,0,im.width,im.height,0,0,W,H);}
      else{c.fillStyle=C.sky;c.fillRect(0,0,W,H);}
      const p=race.player;this.cameraX=-(p.x-1)*10;
      // Dynamic track and lane marks are code geometry, an intentional adaptation for this mechanism prototype.
      this.polygon([{x:153,y:252},{x:237,y:252},{x:560,y:844},{x:-170,y:844}],'#ad96d2');
      this.polygon([{x:159,y:252},{x:231,y:252},{x:520,y:844},{x:-130,y:844}],'#c1ace7');
      for(let i=0;i<4;i++) {const a=this.project(0,i-.5),b=this.project(Core.LENGTH,i-.5);c.strokeStyle='#ded0f5';c.lineWidth=3;c.beginPath();c.moveTo(a.x,a.y+110);c.lineTo(b.x,b.y);c.stroke();}
      const scroll=p.z%8;
      for(let z=8-scroll;z<125;z+=8){const a=this.project(z,-.4),b=this.project(z,2.4);c.strokeStyle='rgba(126,100,170,.12)';c.lineWidth=2;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}
      const finishDistance=Core.LENGTH-p.z;
      if(finishDistance<120){const q=this.project(finishDistance,1),wide=310*q.scale;c.strokeStyle='#f29ab8';c.lineWidth=17*q.scale;c.beginPath();c.moveTo(q.x-wide/2,q.y);c.lineTo(q.x-wide/2,q.y-170*q.scale);c.quadraticCurveTo(q.x,q.y-270*q.scale,q.x+wide/2,q.y-170*q.scale);c.lineTo(q.x+wide/2,q.y);c.stroke();this.text('终点',q.x,q.y-178*q.scale,Math.max(10,28*q.scale),C.ink,800,'center');}
      const entities=[];
      for(const obj of race.track){const z=obj.z-p.z;if(z<-4||z>125||race.isCollected(obj))continue;entities.push({z,obj});}
      race.cats.slice(1).forEach(cat=>{const z=cat.z-p.z;if(z>-5&&z<125)entities.push({z,cat});});
      entities.sort((a,b)=>b.z-a.z);
      entities.forEach(e=>{const q=this.project(e.z,e.obj?e.obj.lane:e.cat.x);const size=q.scale;
        if(e.obj){const obj=e.obj;const index=obj.type==='food'?6:obj.type==='can'?7:8;const wide=(obj.type==='hurdle'?102:obj.type==='can'?51:38)*size;const high=(obj.type==='hurdle'?73:obj.type==='can'?44:38)*size;const lift=obj.height*38*size + (obj.type==='hurdle'?0:Math.sin(race.time*3+obj.id)*3*size);this.shadow(q.x,q.y,wide*.85);this.sprite(index,q.x,q.y-lift,wide,high);}
        else{this.shadow(q.x,q.y,100*size);this.catSprite(e.cat,q.x,q.y-race.jumpHeight(e.cat)*48*size,140*size,158*size,race);if(e.z>6)this.text(Core.CATS[e.cat.skin].name,q.x,q.y-142*size,Math.max(9,13*size),C.ink,650,'center');}
      });
      const q=this.project(0,p.x),jump=race.jumpHeight(p)*48,bob=p.finishTime===null&&race.mode==='racing'?Math.sin(race.time*20)*3:0;
      if(p.boosting){c.strokeStyle='#fff1a5';c.lineWidth=4;for(let i=0;i<5;i++){c.beginPath();c.moveTo(q.x-48+i*24,q.y+10);c.lineTo(q.x-58+i*29,q.y+60);c.stroke();}}
      this.shadow(q.x,q.y-8,120);c.save();if(p.slow>0&&Math.floor(race.time*12)%2)c.globalAlpha=.55;this.catSprite(p,q.x,q.y-jump+bob+12,175,190,race);c.restore();
    }
    screenLayer(fn){const c=this.ctx;c.save();c.setTransform(this.dpr,0,0,this.dpr,0,0);this.screenSpace=true;fn();this.screenSpace=false;c.restore();}
    hud(race){this.screenLayer(()=>{
      const p=race.player,c=this.ctx,left=(this.safeLeft||0)+12,right=this.width-(this.safeRight||0)-12,top=(this.safeTop||0)+12,bottom=this.height-(this.safeBottom||0)-12,landscape=this.width>this.height;
      const compact=this.width<360,button=compact?54:58,boost=compact?60:64,gap=8,y=bottom-boost;
      // Two thumb zones keep the centre clear and retain CSS-sized hit targets.
      const held=new Set(race.controlHeld||[]);
      const control=(id,x,cy,w,h,kind)=>{this.button(id,'',x,cy,w,h,kind);if(held.has(id))this.round(x+3,cy+3,w-6,h-6,17,'rgba(255,255,255,.23)','#fffaf6');this.icon(id,x+w/2,cy+h/2-(id==='jump'||id==='boost'?5:0),id==='boost'?.85:.78,kind==='pink'?'#fffaf6':C.ink);if(id==='jump'||id==='boost')this.text(id==='jump'?'跳':'按住',x+w/2,cy+h-11,11,kind==='pink'?'#fffaf6':C.ink,800,'center');};
      this.round(left-4,y-6,button*2+gap+8,boost+13,23,'rgba(255,250,255,.28)');
      control('left',left,y+boost-button,button,button,'violet');control('right',left+button+gap,y+boost-button,button,button,'violet');
      control('jump',right-boost-gap-button,y+boost-button,button,button,'pink');control('boost',right-boost,y,boost,boost,'pink');
      const energyW=button+boost+gap,energyX=right-energyW,energyY=y-27;
      this.round(energyX,energyY,energyW,19,9,'rgba(255,250,250,.9)');this.round(energyX+3,energyY+3,energyW-6,13,6,'#73508d');if(p.energy>0)this.round(energyX+3,energyY+3,Math.max(1,(energyW-6)*p.energy/100),13,6,'#f991bd');this.text('体力 '+Math.round(p.energy)+'/100',right-energyW/2,energyY+10,10,'#fffaf6',800,'center');
      const pauseX=right-48,audioX=pauseX-46;
      this.button('audioSettings','声',audioX-4,top,44,44,'white');this.button('pause','',pauseX,top,48,44,'pink');this.icon('pause',pauseX+24,top+22,.7,'#fffaf6');
      const infoW=Math.min(audioX-left-12,landscape?260:232);this.round(left,top,infoW,44,16,'rgba(255,250,250,.91)');this.text('第 '+race.rank()+' / 3',left+10,top+12,15,C.ink,900);this.text(Math.floor(p.z)+' / '+Core.LENGTH+' m',left+infoW-10,top+12,11,C.ink,750,'right');
      const progress=Math.max(0,Math.min(1,p.z/Core.LENGTH));this.round(left+10,top+26,infoW-20,7,3,'#d7c5eb');if(progress>0)this.round(left+10,top+26,Math.max(1,(infoW-20)*progress),7,3,'#ee81ae');
      this.text('冻干 '+p.score+'分',left+10,top+39,9,C.ink,700);
      if(race.messageTime>0||race.time<5){const msg=race.messageTime>0?race.message:'左手换道 · 点↑跳 · 按住⚡加速';const width=Math.min(right-left,300);this.round((this.width-width)/2,top+53,width,25,12,'rgba(255,250,250,.90)');this.text(msg,this.width/2,top+66,compact?10:11,C.ink,750,'center');}
    });}
    overlay(race){this.screenLayer(()=>{
      const left=(this.safeLeft||0)+12,right=this.width-(this.safeRight||0)-12,top=(this.safeTop||0)+12,bottom=this.height-(this.safeBottom||0)-12,landscape=this.width>this.height,c=this.ctx;
      c.fillStyle='rgba(67,43,88,.28)';c.fillRect(0,0,this.width,this.height);
      const w=Math.min(right-left,race.mode==='select'?(landscape?660:420):360),x=(left+right-w)/2;
      if(race.mode==='select'){
        const h=Math.min(bottom-top,landscape?350:510),y=top+(bottom-top-h)/2,cardH=Math.max(96,Math.min(180,h-(landscape?218:312))),cardY=y+70,cardW=(w-40)/3;
        this.round(x,y,w,h,26);this.text('猫猫冲冲',x+18,y+25,24,C.ink,850);this.text('选猫 · '+Core.LENGTH+'米 · 两只 AI · '+(race.difficulty==='hard'?'挑战':'轻松'),x+w/2,y+49,12,'#776288',650,'center');
        for(let i=0;i<3;i++){const cx=x+12+i*(cardW+8);this.button('select'+i,'',cx,cardY,cardW,cardH,race.selected===i?'pink':'violet');this.buttons[this.buttons.length-1].ariaLabel='选择'+Core.CATS[i].name;this.sprite(i+3,cx+cardW/2,cardY+cardH-26,Math.min(cardW,cardH-30),Math.min(cardW,cardH-30));this.text(Core.CATS[i].name,cx+cardW/2,cardY+cardH-13,15,C.ink,800,'center');}
        const infoY=cardY+cardH+21;this.text('罐罐 +35体力 · 冻干 +10分 / 0体力',x+w/2,infoY,Math.min(12,w/27),C.ink,650,'center');
        if(landscape){const by=infoY+23;this.button('easy','轻松',x+12,by,84,44,race.difficulty==='easy'?'pink':'white');this.button('hard','挑战',x+104,by,84,44,race.difficulty==='hard'?'pink':'white');this.button('start','开始比赛',x+w-190,by,178,48);this.text('左手换道 · 右手跳 / 按住加速',x+w/2,by+66,12,C.ink,650,'center');}
        else{this.text('左手换道 · 右手跳 / 按住加速',x+w/2,infoY+23,12,C.ink,650,'center');const by=infoY+43;this.button('easy','轻松',x+12,by,(w-32)/2,44,race.difficulty==='easy'?'pink':'white');this.button('hard','挑战',x+w/2+4,by,(w-32)/2,44,race.difficulty==='hard'?'pink':'white');this.button('start','开始比赛',x+12,by+57,w-24,52);this.text('A/D 方向 · W 加速 · 空格跳 · Esc 暂停',x+w/2,by+132,Math.min(11,w/29),'#776288',600,'center');}
      }else if(race.mode==='paused'){
        const h=220,y=top+(bottom-top-h)/2;this.round(x,y,w,h,26);this.text('休息一下',x+w/2,y+34,26,C.ink,800,'center');this.text('恢复后重新按住加速',x+w/2,y+61,13,'#776288',600,'center');this.button('resume','继续比赛',x+12,y+85,w-24,52);this.button('restart','重新开始',x+12,y+151,(w-32)/2,48,'violet');this.button('menu','选小猫',x+w/2+4,y+151,(w-32)/2,48,'violet');
      }else if(race.mode==='results'){
        const h=338,y=top+(bottom-top-h)/2;this.round(x,y,w,h,26);this.text(race.rank()===1?'冠军小猫！':'跑到终点啦',x+w/2,y+29,25,C.ink,850,'center');this.text('第 '+race.rank()+' 名 · 冻干 '+race.player.score+' 分',x+w/2,y+58,14,'#776288',650,'center');
        race.ranking().forEach((cat,i)=>{const ry=y+84+i*54;this.round(x+12,ry,w-24,46,14,cat===race.player?'#fce0eb':'#f0eafb');this.text((i+1)+'  '+(cat===race.player?'你 · ':'AI · ')+Core.CATS[cat.skin].name,x+23,ry+23,14,C.ink,750);this.text(cat.finishTime.toFixed(2)+'s',x+w-23,ry+23,13,C.ink,700,'right');});this.button('restart','再跑一局',x+12,y+269,(w-32)/2,52);this.button('menu','换只小猫',x+w/2+4,y+269,(w-32)/2,52,'violet');
      }
    });}
    audioOverlay(race){this.screenLayer(()=>{const c=this.ctx,s=race.audioSettings,w=Math.min(360,this.width-(this.safeLeft||0)-(this.safeRight||0)-24),h=330,x=((this.safeLeft||0)+this.width-(this.safeRight||0)-w)/2,y=((this.safeTop||0)+this.height-(this.safeBottom||0)-h)/2;c.fillStyle='rgba(67,43,88,.45)';c.fillRect(0,0,this.width,this.height);this.round(x,y,w,h,26);this.text('声音设置',x+w/2,y+30,24,C.ink,850,'center');for(const [kind,label,ry]of [['music','背景音乐',y+61],['sfx','游戏音效',y+161]]){this.text(label,x+12,ry+20,16,C.ink,750);this.button(kind+'Toggle',s[kind+'Enabled']?'开启':'关闭',x+w-96,ry,84,44,s[kind+'Enabled']?'pink':'violet');this.button(kind+'Down','−',x+12,ry+48,48,44,'violet');this.text(Math.round(s[kind+'Volume']*100)+'%',x+w/2,ry+70,18,C.ink,750,'center');this.button(kind+'Up','＋',x+w-60,ry+48,48,44,'violet');}this.button('audioClose','完成',x+12,y+271,w-24,48);});}
    draw(race){const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle=C.sky;c.fillRect(0,0,this.width,this.height);c.translate(this.offsetX,this.offsetY);c.scale(this.scale,this.scale);c.save();c.beginPath();c.rect(-this.offsetX/this.scale,-this.offsetY/this.scale,this.width/this.scale,this.height/this.scale);c.clip();this.buttons=[];this.scene(race);this.hud(race);
      if(race.mode==='select'||race.mode==='paused'||race.mode==='results'){this.buttons=[];this.overlay(race);}
      if(race.mode==='countdown'){this.round(126,304,138,138,40,'rgba(255,250,250,.94)');this.text(String(Math.ceil(race.countdown)),195,361,72,C.ink,900,'center');this.text('准备出发',195,412,15,C.ink,700,'center');}
      if(['select','paused','results'].includes(race.mode)&&!race.audioPanel)this.audioControl();
      if(race.audioPanel){this.buttons=[];this.audioOverlay(race);}
      c.restore();
    }
  }
  return {Renderer,W,H,C,RECTS};
});
