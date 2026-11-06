const assert=require('assert/strict');require('../firebase-auth/calendar-access.js');
const user={uid:'new-user',email:'new@example.test',emailVerified:true};
function options(){return {user,remembered:null,readMembership:async()=>null,findMemberships:async()=>[],findInvites:async()=>[],acceptInvite:async()=>{},isCurrent:()=>true};}
(async()=>{
 const member={uid:user.uid,active:true,calendarId:'shared-calendar'};
 assert.equal(await findUserCalendar({...options(),findMemberships:async()=>[member],findInvites:()=>{throw Error('Must not consume an invite for existing membership');}}),'shared-calendar');
 let accepted=[];
 assert.equal(await findUserCalendar({...options(),findInvites:async()=>[{active:true,calendarId:'shared-calendar',code:'pending'}],acceptInvite:async(...args)=>accepted.push(args)}),'shared-calendar');
 assert.deepEqual(accepted,[['shared-calendar','pending']]);
 assert.equal(await findUserCalendar({...options(),remembered:'wrong-calendar',readMembership:async()=>{throw Object.assign(Error('denied'),{code:'permission-denied'});},findMemberships:async()=>[member]}),'shared-calendar');
 assert.equal(await findUserCalendar({...options(),findMemberships:async()=>[{...member,active:false},{...member,uid:'someone-else'}],findInvites:async()=>[{active:false,calendarId:'shared-calendar',code:'used'}]}),null);
 assert.equal(await findUserCalendar({...options(),user:{...user,emailVerified:false},findMemberships:()=>{throw Error('Unverified lookup');}}),null);
 await assert.rejects(()=>findUserCalendar({...options(),findMemberships:async()=>{throw Object.assign(Error('offline'),{code:'unavailable'});}}),/offline/);
 await assert.rejects(()=>findUserCalendar({...options(),isCurrent:()=>false}),/Kirjautuminen vaihtui/);
 assert.equal(await findUserCalendar({...options(),remembered:'shared-calendar',readMembership:async()=>({active:true}),findMemberships:()=>{throw Error('Unnecessary lookup');}}),'shared-calendar');
 console.log('PASS: fresh browser membership, unfinished invitation, stale browser cache, revoked membership, unverified identity, offline and account-switch handling.');
})().catch(error=>{console.error(error);process.exitCode=1;});
