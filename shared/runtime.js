(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./core'),require('./renderer'));else root.CatRaceRuntime=factory(root.CatRaceCore,root.CatRaceRenderer);})(typeof globalThis!=='undefined'?globalThis:this,function(Core,Visual){
  'use strict';
  function createRuntime(platform,images,options={}){
    const race=new Core.Race(),renderer=options.Renderer?new options.Renderer(platform,images,options.models):new Visual.Renderer(platform.canvas,images),pointers=new Map(),boostSources=new Set();
    let previous=0,running=true,frameCount=0,elapsed=0,audioResume=false;
    race.audioSettings=platform.getAudioSettings?{...platform.getAudioSettings()}:{};race.audioPanel=false;
    function syncBoost(){race.action('boost',boostSources.size>0||[...pointers.values()].includes('boost'));}
    function present(){race.controlHeld=[...new Set([...pointers.values(),...(boostSources.size?['boost']:[])])];renderer.draw(race);if(platform.updateControls){const ui=renderer.ui||renderer;platform.updateControls(ui.buttons.map(b=>({...b,x:ui.offsetX+b.x*ui.scale,y:ui.offsetY+b.y*ui.scale,w:b.w*ui.scale,h:b.h*ui.scale})));}}
    function resetInputs(){pointers.clear();boostSources.clear();race.action('boost',false);if(platform.resetInput)platform.resetInput();}
    function resize(){resetInputs();const s=platform.size();renderer.resize(s.width,s.height,s.dpr,s.safeBottom||0,s.safeTop||0,s.safeLeft||0,s.safeRight||0);present();}
    function action(id,down=true,source='keyboard'){
      if(down&&platform.unlockAudio)platform.unlockAudio();
      if(id==='audioSettings'&&down){audioResume=['racing','countdown'].includes(race.mode);race.pause();resetInputs();race.audioPanel=true;}
      else if(id==='audioClose'&&down){race.audioPanel=false;if(audioResume)race.resume();audioResume=false;resetInputs();}
      else if(race.audioPanel){if(down){const s=race.audioSettings;if(id==='musicToggle')s.musicEnabled=!s.musicEnabled;if(id==='sfxToggle')s.sfxEnabled=!s.sfxEnabled;for(const kind of ['music','sfx'])if(id===kind+'Up'||id===kind+'Down')s[kind+'Volume']=Math.max(0,Math.min(1,Math.round((s[kind+'Volume']+(id.endsWith('Up')?.1:-.1))*10)/10));if(platform.updateAudioSettings)platform.updateAudioSettings(s);}}
      else if(id==='boost'){if(source!=='touch'){if(down&&race.mode==='racing')boostSources.add(source);else boostSources.delete(source);}syncBoost();}
      else if(id==='mute'&&down){race.muted=!race.muted;if(platform.setMuted)platform.setMuted(race.muted);}
      else {if(id==='start'&&down)race.start();else if(id.startsWith('select')&&down)race.select(Number(id.slice(6)));else race.action(id,down);if(down&&['pause','restart','menu','resume','start'].includes(id))resetInputs();if(down&&['restart','menu','start'].includes(id)&&platform.resetAudio)platform.resetAudio();}
      if(platform.syncAudio)platform.syncAudio(race.mode);present();
    }
    function down(id,x,y){if(pointers.has(id))up(id);const b=renderer.hit(x,y);if(!b||b.disabled)return;pointers.set(id,b.id);action(b.id,true,'touch');}
    function up(id){pointers.delete(id);syncBoost();present();}
    // Leaving the original target releases it; sliding into another target does
    // not trigger an action. A fresh touch starts the next gesture.
    function move(id,x,y){if(!pointers.has(id))return;const b=renderer.hit(x,y);if(!b||b.disabled||b.id!==pointers.get(id))up(id);}
    function suspend(){race.pause();resetInputs();previous=0;if(platform.suspendAudio)platform.suspendAudio();else if(platform.stopSound)platform.stopSound();present();}
    function frame(t){if(!running)return;if(!previous)previous=t;const dt=Math.max(0,(t-previous)/1000);previous=t;race.update(dt);if(race.mode==='results')resetInputs();if(platform.syncAudio)platform.syncAudio(race.mode);for(const event of race.drainEvents()){if(renderer.event)renderer.event(event,race);if(platform.audioEvent)platform.audioEvent(event,race);else if(event.type==='can'&&!race.muted&&platform.playSound)platform.playSound('meow');}present();frameCount++;elapsed+=Math.min(.1,dt);platform.frame(frame);}
    resize();platform.bind({down,move,up,action,suspend,resize});platform.frame(frame);
    return {race,renderer,action,down,move,up,suspend,resize,inputStatus(){return {pointers:[...pointers].map(([id,action])=>({id,action})),boostSources:[...boostSources],boostHeld:race.boostHeld};},stop(){resetInputs();running=false;},metrics(){return {frameCount,elapsed,averageFPS:elapsed?frameCount/elapsed:0,drawSize:[platform.canvas.width,platform.canvas.height],renderer:options.Renderer?'Three.js WebGL':'Canvas2D placeholder',gpu:renderer.stats?renderer.stats():null};}};
  }
  return {createRuntime};
});
