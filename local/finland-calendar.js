(function(root) {
  'use strict';

  // Nationwide observances under the current Finnish calendar rules.
  const holidays=[
    [1,1,'Uudenvuodenpäivä'],[1,6,'Loppiainen'],[5,1,'Vappu',true],
    [12,6,'Itsenäisyyspäivä',true],[12,25,'Joulupäivä'],[12,26,'Tapaninpäivä']
  ];
  const flagDays=[
    [2,28,'Kalevalan päivä'],[6,4,'Puolustusvoimain lippujuhlan päivä']
  ];
  const customaryFlagDays=[
    [2,5,'Runebergin päivä'],[3,19,'Minna Canthin päivä'],
    [4,9,'Mikael Agricolan päivä'],[4,27,'Kansallinen veteraanipäivä'],
    [5,9,'Eurooppa-päivä'],[5,12,'Snellmanin päivä'],[7,6,'Eino Leinon päivä'],
    [10,1,'Miina Sillanpään päivä'],[10,10,'Aleksis Kiven päivä'],[10,24,'YK:n päivä'],
    [11,6,'Ruotsalaisuuden päivä'],[11,20,'Lapsen oikeuksien päivä'],[12,8,'Sibeliuksen päivä']
  ];
  // Confirmed non-recurring dates from the University Almanac Office.
  const extraFlagDays=[
    [2027,4,18,'Eduskuntavaalit']
  ];
  const date=(year,month,day)=>new Date(Date.UTC(year,month-1,day));
  const addDays=(value,days)=>date(value.getUTCFullYear(),value.getUTCMonth()+1,value.getUTCDate()+days);
  function weekdayOnOrAfter(value,weekday) {
    return addDays(value,(weekday-value.getUTCDay()+7)%7);
  }
  function easterSunday(year) {
    // Gregorian computus (Meeus/Jones/Butcher).
    const golden=year%19, century=Math.floor(year/100), withinCentury=year%100;
    const correction=Math.floor((century-Math.floor((century+8)/25)+1)/3);
    const moon=(19*golden+century-Math.floor(century/4)-correction+15)%30;
    const sunday=(32+2*(century%4)+2*Math.floor(withinCentury/4)-moon-withinCentury%4)%7;
    const adjustment=Math.floor((golden+11*moon+22*sunday)/451);
    const result=moon+sunday-7*adjustment+114;
    return date(year,Math.floor(result/31),result%31+1);
  }

  const years=new Map();
  function observancesForYear(year) {
    const result=new Map();
    function add(value,name,kind,flag=false) {
      const key=value.toISOString().slice(0,10);
      if(!result.has(key))result.set(key,[]);
      result.get(key).push({name,kind,flag});
    }
    for(const [month,day,name,flag] of holidays)add(date(year,month,day),name,'holiday',flag);
    for(const [month,day,name] of flagDays)add(date(year,month,day),name,'flag',true);
    for(const [month,day,name] of customaryFlagDays)add(date(year,month,day),name,'customary',true);
    for(const [eventYear,month,day,name] of extraFlagDays) {
      if(eventYear===year)add(date(year,month,day),name,'flag',true);
    }

    const easter=easterSunday(year);
    for(const [offset,name] of [[-2,'Pitkäperjantai'],[0,'Pääsiäispäivä'],[1,'Toinen pääsiäispäivä'],[39,'Helatorstai'],[49,'Helluntai']]) {
      add(addDays(easter,offset),name,'holiday');
    }
    const midsummer=weekdayOnOrAfter(date(year,6,20),6);
    add(addDays(midsummer,-1),'Juhannusaatto','eve');
    add(midsummer,'Juhannuspäivä','holiday',true);
    add(weekdayOnOrAfter(date(year,10,31),6),'Pyhäinpäivä','holiday');
    add(date(year,12,24),'Jouluaatto','eve');
    add(weekdayOnOrAfter(date(year,5,8),0),'Äitienpäivä','flag',true);
    add(weekdayOnOrAfter(date(year,5,15),0),'Kaatuneitten muistopäivä','customary',true);
    add(weekdayOnOrAfter(date(year,8,25),6),'Suomen luonnon päivä','customary',true);
    add(weekdayOnOrAfter(date(year,11,8),0),'Isänpäivä','flag',true);
    return result;
  }
  root.finnishCalendarObservances = function(day) {
    const year=Number(day.slice(0,4));
    if(!years.has(year))years.set(year,observancesForYear(year));
    return years.get(year).get(day)||[];
  };
})(typeof window!=='undefined'?window:globalThis);
