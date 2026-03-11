const fs = require('fs');
const path = require('path');

const DAY_MAP = {
  'Lun': 'Lun', 'Mar': 'Mar', 'Mie': 'Mie', 'Mié': 'Mie',
  'Jue': 'Jue', 'Vie': 'Vie', 'Sab': 'Sab', 'Sáb': 'Sab',
};

async function parsePDF() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfPath = path.join(__dirname, '..', '264056dc-5fa6-4bc2-934f-6dc8650f4bd2_copia.pdf');
  const dataBuffer = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data: dataBuffer }).promise;
  console.log(`PDF has ${doc.numPages} pages`);

  const allRows = [];
  const courseCodeRe = /^[A-Z]{2}\d{4}$/;
  let lastColStarts = null; // Carry column positions across pages

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    // Get all non-empty items in the table area
    const items = textContent.items
      .filter(item => item.str.trim().length > 0)
      .map(item => ({
        str: item.str.trim(),
        x: item.transform[4],
        y: Math.round(viewport.height - item.transform[5]),
      }));

    // Detect header row to get column x-positions
    const headerItems = items.filter(it =>
      it.str === 'Código' || it.str === 'Curso' || it.str === 'Sección' ||
      it.str === 'Sesión' || it.str === 'Modalidad' || it.str === 'Horario' ||
      it.str === 'Frecuencia' || it.str === 'Ubicación' || it.str === 'Vacantes' ||
      it.str === 'Matriculados' || it.str === 'Docente' || it.str === 'Correo'
    );

    let colStarts;
    let headerY = 0;

    if (headerItems.length >= 8) {
      headerY = headerItems[0].y;

      const headersByText = {};
      for (const h of headerItems) {
        if (Math.abs(h.y - headerY) <= 3) {
          headersByText[h.str] = h.x;
        }
      }

      colStarts = [
        headersByText['Código'] || 49,
        107, // Curso column - will be fixed below
        headersByText['Sección'] || 181,
        headersByText['Sesión'] || 224,
        headersByText['Modalidad'] || 293,
        headersByText['Horario'] || 341,
        headersByText['Frecuencia'] || 415,
        headersByText['Ubicación'] || 483,
        headersByText['Vacantes'] || 542,
        headersByText['Matriculados'] || 590,
        headersByText['Docente'] || 649,
        headersByText['Correo'] || 722,
      ];

      const cursoItems = headerItems.filter(h => h.str === 'Curso' && Math.abs(h.y - headerY) <= 3);
      if (cursoItems.length >= 2) {
        cursoItems.sort((a, b) => a.x - b.x);
        colStarts[1] = cursoItems[1].x;
      } else if (cursoItems.length === 1) {
        colStarts[1] = cursoItems[0].x;
      }

      lastColStarts = colStarts;
    } else if (lastColStarts) {
      // No header on this page, reuse previous column positions
      colStarts = lastColStarts;
    } else {
      continue; // No columns detected yet
    }

    // Get data items (below header, or all items on headerless pages)
    const dataItems = headerY > 0
      ? items.filter(it => it.y > headerY + 5)
      : items.filter(it => {
          // On pages without header, filter out page numbers and non-table content
          // Page numbers are typically standalone small numbers at the bottom
          return true;
        });

    // Group by Y into visual rows (tolerance of 3px)
    const yBuckets = new Map();
    for (const item of dataItems) {
      let found = false;
      for (const [key] of yBuckets) {
        if (Math.abs(item.y - key) <= 3) {
          yBuckets.get(key).push(item);
          found = true;
          break;
        }
      }
      if (!found) {
        yBuckets.set(item.y, [item]);
      }
    }

    // Sort rows by Y
    const visualRows = [...yBuckets.entries()].sort(([a], [b]) => a - b);

    // Group visual rows into records (a record starts with a course code)
    let currentRecord = null;

    for (const [, rowItems] of visualRows) {
      const cells = assignToColumns(rowItems, colStarts);

      // Check if this row starts a new record
      if (cells[0] && courseCodeRe.test(cells[0])) {
        if (currentRecord) {
          allRows.push(currentRecord);
        }
        currentRecord = [...cells];
      } else if (currentRecord) {
        // Continuation row - merge into current record
        for (let c = 0; c < cells.length; c++) {
          if (cells[c]) {
            currentRecord[c] = currentRecord[c]
              ? currentRecord[c] + ' ' + cells[c]
              : cells[c];
          }
        }
      }
    }
    if (currentRecord) {
      allRows.push(currentRecord);
    }

    if (pageNum % 20 === 0) console.log(`Processed page ${pageNum}/${doc.numPages}`);
  }

  console.log(`Raw rows: ${allRows.length}`);

  // Parse rows into structured data
  const parsedRows = [];
  for (const rec of allRows) {
    const row = parseRecord(rec);
    if (row) {
      parsedRows.push(row);
    }
  }

  console.log(`Parsed ${parsedRows.length} session rows`);

  // Group into courses
  const courseMap = new Map();
  for (const row of parsedRows) {
    if (!courseMap.has(row.code)) {
      courseMap.set(row.code, { code: row.code, name: row.name, sectionsMap: new Map() });
    }
    const course = courseMap.get(row.code);
    if (row.name.length > course.name.length) course.name = row.name;

    if (!course.sectionsMap.has(row.section)) {
      course.sectionsMap.set(row.section, { number: row.section, sessions: [] });
    }
    course.sectionsMap.get(row.section).sessions.push({
      type: row.sessionType,
      modality: row.modality,
      day: row.day,
      startTime: row.startTime,
      endTime: row.endTime,
      frequency: row.frequency,
      location: row.location,
      capacity: row.capacity,
      enrolled: row.enrolled,
      professor: row.professor,
      email: row.email,
    });
  }

  const courses = [];
  for (const [, course] of courseMap) {
    const sections = Array.from(course.sectionsMap.values()).sort((a, b) => a.number - b.number);
    courses.push({ code: course.code, name: course.name, sections });
  }
  courses.sort((a, b) => a.code.localeCompare(b.code));

  console.log(`\nTotal courses: ${courses.length}`);
  console.log(`Total sections: ${courses.reduce((s, c) => s + c.sections.length, 0)}`);
  console.log(`Total sessions: ${courses.reduce((s, c) => s + c.sections.reduce((ss, sec) => ss + sec.sessions.length, 0), 0)}`);

  // Show first few courses for verification
  for (const c of courses.slice(0, 5)) {
    console.log(`\n${c.code} - ${c.name} (${c.sections.length} sections)`);
    for (const s of c.sections) {
      console.log(`  Section ${s.number}: ${s.sessions.length} sessions`);
      for (const sess of s.sessions) {
        console.log(`    ${sess.type} | ${sess.day} ${sess.startTime}-${sess.endTime} | ${sess.modality} | ${sess.location} | ${sess.professor}`);
      }
    }
  }

  const outputPath = path.join(__dirname, '..', 'src', 'data', 'courses.json');
  fs.writeFileSync(outputPath, JSON.stringify(courses, null, 2));
  console.log(`\nWritten to ${outputPath}`);
}

function assignToColumns(rowItems, colStarts) {
  const numCols = colStarts.length;
  const cells = new Array(numCols).fill('');

  for (const item of rowItems) {
    // Find the column this item belongs to
    let col = 0;
    for (let c = numCols - 1; c >= 0; c--) {
      if (item.x >= colStarts[c] - 10) {
        col = c;
        break;
      }
    }
    cells[col] = cells[col] ? cells[col] + ' ' + item.str : item.str;
  }

  return cells;
}

function parseRecord(rec) {
  if (!rec || rec.length < 12) return null;

  const code = (rec[0] || '').trim();
  const name = (rec[1] || '').trim();
  const section = parseInt((rec[2] || '').trim());
  const sessionType = (rec[3] || '').trim();
  const modality = (rec[4] || '').trim();
  const horario = (rec[5] || '').trim();
  const frequency = (rec[6] || '').trim();
  const location = (rec[7] || '').trim();
  const capacity = parseInt((rec[8] || '').trim()) || 0;
  const enrolled = parseInt((rec[9] || '').trim()) || 0;
  const professor = (rec[10] || '').trim();
  const email = (rec[11] || '').trim();

  if (!code || !name || isNaN(section) || !modality) return null;

  // Parse horario
  const schedMatch = horario.match(/(Lun|Mar|Mie|Mié|Jue|Vie|Sab|Sáb)\.\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
  if (!schedMatch) return null;

  const day = DAY_MAP[schedMatch[1]] || schedMatch[1];

  // Clean up location: "UTEC- BA" -> "UTEC-BA"
  const cleanLocation = location.replace(/UTEC-\s+BA/g, 'UTEC-BA');

  return {
    code, name, section, sessionType, modality, day,
    startTime: schedMatch[2],
    endTime: schedMatch[3],
    frequency, location: cleanLocation, capacity, enrolled, professor, email,
  };
}

parsePDF().catch(console.error);
