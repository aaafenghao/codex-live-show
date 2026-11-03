const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('celebration',Object.freeze({done:()=>ipcRenderer.send('fireworks:done')}));
