(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CatRaceKeyboard=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAP={a:'left',keya:'left',arrowleft:'left',d:'right',keyd:'right',arrowright:'right',w:'boost',keyw:'boost',arrowup:'boost',' ':'jump',space:'jump',escape:'pause',p:'pause',keyp:'pause',r:'restart',keyr:'restart'};
 class Keyboard{
  constructor(action){this.action=action;this.held=new Set();}
  key(e){return String(e.code||e.key||'').toLowerCase();}
  boost(){return [...this.held].some(k=>MAP[k]==='boost');}
  down(e){const key=this.key(e),action=MAP[key];if(!action)return;e.preventDefault();if(e.repeat||this.held.has(key))return;this.held.add(key);this.action(action,true);}
  up(e){const key=this.key(e),action=MAP[key];if(!action)return;e.preventDefault();this.held.delete(key);this.action(action,action==='boost'?this.boost():false);}
  reset(){this.held.clear();}
  status(){return {held:[...this.held],boostHeld:this.boost(),mapping:'A/D or ←/→ move; W/↑ held boost; Space edge jump; Esc/P pause; R restart'};}
 }
 return {Keyboard,MAP};
});
