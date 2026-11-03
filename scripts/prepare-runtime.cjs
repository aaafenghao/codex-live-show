const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
async function prepare(){
 const root=path.dirname(require.resolve('electron/package.json')),version=require('electron/package.json').version;
 const executable='Electron.app/Contents/MacOS/Electron',dist=path.join(root,'dist');
 if(!fs.existsSync(path.join(dist,executable))||!fs.existsSync(path.join(dist,'Electron.app/Contents/Frameworks/Electron Framework.framework/Electron Framework'))){
  const {downloadArtifact}=require('@electron/get');
  const zip=await downloadArtifact({version,artifactName:'electron',platform:'darwin',arch:process.arch,checksums:require(path.join(root,'checksums.json'))});
  execFileSync('/usr/bin/ditto',['-x','-k',zip,dist]);
 }
 fs.writeFileSync(path.join(root,'path.txt'),executable);
 console.log('Electron runtime ready: '+version);
}
prepare().catch(e=>{console.error(e.message);process.exitCode=1});
