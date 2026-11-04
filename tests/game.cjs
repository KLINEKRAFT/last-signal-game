const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Test-only access to the simulation, never shipped in the game.
 await page.route('**/game.js',async route=>{const response=await route.fetch();let body=await response.text();body=body.replace('animate();\n\nwindow', 'window.testGame={state,rowan,interact,consume,pause,piles,salvage,finish};\nanimate();\n\nwindow');await route.fulfill({response,body});});
 await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>window.testGame);
 await page.screenshot({path:'/tmp/last-signal-boot.png'});
 await page.click('#begin');await page.waitForTimeout(1000);
 await page.keyboard.down('w');await page.waitForFunction(()=>Math.hypot(testGame.rowan.position.x,testGame.rowan.position.z)>1);await page.keyboard.up('w');
 assert.ok(await page.evaluate(()=>Math.hypot(testGame.rowan.position.x,testGame.rowan.position.z)>1),'keyboard moves Rowan');
 await page.keyboard.press('Escape');const paused=await page.evaluate(()=>testGame.state.clock);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>testGame.state.clock),paused);await page.click('#resume');
 async function warp(x,z){await page.evaluate(([x,z])=>testGame.rowan.position.set(x,0,z),[x,z]);await page.waitForFunction(([x,z])=>{const r=testGame.rowan.position;return Math.hypot(r.x-x,r.z-z)<.01&&document.querySelector('#interact').classList.contains('show')},[x,z]);await page.waitForTimeout(150);console.log('At',x,z,await page.locator('#interact').textContent());}
 await warp(-3.5,4.5);await page.keyboard.press('e');assert.equal(await page.evaluate(()=>testGame.state.wood),1);
 await warp(1.2,-1);await page.keyboard.press('e');assert.equal(await page.evaluate(()=>testGame.state.fed),true);assert.equal(await page.evaluate(()=>testGame.state.wood),0);
 for(const [x,z] of [[-9,-7],[9,6],[-16,-14]]){await warp(x,z);await page.waitForFunction(()=>document.querySelector('#interact').textContent.includes('SEARCH'));await page.keyboard.press('e');}
 assert.equal(await page.evaluate(()=>testGame.state.parts),3);
 await page.evaluate(()=>{testGame.state.hung=30;testGame.state.thir=30;});await page.keyboard.press('1');await page.keyboard.press('2');assert.ok(await page.evaluate(()=>testGame.state.hung>60&&testGame.state.thir>60));
 await warp(-4,-3);await page.keyboard.press('e');assert.equal(await page.evaluate(()=>testGame.state.radio),true);
 await warp(1.2,-1);await page.screenshot({path:'/tmp/last-signal-gameplay.png'});
 await page.evaluate(()=>testGame.state.signal=99.99);await page.waitForTimeout(150);assert.equal(await page.locator('#end-title').textContent(),'You were heard.');
 await page.click('#retry');await page.waitForFunction(()=>window.testGame);await page.click('#begin');await page.evaluate(()=>testGame.state.hung=0);await page.waitForFunction(()=>document.querySelector('#end-title').textContent==='The cold settles in.');
 await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForFunction(()=>window.testGame);await page.screenshot({path:'/tmp/last-signal-mobile.png'});await page.click('#begin');await page.waitForTimeout(900);
 const canvas=page.locator('canvas');await page.mouse.move(300,400);await page.mouse.down();await page.waitForFunction(()=>Math.hypot(testGame.rowan.position.x,testGame.rowan.position.z)>1);await page.mouse.up();assert.ok(await page.evaluate(()=>Math.hypot(testGame.rowan.position.x,testGame.rowan.position.z)>1),'pointer movement works');
 await page.screenshot({path:'/tmp/last-signal-mobile-game.png'});
 assert.deepEqual(errors,[]);console.log('PASS: keyboard, pointer, pause, gathering, fire, salvage, consumables, radio, rescue, failure, restart, mobile; no runtime errors.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
