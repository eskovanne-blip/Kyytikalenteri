const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),cp=require('child_process');
require('../firebase-auth/calendar-backup.js');
const old=cp.execFileSync('git',['show','23638da:firebase-auth/index.html'],{encoding:'utf8'});
const names=['normalizeNote','normalizePayments','normalizeTripPrices','priceFromHistory','parseCsv'];
const functions=names.map(name=>{const m=old.match(new RegExp('function '+name+'\\([\\s\\S]*?\\n      }'));assert(m,name);return m[0];}).join('\n');
const context={today:new Date(2026,10,6),iso:()=> '2026-11-06'};vm.createContext(context);vm.runInContext(functions,context);
const payload={people:['Anna, "A"','Väinö','Vanha\nnimi'],inactivePeople:['Vanha\nnimi'],tripPrice:2,tripPrices:[{date:'0001-01-01',price:1},{date:'2026-11-01',price:2}],payments:[{person:'Väinö',month:'2026-11',amount:20},{person:'Anna, "A"',month:'2026-11',amount:-5}],trips:{'2026-11-02':{to:[0,2],home:[1],notes:['Väinö ajoi illalla','Oma kyyti']}}};
const member={uid:'u1',email:'test@example.com',role:'owner',active:true,joinedAt:'2026-01-01T00:00:00.000Z'};
const snapshot={payload,calendar:{id:'cal1',name:'Kalenteri',ownerUid:'u1'},members:[member,{...member,uid:'u2',role:'member',active:false}]};
const csv=makeCalendarBackupCsv(snapshot,'F_2.0.16',new Date('2026-11-06T00:00:00Z'));
assert(csv.startsWith('\uFEFF"type","date","direction","person"\r\n'));
const parsed=JSON.parse(JSON.stringify(context.parseCsv(csv)));
for(const key of ['people','inactivePeople','payments','tripPrices','trips'])assert.deepEqual(parsed[key],payload[key],key+' legacy round trip');
assert(csv.includes('"member","u1","owner"'));assert(csv.includes('"member","u2","member"'));assert(csv.includes('""active"":false'));
assert(!csv.includes('password'));assert(csv.includes('F_2.0.16'));
const doc=data=>({exists:()=>true,data:()=>data});
function options(){return {user:{uid:'u1',emailVerified:true},calendarId:'cal1',stateRef:'state',memberRef:'own',calendarRef:'calendar',pendingWrites:Promise.resolve(),readDocument:async ref=>doc(ref==='own'?member:ref==='state'?{payload}:snapshot.calendar),readMembers:async()=>({docs:[{id:member.uid,data:()=>({...member,joinedAt:{toDate:()=>new Date(member.joinedAt)},inviteCode:'DO-NOT-EXPORT'})}]}),isCurrent:()=>true};}
(async()=>{
 const data=await readCalendarBackup(options());assert.deepEqual(data.members,[member]);assert(!JSON.stringify(data).includes('DO-NOT-EXPORT'));
 await assert.rejects(()=>readCalendarBackup({...options(),readDocument:async()=>doc({...member,role:'member'})}),/ylläpitäjän/);
 await assert.rejects(()=>readCalendarBackup({...options(),readDocument:async()=>doc({...member,active:false})}),/ylläpitäjän/);
 await assert.rejects(()=>readCalendarBackup({...options(),user:null}),/Kirjaudu/);
 await assert.rejects(()=>readCalendarBackup({...options(),isCurrent:()=>false}),/vaihtui/);
 await assert.rejects(()=>readCalendarBackup({...options(),readMembers:async()=>{throw Error('offline');}}),/offline/);
 let flushed=false;const o=options();o.pendingWrites=Promise.resolve().then(()=>{flushed=true;});const original=o.readDocument;o.readDocument=async ref=>{assert(flushed);return original(ref);};await readCalendarBackup(o);
 const html=fs.readFileSync('firebase-auth/index.html','utf8');
 assert(!/csvHandle|parseCsv|showOpenFilePicker|showSaveFilePicker|indexedDB|queueCsvWrite|csvActions|restoreCsvHandle/.test(html));
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1].replace(/^\s*import .*;\s*$/gm,''));
 // Run the actual calendar UI script with a small browser mock, then click backup.
 const elements=new Map();let downloaded=false,serverRead=false;
 const element=()=>({value:'',innerHTML:'',textContent:'',disabled:false,style:{},handlers:{},addEventListener(event,fn){this.handlers[event]=fn;},append(){},remove(){},click(){downloaded=true;},setAttribute(){},querySelectorAll(){return [];}});
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll(){return [];},createElement:element,body:{append(){}}};
 const browser={document,localStorage:{getItem:()=>JSON.stringify(payload),setItem(){}},Intl,Date,console,setTimeout:fn=>fn(),Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},window:{firebaseReadBackup:async()=>{serverRead=true;return snapshot;},makeCalendarBackupCsv,firebasePersistCalendar:async()=>{}}};
 vm.createContext(browser);const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];vm.runInContext(scripts.at(-1)[1],browser);
 await elements.get('backupData').handlers.click();assert(serverRead);assert(downloaded);assert(elements.get('backupStatus').textContent.includes('Käyttäjiä: 2'));
 downloaded=false;browser.window.firebaseReadBackup=async()=>{throw Object.assign(Error('offline'),{code:'unavailable'});};
 await elements.get('backupData').handlers.click();assert(!downloaded);assert(elements.get('backupStatus').textContent.includes('Varmuuskopiota ei luotu'));assert.equal(elements.get('backupData').disabled,false);
 console.log('PASS: legacy CSV round trip, all member roles/statuses, server-only reads, pending writes, permissions/offline/session failures, removed CSV features, UI startup and backup click.');
})().catch(e=>{console.error(e);process.exitCode=1;});
