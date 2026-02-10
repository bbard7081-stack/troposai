
declare const XLSX: any;
declare const jspdf: any;

export const exportToCSV = (data: any[], filename: string) => {
  const csvRows = [];
  const headers = Object.keys(data[0]);
  csvRows.push(headers.join(','));

  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      return `"${val}"`;
    });
    csvRows.push(values.join(','));
  }

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const exportToExcel = (data: any[], filename: string) => {
  if (typeof XLSX === 'undefined') {
    alert('Excel library not loaded');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Clients");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const exportToPDF = (data: any[], filename: string) => {
  if (typeof jspdf === 'undefined') {
    alert('PDF library not loaded');
    return;
  }
  const { jsPDF } = jspdf;
  const doc = new jsPDF();
  
  const headers = Object.keys(data[0]);
  const rows = data.map(item => Object.values(item));

  (doc as any).autoTable({
    head: [headers],
    body: rows,
  });

  doc.save(`${filename}.pdf`);
};

export const exportToJSON = (data: any[], filename: string) => {
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
  const link = document.createElement("a");
  link.setAttribute("href", jsonString);
  link.setAttribute("download", `${filename}.json`);
  link.click();
};
