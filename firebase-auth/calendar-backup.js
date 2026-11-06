(function(root) {
  'use strict';
  const timestamp = value => value?.toDate ? value.toDate().toISOString() : value ?? null;

  // Injected Firestore readers allow tests to verify server reads and access checks.
  root.readCalendarBackup = async function({user,calendarId,stateRef,pendingWrites,readDocument,readMembers,memberRef,calendarRef,isCurrent}) {
    if(!user?.emailVerified||!calendarId||!stateRef)throw new Error('Kirjaudu kalenteriin ennen varmuuskopiointia.');
    await pendingWrites;
    const own=await readDocument(memberRef);
    if(!own.exists()||!own.data().active||!['owner','admin'].includes(own.data().role))throw new Error('Varmuuskopiointi vaatii omistajan tai ylläpitäjän oikeudet.');
    const [state,calendar,members]=await Promise.all([readDocument(stateRef),readDocument(calendarRef),readMembers()]);
    if(!isCurrent())throw new Error('Kirjautuminen tai kalenteri vaihtui. Yritä uudelleen.');
    if(!state.exists()||!state.data().payload||!calendar.exists())throw new Error('Kalenterin tietoja ei löytynyt tietokannasta. Varmuuskopiota ei luotu.');
    return {payload:state.data().payload,calendar:{id:calendarId,name:calendar.data().name||'',ownerUid:calendar.data().ownerUid||''},members:members.docs.map(member=>{
      const value=member.data();
      return {uid:member.id,email:value.email||'',role:value.role||'',active:value.active===true,joinedAt:timestamp(value.joinedAt)};
    })};
  };

  root.makeCalendarBackupCsv = function({payload,calendar,members},version,exportedAt=new Date()) {
    if(!Array.isArray(payload.people)||!payload.trips||typeof payload.trips!=='object'||!Array.isArray(members))throw new Error('Kalenterin varmuuskopioitavat tiedot ovat puutteelliset.');
    const rows=[['type','date','direction','person'],['parameter','version','','1.1.22']];
    const prices=new Map();
    for(const rate of payload.tripPrices||[])prices.set(rate.date,Number(rate.price));
    if(!prices.has('0001-01-01'))prices.set('0001-01-01',Number(payload.tripPrice??1));
    for(const [date,price] of [...prices].sort(([a],[b])=>a.localeCompare(b)))rows.push(['parameter',date,'tripPrice',price.toFixed(2)]);
    const payments=new Map();
    for(const payment of payload.payments||[])payments.set(payment.person+'\u0000'+payment.month,payment);
    for(const payment of payments.values())rows.push(['saldo',payment.month,Number(payment.amount).toFixed(2),payment.person]);
    payload.people.forEach(name=>rows.push(['person','',(payload.inactivePeople||[]).includes(name)?'inactive':'',name]));
    for(const date of Object.keys(payload.trips).sort()){
      const entry=payload.trips[date];
      for(const way of ['to','home'])for(const i of entry[way]||[])if(payload.people[i]!==undefined)rows.push(['trip',date,way,payload.people[i]]);
      for(const note of entry.notes||[])rows.push(['note',date,'',note]);
    }
    // Extension records retain the original four-column CSV format.
    rows.push(['calendar',calendar.id,'metadata',JSON.stringify({...calendar,exportedAt:exportedAt.toISOString(),appVersion:version})]);
    for(const member of [...members].sort((a,b)=>a.uid.localeCompare(b.uid)))rows.push(['member',member.uid,member.role,JSON.stringify({email:member.email,active:member.active,joinedAt:member.joinedAt})]);
    const cell=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
    return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
  };
})(typeof window!=='undefined'?window:globalThis);
