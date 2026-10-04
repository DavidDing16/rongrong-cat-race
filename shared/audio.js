(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CatRaceAudio=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DEFAULTS={musicEnabled:true,sfxEnabled:true,musicVolume:.4,sfxVolume:.75};
  const LEVELS={meow:1,jump:.7,land:.6,food:.7,can:.7,boost:.55,hit:.85,victory:.9,finish:.7};
  const COOLDOWN={jump:80,land:100,food:90,can:150,boost:400,hit:180,victory:1600,finish:400,meow:160};
  function preferences(value){const s={...DEFAULTS,...value};s.musicEnabled=!!s.musicEnabled;s.sfxEnabled=!!s.sfxEnabled;for(const key of ['musicVolume','sfxVolume'])s[key]=Number.isFinite(s[key])?Math.max(0,Math.min(1,s[key])):DEFAULTS[key];return s;}
  class Controller{
    constructor(adapter,manifest,initial,save){this.adapter=adapter;this.manifest=manifest;this.settings=preferences(initial);this.save=save;this.mode='select';this.unlocked=false;this.background=true;this.last=new Map();this.duckUntil=0;this.events={};this.errors=[];adapter.levels(this.settings,1);}
    async unlock(){try{await this.adapter.unlock();this.unlocked=true;this.background=false;this.sync(this.mode);}catch(e){this.errors.push(String(e));}}
    update(settings){this.settings=preferences(settings);if(this.save)this.save(this.settings);this.sync(this.mode);}
    active(){return this.unlocked&&!this.background&&this.mode!=='paused';}
    sync(mode){this.mode=mode;const active=this.active();const duck=Date.now()<this.duckUntil?.35:1;this.adapter.levels(this.settings,duck);if(active&&this.settings.musicEnabled&&this.settings.musicVolume>0)this.adapter.music(true);else this.adapter.music(false);if(!active||!this.settings.sfxEnabled||this.settings.sfxVolume===0)this.adapter.stopSfx();}
    suspend(){this.background=true;this.adapter.music(false);this.adapter.stopSfx();this.adapter.suspend();}
    resetRace(){this.adapter.stopSfx();this.last.clear();}
    play(name){if(!this.active()||!this.settings.sfxEnabled||this.settings.sfxVolume===0)return false;const now=Date.now();if(now-(this.last.get(name)||0)<(COOLDOWN[name]||90))return false;this.last.set(name,now);const played=this.adapter.effect(name,LEVELS[name]||.7);if(played)this.events[name]=(this.events[name]||0)+1;return played;}
    event(event){if(event.type==='can'){this.duckUntil=Date.now()+650;this.play('can');this.play('meow');this.sync(this.mode);}else if(event.type==='result')this.play(event.rank===1?'victory':'finish');else if(['jump','land','food','boost','hit'].includes(event.type))this.play(event.type);}
    status(){return {...this.adapter.status(),settings:{...this.settings},unlocked:this.unlocked,background:this.background,mode:this.mode,events:{...this.events},ducked:Date.now()<this.duckUntil,errors:[...this.errors,...(this.adapter.errors||[])],maxSfxVoices:4};}
  }
  async function browser(manifest,initial,save){
    const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw new Error('Web Audio unavailable');
    const ctx=new Context(),compressor=ctx.createDynamicsCompressor(),musicGain=ctx.createGain(),sfxGain=ctx.createGain();compressor.threshold.value=-12;compressor.knee.value=14;compressor.ratio.value=8;compressor.attack.value=.003;compressor.release.value=.14;compressor.connect(ctx.destination);musicGain.connect(compressor);sfxGain.connect(compressor);
    const buffers={};await Promise.all(Object.entries(manifest.files).map(async([name,file])=>{const response=await fetch(file);if(!response.ok)throw new Error('Audio asset missing: '+file);buffers[name]=await ctx.decodeAudioData(await response.arrayBuffer());}));
    let musicSource=null,musicOffset=0,musicStart=0,musicStarts=0,voices=[],dropped=0,maximum=0;
    const adapter={errors:[],unlock:()=>ctx.resume(),suspend(){ctx.suspend().catch(()=>{});},levels(s,duck){musicGain.gain.setTargetAtTime(s.musicVolume*.55*duck,ctx.currentTime,.04);sfxGain.gain.setTargetAtTime(s.sfxVolume*.65,ctx.currentTime,.015);},music(on){
      if(on){if(musicSource||ctx.state!=='running')return;const source=ctx.createBufferSource();source.buffer=buffers.music;source.loop=true;source.connect(musicGain);source.start(0,musicOffset%source.buffer.duration);musicSource=source;musicStart=ctx.currentTime;musicStarts++;}
      else if(musicSource){musicOffset=(musicOffset+ctx.currentTime-musicStart)%buffers.music.duration;const source=musicSource;musicSource=null;try{source.stop();}catch{}source.disconnect();}
    },effect(name,level){if(!buffers[name]||ctx.state!=='running')return false;if(voices.length>=4){dropped++;return false;}const source=ctx.createBufferSource(),gain=ctx.createGain();gain.gain.value=level;source.buffer=buffers[name];source.connect(gain);gain.connect(sfxGain);const voice={source,gain};voices.push(voice);maximum=Math.max(maximum,voices.length);source.onended=()=>{voices=voices.filter(v=>v!==voice);source.disconnect();gain.disconnect();};source.start();return true;},stopSfx(){const old=voices;voices=[];for(const voice of old){voice.gain.gain.cancelScheduledValues(ctx.currentTime);voice.gain.gain.setTargetAtTime(0,ctx.currentTime,.004);try{voice.source.stop(ctx.currentTime+.018);}catch{}}},status(){return {backend:'Web Audio',state:ctx.state,musicSources:musicSource?1:0,musicStarts,musicOffset,activeSfx:voices.length,peakConcurrentSfx:maximum,droppedSfx:dropped,bufferCount:Object.keys(buffers).length,plays:0,duration:buffers.meow.duration};}};
    const controller=new Controller(adapter,manifest,initial,save);const baseStatus=controller.status.bind(controller);controller.status=()=>{const status=baseStatus();status.plays=Object.values(status.events).reduce((a,b)=>a+b,0);status.muted=!status.settings.musicEnabled&&!status.settings.sfxEnabled;return status;};return controller;
  }
  function wechat(wx,manifest,initial,save){
    if(!wx.createInnerAudioContext)throw new Error('WeChat InnerAudioContext unavailable');
    const errors=[],music=wx.createInnerAudioContext();music.src=manifest.files.music;music.loop=true;music.autoplay=false;music.onError(e=>errors.push(JSON.stringify(e)));let playing=false,musicStarts=0,maxVoices=0,dropped=0,settings=preferences(initial);
    const pool=Array.from({length:4},()=>{const audio=wx.createInnerAudioContext(),voice={audio,active:false,level:1};audio.autoplay=false;audio.loop=false;audio.onEnded(()=>{voice.active=false;});audio.onStop(()=>{voice.active=false;});audio.onError(e=>{voice.active=false;errors.push(JSON.stringify(e));});return voice;});
    const adapter={errors,unlock:()=>Promise.resolve(),suspend(){},levels(s,duck){settings=s;music.volume=s.musicVolume*.55*duck;for(const voice of pool)voice.audio.volume=s.sfxVolume*.65*voice.level;},music(on){if(on&&!playing){playing=true;musicStarts++;music.play();}else if(!on&&playing){playing=false;music.pause();}},effect(name,level){const voice=pool.find(v=>!v.active);if(!voice){dropped++;return false;}voice.active=true;voice.level=level;voice.audio.src=manifest.files[name];voice.audio.volume=settings.sfxVolume*.65*level;voice.audio.play();maxVoices=Math.max(maxVoices,pool.filter(v=>v.active).length);return true;},stopSfx(){pool.forEach(v=>{if(v.active){v.active=false;v.audio.stop();}});},status(){return {backend:'WeChat InnerAudioContext',musicSources:playing?1:0,musicStarts,activeSfx:pool.filter(v=>v.active).length,peakConcurrentSfx:maxVoices,droppedSfx:dropped,bufferCount:0,state:'native-device-unverified'};}};
    return new Controller(adapter,manifest,initial,save);
  }
  return {Controller,browser,wechat,preferences,DEFAULTS};
});
