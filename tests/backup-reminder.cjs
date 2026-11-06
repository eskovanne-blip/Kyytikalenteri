const assert=require('assert/strict');require('../firebase-auth/calendar-backup.js');
const nowMs=Date.parse('2026-11-06T10:00:00Z'),day=24*60*60*1000;
assert.equal(calendarBackupIsOverdue(new Date(nowMs-30*day).toISOString(),nowMs),false);
assert.equal(calendarBackupIsOverdue(new Date(nowMs-30*day-1).toISOString(),nowMs),true);
assert.equal(calendarBackupIsOverdue({toMillis:()=>nowMs-31*day},nowMs),true);
assert.equal(calendarBackupIsOverdue(null,nowMs),true);
assert.equal(calendarBackupIsOverdue(new Date(nowMs+day).toISOString(),nowMs),false);
(async()=>{
 const saved=new Map();const storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
 let prompts=[],downloads=0,accepted=false,now=new Date(nowMs);
 const reminder=createBackupReminder({storage,now:()=>now,confirm:message=>{prompts.push(message);return accepted;},makeBackup:async()=>{downloads++;}});
 const info={calendarId:'calendar1',userUid:'user1',lastBackupAt:new Date(nowMs-31*day).toISOString()};
 await reminder.update(info);assert.equal(prompts.length,1);assert(prompts[0].includes('yli 30 päivään'));assert.equal(downloads,0);
 await reminder.check();assert.equal(prompts.length,1);
 // Each user and calendar receives their own reminder, including non-admin users.
 await reminder.update({...info,userUid:'user2'});assert.equal(prompts.length,2);
 await reminder.update({...info,calendarId:'calendar2'});assert.equal(prompts.length,3);
 now=new Date(nowMs+day);accepted=true;await reminder.update(info);assert.equal(downloads,1);
 await reminder.update({...info,lastBackupAt:now.toISOString()});await reminder.check();assert.equal(downloads,1);
 reminder.clear();await reminder.check();assert.equal(downloads,1);
 await reminder.update({...info,calendarId:'never-backed-up',lastBackupAt:null});assert(prompts.at(-1).includes('ei ole vielä kirjattu'));assert.equal(downloads,2);
 // New instance/tab reload respects this user's session dismissal.
 const reloaded=createBackupReminder({storage,now:()=>now,confirm:()=>{throw Error('Repeated prompt');},makeBackup:async()=>{}});await reloaded.update(info);
 let noStoragePrompts=0;const noStorage=createBackupReminder({storage:null,now:()=>now,confirm:()=>{noStoragePrompts++;return false;},makeBackup:async()=>{}});await noStorage.update(info);await noStorage.check();assert.equal(noStoragePrompts,1);
 console.log('PASS: exact 30-day threshold, unknown date, all users, daily dismissal, shared fresh backup, background checks, reload and unavailable session storage.');
})().catch(error=>{console.error(error);process.exitCode=1;});
