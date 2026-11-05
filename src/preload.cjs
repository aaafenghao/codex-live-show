const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('clothesline',Object.freeze({
 snapshot:()=>ipcRenderer.invoke('sessions:snapshot'),
 onChange:callback=>{const handler=(_event,snapshot)=>callback(snapshot);ipcRenderer.on('sessions:change',handler);return()=>ipcRenderer.removeListener('sessions:change',handler);},
 openSession:id=>ipcRenderer.invoke('session:open',id),
 dismissCompleted:id=>ipcRenderer.invoke('session:dismiss-completed',id),
 previewFireworks:()=>ipcRenderer.invoke('fireworks:preview'),
 move:delta=>ipcRenderer.send('window:move',delta),
 home:()=>ipcRenderer.send('window:home'),
 resize:height=>ipcRenderer.send('window:resize',height),
 setMousePassthrough:value=>ipcRenderer.send('window:passthrough',value),
 setScale:value=>ipcRenderer.invoke('window:scale',value),
 setPinned:value=>ipcRenderer.invoke('window:pinned',value),
 getPreferences:()=>ipcRenderer.invoke('preferences:get'),
 savePreferences:value=>ipcRenderer.invoke('preferences:save',value),
 quit:()=>ipcRenderer.send('app:quit')
}));
