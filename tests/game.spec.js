const {test,expect}=require('@playwright/test');
async function start(page){await page.goto('/');await page.locator('#begin').click();await expect(page.locator('#interact')).toBeVisible();}
async function seed(page,changes,position){
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('last-signal-v1')));
 Object.assign(saved.state,changes);saved.position=position;
 await page.addInitScript(saved=>localStorage.setItem('last-signal-v1',JSON.stringify(saved)),saved);
 await page.reload();await page.locator('#continue').click();
}
test('salvage, movement, pause and saved continuation',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await start(page);await page.keyboard.press('e');await expect(page.locator('#inv-food')).toHaveText('3');await expect(page.locator('#objective')).toHaveText('Transmit from the ridge');
 await page.keyboard.press('1');await expect(page.locator('#inv-food')).toHaveText('2');
 await page.keyboard.down('s');await page.waitForTimeout(800);await page.keyboard.up('s');
 await page.locator('#pause').click();await expect(page.locator('#panel')).toBeVisible();
 const before=await page.locator('#hud-time').textContent();await page.waitForTimeout(600);await expect(page.locator('#hud-time')).toHaveText(before);
 await page.locator('#resume').click();await page.reload();await page.locator('#continue').click();await expect(page.locator('#inv-food')).toHaveText('2');expect(errors).toEqual([]);
});
test('gathering, fire, beacon requirements and successful rescue',async({page})=>{
 await start(page);await page.keyboard.press('e');
 await seed(page,{}, {x:-3.5,z:4.5});await expect(page.locator('#interact')).toContainText('GATHER');await page.keyboard.press('e');await expect(page.locator('#inv-wood')).toHaveText('1');
 await seed(page,{warm:30}, {x:0,z:0});await page.keyboard.press('e');await expect(page.locator('#inv-wood')).toHaveText('0');await page.waitForTimeout(1200);expect(Number(await page.locator('#v-warm').textContent())).toBeGreaterThan(30);
 await seed(page,{wood:1}, {x:-22,z:-24});await page.keyboard.press('e');await expect(page.locator('#toast')).toContainText('Bring 2 wood');
 await seed(page,{wood:2}, {x:-22,z:-24});await page.keyboard.press('e');await expect(page.locator('#panel-title')).toHaveText('Someone heard you.');expect(await page.evaluate(()=>localStorage.getItem('last-signal-v1'))).toBeNull();
});
test('cold ends an expedition and restart returns to title',async({page})=>{await start(page);await seed(page,{warm:.001},{x:30,z:30});await expect(page.locator('#panel-title')).toHaveText('The wilderness fell silent.');await page.locator('#restart').click();await expect(page.locator('#boot')).not.toHaveClass(/gone/);});
test('mobile title and touch movement fit the viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await start(page);
 await page.mouse.move(260,500);await page.mouse.down();await page.waitForTimeout(900);await page.mouse.up();
 await page.locator('#pause').click();const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('last-signal-v1')));expect(Math.hypot(saved.position.x,saved.position.z)).toBeGreaterThan(.5);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 await page.locator('#resume').click();await page.screenshot({path:'artifacts/mobile.png'});
});
