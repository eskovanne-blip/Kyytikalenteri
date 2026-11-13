const assert = require('node:assert/strict');
require('../firebase-auth/calendar-backup.js');

const payload = {
  people: ['Ääni, "A"', 'B'],
  inactivePeople: ['B'],
  trips: {'2026-11-12': {to:[0], home:[1], notes:['Ääni, "A"\nmerkintä']}},
  tripPrices: [{date:'0001-01-01',price:1},{date:'2026-11-12',price:1}],
  payments: [{person:'B',month:'2026-11',amount:-1,outgoing:2}]
};
const csv = makeCalendarCsv(payload, 'L1.0.0');
const restored = parseCalendarBackupCsv(csv).payload;
assert.deepEqual(restored, {...payload,tripPrice:1});
const legacy = csv + '"calendar","legacy","metadata","{""id"":""legacy""}"\r\n' +
  '"member","user","owner","{""email"":""example@example.com""}"\r\n';
assert.deepEqual(parseCalendarBackupCsv(legacy).payload, restored);
assert.throws(() => parseCalendarBackupCsv(csv + '"unterminated'), /virheellinen/);
