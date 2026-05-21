import { useState, useRef } from 'react'
import './FileUpload.css'

export default function FileUpload({ onFileSelected, isLoading }) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)

  function handleDragOver(e) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') {
      onFileSelected(file)
    }
  }

  function handleChange(e) {
    const file = e.target.files[0]
    if (file) {
      onFileSelected(file)
    }
  }

  return (
    <div
      className={`file-upload ${isDragging ? 'file-upload--dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        onChange={handleChange}
        className="file-upload__input"
      />
      <div className="file-upload__icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="12" y2="12" />
          <line x1="15" y1="15" x2="12" y2="12" />
        </svg>
      </div>
      {isLoading ? (
        <p className="file-upload__text">Processing PDF...</p>
      ) : (
        <>
          <p className="file-upload__text">
            Drag & drop your credit card statement PDF here
          </p>
          <p className="file-upload__subtext">or click to browse</p>
        </>
      )}
    </div>
  )
}
