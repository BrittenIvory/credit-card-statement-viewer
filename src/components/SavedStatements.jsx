import './SavedStatements.css'

import { useState, useRef, useEffect } from 'react'

function StatementCard({ statement: s, onSelect, onDelete, onRename, formatDate, verifiedCount, totalCount, assignedCount, receiptCount }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(s.fileName)
  const inputRef = useRef(null)
  const isCancellingRef = useRef(false)

  useEffect(() => { setDraft(s.fileName) }, [s.fileName])
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function handleSave() {
    if (isCancellingRef.current) {
      isCancellingRef.current = false
      return
    }
    setEditing(false)
    if (draft.trim() && draft.trim() !== s.fileName) {
      onRename(s.id, draft.trim())
    } else {
      setDraft(s.fileName)
    }
  }

  return (
    <div className="statement-card" onClick={() => onSelect(s)}>
      <div className="statement-card__main">
        {editing ? (
          <input
            ref={inputRef}
            className="statement-card__name-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') inputRef.current?.blur()
              if (e.key === 'Escape') { isCancellingRef.current = true; setDraft(s.fileName); setEditing(false) }
            }}
          />
        ) : (
          <div className="statement-card__file">
            {s.fileName}
            <button
              className="statement-card__rename"
              onClick={(e) => { e.stopPropagation(); setEditing(true) }}
              title="Rename statement"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>
        )}
        <div className="statement-card__date">
          Uploaded {formatDate(s.uploadDate)}
        </div>
      </div>
      <div className="statement-card__stats">
        <span className="stat">{totalCount} transactions</span>
        <span className={`stat ${verifiedCount === totalCount ? 'stat--done' : ''}`}>
          {verifiedCount}/{totalCount} verified
        </span>
        {assignedCount > 0 && <span className="stat">{assignedCount} assigned</span>}
        {receiptCount > 0 && <span className="stat">{receiptCount} receipts</span>}
      </div>
      <div className="statement-card__actions">
        <button
          className="statement-card__delete"
          onClick={(e) => {
            e.stopPropagation()
            if (confirm('Delete this saved statement?')) onDelete(s.id)
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
}

export default function SavedStatements({ statements, onSelect, onDelete, onRename, onUploadNew, onOpenReceiptBank, receiptBankCount, onExportBackup, onImportBackup }) {
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
          <button className="backup-btn" onClick={onExportBackup} title="Download a backup file of all statements and receipts">
            Export backup
          </button>
          <button className="backup-btn" onClick={onImportBackup} title="Restore statements and receipts from a backup file">
            Import backup
          </button>
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
              <StatementCard
                key={s.id}
                statement={s}
                onSelect={onSelect}
                onDelete={onDelete}
                onRename={onRename}
                formatDate={formatDate}
                verifiedCount={verifiedCount}
                totalCount={totalCount}
                assignedCount={assignedCount}
                receiptCount={receiptCount}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
