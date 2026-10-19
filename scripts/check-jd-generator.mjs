import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const points = `Role: Service Desk Analyst
Experience: 1–3 years
Must-have skills: Windows desktop support, Microsoft 365, Active Directory user management and password resets, ticketing tools
Location: Bengaluru, on-site
Nice-to-have: ITIL Foundation certification`;
const browser=await chromium.launch({channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const requests=[];const responses=[];const generationIDs=new Set();
 page.on('websocket',socket=>{
  socket.on('framesent',frame=>{const message=JSON.parse(frame.payload.toString());if(message.type==='Action'){requests.push(message);if(message.udfPath==='jd:generate')generationIDs.add(message.requestId);}});
  socket.on('framereceived',frame=>{const message=JSON.parse(frame.payload.toString());if(message.type==='ActionResponse'&&generationIDs.has(message.requestId))responses.push(message);});
 });
 await page.goto('http://127.0.0.1:5175');
 const button=page.getByRole('button',{name:'Generate JD',exact:true});
 await expect(button).toBeDisabled();
 await page.getByLabel('What are you looking for?',{exact:true}).fill(points);
 await button.click();
 await expect(button).toBeDisabled();
 const field=page.getByLabel('Paste job description',{exact:true});
 await expect(field).toHaveValue(/Must-have[\s\S]*Nice-to-have/,{timeout:90000});
 const generated=await field.inputValue();
 expect(responses).toHaveLength(1);expect(responses[0].success).toBe(true);expect(responses[0].result).toBe(generated);
 expect(requests.find(r=>r.udfPath==='jd:generate').args).toEqual([{points}]);
 await expect(page.getByLabel('What are you looking for?',{exact:true})).toHaveValue(points);
 expect(generated).toMatch(/1[–-]3/);expect(generated).toMatch(/Bengaluru/i);expect(generated).toMatch(/Microsoft 365/i);
 await expect(page.getByRole('button',{name:'Confirm requirements',exact:true})).toHaveCount(0);
 await page.locator('.jd-generator').scrollIntoViewIfNeeded();await page.screenshot({path:'.local-checks/jd-generator-desktop.png'});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.jd-generator').scrollIntoViewIfNeeded();await page.screenshot({path:'.local-checks/jd-generator-mobile.png'});
 const edited=generated+'\n\nRecruiter note: This is a draft for review.';
 await field.fill(edited);await page.getByRole('button',{name:'Use pasted JD',exact:true}).click();
 await expect(page.locator('.role-column pre')).toHaveText(edited);
 await page.getByRole('button',{name:'Extract requirements',exact:true}).click();
 await expect(page.getByLabel('Requirement 1',{exact:true})).toBeVisible({timeout:120000});
 expect(requests.find(r=>r.udfPath==='assessment:extractRequirements').args).toEqual([{jdText:edited}]);
 await expect(page.getByRole('button',{name:'Confirm requirements',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Confirm requirements',exact:true}).click();
 await expect(page.getByLabel('Choose candidate CV',{exact:true})).toBeVisible();
 expect(errors).toEqual([]);
 // Simulate an action/provider failure; no server configuration or credentials are changed.
 const failurePage=await browser.newPage();let failedAttempts=0;
 await failurePage.routeWebSocket(/\/sync(?:\?|$)/,socket=>{
  const server=socket.connectToServer();
  socket.onMessage(raw=>{const request=JSON.parse(raw.toString());if(request.type==='Action'&&request.udfPath==='jd:generate'){
   failedAttempts++;socket.send(JSON.stringify({type:'ActionResponse',requestId:request.requestId,success:false,result:'Synthetic provider failure',logLines:[]}));
  }else server.send(raw);});
 });
 await failurePage.goto('http://127.0.0.1:5175');
 await failurePage.getByLabel('What are you looking for?',{exact:true}).fill(points);
 await failurePage.getByLabel('Paste job description',{exact:true}).fill('Existing draft must stay here when generation fails.');
 for(let i=0;i<2;i++){
  await failurePage.getByRole('button',{name:'Generate JD',exact:true}).click();
  await expect(failurePage.getByRole('alert')).toHaveText('Could not generate, try again');
  await expect(failurePage.getByLabel('What are you looking for?',{exact:true})).toHaveValue(points);
  await expect(failurePage.getByLabel('Paste job description',{exact:true})).toHaveValue('Existing draft must stay here when generation fails.');
  await expect(failurePage.getByRole('button',{name:'Generate JD',exact:true})).toBeEnabled();
 }
 expect(failedAttempts).toBe(2);
 const proof=`Points typed:\n${points}\n\nFull generated JD:\n${generated}\n`;
 await writeFile('.local-checks/jd-generator-proof.txt',proof);
 console.log(proof);
 console.log('Real Convex generation returned the exact JD in the editable field. Edited text reached the existing extraction action unchanged; requirements confirmed and CV upload available. Simulated provider failure and retry: exact error, points and existing JD retained. Desktop and mobile checked; no browser errors.');
} finally {await browser.close();}
