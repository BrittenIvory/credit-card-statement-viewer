import { useState, useRef } from 'react'
import { extractReceiptData, findBestMatch, imageFileToDataURL } from '../utils/receiptParser'
import './ReceiptUpload.css'

export default function ReceiptUpload({ transactions, onReceiptMatched }) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const inputRef = useRef(null)

  async function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return

    setIsProcessing(true)
    setResult(null)

    try {
      const [receiptData, dataURL] = await Promise.all([
        extractReceiptData(file),
        imageFileToDataURL(file),
      ])

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
      }
    } catch (err) {
      console.error('Receipt processing error:', err)
      setResult({
        success: false,
        receiptData: null,
        message: 'Failed to process the receipt image.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  function handleChange(e) {
    const file = e.target.files[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function formatAmount(amount) {
    if (amount === null) return 'N/A'
    return '$' + amount.toFixed(2)
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
          <button className="receipt-result__dismiss" onClick={() => setResult(null)}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
