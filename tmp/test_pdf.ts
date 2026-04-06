import { PDFParse } from 'pdf-parse';
import fs from 'node:fs/promises';

async function test() {
    console.log('Testing pdf-parse...');
    try {
        const dummyPdf = Buffer.from('%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
        const parser = new PDFParse({ data: dummyPdf });
        const result = await parser.getText();
        console.log('Result:', result.text);
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
