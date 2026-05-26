const STORAGE_KEY = 'cc-statement-viewer-statements'
const RECEIPT_BANK_KEY = 'cc-statement-viewer-receipt-bank'

export function loadStatements() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function updateStatementsList(statements, statement) {
  const result = [...statements]
  const existing = result.findIndex((s) => s.id === statement.id)
  if (existing >= 0) {
    result[existing] = statement
  } else {
    result.unshift(statement)
  }
  return result
}

export function persistStatements(statements) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statements))
  } catch {
    console.warn('localStorage quota exceeded — receipt images may not persist across sessions')
  }
}

export function deleteStatement(id) {
  const statements = loadStatements().filter((s) => s.id !== id)
  persistStatements(statements)
  return statements
}

export function createStatementRecord(fileName, transactions) {
  return {
    id: Date.now().toString(),
    fileName,
    uploadDate: new Date().toISOString(),
    transactions,
    verifiedIds: [],
    companyAssignments: {},
    receiptImages: {},
  }
}

export function loadReceiptBank() {
  try {
    const data = localStorage.getItem(RECEIPT_BANK_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

export function persistReceiptBank(receiptBank) {
  try {
    localStorage.setItem(RECEIPT_BANK_KEY, JSON.stringify(receiptBank))
  } catch {
    console.warn('localStorage quota exceeded — receipt bank images may not persist')
  }
}
