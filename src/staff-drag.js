(function(root){
 class StaffDrag{
  constructor(handlers){this.handlers=handlers;this.origin=null;this.dragging=false;}
  down(point){if(this.origin)this.up();this.origin=point;this.dragging=false;this.handlers.start(point);}
  move(point){if(!this.origin)return;if(!this.dragging&&Math.hypot(point.x-this.origin.x,point.y-this.origin.y)<4)return;this.dragging=true;this.handlers.move(point);}
  up(point){if(!this.origin)return;if(point&&Number.isFinite(point.x)&&Number.isFinite(point.y))this.move(point);const moved=this.dragging;this.origin=null;this.dragging=false;this.handlers.end(moved);}
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={StaffDrag};
 else root.StaffDrag=StaffDrag;
})(typeof window!=='undefined'?window:globalThis);
