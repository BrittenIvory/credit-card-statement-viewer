import './SavedStatements.css'

export default function SavedStatements({ statements, onSelect, onDelete, onUploadNew, onOpenReceiptBank, receiptBankCount }) {
  function formatDate(isoStr) {
    return new Date(isoStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="saved-statements">
      <div className="saved-statements__header">
        <h2 className="saved-statements__title">Saved Statements</h2>
        <div className="saved-statements__header-actions">
          <button className="receipt-bank-btn" onClick={onOpenReceiptBank}>
            Receipt Bank{receiptBankCount > 0 ? ` (${receiptBankCount})` : ''}
          </button>
          <button className="upload-new-btn" onClick={onUploadNew}>
            Upload new statement
          </button>
        </div>
      </div>

      {statements.length === 0 ? (
        <div className="saved-statements__empty">
          <p>No saved statements yet.</p>
          <p>Upload your first credit card statement to get started.</p>
        </div>
      ) : (
        <div className="saved-statements__list">
          {statements.map((s) => {
            const verifiedCount = s.verifiedIds.length
            const totalCount = s.transactions.length
            const assignedCount = Object.keys(s.companyAssignments).filter(
              (k) => s.companyAssignments[k]
            ).length
            const receiptCount = Object.keys(s.receiptImages).length

            return (
              <div
                key={s.id}
                className="statement-card"
                onClick={() => onSelect(s)}
              >
                <div className="statement-card__main">
                  <div className="statement-card__file">{s.fileName}</div>
                  <div className="statement-card__date">
                    Uploaded {formatDate(s.uploadDate)}
                  </div>
                </div>
                <div className="statement-card__stats">
                  <span className="stat">
                    {totalCount} transactions
                  </span>
                  <span className={`stat ${verifiedCount === totalCount ? 'stat--done' : ''}`}>
                    {verifiedCount}/{totalCount} verified
                  </span>
                  {assignedCount > 0 && (
                    <span className="stat">
                      {assignedCount} assigned
                    </span>
                  )}
                  {receiptCount > 0 && (
                    <span className="stat">
                      {receiptCount} receipts
                    </span>
                  )}
                </div>
                <div className="statement-card__actions">
                  <button
                    className="statement-card__delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('Delete this saved statement?')) {
                        onDelete(s.id)
                      }
                    }}
                    title="Delete statement"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
