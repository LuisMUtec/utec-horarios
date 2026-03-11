import { NextResponse } from 'next/server';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Required for pdfjs-dist to work in standard Node environments without throwing Worker errors
// @ts-ignore
await import('pdfjs-dist/legacy/build/pdf.worker.mjs');

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File is not a PDF' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    // Parse the PDF using pdfjs-dist
    const loadingTask = getDocument({ data, useSystemFonts: true, standardFontDataUrl: '' });
    const pdfDocument = await loadingTask.promise;

    let fullText = '';
    const numPages = pdfDocument.numPages;

    for (let i = 1; i <= numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + ' ';
    }

    // Extract course codes using RegEx (e.g., AD1004, CS2023)
    const courseCodeRegex = /[A-Z]{2}\d{4}/g;
    const matches = fullText.match(courseCodeRegex) || [];
    
    // Extract student name using RegEx (e.g., Alumno : Joel Modesto Cayllahua Hilario Programa)
    const nameRegex = /Alumno\s*:\s*(.*?)\s*Programa/i;
    const nameMatch = fullText.match(nameRegex);
    const studentName = nameMatch ? nameMatch[1].trim() : null;
    
    // Get unique course codes
    const uniqueCodes = Array.from(new Set(matches));

    // Extract course type (Obligatorio/Electivo) for each code
    const courseTipos: Record<string, string> = {};
    const codePositions = [...fullText.matchAll(/[A-Z]{2}\d{4}/g)];
    for (const match of codePositions) {
      const code = match[0];
      if (courseTipos[code]) continue; // keep first occurrence
      const startPos = match.index! + code.length;
      // Look in the next 200 chars for Obligatorio or Electivo
      const snippet = fullText.substring(startPos, startPos + 200);
      const tipoMatch = snippet.match(/\b(Obligatorio|Electivo)\b/i);
      if (tipoMatch) {
        courseTipos[code] = tipoMatch[1].charAt(0).toUpperCase() + tipoMatch[1].slice(1).toLowerCase();
      }
    }

    return NextResponse.json({
      success: true,
      codes: uniqueCodes,
      studentName: studentName,
      courseTipos,
      parsedPages: numPages
    });
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return NextResponse.json(
      { error: 'Error processing the PDF file' },
      { status: 500 }
    );
  }
}
