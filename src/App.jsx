import { useState, useEffect, useRef } from 'react'
import FileUpload from './components/FileUpload'
import TransactionTable from './components/TransactionTable'
import SavedStatements from './components/SavedStatements'
import ReceiptUpload from './components/ReceiptUpload'
import ReceiptBank from './components/ReceiptBank'
import { extractTransactionsFromPDF } from './utils/pdfParser'
import { findBestMatch } from './utils/receiptParser'
import { loadStatements, updateStatementsList, persistStatements, createStatementRecord, loadReceiptBank, persistReceiptBank } from './utils/storage'
import './App.css'

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

  function autoMatchReceipts(record) {
    const allReceipts = Object.values(receiptBank).flat()
    if (allReceipts.length === 0) return record

    let updated = { ...record }
    const matched = []

    for (const receipt of allReceipts) {
      const receiptData = {
        name: receipt.name || null,
        amount: receipt.amount,
        date: receipt.date || null,
      }
      const match = findBestMatch(receiptData, record.transactions)
      if (match && !updated.receiptImages[match.transaction.id]) {
        updated = {
          ...updated,
          receiptImages: {
            ...updated.receiptImages,
            [match.transaction.id]: receipt.image,
          },
        }
        matched.push({
          receipt,
          transaction: match.transaction,
          score: match.score,
        })
      }
    }

    if (matched.length > 0) {
      setAutoMatchResults(matched)
    }

    return updated
  }

  async function handleFileSelected(file) {
    setIsLoading(true)
    setError(null)
    setAutoMatchResults(null)

    try {
      const parsed = await extractTransactionsFromPDF(file)
      if (parsed.length === 0) {
        setError(
          'No transactions found in this PDF. Make sure it is a credit card statement with dates and amounts.'
        )
      } else {
        let record = createStatementRecord(file.name, parsed)
        record = autoMatchReceipts(record)
        setSavedStatements((prev) => updateStatementsList(prev, record))
        setCurrentStatement(record)
        setView('detail')
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

  function updateCurrentStatement(updater) {
    setCurrentStatement((prev) => {
      if (!prev) return prev
      const updated = updater(prev)
      setSavedStatements((prevStatements) => updateStatementsList(prevStatements, updated))
      return updated
    })
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

  function handleReceiptMatched(transactionId, imageDataURL) {
    updateCurrentStatement((prev) => ({
      ...prev,
      receiptImages: { ...prev.receiptImages, [transactionId]: imageDataURL },
    }))
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

      <main className="app-main">
        {view === 'home' && (
          <>
            {savedStatements.length > 0 ? (
              <SavedStatements
                statements={savedStatements}
                onSelect={handleSelectSaved}
                onDelete={handleDeleteSaved}
                onUploadNew={handleShowUpload}
                onOpenReceiptBank={handleShowReceiptBank}
                receiptBankCount={receiptBankCount}
              />
            ) : (
              <div className="upload-section">
                <div className="home-actions">
                  <button className="receipt-bank-link" onClick={handleShowReceiptBank}>
                    Receipt Bank{receiptBankCount > 0 ? ` (${receiptBankCount})` : ''}
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
                  <span className="results-header__file">{currentStatement.fileName}</span>
                  <span className="results-header__count">
                    {currentStatement.transactions.length} transactions
                  </span>
                </div>
              </div>
              <ReceiptUpload
                transactions={currentStatement.transactions}
                onReceiptMatched={handleReceiptMatched}
              />
            </div>

            {autoMatchResults && autoMatchResults.length > 0 && (
              <div className="auto-match-banner">
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

export default App
