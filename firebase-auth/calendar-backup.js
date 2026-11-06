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
    return {userUid:user.uid,payload:state.data().payload,calendar:{id:calendarId,name:calendar.data().name||'',ownerUid:calendar.data().ownerUid||''},members:members.docs.map(member=>{
      const value=member.data();
      return {uid:member.id,email:value.email||'',role:value.role||'',active:value.active===true,joinedAt:timestamp(value.joinedAt)};
    })};
  };

  root.parseCalendarBackupCsv = function(input) {
    const text=String(input).replace(/^\uFEFF/,''),rows=[];
    let row=[],cell='',quoted=false,afterQuote=false;
    const fail=()=>{throw new Error('CSV-varmuuskopion rakenne tai tietue on virheellinen. Palautusta ei tehty.');};
    const endCell=()=>{row.push(cell);cell='';afterQuote=false;};
    const endRow=()=>{endCell();if(row.some(value=>value!==''))rows.push(row);row=[];};
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;afterQuote=true;}}else cell+=c;continue;}
      if(c===','){endCell();continue;}
      if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;endRow();continue;}
      if(afterQuote)fail();
      if(c==='"'){if(cell!=='')fail();quoted=true;}else cell+=c;
    }
    if(quoted)fail();if(cell!==''||row.length||afterQuote)endRow();
    if(!rows.length||rows[0].join(',')!=='type,date,direction,person'||rows.some(r=>r.length!==4))fail();
    const payload={people:[],inactivePeople:[],payments:[],tripPrices:[],tripPrice:1,trips:{}};
    const prices=new Map(),payments=new Map();let calendar=null,memberCount=0,contentRows=0;
    const number=value=>{if(!value.trim()||!Number.isFinite(Number(value)))fail();return Number(value);};
    const validMonth=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value);
    const validDate=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===value;};
    const person=name=>{if(!name.trim())fail();if(!payload.people.includes(name))payload.people.push(name);return payload.people.indexOf(name);};
    const json=value=>{try{const parsed=JSON.parse(value);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))fail();return parsed;}catch{fail();}};
    for(const [type,,direction,name] of rows.slice(1))if(type==='person'){
      if(direction!==''&&direction!=='inactive')fail();person(name);if(direction==='inactive'&&!payload.inactivePeople.includes(name))payload.inactivePeople.push(name);
    }
    for(const [type,date,direction,value] of rows.slice(1)){
      if(type==='parameter'){
        if(date==='version'){if(!value)fail();continue;}
        if(direction==='tripPrice'&&validDate(date)){const price=number(value);if(price<0)fail();prices.set(date,price);contentRows++;}
        else if(date==='tripPrice'){const price=number(value);if(price<0)fail();payload.tripPrice=price;contentRows++;}
        else fail();
      }else if(type==='person'){contentRows++;}
      else if(type==='saldo'){
        if(!validMonth(date))fail();person(value);payments.set(value+'\u0000'+date,{person:value,month:date,amount:number(direction)});contentRows++;
      }else if(type==='trip'||type==='note'){
        if(!validDate(date)||!value.trim()||(type==='trip'&&!['to','home'].includes(direction)))fail();
        const entry=payload.trips[date]||(payload.trips[date]={to:[],home:[],notes:[]});
        if(type==='trip'){const index=person(value);if(!entry[direction].includes(index))entry[direction].push(index);}
        else {
          if(direction!=='')fail();
          const note=value==='Poissa'?'Poissa koulusta/ei kuljettu':value.endsWith(' ajoi (ilta)')?value.slice(0,-12)+' ajoi illalla':value.endsWith(' ajoi')?value.slice(0,-5)+' ajoi aamulla':value;
          if(!entry.notes.includes(note))entry.notes.push(note);
        }contentRows++;
      }else if(type==='calendar'){
        if(calendar||!date||direction!=='metadata')fail();calendar=json(value);if(calendar.id!==date)fail();
      }else if(type==='member'){if(!date||!['owner','admin','member'].includes(direction))fail();json(value);memberCount++;}
      else fail();
    }
    if(!contentRows)fail();
    if(!prices.has('0001-01-01'))prices.set('0001-01-01',payload.tripPrice);
    payload.tripPrices=[...prices].sort(([a],[b])=>a.localeCompare(b)).map(([date,price])=>({date,price}));
    const today=new Date().toLocaleDateString('sv-SE');
    for(const rate of payload.tripPrices)if(rate.date<=today)payload.tripPrice=rate.price;
    payload.payments=[...payments.values()];
    return {payload,calendar,memberCount};
  };

  root.restoreCalendarBackup = async function({payload,expected,user,calendarId,stateRef,memberRef,pendingWrites,executeTransaction,writeMetadata,isCurrent}) {
    if(!user?.emailVerified||expected.userUid!==user.uid||expected.calendar.id!==calendarId||!isCurrent())throw new Error('Kirjautuminen tai kalenteri vaihtui. Palautusta ei tehty.');
    await pendingWrites;
    const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
    await executeTransaction(async tx=>{
      const own=await tx.get(memberRef),state=await tx.get(stateRef);
      if(!isCurrent())throw new Error('Kirjautuminen tai kalenteri vaihtui. Palautusta ei tehty.');
      if(!own.exists()||!own.data().active||!['owner','admin'].includes(own.data().role))throw new Error('Palautus vaatii omistajan tai ylläpitäjän oikeudet.');
      if(!state.exists()||canonical(state.data().payload)!==canonical(expected.payload))throw new Error('Kalenteriin tuli uusia muutoksia vahvistuksen aikana. Aloita palautus uudelleen.');
      // Update only the calendar state, never Auth accounts or membership documents.
      tx.update(stateRef,{payload,...writeMetadata()});
    });
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
