(async function(){
  'use strict';
  const BUILD='20261004-mobile-race-v9';
  const canvas=document.getElementById('game');
  async function load(src){
    for(let attempt=0;attempt<3;attempt++){
      try{return await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src+'?v='+BUILD+'&attempt='+attempt;});}
      catch(error){if(attempt===2)throw new Error('图片加载失败：'+src);await new Promise(resolve=>setTimeout(resolve,250));}
    }
  }
  try{
    const manifest=await (await fetch('assets/models/manifest.json?v='+BUILD,{cache:'no-store'})).json();
    const images={};if(!manifest.ready){const art=await Promise.all(['atlas','background','cats-run','cats-jump','cats-portrait'].map(name=>load('assets/'+name+'.png')));[images.atlas,images.background,images.run,images.jump,images.portrait]=art;}else images.background=await load('assets/background.png');
    let renderOptions={};
    if(manifest.ready){
      async function script(src){return new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src+'?v='+BUILD;el.onload=resolve;el.onerror=()=>reject(new Error('脚本加载失败：'+src));document.head.append(el);});}
      await script('vendor/three.js');await script('shared/glb-loader.js');await script('shared/view-mapping.js');await script('shared/camera-framing.js');await script('shared/webgl-renderer.js');
      const models={cats:{},props:{}};
      for(const section of ['cats','props'])for(const [name,file]of Object.entries(manifest[section]||{})){const directory='assets/models/';const response=await fetch(directory+file+'?v='+BUILD,{cache:'no-store'});if(!response.ok)throw new Error('云端3D资源缺失：'+file);models[section][name]=CatRaceGLB.parse(await response.arrayBuffer(),THREE);}
      renderOptions={Renderer:CatRaceWebGL.Renderer,models};
    }
    const audioManifest=await (await fetch('assets/audio/manifest.json?v='+BUILD,{cache:'no-store'})).json();
    let initial={};try{initial=JSON.parse(localStorage.getItem('cat-race-audio-settings')||'null')||{};if(!localStorage.getItem('cat-race-audio-settings')&&localStorage.getItem('cat-race-muted')==='true')initial={musicEnabled:false,sfxEnabled:false};}catch{}
    const audio=await CatRaceAudio.browser(audioManifest,initial,settings=>{try{localStorage.setItem('cat-race-audio-settings',JSON.stringify(settings));}catch{}});
    let keyboard=null,controlsHandler=null;const controlNodes=new Map();
    function updateControls(buttons){
      const active=new Set(buttons.map(b=>b.id));for(const [id,node]of controlNodes)node.hidden=!active.has(id);
      for(const b of buttons){let node=controlNodes.get(b.id);if(!node){node=document.createElement('button');node.className='accessible-control';node.dataset.action=b.id;node.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();e.stopPropagation();if(!e.repeat)controlsHandler.action(b.id,true,'a11y');}});node.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();e.stopPropagation();controlsHandler.action(b.id,false,'a11y');}});node.addEventListener('blur',()=>controlsHandler?.action(b.id,false,'a11y'));node.addEventListener('click',()=>{controlsHandler.action(b.id,true,'a11y');if(b.id==='boost')setTimeout(()=>controlsHandler.action('boost',false,'a11y'),200);});document.body.append(node);controlNodes.set(b.id,node);}
        node.hidden=false;node.disabled=!!b.disabled;const label=b.ariaLabel||b.id;if(node.getAttribute('aria-label')!==label){node.setAttribute('aria-label',label);node.textContent=label;}const rect=[b.x,b.y,b.w,b.h].map(x=>x.toFixed(2)).join(',');if(node.dataset.rect!==rect){node.dataset.rect=rect;Object.assign(node.style,{left:b.x+'px',top:b.y+'px',width:b.w+'px',height:b.h+'px'});}
      }
    }
    const platform={canvas,updateControls,createSurface:()=>document.createElement('canvas'),attachHUD(surface){surface.id='hud';surface.setAttribute('aria-hidden','true');Object.assign(surface.style,{position:'absolute',left:'0',top:'0',pointerEvents:'none'});document.body.append(surface);},getAudioSettings:()=>audio.settings,updateAudioSettings:s=>audio.update(s),unlockAudio:()=>audio.unlock(),audioEvent:e=>audio.event(e),syncAudio:mode=>audio.sync(mode),suspendAudio:()=>audio.suspend(),resetAudio:()=>audio.resetRace(),size(){const css=getComputedStyle(document.documentElement),bottom=parseFloat(css.getPropertyValue('--safe-bottom'))||0,top=parseFloat(css.getPropertyValue('--safe-top'))||0;return {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,safeBottom:bottom,safeTop:top,safeLeft:parseFloat(css.getPropertyValue('--safe-left'))||0,safeRight:parseFloat(css.getPropertyValue('--safe-right'))||0};},frame:cb=>requestAnimationFrame(cb),bind(handlers){controlsHandler=handlers;
      canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);handlers.down(e.pointerId,e.clientX,e.clientY);});
      const release=e=>{e.preventDefault();platform.unlockAudio();handlers.up(e.pointerId);};canvas.addEventListener('pointermove',e=>handlers.move(e.pointerId,e.clientX,e.clientY));canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',e=>handlers.up(e.pointerId));canvas.addEventListener('lostpointercapture',e=>handlers.up(e.pointerId));
      keyboard=new CatRaceKeyboard.Keyboard(handlers.action);platform.resetInput=()=>keyboard.reset();addEventListener('keydown',e=>keyboard.down(e));addEventListener('keyup',e=>keyboard.up(e));
      addEventListener('blur',handlers.suspend);document.addEventListener('visibilitychange',()=>{if(document.hidden)handlers.suspend();});canvas.addEventListener('webglcontextlost',handlers.suspend);canvas.addEventListener('webglcontextrestored',handlers.resize);addEventListener('resize',handlers.resize);
    }};
    document.documentElement.style.setProperty('--safe-bottom','env(safe-area-inset-bottom, 0px)');
    document.documentElement.style.setProperty('--safe-top','env(safe-area-inset-top, 0px)');
    document.documentElement.style.setProperty('--safe-left','env(safe-area-inset-left, 0px)');document.documentElement.style.setProperty('--safe-right','env(safe-area-inset-right, 0px)');
    const runtime=CatRaceRuntime.createRuntime(platform,images,renderOptions);
    // Read-only diagnostics: usable for browser QA without mutating race state.
    window.catRace={buildVersion:BUILD,snapshot:()=>runtime.race.snapshot(),track:()=>runtime.race.track.map(o=>({...o,collected:runtime.race.isCollected(o)})),world:()=>({visibleObjectIds:[...(runtime.renderer.objects?.keys()||[])]}),metrics:()=>runtime.metrics(),audio:()=>audio.status(),keyboard:()=>keyboard?.status(),inputs:()=>runtime.inputStatus(),screen:()=>runtime.renderer.screenState?runtime.renderer.screenState(runtime.race):null,poses:()=>runtime.renderer.actors?runtime.renderer.actors.map(a=>({name:a.root.name,race:a.root.userData.racePose,nodes:['Body','Head','LegFL','Tail'].map(name=>{const n=a.root.getObjectByName(name);return {name,position:n?.position.toArray(),quaternion:n?.quaternion.toArray(),scale:n?.scale.toArray()};})})):[]};
    let lastMode='';setInterval(()=>{const s=runtime.race.snapshot();if(s.mode!==lastMode){lastMode=s.mode;document.getElementById('accessible').textContent=s.mode==='results'?'比赛结束，第'+s.rank+'名':s.mode==='paused'?'比赛暂停':s.mode==='racing'?'比赛开始':s.mode==='select'?'请选择小猫':'准备开始';}},300);
  }catch(error){const el=document.getElementById('error');el.style.display='block';el.textContent=error.message;console.error(error);}
})();
