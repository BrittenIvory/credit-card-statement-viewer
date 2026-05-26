import { useState, useRef } from 'react'
import { extractReceiptData, findBestMatch, imageFileToDataURL } from '../utils/receiptParser'
import './ReceiptUpload.css'

export default function ReceiptUpload({ transactions, onReceiptMatched }) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [showManual, setShowManual] = useState(false)
  const [manualData, setManualData] = useState({ name: '', amount: '', date: '' })
  const [pendingImage, setPendingImage] = useState(null)
  const [manualTransaction, setManualTransaction] = useState('')
  const inputRef = useRef(null)

  async function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return

    setIsProcessing(true)
    setResult(null)
    setShowManual(false)

    try {
      const [receiptData, dataURL] = await Promise.all([
        extractReceiptData(file),
        imageFileToDataURL(file),
      ])

      setPendingImage(dataURL)

      const match = findBestMatch(receiptData, transactions)

      if (match) {
        onReceiptMatched(match.transaction.id, dataURL)
        setResult({
          success: true,
          receiptData,
          matchedTransaction: match.transaction,
          score: match.score,
        })
      } else {
        setResult({
          success: false,
          receiptData,
          message: 'Could not find a matching transaction.',
        })
        setManualData({
          name: receiptData.name || '',
          amount: receiptData.amount !== null ? receiptData.amount.toFixed(2) : '',
          date: receiptData.date || '',
        })
        setShowManual(true)
      }
    } catch (err) {
      console.error('Receipt processing error:', err)
      setResult({
        success: false,
        receiptData: null,
        message: 'Failed to process the receipt image.',
      })
      setShowManual(true)
    } finally {
      setIsProcessing(false)
    }
  }

  function handleChange(e) {
    const file = e.target.files[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function handleManualMatch() {
    if (manualTransaction && pendingImage) {
      onReceiptMatched(manualTransaction, pendingImage)
      setResult({
        success: true,
        receiptData: {
          name: manualData.name,
          amount: manualData.amount ? parseFloat(manualData.amount) : null,
          date: manualData.date,
        },
        matchedTransaction: transactions.find((t) => String(t.id) === manualTransaction),
        score: 'manual',
      })
      setShowManual(false)
    }
  }

  function handleManualRetry() {
    const amount = manualData.amount ? parseFloat(manualData.amount) : null
    const retryData = {
      name: manualData.name || null,
      amount: isNaN(amount) ? null : amount,
      date: manualData.date || null,
    }
    const match = findBestMatch(retryData, transactions)
    if (match && pendingImage) {
      onReceiptMatched(match.transaction.id, pendingImage)
      setResult({
        success: true,
        receiptData: retryData,
        matchedTransaction: match.transaction,
        score: match.score,
      })
      setShowManual(false)
    } else {
      setResult({
        success: false,
        receiptData: retryData,
        message: 'Still no match found. Pick a transaction manually below.',
      })
    }
  }

  function formatAmount(amount) {
    if (amount === null || amount === undefined) return 'N/A'
    return '$' + Number(amount).toFixed(2)
  }

  function handleDismiss() {
    setResult(null)
    setShowManual(false)
    setPendingImage(null)
    setManualData({ name: '', amount: '', date: '' })
    setManualTransaction('')
  }

  return (
    <div className="receipt-upload">
      <button
        className="receipt-upload__btn"
        onClick={() => inputRef.current?.click()}
        disabled={isProcessing}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        {isProcessing ? 'Processing receipt...' : 'Upload receipt photo'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="receipt-upload__input"
      />

      {result && (
        <div className={`receipt-result ${result.success ? 'receipt-result--success' : 'receipt-result--error'}`}>
          {result.success ? (
            <>
              <div className="receipt-result__title">Receipt matched!</div>
              <div className="receipt-result__details">
                <span>Matched to: <strong>{result.matchedTransaction.description}</strong></span>
                <span>Receipt: {result.receiptData.name || 'Unknown'} &middot; {formatAmount(result.receiptData.amount)} &middot; {result.receiptData.date || 'No date'}</span>
              </div>
            </>
          ) : (
            <>
              <div className="receipt-result__title">{result.message}</div>
              {result.receiptData && (
                <div className="receipt-result__details">
                  <span>Extracted: {result.receiptData.name || 'No name'} &middot; {formatAmount(result.receiptData.amount)} &middot; {result.receiptData.date || 'No date'}</span>
                </div>
              )}
            </>
          )}
          <button className="receipt-result__dismiss" onClick={handleDismiss}>
            Dismiss
          </button>
        </div>
      )}

      {showManual && (
        <div className="receipt-manual">
          <div className="receipt-manual__title">Correct or enter receipt details manually:</div>
          <div className="receipt-manual__fields">
            <div className="receipt-manual__field">
              <label>Company / Name</label>
              <input
                type="text"
                value={manualData.name}
                onChange={(e) => setManualData((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Starbucks"
              />
            </div>
            <div className="receipt-manual__field">
              <label>Amount</label>
              <input
                type="number"
                step="0.01"
                value={manualData.amount}
                onChange={(e) => setManualData((d) => ({ ...d, amount: e.target.value }))}
                placeholder="e.g. 6.50"
              />
            </div>
            <div className="receipt-manual__field">
              <label>Date</label>
              <input
                type="text"
                value={manualData.date}
                onChange={(e) => setManualData((d) => ({ ...d, date: e.target.value }))}
                placeholder="e.g. 05/03/2026"
              />
            </div>
          </div>
          <div className="receipt-manual__actions">
            <button className="receipt-manual__retry" onClick={handleManualRetry}>
              Re-match with corrected info
            </button>
            <span className="receipt-manual__or">or pick transaction:</span>
            <select
              className="receipt-manual__select"
              value={manualTransaction}
              onChange={(e) => setManualTransaction(e.target.value)}
            >
              <option value="">Select transaction...</option>
              {transactions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.date} - {t.description} - ${Math.abs(t.amount).toFixed(2)}
                </option>
              ))}
            </select>
            <button
              className="receipt-manual__apply"
              onClick={handleManualMatch}
              disabled={!manualTransaction}
            >
              Apply to selected
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
