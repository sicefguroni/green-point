import pkg from 'xlsx';
const { readFile, utils } = pkg;
import path from 'path';

const filePath = path.resolve('public/data/Tree Tagging_v1.xlsx');
const workbook = readFile(filePath);

console.log('Sheet Names:', workbook.SheetNames);

// Inspect the first barangay sheet (skipping 'Summary' which is index 0 usually)
const lastSheet = workbook.SheetNames[28];
const worksheet = workbook.Sheets[lastSheet];
const data = utils.sheet_to_json(worksheet, { header: 1 });

console.log(`\nSample data from ${lastSheet}:`);
data.slice(0, 10).forEach((row, i) => {
  console.log(`Row ${i}:`, row);
});
