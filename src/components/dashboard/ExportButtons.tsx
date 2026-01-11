import { Button } from '@/components/ui/button';

export function ExportButtons() {
  const exportPDF = () => {
    // Use browser's native print dialog for PDF generation
    // This is secure and doesn't require vulnerable external libraries
    const printContents = document.getElementById('dashboard-root');
    if (!printContents) return;

    // Create a new window with the dashboard content for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to export PDF');
      return;
    }

    // Copy styles from the current document
    const styles = Array.from(document.styleSheets)
      .map(styleSheet => {
        try {
          return Array.from(styleSheet.cssRules)
            .map(rule => rule.cssText)
            .join('\n');
        } catch {
          // Handle cross-origin stylesheets
          return '';
        }
      })
      .join('\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Dashboard Export</title>
          <style>
            ${styles}
            @media print {
              body { margin: 0; padding: 20px; }
              @page { size: A4; margin: 20mm; }
            }
          </style>
        </head>
        <body>
          ${printContents.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    
    // Wait for content to load then trigger print
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
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
