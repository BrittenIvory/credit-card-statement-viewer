import { useState } from 'react'
import FileUpload from './components/FileUpload'
import TransactionTable from './components/TransactionTable'
import { extractTransactionsFromPDF } from './utils/pdfParser'
import './App.css'

function App() {
  const [transactions, setTransactions] = useState([])
  const [fileName, setFileName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [verifiedIds, setVerifiedIds] = useState(new Set())

  async function handleFileSelected(file) {
    setIsLoading(true)
    setError(null)
    setFileName(file.name)

    try {
      const parsed = await extractTransactionsFromPDF(file)
      if (parsed.length === 0) {
        setError(
          'No transactions found in this PDF. Make sure it is a credit card statement with dates and amounts.'
        )
        setTransactions([])
      } else {
        setTransactions(parsed)
      }
    } catch (err) {
      console.error('PDF parsing error:', err)
      setError('Failed to parse the PDF. Please make sure it is a valid credit card statement.')
      setTransactions([])
    } finally {
      setIsLoading(false)
    }
  }

  function handleToggleVerified(id) {
    setVerifiedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleReset() {
    setTransactions([])
    setFileName('')
    setError(null)
    setVerifiedIds(new Set())
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Credit Card Statement Viewer</h1>
        <p className="app-subtitle">
          Upload a PDF statement to view, filter, and sort your transactions
        </p>
      </header>

      <main className="app-main">
        {transactions.length === 0 ? (
          <div className="upload-section">
            <FileUpload
              onFileSelected={handleFileSelected}
              isLoading={isLoading}
            />
            {error && <div className="error-message">{error}</div>}
          </div>
        ) : (
          <div className="results-section">
            <div className="results-header">
              <div className="results-header__info">
                <span className="results-header__file">{fileName}</span>
                <span className="results-header__count">
                  {transactions.length} transactions found
                </span>
              </div>
              <button className="upload-new-btn" onClick={handleReset}>
                Upload new statement
              </button>
            </div>
            <TransactionTable
              transactions={transactions}
              verifiedIds={verifiedIds}
              onToggleVerified={handleToggleVerified}
            />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
