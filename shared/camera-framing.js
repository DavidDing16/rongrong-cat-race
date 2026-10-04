(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../vendor/three'),require('./view-mapping'));else root.CatRaceFraming=factory(root.THREE,root.CatRaceView);})(typeof globalThis!=='undefined'?globalThis:this,function(T,View){
  'use strict';
  const BASE={fov:53,height:5.4,distance:10.2,lookDistance:24.2,pitch:Math.atan2(5.95,24.2)},MAX_SCALE=2.4;
  const TAN=Math.tan(BASE.fov*Math.PI/360),GROUND_ANCHOR=.5+Math.tan(Math.atan2(BASE.height,BASE.distance)-BASE.pitch)/(2*TAN);
  const smoothstep=(a,b,x)=>{const q=Math.max(0,Math.min(1,(x-a)/(b-a)));return q*q*(3-2*q);};
  class AdaptiveCamera{
    constructor(camera,actors,identities=[]){
      this.camera=camera;this.actors=actors;this.identities=identities;this.scale=1;this.wantedScale=1;this.releaseAge=0;this.needsSnap=true;this.lastRaceTime=0;this.lastMode='';this.near=[];this.scratch=new T.Vector3();
      // Only these initial scans touch vertex arrays. Per-frame work transforms
      // the eight cached geometry-box corners for each actual rendered mesh.
      this.cache=actors.map(actor=>{const meshes=[];let count=0;actor.root.traverse(mesh=>{if(!mesh.isMesh)return;if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox,corners=new Float32Array(24);let i=0;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){corners[i++]=x;corners[i++]=y;corners[i++]=z;}meshes.push({mesh,corners,offset:count});count+=24;});return {meshes,points:new Float64Array(count),mask:new Uint8Array(count/3),skin:-1,role:'',relativeZ:0,jumpHeight:0,near:false,minX:0,maxX:0};});
      this.configure(390,844,0,0);
    }
    configure(width,height,safeBottom=0,safeTop=0,safeLeft=0,safeRight=0){
      this.width=width;this.height=height;this.aspect=width/height;this.safeTop=safeTop;this.safeBottom=safeBottom;this.safeLeft=safeLeft;this.safeRight=safeRight;this.groundAnchor=width>height?.66:GROUND_ANCHOR;this.targetAnchor=(safeTop+(height-safeTop-safeBottom)*this.groundAnchor)/height;
      this.pitch=Math.atan2(BASE.height,BASE.distance)-Math.atan((this.targetAnchor-.5)*2*TAN);this.sin=Math.sin(this.pitch);this.cos=Math.cos(this.pitch);this.depthPerScale=BASE.distance*this.cos+BASE.height*this.sin;this.needsSnap=true;
    }
    collect(race){
      this.near.length=0;this.closestRival=Infinity;this.groupMinX=Infinity;this.groupMaxX=-Infinity;this.nearRivals=0;
      race.cats.forEach((cat,index)=>{
        const actor=this.actors[cat.skin],data=this.cache[cat.skin];actor.root.updateMatrixWorld(true);data.skin=cat.skin;data.role=index===0?'player':'rival';data.relativeZ=cat.z-race.player.z;data.jumpHeight=race.jumpHeight(cat);data.near=index===0||(data.relativeZ>=-4&&data.relativeZ<=16);data.minX=Infinity;data.maxX=-Infinity;
        for(const record of data.meshes){const local=record.corners,world=data.points,matrix=record.mesh.matrixWorld;for(let i=0;i<24;i+=3){this.scratch.set(local[i],local[i+1],local[i+2]).applyMatrix4(matrix);const j=record.offset+i;world[j]=this.scratch.x;world[j+1]=this.scratch.y;world[j+2]=this.scratch.z;data.minX=Math.min(data.minX,this.scratch.x);data.maxX=Math.max(data.maxX,this.scratch.x);}}
        if(data.near){this.near.push(data);this.groupMinX=Math.min(this.groupMinX,data.minX);this.groupMaxX=Math.max(this.groupMaxX,data.maxX);if(index>0){this.nearRivals++;this.closestRival=Math.min(this.closestRival,Math.abs(data.relativeZ));}}
      });
    }
    requiredScale(centerX,margin,grounded,bob,horizontalMargin=margin){
      const spread=(1-2*horizontalMargin)*TAN*this.aspect,vertical=(1-2*margin)*TAN,anchor=-BASE.height*this.cos+BASE.distance*this.sin;let scale=1;
      for(const data of this.near){const points=data.points,lift=grounded?data.jumpHeight:0;for(let i=0;i<points.length;i+=3){const y=points[i+1]-lift-bob,z=points[i+2],depth=z*this.cos-y*this.sin,up=y*this.cos+z*this.sin;const horizontal=(Math.abs(points[i]-centerX)/spread-depth)/this.depthPerScale,top=(up-vertical*depth)/(vertical*this.depthPerScale-anchor),bottom=(-up-vertical*depth)/(vertical*this.depthPerScale+anchor);scale=Math.max(scale,horizontal,top,bottom);}}
      return scale;
    }
    update(race,dt){
      this.collect(race);const reset=race.time<this.lastRaceTime-1e-6||(race.mode==='countdown'&&this.lastMode!=='countdown'),snap=this.needsSnap||reset;this.lastRaceTime=race.time;this.lastMode=race.mode;
      const playerFollow=View.worldX(race.player.x,1.6),fleetCenter=(this.groupMinX+this.groupMaxX)/2;this.fleetBlend=this.nearRivals?1-smoothstep(2,7,this.closestRival):0;this.targetCenter=playerFollow+(fleetCenter-playerFollow)*this.fleetBlend;
      const center=snap?this.targetCenter:this.camera.position.x+(this.targetCenter-this.camera.position.x)*(1-Math.exp(-8*dt)),bob=race.player.boosting?.06:0;
      // Ground-normalizing only the fit input preserves the real jump in the
      // render while avoiding camera pumping on every jump. The wider comfort
      // margin absorbs that lift; an actual-pose hard guard prevents clipping.
      this.softRequired=this.requiredScale(center,.055,true,bob,.055+Math.max(this.safeLeft,this.safeRight)/this.width);this.hardRequired=this.requiredScale(center,.015,false,bob,.015+Math.max(this.safeLeft,this.safeRight)/this.width);const wanted=Math.min(MAX_SCALE,Math.max(1,this.softRequired));
      if(snap){this.wantedScale=wanted;this.scale=Math.max(wanted,Math.min(MAX_SCALE,this.hardRequired));this.releaseAge=0;}
      else{if(wanted>this.wantedScale+.012){this.wantedScale=wanted;this.releaseAge=0;}else if(wanted<this.wantedScale-.075||(wanted===1&&this.wantedScale>1&&this.fleetBlend<.05)){this.releaseAge+=dt;if(this.releaseAge>.30){this.wantedScale=wanted;this.releaseAge=0;}}else this.releaseAge=0;const rate=this.wantedScale>this.scale?10:3.4;this.scale+=(this.wantedScale-this.scale)*(1-Math.exp(-rate*dt));this.scale=Math.max(this.scale,Math.min(MAX_SCALE,this.hardRequired));if(this.wantedScale===1&&this.scale<1.005)this.scale=1;}
      this.scale=Math.max(1,Math.min(MAX_SCALE,this.scale));this.camera.position.set(center,BASE.height*this.scale+bob,-BASE.distance*this.scale);this.camera.lookAt(center,this.camera.position.y-Math.tan(this.pitch)*BASE.lookDistance*this.scale,this.camera.position.z+BASE.lookDistance*this.scale);this.camera.updateMatrixWorld(true);this.needsSnap=false;
    }
    projectPoints(data,grounded=false,withMasks=false){
      const result={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity,behind:0,outsideCornerCount:0,clipMask:0},points=data.points,lift=grounded?data.jumpHeight:0;
      for(let i=0;i<points.length;i+=3){const x=points[i]-this.camera.position.x,y=points[i+1]-lift-this.camera.position.y,z=points[i+2]-this.camera.position.z,depth=z*this.cos-y*this.sin,px=.5-x/(2*TAN*this.aspect*depth),py=.5-(y*this.cos+z*this.sin)/(2*TAN*depth);let mask=0;if(depth<this.camera.near)mask|=16;if(px<0)mask|=1;if(px>1)mask|=2;if(py<0)mask|=4;if(py>1)mask|=8;if(withMasks)data.mask[i/3]=mask;if(mask){result.outsideCornerCount++;result.clipMask|=mask;}if(depth<this.camera.near){result.behind++;continue;}result.left=Math.min(result.left,px);result.right=Math.max(result.right,px);result.top=Math.min(result.top,py);result.bottom=Math.max(result.bottom,py);}
      if(result.left===Infinity)result.left=result.right=result.top=result.bottom=null;return result;
    }
    diagnostics(race){
      const actors=race.cats.map((cat,index)=>{const data=this.cache[cat.skin],bounds=this.projectPoints(data,false,true);return {role:index===0?'player':'rival',skin:cat.skin,id:this.identities[cat.skin]?.id||String(cat.skin),relativeZ:data.relativeZ,world:this.actors[cat.skin].root.position.toArray(),jumpHeight:data.jumpHeight,inFit:data.near,exclusion:data.near?null:data.relativeZ< -4?'behind near-field range':'ahead of near-field range',meshCount:data.meshes.length,cornerCount:data.mask.length,cornerMasks:Array.from(data.mask),normalized:bounds,pixels:{left:bounds.left===null?null:bounds.left*this.width,right:bounds.right===null?null:bounds.right*this.width,top:bounds.top===null?null:bounds.top*this.height,bottom:bounds.bottom===null?null:bounds.bottom*this.height,height:bounds.top===null?null:(bounds.bottom-bounds.top)*this.height}};});
      const hero=actors[0],p=race.player,worldY=-this.camera.position.y,worldZ=-this.camera.position.z,depth=worldZ*this.cos-worldY*this.sin,anchor=.5-(worldY*this.cos+worldZ*this.sin)/(2*TAN*depth),fitBounds={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};for(const data of this.near){const bounds=this.projectPoints(data,true,false);if(bounds.left!==null){fitBounds.left=Math.min(fitBounds.left,bounds.left);fitBounds.right=Math.max(fitBounds.right,bounds.right);fitBounds.top=Math.min(fitBounds.top,bounds.top);fitBounds.bottom=Math.max(fitBounds.bottom,bounds.bottom);}}
      return {...this.state(),viewport:[this.width,this.height],safeInsets:{top:this.safeTop,bottom:this.safeBottom},groundAnchor:anchor,groundAnchorPixels:anchor*this.height,groundAnchorInSafeArea:(anchor*this.height-this.safeTop)/(this.height-this.safeTop-this.safeBottom),playerPixelHeight:hero.pixels.height,fitBounds,player:hero,rivals:actors.slice(1),maskLegend:{left:1,right:2,top:4,bottom:8,behindCamera:16},input:{mode:race.mode,time:race.time,lane:p.lane,x:p.x,steer:p.steer,jump:p.jump,boostHeld:race.boostHeld,boosting:p.boosting}};
    }
    state(){return {cameraScale:this.scale,wantedScale:this.wantedScale,softRequiredScale:this.softRequired,hardRequiredScale:this.hardRequired,maximumScale:MAX_SCALE,clamped:Math.max(this.softRequired||1,this.hardRequired||1)>MAX_SCALE,framing:this.scale>1.06?(this.nearRivals?'near-field group':'player edge'):'close chase',nearFieldZ:[-4,16],nearRivals:this.nearRivals,fleetBlend:this.fleetBlend,targetCenterX:this.targetCenter,targetGroundAnchor:this.targetAnchor,fitMargin:.055,hardMargin:.015,fitJumpTreatment:'ground-normalized; actual-pose hard guard',perFrameVertexScans:0};}
  }
  return {AdaptiveCamera,BASE,GROUND_ANCHOR};
});
