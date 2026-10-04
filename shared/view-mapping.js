(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CatRaceView=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Camera is behind the cats looking along +Z: world +X projects to screen LEFT.
 const worldX=(lane,spacing=2.4)=>(1-lane)*spacing;
 function resolution(w,h,dpr=1,budget=1500000,cap=1.5){return Math.max(.25,Math.min(Number.isFinite(dpr)?dpr:1,cap,Math.sqrt(budget/Math.max(1,w*h))));}
 return {worldX,resolution};
});
