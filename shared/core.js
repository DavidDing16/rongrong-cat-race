(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CatRaceCore=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const LENGTH=800,STEP=1/60,JUMP_TIME=.9;
  // Rounded solid body, excluding flexible tails/ears; coordinates are metres.
  const PHYSICS=Object.freeze({laneWidth:2.4,bodyWidth:2.15,bodyLength:2.45,bodyHeight:2.05,jumpHeight:2.9,baseSpeed:23.4,boostSpeed:15.6,slowSpeed:13,canEnergy:35,foodScore:10,foodEnergy:0,energyDrain:50,pickupTolerance:.8});
  const CATS = [

    { id: 'rongrong', name: '绒绒', note: '短腿米努特 · 非对称小花脸', color: '#f7e4c8' },

    { id: 'orange', name: '胖橘', note: '圆滚滚的橘色小选手', color: '#eea654' },

    { id: 'american', name: '美短', note: '银色小虎斑 · 灵巧的小选手', color: '#8994af' }

  ];
  function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
  function height(jump){return jump>0?Math.sin(Math.PI*(1-jump/JUMP_TIME))*PHYSICS.jumpHeight:0;}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function makeTrack(seed=20261004,difficulty='easy'){
    const random=rng(seed),phase=Math.floor(random()*3),direction=random()<.5?1:2,a=[];
    const add=(z,lane,type,h,segment)=>a.push({id:a.length,z,lane,type,height:h,segment});
    // Two cans per lane/segment; rotating hurdles never close all three lanes.
    for(let s=0;s<12;s++){
      const trackScale=LENGTH/600,z=(18+s*48)*trackScale,blocked=(phase+s*direction)%3,free=(blocked+1)%3;
      for(let lane=0;lane<3;lane++)add(z,lane,'can',.45,s);
      for(let lane=0;lane<3;lane++){const hurdle=difficulty==='hard'?lane!==free:lane===blocked;if(hurdle)add(z+18*trackScale,lane,'hurdle',0,s);add(z+18*trackScale,lane,'can',hurdle?2.2:.45,s);}
      add(z+36*trackScale,(phase+s)%3,'food',2.2,s);
    }
    return a.sort((a,b)=>a.z-b.z||a.id-b.id);
  }
  function sweptBody(a,b){
    const x0=(a.x0-b.x0)*PHYSICS.laneWidth/PHYSICS.bodyWidth,z0=(a.z0-b.z0)/PHYSICS.bodyLength;
    const dx=(a.cat.x-b.cat.x)*PHYSICS.laneWidth/PHYSICS.bodyWidth-x0,dz=(a.cat.z-b.cat.z)/PHYSICS.bodyLength-z0;
    const A=dx*dx+dz*dz,B=2*(x0*dx+z0*dz),C=x0*x0+z0*z0-1;
    if(A<1e-12)return C<0?[0,1]:null;const d=B*B-4*A*C;if(d<0)return null;
    const lo=Math.max(0,(-B-Math.sqrt(d))/(2*A)),hi=Math.min(1,(-B+Math.sqrt(d))/(2*A));return lo<=hi?[lo,hi]:null;
  }
  const atHeight=(m,t)=>height(Math.max(0,m.jump0-m.dt*t));
  class Race{
    constructor(options={}){this.selected=0;this.muted=false;this.seed=options.seed??20261004;this.difficulty=options.difficulty==='hard'?'hard':'easy';this.reset('select');}
    reset(mode='countdown'){
      this.audioPanel=false;this.track=makeTrack(this.seed,this.difficulty);this.collected=new Map();this.time=0;this.countdown=3;this.mode=mode;this.previousMode=null;this.boostHeld=false;this.message='';this.messageTime=0;this.accumulator=0;this.events=[];this.contacts=new Set();this.collisionStats={contacts:0,maxPenetration:0};
      const order=[this.selected,...[0,1,2].filter(i=>i!==this.selected)];
      this.cats=order.map((skin,i)=>({skin,lane:i===0?1:i===1?0:2,x:i===0?1:i===1?0:2,z:0,jump:0,energy:0,score:0,slow:0,boosting:false,wantBoost:false,finishTime:null,seen:new Set(),aiTimer:0,aiRandom:rng(this.seed^Math.imul(skin+1,7919)),boostDelay:.25+skin*.12,laneHold:0,driftTime:0,steer:0,landing:0,eating:0,stats:{hits:0,cans:0,foods:0,boostSeconds:0,energyEarned:0,energySpent:0,contacts:0}}));this.stats=this.player.stats;
    }
    select(i){if(this.mode==='select'&&i>=0&&i<3){this.selected=i;this.reset('select');}}
    start(){this.reset();}
    get player(){return this.cats[0];}
    jumpHeight(cat){return height(cat.jump);}
    isCollected(obj){return obj.type!=='hurdle'&&this.collected.has(obj.id);}
    action(a,down=true){
      if(a==='restart'&&down){this.reset();return;}if(a==='menu'&&down){this.reset('select');return;}
      if((a==='easy'||a==='hard')&&down&&this.mode==='select'){this.difficulty=a;this.reset('select');return;}
      if(a==='pause'&&down){this.pause();return;}if(a==='resume'&&down){this.resume();return;}
      if(a==='boost'){this.boostHeld=down&&this.mode==='racing';return;}
      if(this.mode!=='racing'||this.player.finishTime!==null||!down)return;
      if(a==='left'&&this.player.lane>0)this.steer(this.player,this.player.lane-1);if(a==='right'&&this.player.lane<2)this.steer(this.player,this.player.lane+1);
      if(a==='jump'&&this.player.jump===0){this.player.jump=JUMP_TIME;this.events.push({type:'jump'});}
    }
    steer(cat,lane){cat.steer=Math.sign(lane-cat.lane);cat.lane=lane;cat.driftTime=.55;cat.laneHold=.45;}
    pause(){if(this.mode==='racing'||this.mode==='countdown'){this.previousMode=this.mode;this.mode='paused';this.boostHeld=false;this.accumulator=0;}}
    resume(){if(this.mode==='paused'){this.mode=this.previousMode||'racing';this.previousMode=null;this.accumulator=0;this.boostHeld=false;}}
    rank(){return this.ranking().findIndex(c=>c===this.player)+1;}
    ranking(){return [...this.cats].sort((a,b)=>a.finishTime!==null&&b.finishTime!==null?a.finishTime-b.finishTime:a.finishTime!==null?-1:b.finishTime!==null?1:b.z-a.z);}
    update(dt){if(['paused','select','results'].includes(this.mode))return;this.accumulator+=Math.min(.1,Math.max(0,dt));while(this.accumulator+1e-9>=STEP){this.accumulator-=STEP;this.tick(STEP);}}
    tick(dt){
      if(this.mode==='countdown'){this.countdown=Math.max(0,this.countdown-dt);if(this.countdown===0)this.mode='racing';return;}if(this.mode!=='racing')return;
      const oldTime=this.time;this.time+=dt;this.messageTime=Math.max(0,this.messageTime-dt);
      const motion=this.cats.map((cat,i)=>{
        if(cat.finishTime!==null){cat.boosting=false;return {cat,x0:cat.x,z0:cat.z,jump0:cat.jump,dt};}if(i>0)this.ai(cat,dt);
        const m={cat,x0:cat.x,z0:cat.z,jump0:cat.jump,dt},wasJumping=cat.jump>0;
        cat.jump=Math.max(0,cat.jump-dt);cat.slow=Math.max(0,cat.slow-dt);cat.driftTime=Math.max(0,cat.driftTime-dt);cat.laneHold=Math.max(0,cat.laneHold-dt);cat.landing=Math.max(0,cat.landing-dt*4);cat.eating=Math.max(0,cat.eating-dt/1.4);
        if(wasJumping&&cat.jump===0){cat.landing=1;if(i===0)this.events.push({type:'land'});}cat.x+=(cat.lane-cat.x)*Math.min(1,dt*12);
        const wasBoosting=cat.boosting;cat.boosting=(i===0?this.boostHeld:cat.wantBoost)&&cat.energy>0&&cat.slow===0;if(i===0&&cat.boosting&&!wasBoosting)this.events.push({type:'boost'});
        const boostDt=cat.boosting?Math.min(dt,cat.energy/PHYSICS.energyDrain):0;cat.energy=Math.max(0,cat.energy-boostDt*PHYSICS.energyDrain);cat.stats.energySpent+=boostDt*PHYSICS.energyDrain;cat.stats.boostSeconds+=boostDt;
        cat.z+=(cat.slow>0?PHYSICS.slowSpeed:PHYSICS.baseSpeed)*dt+boostDt*PHYSICS.boostSpeed;return m;
      });
      this.resolveCats(motion);this.resolveTrack(motion);
      for(const m of motion){const cat=m.cat;if(cat.finishTime===null&&cat.z>=LENGTH){cat.finishTime=oldTime+(LENGTH-m.z0)/(cat.z-m.z0)*dt;cat.z=LENGTH;cat.boosting=false;if(cat===this.player){this.boostHeld=false;this.say('到终点啦 · 等待其他小猫',10);this.events.push({type:'finish'});}}}
      if(this.cats.every(c=>c.finishTime!==null)){this.mode='results';this.events.push({type:'result',rank:this.rank()});}
    }
    resolveCats(motion){
      const active=new Set(),width=PHYSICS.bodyWidth/PHYSICS.laneWidth,length=PHYSICS.bodyLength;
      // Position constraints: no impulses, upward launch or free forward speed.
      for(let pass=0;pass<12;pass++)for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
        const a=motion[i],b=motion[j],A=a.cat,B=b.cat;if(A.finishTime!==null||B.finishTime!==null)continue;
        const interval=sweptBody(a,b);if(!interval)continue;if(![interval[0],(interval[0]+interval[1])/2,interval[1]].some(t=>Math.abs(atHeight(a,t)-atHeight(b,t))<PHYSICS.bodyHeight-1e-6))continue;
        const dx=A.x-B.x,dz=A.z-B.z,q=(dx/width)**2+(dz/length)**2;
        if(q>=1-1e-9&&Math.sign(dz)===Math.sign(a.z0-b.z0)&&Math.sign(dx)===Math.sign(a.x0-b.x0))continue;
        if(Math.abs(this.jumpHeight(A)-this.jumpHeight(B))>=PHYSICS.bodyHeight&&q<1&&pass>0)continue;active.add(i+':'+j);
        const side=Math.abs((a.x0-b.x0)/width)>Math.abs((a.z0-b.z0)/length)||Math.abs(dz)<.15;let lateral=side;
        if(!side){const front=a.z0>b.z0?A:B,rear=front===A?B:A,rearM=front===A?b:a;const gap=length*Math.sqrt(Math.max(0,1-(dx/width)**2))+1e-5,limit=front.z-gap;if(limit>=rearM.z0-1e-8)rear.z=Math.max(rearM.z0,Math.min(rear.z,limit));else lateral=true;}
        if(lateral){const sign=Math.abs(a.x0-b.x0)>1e-6?Math.sign(a.x0-b.x0):A.skin<B.skin?-1:1,gap=width*Math.sqrt(Math.max(0,1-((A.z-B.z)/length)**2))+1e-5,missing=gap-sign*(A.x-B.x);
          if(missing>0){const moveA=Math.min(missing/2,sign>0?2-A.x:A.x),moveB=Math.min(missing/2,sign>0?B.x:2-B.x);A.x+=sign*moveA;B.x-=sign*moveB;const left=missing-moveA-moveB;if(left>0){const extraA=Math.min(left,sign>0?2-A.x:A.x);A.x+=sign*extraA;B.x-=sign*Math.min(left-extraA,sign>0?B.x:2-B.x);}}A.x=clamp(A.x,0,2);B.x=clamp(B.x,0,2);
        }
      }
      for(const pair of active)if(!this.contacts.has(pair)){this.collisionStats.contacts++;const [i,j]=pair.split(':').map(Number);this.cats[i].stats.contacts++;this.cats[j].stats.contacts++;if(i===0||j===0){this.say('挤到小猫啦 · 换道或跃过');this.events.push({type:'catContact'});}}this.contacts=active;
      for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){const A=this.cats[i],B=this.cats[j];if(A.finishTime!==null||B.finishTime!==null||Math.abs(this.jumpHeight(A)-this.jumpHeight(B))>=PHYSICS.bodyHeight)continue;const q=((A.x-B.x)/width)**2+((A.z-B.z)/length)**2;this.collisionStats.maxPenetration=Math.max(this.collisionStats.maxPenetration,Math.max(0,1-Math.sqrt(q)));}
    }
    resolveTrack(motion){
      const claims=[];
      for(const m of motion){const cat=m.cat;if(cat.finishTime!==null)continue;for(const obj of this.track){
        if(cat.seen.has(obj.id)||obj.z>cat.z||obj.z<m.z0)continue;cat.seen.add(obj.id);const t=cat.z>m.z0?clamp((obj.z-m.z0)/(cat.z-m.z0),0,1):0,x=m.x0+(cat.x-m.x0)*t,h=atHeight(m,t);
        if(Math.abs(x-obj.lane)>(obj.type==='hurdle'?.70:.43))continue;
        if(obj.type==='hurdle'){if(h<.68){cat.slow=1.25;cat.stats.hits++;if(cat===this.player){this.say('撞到跳栏啦 · 跳跃或换道');this.events.push({type:'hit'});}}}
        else if(!this.isCollected(obj)&&Math.abs(h-obj.height)<PHYSICS.pickupTolerance)claims.push({obj,cat,t});
      }}
      // Earliest plane crossing wins; exact ties rotate by seed/item/physical skin.
      const priority=c=>(c.cat.skin-((this.seed+c.obj.id)%3)+3)%3;claims.sort((a,b)=>a.t-b.t||priority(a)-priority(b));
      for(const {obj,cat,t}of claims){if(this.isCollected(obj))continue;this.collected.set(obj.id,{skin:cat.skin,time:this.time-STEP+t*STEP});cat.eating=1;
        if(obj.type==='can'){const gain=Math.min(PHYSICS.canEnergy,100-cat.energy);cat.energy+=gain;cat.stats.cans++;cat.stats.energyEarned+=gain;cat.boostDelay=this.difficulty==='hard'?.10:.30;if(cat===this.player){this.say('罐罐 +35 能量');this.events.push({type:'can'});}}
        else{cat.score+=PHYSICS.foodScore;cat.stats.foods++;if(cat===this.player){this.say('冻干 +10 · 真香！');this.events.push({type:'food'});}}
      }
    }
    ai(cat,dt){
      cat.aiTimer-=dt;cat.boostDelay=Math.max(0,cat.boostDelay-dt);if(cat.energy<=0)cat.wantBoost=false;if(cat.aiTimer>0)return;cat.aiTimer=this.difficulty==='hard'?.09:.18;
      const speed=PHYSICS.baseSpeed+(cat.wantBoost&&cat.energy>0?PHYSICS.boostSpeed:0),obstacle=this.track.find(o=>o.type==='hurdle'&&o.lane===cat.lane&&o.z>cat.z&&o.z-cat.z<24);
      const blocker=this.cats.find(c=>c!==cat&&c.finishTime===null&&c.z>cat.z&&c.z-cat.z<7&&Math.abs(c.x-cat.lane)<.75&&Math.abs(this.jumpHeight(c)-this.jumpHeight(cat))<PHYSICS.bodyHeight);
      if(cat.laneHold===0&&blocker){const lanes=[cat.lane-1,cat.lane+1].filter(l=>l>=0&&l<=2).filter(l=>!this.cats.some(c=>c!==cat&&c.finishTime===null&&Math.abs(c.x-l)<.8&&Math.abs(c.z-cat.z)<4));if(lanes.length)this.steer(cat,lanes[Math.floor(cat.aiRandom()*lanes.length)]);}
      else if(cat.laneHold===0&&obstacle&&obstacle.z-cat.z>12&&this.difficulty==='easy'&&cat.aiRandom()<.30){const lane=[cat.lane-1,cat.lane+1].find(l=>l>=0&&l<=2&&!this.track.some(o=>o.type==='hurdle'&&o.lane===l&&Math.abs(o.z-obstacle.z)<1)&&!this.cats.some(c=>c!==cat&&Math.abs(c.x-l)<.8&&Math.abs(c.z-cat.z)<4));if(lane!==undefined)this.steer(cat,lane);}
      const target=this.track.find(o=>o.z>cat.z&&o.z-cat.z<24&&o.lane===cat.lane&&(o.type==='hurdle'||(o.height>1&&!this.isCollected(o))));
      if(target&&cat.jump===0&&target.z-cat.z<=speed*.45&&cat.jumpTarget!==target.id){cat.jumpTarget=target.id;if(cat.aiRandom()<(this.difficulty==='hard'?.96:.82))cat.jump=JUMP_TIME;}
      if(blocker&&cat.jump===0)cat.wantBoost=false;else if(!cat.wantBoost&&cat.energy>=PHYSICS.canEnergy&&cat.boostDelay===0)cat.wantBoost=true;if(cat.slow>0)cat.wantBoost=false;
    }
    say(s,t=1.8){this.message=s;this.messageTime=t;}
    drainEvents(){const e=this.events;this.events=[];return e;}
    snapshot(){return {seed:this.seed,difficulty:this.difficulty,physics:PHYSICS,boostHeld:this.boostHeld,audioPanel:!!this.audioPanel,audioSettings:this.audioSettings?{...this.audioSettings}:null,mode:this.mode,time:this.time,countdown:this.countdown,selected:this.selected,muted:this.muted,rank:this.rank(),stats:{...this.stats},collisions:{...this.collisionStats},collected:[...this.collected].map(([id,owner])=>({id,...owner})),cats:this.cats.map(c=>({skin:c.skin,lane:c.lane,x:c.x,z:c.z,jump:c.jump,height:this.jumpHeight(c),energy:c.energy,score:c.score,slow:c.slow,boosting:c.boosting,finishTime:c.finishTime,steer:c.steer,drift:c.driftTime/.55,landing:c.landing,eating:c.eating,stats:{...c.stats}}))};}
  }
  return {Race,CATS,LENGTH,STEP,JUMP_TIME,PHYSICS,makeTrack};
});
