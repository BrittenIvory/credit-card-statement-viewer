import { useState, useEffect, useRef } from 'react'
import FileUpload from './components/FileUpload'
import TransactionTable from './components/TransactionTable'
import SavedStatements from './components/SavedStatements'
import ReceiptUpload from './components/ReceiptUpload'
import ReceiptBank from './components/ReceiptBank'
import { extractTransactionsFromPDF } from './utils/pdfParser'
import { findBestMatch } from './utils/receiptParser'
import { initStorage, loadStatements, updateStatementsList, persistStatements, createStatementRecord, loadReceiptBank, persistReceiptBank } from './utils/storage'
import './App.css'

function EditableName({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)
  const isCancellingRef = useRef(false)

  useEffect(() => {
    setDraft(value)
  }, [value])

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
    if (draft.trim() && draft.trim() !== value) {
      onSave(draft.trim())
    } else {
      setDraft(value)
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="editable-name__input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') inputRef.current?.blur()
          if (e.key === 'Escape') {
            isCancellingRef.current = true
            setDraft(value)
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <span className="editable-name" onClick={() => setEditing(true)} title="Click to rename">
      {value}
      <svg className="editable-name__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </span>
  )
}

function AppLoader() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initStorage().then(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className="app">
        <header className="app-header">
          <h1 className="app-title">Credit Card Statement Viewer</h1>
          <p className="app-subtitle">Loading your data...</p>
        </header>
      </div>
    )
  }

  return <App />
}

function App() {
  const [view, setView] = useState('home')
  const [savedStatements, setSavedStatements] = useState(() => loadStatements())
  const [receiptBank, setReceiptBank] = useState(() => loadReceiptBank())
  const [currentStatement, setCurrentStatement] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [autoMatchResults, setAutoMatchResults] = useState(null)
  const isInitialMount = useRef(true)
  const isInitialMountBank = useRef(true)
  const uploadActiveRef = useRef(false)
  const importInputRef = useRef(null)

  function triggerImport() {
    importInputRef.current?.click()
  }

  function handleImportInputChange(e) {
    const file = e.target.files[0]
    if (file) handleImportBackup(file)
    e.target.value = ''
  }

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    persistStatements(savedStatements)
  }, [savedStatements])

  useEffect(() => {
    if (isInitialMountBank.current) {
      isInitialMountBank.current = false
      return
    }
    persistReceiptBank(receiptBank)
  }, [receiptBank])

  function matchReceiptsIntoRecord(record, bank) {
    const allReceipts = Object.entries(bank).flatMap(([month, arr]) =>
      arr.map((r) => ({ ...r, _month: month }))
    )
    if (allReceipts.length === 0) {
      return { record, matched: [], matchedReceiptIds: [] }
    }

    const updated = {
      ...record,
      receiptImages: { ...record.receiptImages },
      companyAssignments: { ...record.companyAssignments },
      verifiedIds: [...record.verifiedIds],
    }
    const verifiedSet = new Set(updated.verifiedIds)
    const claimedTxIds = new Set(
      Object.keys(updated.receiptImages).map((k) => Number(k))
    )
    const matched = []
    const matchedReceiptIds = []

    for (const receipt of allReceipts) {
      const receiptData = {
        name: receipt.name || null,
        amount: receipt.amount,
        date: receipt.date || null,
      }
      const match = findBestMatch(receiptData, record.transactions)
      if (!match) continue

      const txId = match.transaction.id
      if (claimedTxIds.has(txId)) continue
      claimedTxIds.add(txId)

      if (receipt.image) {
        updated.receiptImages[txId] = receipt.image
      }
      if (receipt.company) {
        updated.companyAssignments[txId] = receipt.company
      }
      verifiedSet.add(txId)

      matched.push({ receipt, transaction: match.transaction, score: match.score })
      matchedReceiptIds.push({ month: receipt._month, id: receipt.id })
    }

    updated.verifiedIds = [...verifiedSet]
    return { record: updated, matched, matchedReceiptIds }
  }

  function markReceiptsMatched(matchedReceiptIds) {
    if (matchedReceiptIds.length === 0) return
    setReceiptBank((prev) => {
      const next = { ...prev }
      for (const { month, id } of matchedReceiptIds) {
        if (!next[month]) continue
        next[month] = next[month].map((r) =>
          r.id === id ? { ...r, matched: true } : r
        )
      }
      return next
    })
  }

  async function handleFileSelected(file) {
    setIsLoading(true)
    setError(null)
    setAutoMatchResults(null)
    uploadActiveRef.current = true

    try {
      const parsed = await extractTransactionsFromPDF(file)
      if (parsed.length === 0) {
        setError(
          'No transactions found in this PDF. Make sure it is a credit card statement with dates and amounts.'
        )
      } else {
        const base = createStatementRecord(file.name, parsed)
        const { record, matched, matchedReceiptIds } = matchReceiptsIntoRecord(base, receiptBank)
        if (matched.length > 0) {
          setAutoMatchResults(matched)
          markReceiptsMatched(matchedReceiptIds)
        }
        setSavedStatements((prev) => updateStatementsList(prev, record))
        if (uploadActiveRef.current) {
          setCurrentStatement(record)
          setView('detail')
        }
      }
    } catch (err) {
      console.error('PDF parsing error:', err)
      setError('Failed to parse the PDF. Please make sure it is a valid credit card statement.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleSelectSaved(statement) {
    setCurrentStatement(statement)
    setAutoMatchResults(null)
    setView('detail')
  }

  function handleDeleteSaved(id) {
    setSavedStatements((prev) => prev.filter((s) => s.id !== id))
    if (currentStatement && currentStatement.id === id) {
      setCurrentStatement(null)
      setView('home')
    }
  }

  const currentStatementRef = useRef(currentStatement)
  currentStatementRef.current = currentStatement

  function updateCurrentStatement(updater) {
    const prev = currentStatementRef.current
    if (!prev) return
    const updated = updater(prev)
    setCurrentStatement(updated)
    setSavedStatements((prevStatements) => updateStatementsList(prevStatements, updated))
  }

  function handleToggleVerified(id) {
    updateCurrentStatement((prev) => {
      const verifiedSet = new Set(prev.verifiedIds)
      if (verifiedSet.has(id)) {
        verifiedSet.delete(id)
      } else {
        verifiedSet.add(id)
      }
      return { ...prev, verifiedIds: [...verifiedSet] }
    })
  }

  function handleBatchToggleVerified(ids, shouldVerify) {
    updateCurrentStatement((prev) => {
      const verifiedSet = new Set(prev.verifiedIds)
      for (const id of ids) {
        if (shouldVerify) {
          verifiedSet.add(id)
        } else {
          verifiedSet.delete(id)
        }
      }
      return { ...prev, verifiedIds: [...verifiedSet] }
    })
  }

  function handleAssignCompany(id, company) {
    updateCurrentStatement((prev) => ({
      ...prev,
      companyAssignments: { ...prev.companyAssignments, [id]: company },
    }))
  }

  function handleRenameStatement(id, newName) {
    if (!newName || !newName.trim()) return
    const trimmed = newName.trim()
    setSavedStatements((prev) =>
      prev.map((s) => (s.id === id ? { ...s, fileName: trimmed } : s))
    )
    setCurrentStatement((prev) =>
      prev && prev.id === id ? { ...prev, fileName: trimmed } : prev
    )
  }

  function handleReceiptMatched(transactionId, imageDataURL) {
    updateCurrentStatement((prev) => {
      const verifiedSet = new Set(prev.verifiedIds)
      verifiedSet.add(transactionId)
      return {
        ...prev,
        receiptImages: { ...prev.receiptImages, [transactionId]: imageDataURL },
        verifiedIds: [...verifiedSet],
      }
    })
  }

  function handleExportBackup() {
    const payload = {
      app: 'credit-card-statement-viewer',
      version: 1,
      exportedAt: new Date().toISOString(),
      statements: savedStatements,
      receiptBank,
    }
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cc-statement-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  async function handleImportBackup(file) {
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const hasStatements = Array.isArray(data?.statements)
      const hasBank = data?.receiptBank && typeof data.receiptBank === 'object'
      if (!hasStatements && !hasBank) {
        window.alert('That file is not a valid backup export.')
        return
      }

      if (hasStatements) {
        setSavedStatements((prev) => {
          const byId = new Map(prev.map((s) => [s.id, s]))
          for (const s of data.statements) byId.set(s.id, s)
          return [...byId.values()]
        })
      }
      if (hasBank) {
        setReceiptBank((prev) => {
          const next = { ...prev }
          for (const [month, arr] of Object.entries(data.receiptBank)) {
            if (!Array.isArray(arr)) continue
            const existing = next[month] || []
            const byId = new Map(existing.map((r) => [r.id, r]))
            for (const r of arr) byId.set(r.id, r)
            next[month] = [...byId.values()]
          }
          return next
        })
      }

      const count = hasStatements ? data.statements.length : 0
      window.alert(`Backup imported. Restored ${count} statement${count !== 1 ? 's' : ''} and their receipts.`)
    } catch (err) {
      console.error('Backup import error:', err)
      window.alert('Failed to import backup — the file may be corrupted or not a valid backup.')
    }
  }

  function handleRematchReceipts() {
    const prev = currentStatementRef.current
    if (!prev) return
    const { record, matched, matchedReceiptIds } = matchReceiptsIntoRecord(prev, receiptBank)
    setAutoMatchResults(matched)
    if (matched.length > 0) {
      setCurrentStatement(record)
      setSavedStatements((s) => updateStatementsList(s, record))
      markReceiptsMatched(matchedReceiptIds)
    }
  }

  function handleAddReceiptToBank(month, receipt) {
    setReceiptBank((prev) => {
      const existing = prev[month] || []
      const updated = existing.find((r) => r.id === receipt.id)
        ? existing.map((r) => (r.id === receipt.id ? receipt : r))
        : [...existing, receipt]
      return { ...prev, [month]: updated }
    })
  }

  function handleDeleteReceiptFromBank(month, receiptId) {
    setReceiptBank((prev) => {
      const existing = prev[month] || []
      const updated = existing.filter((r) => r.id !== receiptId)
      const result = { ...prev }
      if (updated.length === 0) {
        delete result[month]
      } else {
        result[month] = updated
      }
      return result
    })
  }

  function handleBackToList() {
    uploadActiveRef.current = false
    setCurrentStatement(null)
    setAutoMatchResults(null)
    setView('home')
    setError(null)
  }

  function handleShowUpload() {
    setView('upload')
    setError(null)
  }

  function handleShowReceiptBank() {
    uploadActiveRef.current = false
    setView('receipt-bank')
    setError(null)
  }

  const receiptBankCount = Object.values(receiptBank).reduce((sum, arr) => sum + arr.length, 0)
  const verifiedSet = currentStatement ? new Set(currentStatement.verifiedIds) : new Set()

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title" onClick={handleBackToList} style={{ cursor: 'pointer' }}>
          Credit Card Statement Viewer
        </h1>
        <p className="app-subtitle">
          Upload a PDF statement to view, filter, and sort your transactions
        </p>
      </header>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImportInputChange}
        style={{ display: 'none' }}
      />

      <main className="app-main">
        {view === 'home' && (
          <>
            {savedStatements.length > 0 ? (
              <SavedStatements
                statements={savedStatements}
                onSelect={handleSelectSaved}
                onDelete={handleDeleteSaved}
                onRename={handleRenameStatement}
                onUploadNew={handleShowUpload}
                onOpenReceiptBank={handleShowReceiptBank}
                receiptBankCount={receiptBankCount}
                onExportBackup={handleExportBackup}
                onImportBackup={triggerImport}
              />
            ) : (
              <div className="upload-section">
                <div className="home-actions">
                  <button className="receipt-bank-link" onClick={handleShowReceiptBank}>
                    Receipt Bank{receiptBankCount > 0 ? ` (${receiptBankCount})` : ''}
                  </button>
                  <button className="backup-btn" onClick={triggerImport}>
                    Import backup
                  </button>
                </div>
                <FileUpload
                  onFileSelected={handleFileSelected}
                  isLoading={isLoading}
                />
                {error && <div className="error-message">{error}</div>}
              </div>
            )}
          </>
        )}

        {view === 'upload' && (
          <div className="upload-section">
            <button className="back-btn" onClick={handleBackToList}>
              &larr; Back to saved statements
            </button>
            <FileUpload
              onFileSelected={handleFileSelected}
              isLoading={isLoading}
            />
            {error && <div className="error-message">{error}</div>}
          </div>
        )}

        {view === 'receipt-bank' && (
          <ReceiptBank
            receipts={receiptBank}
            onAddReceipt={handleAddReceiptToBank}
            onDeleteReceipt={handleDeleteReceiptFromBank}
            onBack={handleBackToList}
          />
        )}

        {view === 'detail' && currentStatement && (
          <div className="results-section">
            <div className="results-header">
              <div className="results-header__left">
                <button className="back-btn" onClick={handleBackToList}>
                  &larr; Back
                </button>
                <div className="results-header__info">
                  <EditableName
                    value={currentStatement.fileName}
                    onSave={(newName) => handleRenameStatement(currentStatement.id, newName)}
                  />
                  <span className="results-header__count">
                    {currentStatement.transactions.length} transactions
                  </span>
                </div>
              </div>
              <div className="results-header__tools">
                <button
                  className="rematch-btn"
                  onClick={handleRematchReceipts}
                  disabled={receiptBankCount === 0}
                  title={receiptBankCount === 0 ? 'No receipts in the Receipt Bank' : 'Re-check all Receipt Bank receipts against this statement'}
                >
                  Re-check Receipt Bank{receiptBankCount > 0 ? ` (${receiptBankCount})` : ''}
                </button>
                <ReceiptUpload
                  transactions={currentStatement.transactions}
                  onReceiptMatched={handleReceiptMatched}
                />
              </div>
            </div>

            {autoMatchResults && (
              <div className="auto-match-banner">
                {autoMatchResults.length > 0 ? (
                  <>
                    <div className="auto-match-banner__title">
                      Auto-matched {autoMatchResults.length} receipt{autoMatchResults.length !== 1 ? 's' : ''} from Receipt Bank
                    </div>
                    <div className="auto-match-banner__list">
                      {autoMatchResults.map((m, i) => (
                        <span key={i}>
                          {m.receipt.name || 'Receipt'} &rarr; {m.transaction.description}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="auto-match-banner__title">
                    No new receipts matched these transactions.
                  </div>
                )}
                <button className="auto-match-banner__dismiss" onClick={() => setAutoMatchResults(null)}>
                  Dismiss
                </button>
              </div>
            )}

            <TransactionTable
              transactions={currentStatement.transactions}
              verifiedIds={verifiedSet}
              onToggleVerified={handleToggleVerified}
              onBatchToggleVerified={handleBatchToggleVerified}
              companyAssignments={currentStatement.companyAssignments}
              onAssignCompany={handleAssignCompany}
              receiptImages={currentStatement.receiptImages}
            />
          </div>
        )}
      </main>
    </div>
  )
}

export default AppLoader
