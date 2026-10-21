import { useState } from 'react'
import Modal from '../ui/Modal'

// One small form for "New folder" and "Rename": a single name field with a save button.
// onSubmit(name) may throw an Error whose message is shown under the field.
const NameModal = ({ open, onClose, title, subtitle, icon, label, initial = '', submitLabel, onSubmit, selectBaseName = false }) => {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  // Pre-select the name without its extension, like desktop file managers
  const onFocus = (e) => {
    const dot = selectBaseName ? e.target.value.lastIndexOf('.') : -1;
    e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length);
  };

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      size="sm"
      title={title}
      subtitle={subtitle}
      icon={icon}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="name-form" className="btn btn-primary" disabled={busy || !name.trim() || name.trim() === initial}>
            {busy && <span className="spinner size-4" />}
            {submitLabel}
          </button>
        </>
      }
    >
      <form id="name-form" onSubmit={submit} className="px-5 py-5 sm:px-6">
        <div className="field">
          <label htmlFor="item-name">{label}</label>
          <input
            id="item-name"
            className="input"
            value={name}
            maxLength={255}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            onFocus={onFocus}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'item-name-error' : undefined}
            autoComplete="off"
          />
          {error && <p id="item-name-error" role="alert" className="text-[13px] text-danger">{error}</p>}
        </div>
      </form>
    </Modal>
  );
};

export default NameModal
