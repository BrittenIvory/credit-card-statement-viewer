const STORAGE_KEY = 'cc-statement-viewer-statements'

export function loadStatements() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveStatement(statement) {
  const statements = loadStatements()
  const existing = statements.findIndex((s) => s.id === statement.id)
  if (existing >= 0) {
    statements[existing] = statement
  } else {
    statements.unshift(statement)
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statements))
  } catch {
    console.warn('localStorage quota exceeded — receipt images may not persist across sessions')
  }
  return statements
}

export function deleteStatement(id) {
  const statements = loadStatements().filter((s) => s.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(statements))
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
