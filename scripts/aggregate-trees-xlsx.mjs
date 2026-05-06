import pkg from 'xlsx';
const { readFile, utils } = pkg;
import fs from 'fs';
import path from 'path';

const xlsxPath = path.resolve('public/data/Tree Tagging_v1.xlsx');
const outputPath = path.resolve('public/data/tagged-trees.json');

function dmsToDecimal(dmsStr) {
  if (!dmsStr || typeof dmsStr !== 'string') return null;
  
  // Format: 10°19'55.19"N or 123°56'45.14"E
  const regex = /(\d+)°(\d+)'([\d.]+)"([NSEW])/;
  const match = dmsStr.match(regex);
  
  if (!match) return null;
  
  const degrees = parseFloat(match[1]);
  const minutes = parseFloat(match[2]);
  const seconds = parseFloat(match[3]);
  const direction = match[4];
  
  let decimal = degrees + (minutes / 60) + (seconds / 3600);
  
  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }
  
  return decimal;
}

const workbook = readFile(xlsxPath);
const newFeatures = [];

// Sheets 1 to 27 are barangays (0 is Summary, 28 is CCSEAZ)
// Actually let's just process all sheets except Summary
workbook.SheetNames.forEach((sheetName, index) => {
  if (sheetName.toUpperCase() === 'SUMMARY') return;
  
  const worksheet = workbook.Sheets[sheetName];
  const data = utils.sheet_to_json(worksheet, { header: 1 });
  
  // Header is at row 5 (index 5)
  // Data starts at row 6 (index 6)
  for (let i = 6; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 4) continue;
    
    const code = row[0];
    const species = row[1];
    const latStr = row[2];
    const lngStr = row[3];
    const dbh = row[4];
    const height = row[5];
    const remarks = row[6];
    
    const lat = dmsToDecimal(latStr);
    const lng = dmsToDecimal(lngStr);
    
    if (lat !== null && lng !== null) {
      newFeatures.push({
        type: 'Feature',
        properties: {
          id: code ? String(code) : `xlsx-${index}-${i}`,
          species: species || 'Unknown',
          dbh_cm: dbh || null,
          height_ft: height || null,
          remarks: remarks || '',
          barangay: sheetName.replace(/^\d+\)\s*/, ''), // Clean "1) Alang-alang" to "Alang-alang"
          source: 'Tree Tagging_v1.xlsx',
          type: 'tree'
        },
        geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        }
      });
    }
  }
});

console.log(`Extracted ${newFeatures.length} trees from XLSX.`);

const geojson = {
  type: 'FeatureCollection',
  features: newFeatures
};

fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
console.log(`Successfully updated ${outputPath} with total ${newFeatures.length} trees.`);
