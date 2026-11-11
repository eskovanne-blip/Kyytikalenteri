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
assert(!csv.includes('password'));assert(csv.includes('"parameter","version","","F_2.0.16"'));
const duplicateRates={...payload,tripPrices:[
  {date:'0001-01-01',price:1},{date:'2026-01-01',price:1},
  {date:'2026-02-01',price:2},{date:'2026-03-01',price:1}
]};
const compactCsv=makeCalendarBackupCsv({...snapshot,payload:duplicateRates},'2.0.21');
assert.deepEqual(parseCalendarBackupCsv(compactCsv).payload.tripPrices,
  duplicateRates.tripPrices.filter(rate=>rate.date!=='2026-01-01'));
const restored=parseCalendarBackupCsv(csv);
for(const key of ['people','inactivePeople','payments','tripPrices','trips'])assert.deepEqual(restored.payload[key],payload[key],key+' restore round trip');
assert.equal(restored.calendar.id,'cal1');assert.equal(restored.calendar.appVersion,'F_2.0.16');assert.equal(restored.memberCount,2);
assert.throws(()=>parseCalendarBackupCsv('type,date,direction,person\ntrip,2026-02-30,to,Anna'),/virheellinen/);
assert.throws(()=>parseCalendarBackupCsv('type,date,direction,person\nsaldo,2026-11,NaN,Anna'),/virheellinen/);
assert.throws(()=>parseCalendarBackupCsv('type,date,direction,person\nperson,,,"unfinished'),/virheellinen/);
assert.throws(()=>parseCalendarBackupCsv('type,date,direction,person'),/virheellinen/);
assert.throws(()=>parseCalendarBackupCsv(csv+'"unexpected","","","x"\r\n'),/virheellinen/);
const minimal=parseCalendarBackupCsv('type,date,direction,person\nparameter,tripPrice,,1.50\ntrip,2026-11-02,to,Anna\nnote,2026-11-02,,Pekka ajoi');
assert.deepEqual(minimal.payload.people,['Anna']);assert.equal(minimal.payload.trips['2026-11-02'].notes[0],'Pekka ajoi aamulla');
const doc=data=>({exists:()=>true,data:()=>data});
function options(){return {user:{uid:'u1',emailVerified:true},calendarId:'cal1',stateRef:'state',memberRef:'own',calendarRef:'calendar',pendingWrites:Promise.resolve(),readDocument:async ref=>doc(ref==='own'?member:ref==='state'?{payload}:snapshot.calendar),readMembers:async()=>({docs:[{id:member.uid,data:()=>({...member,joinedAt:{toDate:()=>new Date(member.joinedAt)},inviteCode:'DO-NOT-EXPORT'})}]}),isCurrent:()=>true};}
(async()=>{
 const data=await readCalendarBackup(options());assert.deepEqual(data.members,[member]);assert(!JSON.stringify(data).includes('DO-NOT-EXPORT'));
 const memberOptions=options(),memberRead=memberOptions.readDocument;let memberListRead=false;
 memberOptions.readDocument=async ref=>ref==='own'?doc({...member,role:'member'}):memberRead(ref);
 memberOptions.readMembers=async()=>{memberListRead=true;throw Error('Member must not read private list');};
 const memberBackup=await readCalendarBackup(memberOptions);assert.equal(memberBackup.membersComplete,false);assert.equal(memberBackup.members.length,1);assert.equal(memberBackup.calendar.memberScope,'self');assert.equal(memberListRead,false);
 await assert.rejects(()=>readCalendarBackup({...options(),readDocument:async()=>doc({...member,active:false})}),/aktiivisen/);
 await assert.rejects(()=>readCalendarBackup({...options(),user:null}),/Kirjaudu/);
 await assert.rejects(()=>readCalendarBackup({...options(),isCurrent:()=>false}),/vaihtui/);
 await assert.rejects(()=>readCalendarBackup({...options(),readMembers:async()=>{throw Error('offline');}}),/offline/);
 const writes=[];
 const restoreOptions={payload:restored.payload,expected:{...snapshot,userUid:'u1'},user:{uid:'u1',emailVerified:true},calendarId:'cal1',stateRef:'state',memberRef:'own',pendingWrites:Promise.resolve(),isCurrent:()=>true,writeMetadata:()=>({updatedAt:'server-time',updatedBy:'u1'}),executeTransaction:async callback=>callback({get:async ref=>doc(ref==='own'?member:{payload}),update:(...args)=>writes.push(args)})};
 await restoreCalendarBackup(restoreOptions);assert.equal(writes.length,1);assert.equal(writes[0][0],'state');assert.deepEqual(writes[0][1].payload,restored.payload);
 writes.length=0;
 await assert.rejects(()=>restoreCalendarBackup({...restoreOptions,expected:{...restoreOptions.expected,payload:{...payload,people:[]}}}),/uusia muutoksia/);assert.equal(writes.length,0);
 await assert.rejects(()=>restoreCalendarBackup({...restoreOptions,isCurrent:()=>false}),/vaihtui/);assert.equal(writes.length,0);
 await assert.rejects(()=>restoreCalendarBackup({...restoreOptions,executeTransaction:async callback=>callback({get:async()=>doc({...member,role:'member'}),update:()=>writes.push('forbidden')})}),/ylläpitäjän/);assert.equal(writes.length,0);
 await assert.rejects(()=>restoreCalendarBackup({...restoreOptions,executeTransaction:async()=>{throw Error('offline');}}),/offline/);assert.equal(writes.length,0);
 let flushed=false;const o=options();o.pendingWrites=Promise.resolve().then(()=>{flushed=true;});const original=o.readDocument;o.readDocument=async ref=>{assert(flushed);return original(ref);};await readCalendarBackup(o);
 const html=fs.readFileSync('firebase-auth/index.html','utf8');
 assert(!/csvHandle|parseCsv|showOpenFilePicker|showSaveFilePicker|indexedDB|queueCsvWrite|csvActions|restoreCsvHandle/.test(html));
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1].replace(/^\s*import .*;\s*$/gm,''));
 // Run the actual calendar UI script with a small browser mock, then click backup.
 const elements=new Map();let downloaded=false,serverRead=false;
 const element=()=>({value:'',innerHTML:'',textContent:'',disabled:false,style:{},handlers:{},addEventListener(event,fn){this.handlers[event]=fn;},append(){},remove(){},click(){downloaded=true;},setAttribute(){},focus(){},querySelectorAll(){return [];}});
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll(){return [];},createElement:element,body:{append(){}},addEventListener(){}};
 let recorded=0;
 const browser={document,localStorage:{getItem:()=>JSON.stringify(payload),setItem(){}},Intl,Date,console,setInterval(){},setTimeout:fn=>fn(),Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},window:{sessionStorage:{getItem(){},setItem(){}},createBackupReminder,firebaseRecordBackup:async()=>{assert(downloaded,'Timestamp must follow CSV download');recorded++;},firebaseReadBackup:async()=>{serverRead=true;return snapshot;},makeCalendarBackupCsv,firebasePersistCalendar:async()=>{}}};
 vm.createContext(browser);const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];vm.runInContext(scripts.at(-1)[1],browser);
 const latestBackup={calendarId:'cal1',userUid:'u1',lastBackupAt:new Date().toISOString()};
 browser.window.updateBackupReminder({...latestBackup,lastBackupByEmail:'tekijä@example.com',lastBackupVersion:'2.0.19'});
 assert.match(elements.get('lastBackupInfo').textContent,/Viimeisin varmuuskopio: .* · Tekijä: tekijä@example.com · Versio: 2\.0\.19/);
 browser.window.updateBackupReminder(latestBackup);
 assert.match(elements.get('lastBackupInfo').textContent,/Tekijä: ei tiedossa/);
 await elements.get('backupData').handlers.click();assert(serverRead);assert(downloaded);assert.equal(recorded,1);assert(elements.get('backupStatus').textContent.includes('Jäsenyyksiä: 2'));
 downloaded=false;browser.window.firebaseReadBackup=async()=>{throw Object.assign(Error('offline'),{code:'unavailable'});};
 await elements.get('backupData').handlers.click();assert(!downloaded);assert.equal(recorded,1);assert(elements.get('backupStatus').textContent.includes('Varmuuskopiota ei luotu'));assert.equal(elements.get('backupData').disabled,false);
 let restoreCalls=0;browser.window.parseCalendarBackupCsv=parseCalendarBackupCsv;browser.window.firebaseReadBackup=async()=>({...snapshot,userUid:'u1'});
 browser.window.firebaseRestoreCalendar=async(p,expected)=>{assert.equal(expected.userUid,'u1');assert.deepEqual(p,restored.payload);restoreCalls++;};
 let confirmation='';browser.window.confirm=question=>{confirmation=question;return false;};
 const fileInput={files:[{name:'backup.csv',size:csv.length,text:async()=>csv}],value:'backup.csv'};
 await elements.get('restoreBackupFile').handlers.change({target:fileInput});assert.equal(restoreCalls,0);assert(confirmation.includes('korvataan'));assert(confirmation.includes('Käyttäjätunnukset ja käyttöoikeudet säilyvät'));assert(elements.get('backupStatus').textContent.includes('peruutettu'));
 browser.window.confirm=()=>true;await elements.get('restoreBackupFile').handlers.change({target:fileInput});assert.equal(restoreCalls,1);assert(elements.get('backupStatus').textContent.includes('palautettu'));
 fileInput.files[0].text=async()=> 'invalid';await elements.get('restoreBackupFile').handlers.change({target:fileInput});assert.equal(restoreCalls,1);assert(elements.get('backupStatus').textContent.includes('virheellinen'));
 // Exercise the real payment UI in both directions, including cancellation and removal.
 const now=new Date(), month=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
 let ledger={...payload,people:['Anna','Väinö'],inactivePeople:[],tripPrice:5,
   tripPrices:[{date:'0001-01-01',price:5}],
   payments:[],
   trips:{[month+'-'+String(now.getDate()).padStart(2,'0')]:{to:[0],home:[],notes:['Väinö ajoi aamulla']}}};
 browser.window.applyFirebaseCalendar(ledger);
 const get=id=>elements.get(id);
 get('paymentPanel').hidden=true;
 get('paymentsButton').handlers.click();
 assert.equal((get('paymentMonth').innerHTML.match(/<option/g)||[]).length,2);
 const previous=new Date(now.getFullYear(),now.getMonth()-1,1);
 assert.equal(get('paymentMonth').value,previous.getFullYear()+'-'+String(previous.getMonth()+1).padStart(2,'0'));
 get('paymentMonth').value=month;
 get('paymentMonth').handlers.change();
 assert.match(get('paymentBalances').innerHTML,/[−-]5,00/);
 assert.match(get('paymentBalances').innerHTML,/5,00/);
 const togglePassenger=checked=>get('detail').handlers.change({target:{
   closest:()=>({checked,dataset:{way:'to',person:'0'}})
 }});
 togglePassenger(false);
 assert.doesNotMatch(get('monthReport').innerHTML.split('<tfoot>')[0],/[−-]5,00/);
 assert.match(get('monthReport').innerHTML, /<tfoot>.*Oma saldo \(jos ylläolevat on suoritettu\):<\/th><td[^>]*>[−-]5,00€<\/td>/);
 assert.doesNotMatch(get('paymentBalances').innerHTML,/[−-]5,00/);
 togglePassenger(true);
 assert.match(get('monthReport').innerHTML.split('<tfoot>')[0],/[−-]5,00/);
 assert.match(get('paymentBalances').innerHTML,/[−-]5,00/);
 let writesToLedger=0;
 browser.window.firebaseRecordPayment=async change=>{
   const payments=change(ledger);
   assert.throws(()=>change({...ledger,payments}),/Saldo tai maksumerkintä muuttui/);
   ledger={...ledger,payments};
   writesToLedger++;
   browser.window.applyFirebaseCalendar(ledger);
 };
 const choose=index=>get('paymentBalances').handlers.click({target:{closest:()=>({dataset:{paymentPerson:String(index)}})}});
 const submit=()=>get('paymentEditor').handlers.submit({preventDefault(){}});
 await choose(0);
 assert.match(get('paymentQuestion').textContent,/Anna/);
 assert.equal(get('paymentAmount').value,'5.00');
 get('cancelPayment').handlers.click();
 assert.equal(writesToLedger,0);
 await choose(0);
 get('paymentAmount').value='3.50';
 await submit();
 await choose(1);
 assert.match(get('paymentQuestion').textContent,/maksetuksi henkilölle Väinö/);
 assert.equal(get('paymentAmount').value,'5.00');
 await submit();
 assert.equal(writesToLedger,2);
 assert.equal(ledger.payments.find(p=>p.person==='Anna').amount,3.5);
 assert.equal(ledger.payments.find(p=>p.person==='Väinö').amount,-5);
 assert(get('monthReport').innerHTML.split('<tfoot>')[0].includes('5,00 €*'));
 assert.match(get('paymentBalances').innerHTML,/>Suoritus<.*>Uusi saldo</);
 assert.match(get('paymentBalances').innerHTML,/class="balance-nonnegative">3,50 €/);
 assert.match(get('paymentBalances').innerHTML,/payment-value balance-nonnegative">0,00 €/);
 assert.match(get('paymentBalances').innerHTML,/payment-value balance-negative">[−-]1,50 €/);
 await choose(0);
 assert.equal(get('paymentAmount').value,'1.50');
 assert.equal(get('confirmPayment').textContent,'Täydennä osasuoritusta');
 assert.equal(get('removePayment').hidden,false);
 browser.window.confirm=question=>{assert.match(question,/Poistetaanko henkilön Anna maksumerkintä.*alkuperäinen saldo/);return false;};
 await get('removePayment').handlers.click();
 assert.equal(writesToLedger,2);
 get('paymentAmount').value='0.50';
 await submit();
 assert.equal(ledger.payments.find(p=>p.person==='Anna').amount,4);
 await choose(0);
 assert.equal(get('paymentAmount').value,'1.00');
 browser.window.confirm=()=>true;
 await get('removePayment').handlers.click();
 await choose(1);
 assert.equal(writesToLedger,5);
 assert.equal(ledger.payments.length,0);
 assert.match(get('paymentBalances').innerHTML,/[−-]5,00/);
 assert.doesNotMatch(get('paymentBalances').innerHTML,/class="balance-nonnegative">[0-9]/);
 const earlier=new Date(now.getFullYear(),now.getMonth()-2,1);
 const earlierMonth=earlier.getFullYear()+'-'+String(earlier.getMonth()+1).padStart(2,'0');
 browser.window.applyFirebaseCalendar({...ledger,
   trips:{[earlierMonth+'-01']:{to:[0],home:[],notes:['Väinö ajoi aamulla']}},
   payments:[{person:'Anna',month:earlierMonth,amount:2},{person:'Väinö',month:earlierMonth,amount:-2}]
 });
 const summary=get('monthReport').innerHTML.split('<tfoot>')[0];
 assert.match(summary,/<td>[−-]3,00€<\/td><td class="balance-negative">[−-]3,00€/);
 assert.match(summary,/<td>3,00€<\/td><td class="balance-nonnegative">3,00€/);
 assert.match(get('paymentBalances').innerHTML,/balance-negative">[−-]3,00 €/);
 assert.match(get('paymentBalances').innerHTML,/payment-value-positive">3,00 €/);
 const mixed={...ledger,payments:[{person:'Väinö',month,amount:-5,outgoing:7}]};
 const mixedCsv=makeCalendarBackupCsv({...snapshot,payload:mixed},'F_2.0.29');
 assert.deepEqual(parseCalendarBackupCsv(mixedCsv).payload.payments,mixed.payments);
 const todayKey=month+'-'+String(now.getDate()).padStart(2,'0');
 browser.window.applyFirebaseCalendar({...ledger,payments:[],trips:{
   [todayKey]:{to:[],home:[],notes:['Anna ajoi aamulla','Väinö ajoi aamulla','Väinö ajoi illalla']}
 }});
 assert.doesNotMatch(get('detail').innerHTML,/Anna ajoi aamulla/);
 assert.match(get('detail').innerHTML,/Väinö ajoi aamulla/);
 get('detail').handlers.change({target:{id:'otherRiderSelect',value:'Anna'}});
 assert.match(get('detail').innerHTML,/Anna ajoi aamulla/);
 assert.doesNotMatch(get('detail').innerHTML,/Väinö ajoi aamulla/);
 assert.match(get('detail').innerHTML,/Väinö ajoi illalla/);
 assert.equal((get('monthReport').innerHTML.split('<tfoot>')[0].match(/>5,00€</g)||[]).length,2);
 const upcoming=new Date(now.getFullYear(),now.getMonth()+1,1);
 const nextKey=upcoming.getFullYear()+'-'+String(upcoming.getMonth()+1).padStart(2,'0')+'-01';
 browser.window.applyFirebaseCalendar({...ledger,payments:[],tripPrice:1,
   tripPrices:[{date:'0001-01-01',price:1}],
   trips:{[todayKey]:{to:[],home:[],notes:['Anna ajoi aamulla']},
     [nextKey]:{to:[],home:[],notes:['Väinö ajoi aamulla']}}
 });
 assert.equal(get('tripPriceDate').value,nextKey);
 const setTripPrice=value=>{
   document.getElementById('tripPrice').value=value;
   get('tripPriceForm').handlers.submit({preventDefault(){}});
 };
 setTripPrice('2.00');
 assert.match(get('tripPriceInfo').textContent,/Nykyinen hinta: 1,00 €/);
 assert.match(get('scheduledTripPrices').innerHTML,/Ajastettu: 2,00 €/);
 assert.match(get('monthReport').innerHTML.split('<tfoot>')[0],/>1,00€<\/td>/);
 get('next').handlers.click();
 assert.match(get('monthReport').innerHTML.split('<tfoot>')[0],/>2,00€<\/td>/);
 setTripPrice('1.00');
 assert.match(get('scheduledTripPrices').innerHTML,/Ajastettu: 1,00 €/);
 assert.doesNotMatch(get('monthReport').innerHTML.split('<tfoot>')[0],/>2,00€<\/td>/);
 setTripPrice('2.00');
 const removeScheduledPrice=()=>get('scheduledTripPrices').handlers.click({
   target:{closest:()=>({dataset:{removeTripPrice:nextKey}})}
 });
 browser.window.confirm=()=>false;
 removeScheduledPrice();
 assert.match(get('scheduledTripPrices').innerHTML,/Ajastettu: 2,00 €/);
 browser.window.confirm=()=>true;
 removeScheduledPrice();
 assert.equal(get('scheduledTripPrices').innerHTML,'');
 assert.match(get('tripPriceInfo').textContent,/Nykyinen hinta: 1,00 €/);
 assert.doesNotMatch(get('monthReport').innerHTML.split('<tfoot>')[0],/>2,00€<\/td>/);
 console.log('PASS: backup/restore round trips, malformed CSV rejection, legacy format, admin and session checks, concurrent edits, offline failures, UI confirmation cancel and restore, no user-account writes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
