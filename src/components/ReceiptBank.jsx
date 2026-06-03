import { useState, useRef } from 'react'
import { extractReceiptData, imageFileToDataURL } from '../utils/receiptParser'
import './ReceiptBank.css'

export default function ReceiptBank({ receipts, onAddReceipt, onDeleteReceipt, onBack }) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [isProcessing, setIsProcessing] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualData, setManualData] = useState({ name: '', amount: '', date: '' })
  const [pendingImage, setPendingImage] = useState(null)
  const inputRef = useRef(null)

  function getCurrentMonth() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  function formatMonth(monthStr) {
    const [year, month] = monthStr.split('-')
    const date = new Date(Number(year), Number(month) - 1, 1)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  }

  function getMonthOptions() {
    const months = []
    const now = new Date()
    for (let i = -2; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months.push(val)
    }
    const fromReceipts = Object.keys(receipts)
    for (const m of fromReceipts) {
      if (!months.includes(m)) months.push(m)
    }
    months.sort()
    return months
  }

  async function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return

    setIsProcessing(true)
    setShowManualEntry(false)
    setPendingImage(null)

    try {
      const [ocrResult, imageResult] = await Promise.allSettled([
        extractReceiptData(file),
        imageFileToDataURL(file),
      ])

      const dataURL = imageResult.status === 'fulfilled' ? imageResult.value : null
      const receiptData = ocrResult.status === 'fulfilled' ? ocrResult.value : null

      if (dataURL) setPendingImage(dataURL)

      if (receiptData) {
        setManualData({
          name: receiptData.name || '',
          amount: receiptData.amount !== null ? receiptData.amount.toFixed(2) : '',
          date: receiptData.date || '',
        })
      } else {
        setManualData({ name: '', amount: '', date: '' })
      }
      setShowManualEntry(true)
    } catch (err) {
      console.error('Receipt processing error:', err)
      setManualData({ name: '', amount: '', date: '' })
      setShowManualEntry(true)
    } finally {
      setIsProcessing(false)
    }
  }

  function handleChange(e) {
    const file = e.target.files[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function handleManualSave() {
    const amount = manualData.amount ? parseFloat(manualData.amount) : null
    const image = pendingImage || null
    const receipt = {
      id: Date.now().toString(),
      image,
      name: manualData.name,
      amount: isNaN(amount) ? null : amount,
      date: manualData.date,
      rawText: '',
      addedAt: new Date().toISOString(),
    }
    onAddReceipt(selectedMonth, receipt)
    setShowManualEntry(false)
    setManualData({ name: '', amount: '', date: '' })
    setPendingImage(null)
  }

  function handleManualAdd() {
    setShowManualEntry(true)
    setPendingImage(null)
    setManualData({ name: '', amount: '', date: '' })
  }

  const monthReceipts = receipts[selectedMonth] || []

  return (
    <div className="receipt-bank">
      <div className="receipt-bank__header">
        <button className="back-btn" onClick={onBack}>&larr; Back</button>
        <h2 className="receipt-bank__title">Receipt Bank</h2>
        <p className="receipt-bank__subtitle">
          Upload receipts throughout the month. When you add a statement, receipts will auto-match.
        </p>
      </div>

      <div className="receipt-bank__controls">
        <div className="receipt-bank__month-picker">
          <label>Month:</label>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            {getMonthOptions().map((m) => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>
        </div>
        <div className="receipt-bank__actions">
          <button
            className="receipt-bank__upload-btn"
            onClick={() => inputRef.current?.click()}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Upload receipt photo'}
          </button>
          <button className="receipt-bank__manual-btn" onClick={handleManualAdd}>
            Add manually
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleChange}
          className="receipt-upload__input"
        />
      </div>

      {showManualEntry && (
        <div className="receipt-bank__manual-form">
          <div className="receipt-bank__manual-title">
            {pendingImage ? 'Verify extracted details and save:' : 'Enter receipt details:'}
          </div>
          <div className="receipt-bank__manual-fields">
            <div className="receipt-bank__field">
              <label>Company / Name</label>
              <input
                type="text"
                value={manualData.name}
                onChange={(e) => setManualData((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Starbucks"
              />
            </div>
            <div className="receipt-bank__field">
              <label>Amount</label>
              <input
                type="number"
                step="0.01"
                value={manualData.amount}
                onChange={(e) => setManualData((d) => ({ ...d, amount: e.target.value }))}
                placeholder="e.g. 6.50"
              />
            </div>
            <div className="receipt-bank__field">
              <label>Date</label>
              <input
                type="text"
                value={manualData.date}
                onChange={(e) => setManualData((d) => ({ ...d, date: e.target.value }))}
                placeholder="e.g. 05/03/2026"
              />
            </div>
          </div>
          <div className="receipt-bank__manual-actions">
            <button className="receipt-bank__save-btn" onClick={handleManualSave}>
              Save receipt
            </button>
            <button className="receipt-bank__cancel-btn" onClick={() => {
              setShowManualEntry(false)
              setPendingImage(null)
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="receipt-bank__list">
        {monthReceipts.length === 0 ? (
          <div className="receipt-bank__empty">
            No receipts for {formatMonth(selectedMonth)} yet. Upload photos or add manually.
          </div>
        ) : (
          <>
            <div className="receipt-bank__count">
              {monthReceipts.length} receipt{monthReceipts.length !== 1 ? 's' : ''} for {formatMonth(selectedMonth)}
            </div>
            {monthReceipts.map((r) => (
              <div key={r.id} className="receipt-bank__item">
                {r.image && (
                  <img src={r.image} alt="Receipt" className="receipt-bank__thumb" />
                )}
                <div className="receipt-bank__item-info">
                  <div className="receipt-bank__item-name">{r.name || 'Unknown merchant'}</div>
                  <div className="receipt-bank__item-details">
                    {r.amount !== null ? `$${Number(r.amount).toFixed(2)}` : 'No amount'}
                    {r.date ? ` \u00B7 ${r.date}` : ''}
                  </div>
                </div>
                <button
                  className="receipt-bank__item-delete"
                  onClick={() => onDeleteReceipt(selectedMonth, r.id)}
                  title="Remove receipt"
                >
                  &times;
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
