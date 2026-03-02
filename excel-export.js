/* Excel Export Module v2 — Styled with Colors & Arabic Days */
const ExcelExport = (() => {
  const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const PAY_AR = { Cash: 'نقد', Card: 'بطاقة', Transfer: 'تحويل', Transferred: 'تم التحويل' };

  const C = {
    hdrBg: '1B4332', hdrFg: 'FFFFFF',
    totBg: '2D6A4F', totFg: 'FFFFFF',
    stripe: 'F0F7F4', white: 'FFFFFF',
    brd: 'D5E8D4', accent: '40916C',
    txt: '1B1B1B',
    cashBg: 'D8F3DC', cardBg: 'D0E8FF', xferBg: 'FFF3CD', doneBg: 'E8DAEF',
  };

  const bdr = (c) => ({ top:{style:'thin',color:{rgb:c||C.brd}}, bottom:{style:'thin',color:{rgb:c||C.brd}}, left:{style:'thin',color:{rgb:c||C.brd}}, right:{style:'thin',color:{rgb:c||C.brd}} });

  const sHdr = { font:{bold:true,color:{rgb:C.hdrFg},sz:12}, fill:{fgColor:{rgb:C.hdrBg}}, alignment:{horizontal:'center',vertical:'center',wrapText:true}, border:bdr(C.hdrBg) };
  const sTot = { font:{bold:true,color:{rgb:C.totFg},sz:12}, fill:{fgColor:{rgb:C.totBg}}, alignment:{horizontal:'center',vertical:'center'}, border:bdr(C.totBg) };
  const sTotAmt = { ...sTot, numFmt:'#,##0.00' };

  const sCell = (s) => ({ font:{color:{rgb:C.txt},sz:11}, fill:{fgColor:{rgb:s?C.stripe:C.white}}, alignment:{vertical:'center'}, border:bdr() });
  const sCellC = (s) => ({ ...sCell(s), alignment:{horizontal:'center',vertical:'center'} });
  const sAmt = (s) => ({ font:{bold:true,color:{rgb:C.txt},sz:11}, fill:{fgColor:{rgb:s?C.stripe:C.white}}, numFmt:'#,##0.00', alignment:{horizontal:'center',vertical:'center'}, border:bdr() });
  const sPay = (p,s) => {
    const m = {Cash:C.cashBg,Card:C.cardBg,Transfer:C.xferBg,Transferred:C.doneBg};
    return { font:{bold:true,color:{rgb:C.txt},sz:10}, fill:{fgColor:{rgb:m[p]||(s?C.stripe:C.white)}}, alignment:{horizontal:'center',vertical:'center'}, border:bdr() };
  };
  const sPct = (s) => ({ ...sCellC(s), font:{bold:true,color:{rgb:C.accent},sz:11} });

  function dayDate(d) { return DAYS_AR[new Date(d).getDay()] + '  ' + d; }

  function autoFit(ws, data, mins) {
    const w = [];
    data.forEach(r => r.forEach((c, i) => { const l = (c != null ? String(c).length : 0) * 1.3 + 3; if (!w[i] || l > w[i]) w[i] = l; }));
    ws['!cols'] = w.map((v, i) => ({ wch: Math.max(v, mins?.[i] || 8) }));
  }

  // ===== FILTERED =====
  function exportFiltered(inv, suppTotals, total, fm, fy) {
    if (!inv.length) return false;
    const wb = XLSX.utils.book_new();

    // Sheet 1: Invoices
    const h1 = ['#', 'اليوم والتاريخ', 'المورد', 'المبلغ (ر.س)', 'طريقة الدفع', 'ملاحظة'];
    const d1 = [h1];
    inv.forEach((v, i) => d1.push([i+1, dayDate(v.date), v.supplierName, v.amount, PAY_AR[v.payment]||v.payment, v.note||'—']));
    d1.push(['', '', 'الإجمالي', total, '', inv.length+' فاتورة']);

    const ws1 = XLSX.utils.aoa_to_sheet(d1);
    autoFit(ws1, d1, [5,24,18,16,14,20]);
    ws1['!rows'] = [{hpt:30}];

    for (let c=0;c<h1.length;c++) { const a=XLSX.utils.encode_cell({r:0,c}); if(ws1[a]) ws1[a].s=sHdr; }
    for (let r=1;r<=inv.length;r++) { const s=r%2===0;
      for(let c=0;c<h1.length;c++) { const a=XLSX.utils.encode_cell({r,c}); if(!ws1[a]) continue;
        if(c===0) ws1[a].s=sCellC(s); else if(c===1) ws1[a].s=sCellC(s); else if(c===2) ws1[a].s=sCell(s);
        else if(c===3) ws1[a].s=sAmt(s); else if(c===4) ws1[a].s=sPay(inv[r-1].payment,s); else ws1[a].s=sCell(s);
      }
      ws1['!rows'][r] = {hpt:24};
    }
    const tr=inv.length+1;
    for(let c=0;c<h1.length;c++) { const a=XLSX.utils.encode_cell({r:tr,c}); if(!ws1[a]) ws1[a]={v:'',t:'s'}; ws1[a].s=c===3?sTotAmt:sTot; }
    ws1['!rows'][tr] = {hpt:28};
    XLSX.utils.book_append_sheet(wb, ws1, 'الفواتير');

    // Sheet 2: By Supplier
    if (suppTotals.length) {
      const h2 = ['المورد','الإجمالي (ر.س)','عدد الفواتير','النسبة'];
      const d2 = [h2];
      suppTotals.forEach(([_,d])=>d2.push([d.name,d.total,d.count,total>0?((d.total/total)*100).toFixed(1)+'%':'0%']));
      d2.push(['الإجمالي',total,inv.length,'100%']);
      const ws2=XLSX.utils.aoa_to_sheet(d2); autoFit(ws2,d2,[20,16,14,12]);
      ws2['!rows']=[{hpt:30}];
      for(let c=0;c<h2.length;c++){const a=XLSX.utils.encode_cell({r:0,c});if(ws2[a])ws2[a].s=sHdr;}
      for(let r=1;r<d2.length-1;r++){const s=r%2===0;
        for(let c=0;c<h2.length;c++){const a=XLSX.utils.encode_cell({r,c});if(!ws2[a])continue;
          if(c===1)ws2[a].s=sAmt(s);else if(c===3)ws2[a].s=sPct(s);else ws2[a].s=c===0?sCell(s):sCellC(s);}}
      const lr=d2.length-1;
      for(let c=0;c<h2.length;c++){const a=XLSX.utils.encode_cell({r:lr,c});if(!ws2[a])ws2[a]={v:'',t:'s'};ws2[a].s=c===1?sTotAmt:sTot;}
      XLSX.utils.book_append_sheet(wb,ws2,'حسب المورد');
    }

    // Sheet 3: By Payment
    const pm={};
    inv.forEach(v=>{if(!pm[v.payment])pm[v.payment]={t:0,c:0};pm[v.payment].t+=v.amount;pm[v.payment].c++;});
    const sorted=Object.entries(pm).sort((a,b)=>b[1].t-a[1].t);
    const h3=['طريقة الدفع','الإجمالي (ر.س)','عدد الفواتير'];
    const d3=[h3];
    sorted.forEach(([m,d])=>d3.push([PAY_AR[m]||m,d.t,d.c]));
    const ws3=XLSX.utils.aoa_to_sheet(d3); autoFit(ws3,d3,[16,16,14]);
    ws3['!rows']=[{hpt:30}];
    for(let c=0;c<h3.length;c++){const a=XLSX.utils.encode_cell({r:0,c});if(ws3[a])ws3[a].s=sHdr;}
    for(let r=1;r<d3.length;r++){const s=r%2===0;const pk=sorted[r-1]?.[0];
      for(let c=0;c<h3.length;c++){const a=XLSX.utils.encode_cell({r,c});if(!ws3[a])continue;
        if(c===0)ws3[a].s=sPay(pk,s);else if(c===1)ws3[a].s=sAmt(s);else ws3[a].s=sCellC(s);}}
    XLSX.utils.book_append_sheet(wb,ws3,'حسب الدفع');

    const ms=fm!=='all'?MONTHS_AR[parseInt(fm)]:'الكل';
    XLSX.writeFile(wb,`فواتير_${fy!=='all'?fy:'الكل'}_${ms}.xlsx`);
    return true;
  }

  // ===== EXPORT ALL =====
  function exportAll(suppliers, invoices) {
    if (!invoices.length && !suppliers.length) return false;
    const wb = XLSX.utils.book_new();
    const total = invoices.reduce((s,i)=>s+i.amount,0);

    // All Invoices
    const h1=['#','اليوم والتاريخ','المورد','المبلغ (ر.س)','طريقة الدفع','ملاحظة'];
    const d1=[h1];
    invoices.forEach((v,i)=>d1.push([i+1,dayDate(v.date),v.supplierName,v.amount,PAY_AR[v.payment]||v.payment,v.note||'—']));
    d1.push(['','','الإجمالي',total,'',invoices.length+' فاتورة']);
    const ws1=XLSX.utils.aoa_to_sheet(d1); autoFit(ws1,d1,[5,24,18,16,14,20]);
    ws1['!rows']=[{hpt:30}];
    for(let c=0;c<h1.length;c++){const a=XLSX.utils.encode_cell({r:0,c});if(ws1[a])ws1[a].s=sHdr;}
    for(let r=1;r<=invoices.length;r++){const s=r%2===0;
      for(let c=0;c<h1.length;c++){const a=XLSX.utils.encode_cell({r,c});if(!ws1[a])continue;
        if(c===0)ws1[a].s=sCellC(s);else if(c===1)ws1[a].s=sCellC(s);else if(c===2)ws1[a].s=sCell(s);
        else if(c===3)ws1[a].s=sAmt(s);else if(c===4)ws1[a].s=sPay(invoices[r-1].payment,s);else ws1[a].s=sCell(s);}
      ws1['!rows'][r]={hpt:24};}
    const tr=invoices.length+1;
    for(let c=0;c<h1.length;c++){const a=XLSX.utils.encode_cell({r:tr,c});if(!ws1[a])ws1[a]={v:'',t:'s'};ws1[a].s=c===3?sTotAmt:sTot;}
    ws1['!rows'][tr]={hpt:28};
    XLSX.utils.book_append_sheet(wb,ws1,'جميع الفواتير');

    // By Supplier
    const map={};
    invoices.forEach(v=>{if(!map[v.supplierId])map[v.supplierId]={name:v.supplierName,t:0,c:0};map[v.supplierId].t+=v.amount;map[v.supplierId].c++;});
    const st=Object.entries(map).sort((a,b)=>b[1].t-a[1].t);
    if(st.length){
      const h2=['المورد','الإجمالي (ر.س)','عدد الفواتير','النسبة'];
      const d2=[h2];
      st.forEach(([_,d])=>d2.push([d.name,d.t,d.c,total>0?((d.t/total)*100).toFixed(1)+'%':'0%']));
      d2.push(['الإجمالي',total,invoices.length,'100%']);
      const ws2=XLSX.utils.aoa_to_sheet(d2);autoFit(ws2,d2,[20,16,14,12]);
      ws2['!rows']=[{hpt:30}];
      for(let c=0;c<h2.length;c++){const a=XLSX.utils.encode_cell({r:0,c});if(ws2[a])ws2[a].s=sHdr;}
      for(let r=1;r<d2.length-1;r++){const s=r%2===0;
        for(let c=0;c<h2.length;c++){const a=XLSX.utils.encode_cell({r,c});if(!ws2[a])continue;
          if(c===1)ws2[a].s=sAmt(s);else if(c===3)ws2[a].s=sPct(s);else ws2[a].s=c===0?sCell(s):sCellC(s);}}
      const lr=d2.length-1;
      for(let c=0;c<h2.length;c++){const a=XLSX.utils.encode_cell({r:lr,c});if(!ws2[a])ws2[a]={v:'',t:'s'};ws2[a].s=c===1?sTotAmt:sTot;}
      XLSX.utils.book_append_sheet(wb,ws2,'حسب المورد');
    }

    // Suppliers
    const slh=['المورد','الدفع الافتراضي','عدد الفواتير','الإجمالي (ر.س)'];
    const sld=[slh];
    suppliers.forEach(s=>{const d=map[s.id]||{c:0,t:0};sld.push([s.name,PAY_AR[s.defaultPayment]||s.defaultPayment,d.c,d.t]);});
    const ws4=XLSX.utils.aoa_to_sheet(sld);autoFit(ws4,sld,[20,16,14,16]);
    ws4['!rows']=[{hpt:30}];
    for(let c=0;c<slh.length;c++){const a=XLSX.utils.encode_cell({r:0,c});if(ws4[a])ws4[a].s=sHdr;}
    for(let r=1;r<sld.length;r++){const s=r%2===0;
      for(let c=0;c<slh.length;c++){const a=XLSX.utils.encode_cell({r,c});if(!ws4[a])continue;
        if(c===1)ws4[a].s=sPay(suppliers[r-1]?.defaultPayment,s);else if(c===3)ws4[a].s=sAmt(s);else ws4[a].s=c===0?sCell(s):sCellC(s);}}
    XLSX.utils.book_append_sheet(wb,ws4,'الموردين');

    XLSX.writeFile(wb,`متتبع_الفواتير_${new Date().toISOString().split('T')[0]}.xlsx`);
    return true;
  }

  return { exportFiltered, exportAll };
})();
