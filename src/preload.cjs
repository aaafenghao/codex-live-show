const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('clothesline',Object.freeze({
 setDrawer:value=>ipcRenderer.invoke('window:drawer',value),
 setLayout:value=>ipcRenderer.invoke('window:layout',value),
 setDrawerSide:value=>ipcRenderer.invoke('window:drawer-side',value),
 onView:callback=>{const handler=(_event,value)=>callback(value);ipcRenderer.on('window:view',handler);return()=>ipcRenderer.removeListener('window:view',handler);},
 snapshot:()=>ipcRenderer.invoke('sessions:snapshot'),
 onChange:callback=>{const handler=(_event,snapshot)=>callback(snapshot);ipcRenderer.on('sessions:change',handler);return()=>ipcRenderer.removeListener('sessions:change',handler);},
 openSession:id=>ipcRenderer.invoke('session:open',id),
 dismissCompleted:id=>ipcRenderer.invoke('session:dismiss-completed',id),
 previewFireworks:()=>ipcRenderer.invoke('fireworks:preview'),
 move:delta=>ipcRenderer.send('window:move',delta),
 beginStaffDrag:point=>ipcRenderer.send('window:drag-start',point),
 moveStaffDrag:point=>ipcRenderer.send('window:drag-move',point),
 endStaffDrag:moved=>ipcRenderer.send('window:drag-end',moved),
 home:()=>ipcRenderer.send('window:home'),
 resize:(height,columns)=>ipcRenderer.send('window:resize',height,columns),
 setInputRegions:regions=>ipcRenderer.send('window:input-regions',regions),
 setScale:value=>ipcRenderer.invoke('window:scale',value),
 setPinned:value=>ipcRenderer.invoke('window:pinned',value),
 getPreferences:()=>ipcRenderer.invoke('preferences:get'),
 savePreferences:value=>ipcRenderer.invoke('preferences:save',value),
 quit:()=>ipcRenderer.send('app:quit')
}));
