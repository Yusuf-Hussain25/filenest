// Builders for realistic demo files, so the seeder needs no extra tools:
// one-page PDFs, short WAV melodies, ZIP archives and remote photos/video.
import { crc32 } from 'zlib';

// ---------------------------------------------------------------- PDF
const pdfText = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7e]/g, '-');

// A4 page with a colored header band, a title, a subtitle and body lines
export const makePdf = ({ title, subtitle = '', lines = [], color = [0.05, 0.55, 0.85] }) => {
    const body = [];
    body.push(`${color.join(' ')} rg 0 772 595 70 re f`);
    body.push(`BT /F2 22 Tf 1 1 1 rg 48 798 Td (${pdfText(title)}) Tj ET`);
    if (subtitle) body.push(`BT /F1 11 Tf 1 1 1 rg 48 781 Td (${pdfText(subtitle)}) Tj ET`);
    let y = 730;
    for (const line of lines) {
        if (y < 60) break;
        if (line.startsWith('# ')) {
            y -= 8;
            body.push(`BT /F2 13 Tf 0.1 0.15 0.2 rg 48 ${y} Td (${pdfText(line.slice(2))}) Tj ET`);
            y -= 22;
        } else {
            body.push(`BT /F1 11 Tf 0.25 0.3 0.36 rg 48 ${y} Td (${pdfText(line)}) Tj ET`);
            y -= 17;
        }
    }
    body.push('0.85 0.88 0.92 RG 48 40 m 547 40 l S');
    body.push(`BT /F1 8 Tf 0.5 0.55 0.6 rg 48 28 Td (Stored with Filenest) Tj ET`);
    const stream = body.join('\n');

    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
        `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    ];
    let out = '%PDF-1.4\n';
    const offsets = [];
    objects.forEach((obj, i) => {
        offsets.push(Buffer.byteLength(out));
        out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    });
    const xref = Buffer.byteLength(out);
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, 'latin1');
};

// ---------------------------------------------------------------- WAV
const NOTE = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25 };

// 16-bit mono WAV of a simple melody: [['E4', 0.4], ['G4', 0.4], ...]
export const makeWav = (melody, sampleRate = 22050) => {
    const samples = [];
    for (const [note, secs] of melody) {
        const freq = NOTE[note] || 0;
        const n = Math.floor(secs * sampleRate);
        for (let i = 0; i < n; i++) {
            const t = i / sampleRate;
            const env = Math.min(1, i / 400) * Math.exp(-3 * (i / n)); // soft attack, decay
            const v = freq ? (Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(4 * Math.PI * freq * t)) * env * 0.35 : 0;
            samples.push(Math.max(-1, Math.min(1, v)));
        }
    }
    const data = Buffer.alloc(samples.length * 2);
    samples.forEach((s, i) => data.writeInt16LE(Math.round(s * 32767), i * 2));
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + data.length, 4);
    header.write('WAVEfmt ', 8);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(1, 22); // mono
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(data.length, 40);
    return Buffer.concat([header, data]);
};

// ---------------------------------------------------------------- ZIP
// Uncompressed ("stored") ZIP of [{ name, data: Buffer|string }]
export const makeZip = (entries) => {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const { name, data } of entries) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        const nameBuf = Buffer.from(name);
        const crc = crc32(buf);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(buf.length, 18);
        local.writeUInt32LE(buf.length, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        locals.push(local, nameBuf, buf);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(buf.length, 20);
        central.writeUInt32LE(buf.length, 24);
        central.writeUInt16LE(nameBuf.length, 28);
        central.writeUInt32LE(offset, 42);
        centrals.push(central, nameBuf);
        offset += 30 + nameBuf.length + buf.length;
    }
    const centralSize = centrals.reduce((n, b) => n + b.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, ...centrals, end]);
};

// ---------------------------------------------------------------- remote
// Download a file, or return null (the seeder skips it) when offline
export const download = async (url) => {
    try {
        const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
    } catch {
        return null;
    }
};

// A specific picsum.photos image (ids picked so the photos fit the folders they're in)
export const photo = (id, w = 1600, h = 1067) => download(`https://picsum.photos/id/${id}/${w}/${h}.jpg`);
