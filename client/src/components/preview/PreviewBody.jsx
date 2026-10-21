import { useEffect, useState } from 'react'
import { DownloadIcon, ExternalLinkIcon, FileX2Icon } from 'lucide-react'
import { FileGlyph } from '../ui/FileGlyph'
import { previewMode, fileKind } from '../../lib/files'
import { formatBytes } from '../../lib/format'

// Click to switch between "fit to screen" and actual size
const ImageView = ({ url, name }) => {
  const [zoomed, setZoomed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={`relative size-full ${zoomed ? 'overflow-auto' : 'grid place-items-center overflow-hidden'}`}>
      {!loaded && <div className="absolute inset-0 m-auto size-12 animate-spin rounded-full border-2 border-white/60 border-r-transparent" aria-hidden="true" />}
      <img
        src={url}
        alt={name}
        onLoad={() => setLoaded(true)}
        onClick={() => setZoomed((z) => !z)}
        className={`select-none transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${
          zoomed ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in rounded-xl object-contain shadow-2xl'
        }`}
        draggable={false}
      />
    </div>
  );
};

const AudioView = ({ url, file }) => {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/[.06] p-7 text-center text-white backdrop-blur-xl">
      <div className="mx-auto grid size-28 place-items-center rounded-[28px] bg-gradient-to-br from-pink-400/30 to-fuchsia-700/30">
        <FileGlyph mime={file.mime_type} size={64} />
      </div>
      <div className="mx-auto mt-6 flex h-10 items-end justify-center gap-1" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <span
            key={i}
            className="w-1.5 rounded-full bg-gradient-to-t from-sky-400 to-fuchsia-400"
            style={{
              height: `${20 + ((i * 37) % 80)}%`,
              animation: playing ? `float ${0.6 + (i % 5) * 0.15}s ease-in-out ${i * 0.04}s infinite` : 'none',
              opacity: playing ? 1 : 0.45,
            }}
          />
        ))}
      </div>
      <p className="mt-5 truncate font-semibold">{file.name}</p>
      <p className="text-sm text-white/55">{formatBytes(file.size)}</p>
      <audio src={url} controls className="mt-5 w-full" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    </div>
  );
};

// Small CSV parser (quotes and escaped quotes) for the table view
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
};

// Inline **bold**, *italic* and `code` as React elements (never HTML strings)
const inline = (text) => text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).map((part, i) => {
  if (/^\*\*.+\*\*$/.test(part)) return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
  if (/^`.+`$/.test(part)) return <code key={i} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.9em]">{part.slice(1, -1)}</code>;
  if (/^\*.+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
  return part;
});

// Enough Markdown for notes and recipes: headings, lists, checkboxes, paragraphs
const MarkdownView = ({ text }) => (
  <article className="mx-auto max-w-2xl px-6 py-7 text-[15px] leading-7 text-[#c9d6e5] sm:px-10">
    {text.split('\n').map((line, i) => {
      const t = line.trim();
      if (!t) return <div key={i} className="h-3" />;
      if (t.startsWith('### ')) return <h3 key={i} className="mt-4 mb-1 text-base font-semibold text-white">{inline(t.slice(4))}</h3>;
      if (t.startsWith('## ')) return <h2 key={i} className="mt-5 mb-1.5 text-lg font-semibold text-white">{inline(t.slice(3))}</h2>;
      if (t.startsWith('# ')) return <h1 key={i} className="mb-2 text-2xl font-semibold tracking-tight text-white">{inline(t.slice(2))}</h1>;
      const task = t.match(/^[-*] \[( |x)\] (.*)$/i);
      if (task) {
        return (
          <p key={i} className="flex items-start gap-2.5">
            <span className={`mt-1.5 grid size-4 shrink-0 place-items-center rounded border ${task[1] !== ' ' ? 'border-sky-400 bg-sky-400 text-[#05080d]' : 'border-white/30'}`}>{task[1] !== ' ' ? '✓' : ''}</span>
            <span className={task[1] !== ' ' ? 'text-white/50 line-through' : ''}>{inline(task[2])}</span>
          </p>
        );
      }
      const bullet = t.match(/^[-*] (.*)$/);
      if (bullet) return <p key={i} className="flex gap-2.5 pl-1"><span className="text-sky-400">•</span><span>{inline(bullet[1])}</span></p>;
      const num = t.match(/^(\d+)\. (.*)$/);
      if (num) return <p key={i} className="flex gap-2.5 pl-1"><span className="w-5 shrink-0 text-right text-sky-400 tabular-nums">{num[1]}.</span><span>{inline(num[2])}</span></p>;
      return <p key={i}>{inline(t)}</p>;
    })}
  </article>
);

const TextView = ({ file, loadText }) => {
  const [state, setState] = useState({ id: null, content: null, truncated: false, error: null });
  const [source, setSource] = useState(false);

  useEffect(() => {
    let alive = true;
    loadText()
      .then(({ content, truncated }) => alive && setState({ id: file.id, content, truncated, error: null }))
      .catch(() => alive && setState({ id: file.id, content: null, truncated: false, error: 'Could not load this file.' }));
    return () => {
      alive = false;
    };
  }, [file.id, loadText]);

  if (state.id !== file.id) {
    return (
      <div className="w-full max-w-4xl space-y-2.5 rounded-2xl bg-white/[.04] p-6" aria-label="Loading">
        {[80, 65, 90, 50, 72, 40].map((w, i) => <div key={i} className="h-3 animate-pulse rounded bg-white/10" style={{ width: `${w}%` }} />)}
      </div>
    );
  }
  if (state.error) return <p className="text-white/70">{state.error}</p>;

  const isCsv = /csv/.test(file.mime_type) || file.name.toLowerCase().endsWith('.csv');
  let pretty = state.content;
  if (/json/.test(file.mime_type)) {
    try { pretty = JSON.stringify(JSON.parse(state.content), null, 2); } catch { /* show as is */ }
  }
  const rows = isCsv ? parseCsv(state.content) : null;
  const isNumber = (c) => /^-?[\d.,]+$/.test(c);
  const numericCols = rows?.[1]?.map(isNumber) || [];
  const isMarkdown = /markdown/.test(file.mime_type) || /\.md$/i.test(file.name);

  return (
    <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b111a] text-[#dbe6f3] shadow-2xl">
      {isMarkdown && (
        <div className="flex justify-end border-b border-white/10 px-3 py-2">
          <div className="segmented !p-[3px]" role="group" aria-label="Markdown view">
            <button type="button" aria-pressed={!source} onClick={() => setSource(false)} className="!h-7">Formatted</button>
            <button type="button" aria-pressed={source} onClick={() => setSource(true)} className="!h-7">Source</button>
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {rows ? (
          <table className="w-full border-collapse text-left text-[13px]">
            <thead className="sticky top-0 bg-[#121a26]">
              <tr>{rows[0].map((h, i) => <th key={i} className={`border-b border-white/10 px-4 py-2.5 font-semibold whitespace-nowrap text-white ${numericCols[i] ? 'text-right' : ''}`}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(1).map((r, i) => (
                <tr key={i} className="odd:bg-white/[.02] hover:bg-white/[.05]">
                  {r.map((c, j) => <td key={j} className={`border-b border-white/5 px-4 py-2 whitespace-nowrap ${isNumber(c) ? 'text-right tabular-nums' : ''}`}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        ) : isMarkdown && !source ? (
          <MarkdownView text={state.content} />
        ) : (
          <pre className="p-5 font-mono text-[13px] leading-6 whitespace-pre-wrap break-words">
            {pretty.split('\n').map((line, i) => (
              <span key={i} className="flex gap-4">
                <span className="w-8 shrink-0 text-right text-white/25 select-none">{i + 1}</span>
                <span className="min-w-0 flex-1">{line || ' '}</span>
              </span>
            ))}
          </pre>
        )}
      </div>
      {state.truncated && <p className="border-t border-white/10 px-5 py-2.5 text-xs text-white/50">Showing the first 512 KB. Download the file to see all of it.</p>}
    </div>
  );
};

const NoPreview = ({ file, onDownload }) => (
  <div className="max-w-sm rounded-[28px] border border-white/10 bg-white/[.06] p-8 text-center text-white backdrop-blur-xl">
    <div className="mx-auto w-fit"><FileGlyph mime={file.mime_type} name={file.name} size={72} showExt /></div>
    <p className="mt-6 font-semibold">No preview for this file type</p>
    <p className="mt-1 text-sm text-white/55">{fileKind(file.mime_type).label} · {formatBytes(file.size)}</p>
    {onDownload && (
      <button className="btn btn-primary mt-6" onClick={onDownload}><DownloadIcon size={17} /> Download</button>
    )}
  </div>
);

// Picks the right viewer for the file type
const PreviewBody = ({ file, url, loadText, onDownload }) => {
  const mode = previewMode(file.mime_type);
  if (!url && mode !== 'none') {
    return <div className="size-12 animate-spin rounded-full border-2 border-white/60 border-r-transparent" aria-label="Loading preview" />;
  }
  if (mode === 'image') return <ImageView url={url} name={file.name} key={url} />;
  if (mode === 'video') return <video src={url} controls playsInline className="max-h-full max-w-full rounded-xl bg-black shadow-2xl" />;
  if (mode === 'audio') return <AudioView url={url} file={file} />;
  if (mode === 'pdf') {
    return (
      <div className="flex size-full max-w-5xl flex-col gap-3">
        <iframe src={url} title={file.name} className="min-h-0 w-full flex-1 rounded-xl border border-white/10 bg-white shadow-2xl" />
        <a href={url} target="_blank" rel="noreferrer" className="mx-auto flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
          <ExternalLinkIcon size={14} /> Open in a new tab
        </a>
      </div>
    );
  }
  if (mode === 'text' && loadText) return <TextView file={file} loadText={loadText} />;
  return <NoPreview file={file} onDownload={onDownload} />;
};

export const PreviewError = ({ message }) => (
  <div className="max-w-sm text-center text-white">
    <FileX2Icon size={40} className="mx-auto text-white/50" />
    <p className="mt-4 font-semibold">{message}</p>
  </div>
);

export default PreviewBody
