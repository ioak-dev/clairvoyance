const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Find the Excel file in the workspace
const findExcelFile = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith('.xlsx')) {
      return path.join(dir, file);
    }
  }
  return null;
};

const excelFile = findExcelFile('/Users/arun/projects/workspace/win/clairvoyance');

if (!excelFile) {
  console.log('No Excel file found');
  process.exit(1);
}

console.log('Reading:', excelFile);
const wb = XLSX.readFile(excelFile);

wb.SheetNames.forEach(sheet => {
  console.log(`\n=== Sheet: ${sheet} ===`);
  const ws = wb.Sheets[sheet];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  
  const headers = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const address = XLSX.utils.encode_cell({ r: 0, c: C });
    const cell = ws[address];
    headers.push(cell ? cell.v : '');
  }
  
  console.log('Columns:', JSON.stringify(headers, null, 2));
  console.log('Total rows:', range.e.r + 1);
  
  // Show first 2 data rows as sample
  if (range.e.r > 0) {
    console.log('\nSample data (row 2):');
    const sampleRow = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: 1, c: C });
      const cell = ws[address];
      sampleRow.push(cell ? cell.v : null);
    }
    console.log(JSON.stringify(sampleRow, null, 2));
  }
});
