export default function EmptyState({ message, actionLabel, onAction }) {
  return (
    <div className="state-panel">
      <p>{message}</p>
      {actionLabel && (
        <button className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
