const assert=require('node:assert/strict');
require('../firebase-auth/finland-calendar.js');

const days=globalThis.finnishCalendarObservances;
const names=date=>days(date).map(day=>day.name);

for(const [date,name] of [
  ['2026-04-03','Pitkäperjantai'],['2026-04-06','Toinen pääsiäispäivä'],
  ['2026-05-14','Helatorstai'],['2026-05-24','Helluntai'],
  ['2026-06-19','Juhannusaatto'],['2026-06-20','Juhannuspäivä'],
  ['2026-10-31','Pyhäinpäivä'],['2026-11-08','Isänpäivä'],
  ['2027-04-18','Eduskuntavaalit'],['2027-06-26','Juhannuspäivä'],
  ['2027-08-28','Suomen luonnon päivä'],['2027-11-06','Pyhäinpäivä']
])assert(names(date).includes(name),date+' '+name);

assert.deepEqual(names('2027-05-09'),['Eurooppa-päivä','Äitienpäivä']);
assert.deepEqual(days('2026-12-06'),[{name:'Itsenäisyyspäivä',kind:'holiday',flag:true}]);
assert.deepEqual(days('2026-12-24'),[{name:'Jouluaatto',kind:'eve',flag:false}]);
assert.deepEqual(days('2026-06-22'),[]);
console.log('PASS: Finnish fixed and movable holidays, recurring and confirmed flag days, overlapping observances.');
