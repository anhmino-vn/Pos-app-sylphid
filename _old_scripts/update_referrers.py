import re

with open('src/pages/customers/Referrers.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove extra đ
content = re.sub(r'\$\{formatCurrency\(([^)]+)\)\}\s*đ', r'${formatCurrency(\1)}', content)
content = re.sub(r'\{formatCurrency\(([^)]+)\)\}\s*đ', r'{formatCurrency(\1)}', content)

# 2. Change Filter button text
content = content.replace('<Filter className="w-4 h-4" /> Bộ lọc', '<SettingsIcon className="w-4 h-4" /> Cấu hình')

# 3. Add chart data logic
chart_data_logic = """
  // ── Chart Data ──────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    let isDaily = false;
    if (dateRange.startDate && dateRange.endDate) {
      const diffTime = Math.abs(dateRange.endDate.getTime() - dateRange.startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 31) isDaily = true;
    }

    const labels: string[] = [];
    const data1: number[] = [];
    const data2: number[] = [];
    
    if (isDaily && dateRange.startDate && dateRange.endDate) {
       let d = new Date(dateRange.startDate);
       d.setHours(0,0,0,0);
       const end = new Date(dateRange.endDate);
       end.setHours(23,59,59,999);
       while (d <= end) {
          labels.push(`${d.getDate()}/${d.getMonth()+1}`);
          data1.push(0);
          data2.push(0);
          d.setDate(d.getDate() + 1);
       }
       allOrders.forEach((o: any) => {
         if (!o.referredById || o.commissionEligible === false) return;
         const od = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
         if (od >= dateRange.startDate! && od <= dateRange.endDate!) {
            const diffTime = Math.abs(od.getTime() - dateRange.startDate!.getTime());
            const idx = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (idx >= 0 && idx < data1.length) {
               data1[idx] += (o.totalAmount || 0);
            }
         }
         const prevStart = new Date(dateRange.startDate);
         prevStart.setMonth(prevStart.getMonth() - 1);
         const prevEnd = new Date(dateRange.endDate);
         prevEnd.setMonth(prevEnd.getMonth() - 1);
         if (od >= prevStart && od <= prevEnd) {
            const diffTime = Math.abs(od.getTime() - prevStart.getTime());
            const idx = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (idx >= 0 && idx < data2.length) {
               data2[idx] += (o.totalAmount || 0);
            }
         }
       });
    } else {
       for (let i = 0; i < 12; i++) {
         labels.push(`T${i + 1}`);
         data1.push(0);
         data2.push(0);
       }
       const targetYear = dateRange.startDate ? dateRange.startDate.getFullYear() : new Date().getFullYear();
       allOrders.forEach((o: any) => {
         if (!o.referredById || o.commissionEligible === false) return;
         const od = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
         const year = od.getFullYear();
         const month = od.getMonth();
         if (year === targetYear) data1[month] += (o.totalAmount || 0);
         if (year === targetYear - 1) data2[month] += (o.totalAmount || 0);
       });
    }

    const maxVal = Math.max(...data1, ...data2, 1);
    return { 
      labels, 
      data1: data1.map(v => (v / maxVal) * 100), 
      data2: data2.map(v => (v / maxVal) * 100),
      raw1: data1,
      raw2: data2,
      maxVal,
      isDaily
    };
  }, [allOrders, dateRange]);

  // ── Derived data ────────────────────────────────────────────────────────"""

content = content.replace('  // ── Derived data ────────────────────────────────────────────────────────', chart_data_logic)

old_chart = """                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Doanh thu Referral</h3>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Tháng này</span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><div className="w-2.5 h-2.5 rounded-full bg-slate-200" /> Tháng trước</span>
                  </div>
                </div>
                <div className="h-[220px] flex items-end gap-2 px-2 pb-6 relative border-b border-l border-slate-100">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const h1 = 20 + (i % 4) * 15 + (i % 3) * 10;
                    const h2 = 15 + (i % 5) * 12 + (i % 2) * 8;
                    return (
                      <div key={i} className="flex-1 flex justify-center items-end gap-0.5 h-full group">
                        <div className="w-2/5 bg-slate-100 rounded-t-sm group-hover:bg-slate-200 transition-colors" style={{ height: `${h1}%` }} />
                        <div className="w-2/5 bg-blue-500 rounded-t-sm group-hover:bg-blue-600 transition-colors" style={{ height: `${h2}%` }} />
                        <span className="absolute text-[9px] font-bold text-slate-400" style={{ bottom: 4, left: `${(i / 12) * 100 + 4}%` }}>T{i + 1}</span>
                      </div>
                    );
                  })}
                </div>"""

new_chart = """                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Doanh thu Referral</h3>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> {chartData.isDaily ? 'Kỳ này' : 'Năm nay'}</span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><div className="w-2.5 h-2.5 rounded-full bg-slate-200" /> {chartData.isDaily ? 'Kỳ trước' : 'Năm trước'}</span>
                  </div>
                </div>
                <div className="h-[220px] flex items-end gap-2 px-2 pb-6 relative border-b border-l border-slate-100 overflow-x-auto custom-scrollbar">
                  {chartData.labels.map((label, i) => {
                    const h1 = chartData.data2[i];
                    const h2 = chartData.data1[i];
                    return (
                      <div key={i} className="flex-1 flex justify-center items-end gap-0.5 h-full group min-w-[24px]" title={`${label}\\n${chartData.isDaily ? 'Kỳ này' : 'Năm nay'}: ${formatCurrency(chartData.raw1[i])}\\n${chartData.isDaily ? 'Kỳ trước' : 'Năm trước'}: ${formatCurrency(chartData.raw2[i])}`}>
                        <div className="w-2/5 bg-slate-100 rounded-t-sm group-hover:bg-slate-200 transition-all duration-500" style={{ height: `${h1}%`, minHeight: h1 > 0 ? '4px' : '0' }} />
                        <div className="w-2/5 bg-blue-500 rounded-t-sm group-hover:bg-blue-600 transition-all duration-500" style={{ height: `${h2}%`, minHeight: h2 > 0 ? '4px' : '0' }} />
                        <span className="absolute text-[9px] font-bold text-slate-400 whitespace-nowrap" style={{ bottom: 4, left: `${(i / chartData.labels.length) * 100 + (100 / chartData.labels.length / 2)}%`, transform: 'translateX(-50%)' }}>{label}</span>
                      </div>
                    );
                  })}
                  {chartData.labels.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-bold">Chưa có dữ liệu biểu đồ</div>
                  )}
                </div>"""

content = content.replace(old_chart, new_chart)

with open('src/pages/customers/Referrers.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
