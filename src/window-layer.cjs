function setWindowLayer(window,pinned,platform=process.platform){
 if(pinned)window.setAlwaysOnTop(true,'floating');
 else if(platform==='darwin')window.setAlwaysOnTop(true,'normal',-1);
 else{window.setAlwaysOnTop(false);window.moveBottom?.();}
}
module.exports={setWindowLayer};
