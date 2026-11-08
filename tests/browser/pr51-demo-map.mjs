import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { resolve, dirname, isAbsolute } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSeed } from '../../assets/js/data/seed.js';
import { buildFrontendArtifact } from '../../scripts/stage-frontend.mjs';

// Explicit fictional browser-demo compatibility, not backend/production evidence.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
if (!isAbsolute(process.env.P1_BROWSER_MODULE||'')) throw new Error('Use the locked private browser runtime.');
const {chromium}=await import(pathToFileURL(process.env.P1_BROWSER_MODULE).href);
const artifact=await buildFrontendArtifact({root});
const socket=createServer(); socket.listen(0,'127.0.0.1'); await once(socket,'listening');
const port=socket.address().port; await new Promise(resolve=>socket.close(resolve));
const origin=`http://127.0.0.1:${port}`;
const server=spawn(process.env.PHP_BINARY||'php',['-S',`127.0.0.1:${port}`,'-t',artifact.directory],{cwd:root,windowsHide:true,stdio:'ignore'});
const directory=resolve(root,'tests/browser/evidence/pr-one-demo-map');
const report={scope:'Explicit fictional browser-demo only; no Laravel/backend acceptance claim.',checks:[],screenshots:[]};
let browser;
try {
  await mkdir(directory,{recursive:true});
  let ready=false;
  for(let attempt=0;attempt<100;attempt++){try{if((await fetch(origin+'/assets/js/core/runtime-config.js')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  assert.ok(ready,'Private static demo server did not start.');
  browser=await chromium.launch({headless:true});
  for(const mode of ['legacy','missing','unknown']){
    const db=createSeed(); db.demo_started_at=Date.now();
    for(const area of db.barangays)delete area.map_scope;
    for(const facility of db.facilities){delete facility.map_scope;delete facility.managed_by_barangay_id;}
    if(mode!=='legacy')db.barangays[0].map_scope=mode==='missing'?null:'unknown-artwork';
    db.emergency_alerts[0].description='Preserved fictional browser record';
    const context=await browser.newContext({viewport:{width:1440,height:1080}}),requests=[];
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await context.addInitScript(({db})=>{if(!localStorage.getItem('barangay-connect:data:v1'))localStorage.setItem('barangay-connect:data:v1',JSON.stringify(db));sessionStorage.setItem('barangay-connect:session:v1','1');},{db});
    const page=await context.newPage();page.setDefaultTimeout(15000);page.on('request',request=>requests.push(new URL(request.url()).pathname));
    await page.goto(origin+'/official-map.html');
    if(mode==='legacy')await page.locator('.bc-map-image').waitFor();
    else{await page.getByText('Map coverage is not available yet',{exact:true}).waitFor();assert.equal(await page.locator('.bc-map-image').count(),0);}
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('barangay-connect:data:v1')).emergency_alerts[0].description),'Preserved fictional browser record');
    assert.ok(requests.every(path=>!path.startsWith('/api/')));
    const file=mode+'-demo.png';await page.screenshot({path:resolve(directory,file),fullPage:true});report.screenshots.push(file);
    if(mode==='legacy'){
      await page.goto(origin+'/official-facilities.html'); await page.locator('[data-add]').click();
      await page.waitForFunction(()=>{const button=document.querySelector('[data-pin]');return button&&(!button.disabled||button.title);});
      assert.equal(await page.locator('[data-pin]').isEnabled(),true);
      assert.equal(await page.locator('[data-menu="2"]').count(),1,'Original shared fictional referral remains manageable by its declared fixture owner.');
    }
    const label=`${mode} fictional demo preserves data and explicit coverage`;report.checks.push(label);console.log('PASS demo compatibility: '+label);
    await context.close();
  }
}catch(error){report.error=error.message;throw error;}
finally{await mkdir(directory,{recursive:true});await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2));await browser?.close();server.kill();}
