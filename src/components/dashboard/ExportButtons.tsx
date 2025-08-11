import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export function ExportButtons() {
  const exportPDF = async () => {
    const el = document.getElementById('dashboard-root');
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save('dashboard.pdf');
  };

  const exportCSV = () => {
    const el = document.getElementById('kpi-data');
    const rows: string[][] = [];
    if (el) {
      const items = el.querySelectorAll('[data-kpi]');
      items.forEach((item) => {
        const key = item.getAttribute('data-kpi') || '';
        const value = (item.querySelector('[data-kpi-value]')?.textContent || '').trim();
        const note = (item.querySelector('[data-kpi-subtext]')?.textContent || '').trim();
        rows.push([key, value, note]);
      });
    }
    const csv = ['KPI,Value,Note', ...rows.map(r => r.map(x => '"' + x.replace(/"/g, '""') + '"').join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'dashboard.csv';
    link.click();
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={exportCSV}>Export CSV</Button>
      <Button onClick={exportPDF}>Export PDF</Button>
    </div>
  );
}
