import { useState, useEffect, useRef } from 'react'
import FileUpload from './components/FileUpload'
import TransactionTable from './components/TransactionTable'
import SavedStatements from './components/SavedStatements'
import ReceiptUpload from './components/ReceiptUpload'
import { extractTransactionsFromPDF } from './utils/pdfParser'
import { loadStatements, updateStatementsList, persistStatements, createStatementRecord } from './utils/storage'
import './App.css'

function App() {
  const [view, setView] = useState('home')
  const [savedStatements, setSavedStatements] = useState(() => loadStatements())
  const [currentStatement, setCurrentStatement] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    persistStatements(savedStatements)
  }, [savedStatements])

  async function handleFileSelected(file) {
    setIsLoading(true)
    setError(null)

    try {
      const parsed = await extractTransactionsFromPDF(file)
      if (parsed.length === 0) {
        setError(
          'No transactions found in this PDF. Make sure it is a credit card statement with dates and amounts.'
        )
      } else {
        const record = createStatementRecord(file.name, parsed)
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

  function handleBackToList() {
    setCurrentStatement(null)
    setView('home')
    setError(null)
  }

  function handleShowUpload() {
    setView('upload')
    setError(null)
  }

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
              />
            ) : (
              <div className="upload-section">
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
