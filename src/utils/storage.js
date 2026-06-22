const DB_NAME = 'cc-statement-viewer'
const DB_VERSION = 1
const STORE_NAME = 'data'
const STATEMENTS_KEY = 'statements'
const RECEIPT_BANK_KEY = 'receipt-bank'

const LS_STATEMENTS_KEY = 'cc-statement-viewer-statements'
const LS_RECEIPT_BANK_KEY = 'cc-statement-viewer-receipt-bank'

let db = null
let saveError = null

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }
    request.onerror = () => reject(request.error)
  })
}

function idbGet(key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(key)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
  })
}

function idbSet(key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(value, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

let cachedStatements = null
let cachedReceiptBank = null

export async function initStorage() {
  try {
    await openDB()

    const [idbStatements, idbReceiptBank] = await Promise.all([
      idbGet(STATEMENTS_KEY).catch(() => null),
      idbGet(RECEIPT_BANK_KEY).catch(() => null),
    ])

    if (idbStatements) {
      cachedStatements = idbStatements
    }
    if (idbReceiptBank) {
      cachedReceiptBank = idbReceiptBank
    }

    if (!cachedStatements || !cachedReceiptBank) {
      try {
        const lsStatements = localStorage.getItem(LS_STATEMENTS_KEY)
        const lsReceiptBank = localStorage.getItem(LS_RECEIPT_BANK_KEY)
        if (!cachedStatements && lsStatements) {
          cachedStatements = JSON.parse(lsStatements)
          await idbSet(STATEMENTS_KEY, cachedStatements).catch(() => {})
          localStorage.removeItem(LS_STATEMENTS_KEY)
        }
        if (!cachedReceiptBank && lsReceiptBank) {
          cachedReceiptBank = JSON.parse(lsReceiptBank)
          await idbSet(RECEIPT_BANK_KEY, cachedReceiptBank).catch(() => {})
          localStorage.removeItem(LS_RECEIPT_BANK_KEY)
        }
      } catch {
        // localStorage migration failed, continue with defaults
      }
    }

    cachedStatements = cachedStatements || []
    cachedReceiptBank = cachedReceiptBank || {}
  } catch {
    try {
      const lsStatements = localStorage.getItem(LS_STATEMENTS_KEY)
      const lsReceiptBank = localStorage.getItem(LS_RECEIPT_BANK_KEY)
      cachedStatements = lsStatements ? JSON.parse(lsStatements) : []
      cachedReceiptBank = lsReceiptBank ? JSON.parse(lsReceiptBank) : {}
    } catch {
      cachedStatements = []
      cachedReceiptBank = {}
    }
  }
}

export function loadStatements() {
  return cachedStatements || []
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
  cachedStatements = statements
  saveError = null
  if (db) {
    idbSet(STATEMENTS_KEY, statements).catch((err) => {
      saveError = 'Failed to save — storage may be full.'
      console.error('IndexedDB save error:', err)
      lsFallbackSave(LS_STATEMENTS_KEY, statements)
    })
  } else {
    lsFallbackSave(LS_STATEMENTS_KEY, statements)
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
  return cachedReceiptBank || {}
}

export function persistReceiptBank(receiptBank) {
  cachedReceiptBank = receiptBank
  saveError = null
  if (db) {
    idbSet(RECEIPT_BANK_KEY, receiptBank).catch((err) => {
      saveError = 'Failed to save — storage may be full.'
      console.error('IndexedDB save error:', err)
      lsFallbackSave(LS_RECEIPT_BANK_KEY, receiptBank)
    })
  } else {
    lsFallbackSave(LS_RECEIPT_BANK_KEY, receiptBank)
  }
}

function lsFallbackSave(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    saveError = null
  } catch {
    saveError = 'Failed to save — storage is full. Try removing old statements or receipts.'
  }
}

export function getSaveError() {
  return saveError
}

export function clearSaveError() {
  saveError = null
}
