import { useState } from 'react'
import { TriangleAlertIcon } from 'lucide-react'
import Modal from './Modal'

// Yes/no dialog for destructive actions. onConfirm may be async; the button shows progress.
const ConfirmDialog = ({ open, onClose, onConfirm, title, children, confirmLabel = 'Confirm', danger = true }) => {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm?.();
      onClose?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      size="sm"
      title={title}
      icon={danger ? <TriangleAlertIcon size={19} className="text-danger" /> : undefined}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={confirm} disabled={busy} data-autofocus>
            {busy && <span className="spinner size-4" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="px-5 py-5 text-sm leading-relaxed text-fg-2 sm:px-6">{children}</div>
    </Modal>
  );
};

export default ConfirmDialog
