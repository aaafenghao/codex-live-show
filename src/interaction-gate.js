(function(root){
 class InteractionGate{
  constructor(){this.active=false;this.pending=null;}
  begin(){this.active=true;}
  request(callback){if(this.active)this.pending=callback;else callback();}
  end(){this.active=false;const pending=this.pending;this.pending=null;pending?.();}
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={InteractionGate};
 else root.InteractionGate=InteractionGate;
})(typeof window!=='undefined'?window:globalThis);
