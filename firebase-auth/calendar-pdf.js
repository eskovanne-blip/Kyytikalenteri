/* PDF layout uses millimetres on A4 portrait. No calendar data leaves the browser. */
(function(root) {
  'use strict';
  root.createCalendarPdf = function({month, people, trips, summary, version, generatedAt=new Date(), prepareDocument, compact=false}) {
    const pdf = new root.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    if(prepareDocument)prepareDocument(pdf);
    const euro = n => Number(n).toLocaleString('fi-FI',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
    const clean = value => String(value ?? '').replace(/[\u0000-\u001f]/g,' ').replace(/\u2212/g,'-');
    const money = value => Number(value)<0 ? euro(-value)+' Maksettavaa' : Number(value)>0 ? euro(value)+' Hyvitystä' : euro(0);
    const monthLabel=new Intl.DateTimeFormat('fi-FI',{month:'long',year:'numeric'}).format(new Date(month+'-01T12:00:00'));
    const reportTitle=monthLabel[0].toLocaleUpperCase('fi-FI')+monthLabel.slice(1);
    const reportDate=new Intl.DateTimeFormat('fi-FI',{dateStyle:'short'}).format(generatedAt);
    const reportSubtitle='Kyytikalenteri '+clean(version)+' | Ajopäivä '+reportDate;
    const green=[35,107,82], ink=[32,43,40], muted=[105,117,112];
    const left=compact?6:12,width=compact?144:186,bottom=281;
    let y=12;
    function text(value,x,top,size=8,bold=false,color=ink) {
      pdf.setFont('helvetica',bold?'bold':'normal'); pdf.setFontSize(size);pdf.setTextColor(...color);
      pdf.text(value,x,top,{baseline:'top',lineHeightFactor:1.15});
    }
    function heading(label) { if(y+14>bottom)newPage();text(label,left,y,10,true,green); y+=6; }
    function header(continued=false) {
      y=12; text(reportTitle,left,y,18,true);y+=9;
      text(reportSubtitle+(continued?' | jatkuu':''),left,y,9,false,muted);y+=8;
    }
    function newPage(){pdf.addPage();header(true);}
    function tableLayout(rows,widths,font,padding) {
      pdf.setFontSize(font);
      return rows.map((row,rowIndex)=>{
        const cells=row.map((cell,i)=>{
          const runs=Array.isArray(cell)?cell:[{text:cell,bold:false}],maxWidth=widths[i]-padding*2;
          const lines=[[]];let used=0;
          for(const run of runs){
            const bold=rowIndex===0||run.bold;
            pdf.setFont('helvetica',bold?'bold':'normal');
            for(let word of clean(run.text).match(/\S+\s*|\s+/g)||[]){
              if(used&&used+pdf.getTextWidth(word.trimEnd())>maxWidth){lines.push([]);used=0;word=word.trimStart();}
              // Split exceptionally long names too, without dropping characters.
              for(const char of word){
                const charWidth=pdf.getTextWidth(char);
                if(used&&used+charWidth>maxWidth){lines.push([]);used=0;}
                if(!used&&/\s/.test(char))continue;
                const line=lines[lines.length-1],last=line[line.length-1];
                if(last&&last.bold===bold)last.text+=char;else line.push({text:char,bold});
                used+=charWidth;
              }
            }
          }
          return lines;
        });
        return {cells,height:Math.max(...cells.map(c=>c.length))*font*.352778*1.15+padding*2};
      });
    }
    function table(rows,widths,font=8,padding=1.5) {
      const layout=tableLayout(rows,widths,font,padding);
      function draw(row,index,isHeader=false){
        pdf.setFillColor(...(isHeader?[232,243,237]:index%2?[247,249,248]:[255,255,255]));pdf.rect(left,y,width,row.height,'F');
        let x=left;row.cells.forEach((lines,i)=>{
          lines.forEach((runs,lineIndex)=>{let runX=x+padding;runs.forEach(run=>{
            text(run.text,runX,y+padding+lineIndex*font*.352778*1.15,font,run.bold,isHeader?green:ink);
            runX+=pdf.getTextWidth(run.text);
          });});x+=widths[i];
        });
        y+=row.height;pdf.setDrawColor(220,229,224);pdf.setLineWidth(.15);pdf.line(left,y,left+width,y);
      }
      layout.forEach((row,index)=>{if(y+row.height>bottom){newPage();if(index>0)draw(layout[0],0,true);}draw(row,index,index===0);});
    }
    header();heading('Maksutiedot');
    const summaryRows=[['Henkilö','Saldo','A / I / K','Suoritus','Siirto'],...summary.map(p=>[p.name,money(p.total),`${p.to} / ${p.home} / ${p.driverRides}`,p.paymentLabel??euro(p.paid),euro(p.carry)])];
    table(summaryRows,compact?[37,43,20,22,22]:[43,60,23,30,30],8,compact?1:1.4);
    if(!summary.length){text('Ei kyytejä tai maksuja tässä kuussa.',left,y+2,8);y+=6;}
    y+=3;text('A = aamukyydit, I = iltakyydit, K = kuskina. * tarkoittaa, että maksoit henkilölle.',left,y,6.7,false,muted);y+=7;
    heading('Päiväkohtaiset merkinnät');
    const dayRows=Object.keys(trips).filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&date.startsWith(month+'-')).sort().flatMap(date=>{
      const entry=trips[date]||{},notes=Array.isArray(entry.notes)?entry.notes:[];
      if(!(entry.to?.length||entry.home?.length||notes.length))return [];
      const direction=way=>{
        const names=(Array.isArray(entry[way])?entry[way]:[]).map(i=>people[i]).filter(v=>v!==undefined);
        const relevant=notes.filter(note=>{
          if(way==='to')return !note.endsWith(' ajoi illalla')&&note!=='Oma kyyti iltapäivällä'&&note!=='Bussi iltapäivällä';
          return !note.endsWith(' ajoi aamulla')&&note!=='Oma kyyti aamulla'&&note!=='Bussi aamulla'&&note!=='Loma'&&note!=='Poissa / ei kuljettu'&&note!=='Poissa';
        });
        const runs=[...names.map(name=>({text:name,bold:false})),...relevant.map(note=>({text:note==='Oma kyyti aamulla'||note==='Oma kyyti iltapäivällä'?'Oma kyyti':note==='Bussi aamulla'||note==='Bussi iltapäivällä'?'Bussi':note,bold:true}))];
        return runs.length?runs.flatMap((run,i)=>i?[{text:'; ',bold:false},run]:[run]):[{text:'-',bold:false}];
      };
      return [[new Intl.DateTimeFormat('fi-FI',{weekday:'short',day:'numeric',month:'numeric'}).format(new Date(date+'T12:00:00')),direction('to'),direction('home')]];
    });
    const rows=[['Päivä','Aamu','Ilta'],...dayRows];
    let font=7.5,padding=1.1;
    const dayWidths=compact?[18,63,63]:[22,82,82];
    while(font>6&&tableLayout(rows,dayWidths,font,padding).reduce((s,r)=>s+r.height,0)>bottom-y-9){font-=.25;padding=Math.max(.6,padding-.1);}
    table(rows,dayWidths,font,padding);
    if(!dayRows.length){text('Ei päiväkohtaisia merkintöjä tässä kuussa.',left,y+2,8);y+=6;}
    y+=3;if(y+7>bottom)newPage();
    text('Loma ja poissaolo näkyvät kerran, aamun sarakkeessa.',left,y,6.5,false,muted);
    const pages=pdf.getNumberOfPages();
    for(let i=1;i<=pages;i++){pdf.setPage(i);pdf.setDrawColor(220,229,224);pdf.line(left,285,left+width,285);text('Kyytikalenteri | '+clean(version),left,288,7,false,muted);text(`${i} / ${pages}`,left+width-10,288,7,false,muted);}
    pdf.setProperties({title:reportTitle,subject:'Kuukausiyhteenveto ja päiväkohtaiset merkinnät',creator:'Kyytikalenteri '+version});
    return pdf;
  };

  // Mirror the PDF drawing commands; the PDF still determines wrapping and pagination.
  root.createCalendarImages = async function(options) {
    const pages=[],scale=8;
    let context,fontSize=8,bold=false,textColor='rgb(32,43,40)',fillColor='#fff',drawColor='#ddd',lineWidth=.15;
    function page() {
      const canvas=document.createElement('canvas');canvas.width=156*scale;canvas.height=297*scale;
      context=canvas.getContext('2d');if(!context)throw new Error('Kuvan luonti ei onnistu tässä selaimessa.');
      context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.scale(scale,scale);pages.push(canvas);
    }
    root.createCalendarPdf({...options,compact:true,prepareDocument(pdf){
      page();
      const mirror=(name,draw)=>{const original=pdf[name];pdf[name]=function(...args){const result=original.apply(this,args);draw(...args);return result;};};
      mirror('addPage',page);
      mirror('setPage',number=>{context=pages[number-1].getContext('2d');});
      mirror('setFont',(_family,style)=>{bold=style==='bold';});
      mirror('setFontSize',size=>{fontSize=size;});
      mirror('setTextColor',(...rgb)=>{textColor=`rgb(${rgb.join(',')})`;});
      mirror('setFillColor',(...rgb)=>{fillColor=`rgb(${rgb.join(',')})`;});
      mirror('setDrawColor',(...rgb)=>{drawColor=`rgb(${rgb.join(',')})`;});
      mirror('setLineWidth',width=>{lineWidth=width;});
      mirror('text',(value,x,y)=>{
        context.font=`${bold?'bold':'normal'} ${fontSize*25.4/72}px Arial, Helvetica, sans-serif`;
        context.textBaseline='top';context.fillStyle=textColor;context.fillText(value,x,y);
      });
      mirror('rect',(x,y,width,height)=>{context.fillStyle=fillColor;context.fillRect(x,y,width,height);});
      mirror('line',(x1,y1,x2,y2)=>{context.strokeStyle=drawColor;context.lineWidth=lineWidth;context.beginPath();context.moveTo(x1,y1);context.lineTo(x2,y2);context.stroke();});
    }});
    const files=[];
    for(let i=0;i<pages.length;i++){
      const canvas=pages[i];
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG-kuvan luonti epäonnistui.')),'image/png'));
      files.push(new File([blob],`Kyytikalenteri_${options.month}${pages.length>1?'_'+(i+1):''}.png`,{type:'image/png'}));
      canvas.width=canvas.height=0;
    }
    return files;
  };
})(typeof window!=='undefined'?window:globalThis);
