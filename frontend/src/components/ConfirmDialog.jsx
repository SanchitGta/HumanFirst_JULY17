import { useState } from 'react'

export default function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    setBusy(true)
    try {
      await onConfirm()
    } catch (err) {
      setError(err.message || 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal modal-sm" role="alertdialog" aria-modal="true">
        <div className="modal-body">
          <h2>{title}</h2>
          <p>{message}</p>
          {error && <span className="field-error">{error}</span>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={handleConfirm} disabled={busy}>
            {confirmLabel || 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
