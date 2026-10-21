import { useEffect, useRef, useState } from 'react'
import { UploadCloudIcon } from 'lucide-react'
import { useUploads } from '../../context/UploadContext'
import { useWorkspace } from '../../context/WorkspaceContext'

const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');

// Drop files anywhere in the app to upload them to the folder you're in.
const DropOverlay = () => {
  const { uploadFiles } = useUploads();
  const { here } = useWorkspace();
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  const target = useRef(here);

  useEffect(() => {
    target.current = here;
  }, [here]);

  useEffect(() => {
    const onEnter = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current++;
      setActive(true);
    };
    const onOver = (e) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onLeave = (e) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setActive(false);
    };
    const onDrop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setActive(false);
      uploadFiles(e.dataTransfer.files, target.current.id, target.current.name);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [uploadFiles]);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] grid place-items-center bg-bg/60 p-6 backdrop-blur-sm animate-fade-in">
      <div className="flex w-full max-w-lg flex-col items-center rounded-[28px] border-2 border-dashed border-accent bg-panel-solid/90 px-8 py-12 text-center shadow-deep animate-pop-in">
        <span className="grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent-text shadow-glow animate-[float_2s_ease-in-out_infinite]">
          <UploadCloudIcon size={30} />
        </span>
        <p className="mt-5 text-lg font-semibold tracking-tight">Drop to upload</p>
        <p className="mt-1 text-sm text-fg-3">Files go to <span className="font-medium text-fg">{here.name}</span></p>
      </div>
    </div>
  );
};

export default DropOverlay
