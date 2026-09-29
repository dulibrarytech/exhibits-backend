'use strict';

/**
 * Builds a minimal multi-page PDF in memory for tests.
 *
 * Every page draws a filled rectangle at a page-specific position and size, so
 * the pages rasterize to visibly different bitmaps. Vector graphics only — no
 * fonts — so rendering does not depend on pdfjs locating standard font data.
 *
 * Hand-built rather than fixture-committed so the page count, page size and
 * content are visible in the test that uses it.
 *
 * @param {number} page_count - Number of pages to emit
 * @param {Object} [size] - Page size in PDF points
 * @returns {Buffer} PDF bytes
 */
const build_multipage_pdf = (page_count, size = { width: 612, height: 792 }) => {

    const objects = [];

    /* 1: catalog, 2: page tree, then a page + content stream per page. */
    const page_object_number = (index) => 3 + (index * 2);
    const kids = Array.from({ length: page_count }, (unused, index) => `${page_object_number(index)} 0 R`).join(' ');

    objects.push('<</Type/Catalog/Pages 2 0 R>>');
    objects.push(`<</Type/Pages/Kids[${kids}]/Count ${page_count}>>`);

    for (let index = 0; index < page_count; index++) {

        const contents_number = page_object_number(index) + 1;
        const band_height = Math.floor(size.height / (page_count + 1));
        const stream = `0 0 0 rg 40 ${40 + (index * band_height)} ${size.width - 80} ${band_height} re f`;

        objects.push(
            `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${size.width} ${size.height}]/Contents ${contents_number} 0 R/Resources<<>>>>`
        );
        objects.push(`<</Length ${stream.length}>>\nstream\n${stream}\nendstream`);
    }

    /* Serialize, tracking each object's byte offset for the xref table. */
    let pdf = '%PDF-1.4\n';
    const offsets = [];

    objects.forEach((body, index) => {
        offsets.push(pdf.length);
        pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });

    const xref_offset = pdf.length;

    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    offsets.forEach((offset) => {
        pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref_offset}\n%%EOF\n`;

    return Buffer.from(pdf, 'latin1');
};

module.exports = { build_multipage_pdf };
