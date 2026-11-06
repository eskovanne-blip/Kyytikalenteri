/* PDF layout uses millimetres on A4 portrait. No calendar data leaves the browser. */
(function(root) {
  'use strict';
  root.createCalendarPdf = function({title, calendarName, month, people, trips, summary, version, generatedAt=new Date()}) {
    const pdf = new root.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    const euro = n => Number(n).toLocaleString('fi-FI',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
    const clean = value => String(value ?? '').replace(/[\u0000-\u001f]/g,' ').replace(/\u2212/g,'-');
    const money = value => Number(value)<0 ? 'Maksettavaa '+euro(-value) : Number(value)>0 ? 'Hyvitystä '+euro(value) : euro(0);
    const green=[35,107,82], ink=[32,43,40], muted=[105,117,112];
    const left=12,width=186,bottom=281;
    let y=12;
    function text(value,x,top,size=8,bold=false,color=ink) {
      pdf.setFont('helvetica',bold?'bold':'normal'); pdf.setFontSize(size);pdf.setTextColor(...color);
      pdf.text(value,x,top,{baseline:'top',lineHeightFactor:1.15});
    }
    function heading(label) { if(y+14>bottom)newPage();text(label,left,y,10,true,green); y+=6; }
    function header(continued=false) {
      y=12; text('Koulukyydit',left,y,18,true);y+=9;
      text(clean(calendarName)+' | '+clean(title)+(continued?' | jatkuu':''),left,y,9);y+=6;
      if(!continued){text('Muodostettu '+new Intl.DateTimeFormat('fi-FI',{dateStyle:'short'}).format(generatedAt),left,y,7,false,muted);y+=8;}
    }
    function newPage(){pdf.addPage();header(true);}
    function tableLayout(rows,widths,font,padding) {
      pdf.setFont('helvetica','normal');pdf.setFontSize(font);
      return rows.map(row=>{const cells=row.map((cell,i)=>pdf.splitTextToSize(clean(cell),widths[i]-padding*2));return {cells,height:Math.max(...cells.map(c=>c.length))*font*.352778*1.15+padding*2};});
    }
    function table(rows,widths,font=8,padding=1.5) {
      const layout=tableLayout(rows,widths,font,padding);
      function draw(row,index,isHeader=false){
        pdf.setFillColor(...(isHeader?[232,243,237]:index%2?[247,249,248]:[255,255,255]));pdf.rect(left,y,width,row.height,'F');
        let x=left;row.cells.forEach((lines,i)=>{text(lines,x+padding,y+padding,font,isHeader,isHeader?green:ink);x+=widths[i];});
        y+=row.height;pdf.setDrawColor(220,229,224);pdf.setLineWidth(.15);pdf.line(left,y,left+width,y);
      }
      layout.forEach((row,index)=>{if(y+row.height>bottom){newPage();if(index>0)draw(layout[0],0,true);}draw(row,index,index===0);});
    }
    header();heading('Henkilökohtainen yhteenveto');
    const summaryRows=[['Henkilö','A / I / K','Maksettu','Siirtynyt','Saldo'],...summary.map(p=>[p.name,`${p.to} / ${p.home} / ${p.driverRides}`,euro(p.paid),euro(p.carry),money(p.total)])];
    table(summaryRows,[43,23,30,30,60],8,1.4);
    if(!summary.length){text('Ei kyytejä tai maksuja tässä kuussa.',left,y+2,8);y+=6;}
    y+=3;text('A = aamukyydit, I = iltakyydit, K = kuskina. Maksut ja siirtynyt saldo sisältyvät saldoon.',left,y,6.7,false,muted);y+=7;
    heading('Päiväkohtaiset merkinnät');
    const dayRows=Object.keys(trips).filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&date.startsWith(month+'-')).sort().flatMap(date=>{
      const entry=trips[date]||{},notes=Array.isArray(entry.notes)?entry.notes:[];
      if(!(entry.to?.length||entry.home?.length||notes.length))return [];
      const direction=way=>{
        const names=(Array.isArray(entry[way])?entry[way]:[]).map(i=>people[i]).filter(v=>v!==undefined);
        const relevant=notes.filter(n=>way==='to'?!n.endsWith(' ajoi illalla'):!n.endsWith(' ajoi aamulla'));
        return [...names,...relevant].join('; ')||'-';
      };
      return [[new Intl.DateTimeFormat('fi-FI',{weekday:'short',day:'numeric',month:'numeric'}).format(new Date(date+'T12:00:00')),direction('to'),direction('home')]];
    });
    const rows=[['Päivä','Aamu','Ilta'],...dayRows];
    let font=7.5,padding=1.1;
    while(font>6&&tableLayout(rows,[22,82,82],font,padding).reduce((s,r)=>s+r.height,0)>bottom-y-9){font-=.25;padding=Math.max(.6,padding-.1);}
    table(rows,[22,82,82],font,padding);
    if(!dayRows.length){text('Ei päiväkohtaisia merkintöjä tässä kuussa.',left,y+2,8);y+=6;}
    y+=3;if(y+7>bottom)newPage();
    text('Koko päivälle tallennetut merkinnät näkyvät sekä aamun että illan sarakkeessa.',left,y,6.5,false,muted);
    const pages=pdf.getNumberOfPages();
    for(let i=1;i<=pages;i++){pdf.setPage(i);pdf.setDrawColor(220,229,224);pdf.line(left,285,left+width,285);text('Koulukyydit | '+clean(version),left,288,7,false,muted);text(`${i} / ${pages}`,188,288,7,false,muted);}
    pdf.setProperties({title:'Koulukyydit - '+clean(title),subject:'Kuukausiyhteenveto ja päiväkohtaiset merkinnät',creator:'Koulukyydit '+version});
    return pdf;
  };
})(typeof window!=='undefined'?window:globalThis);
