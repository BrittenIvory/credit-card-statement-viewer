import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

export async function extractTransactionsFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const lines = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    const pageLines = groupTextItemsIntoLines(content.items)
    lines.push(...pageLines)
  }

  return parseTransactionLines(lines)
}

function groupTextItemsIntoLines(items) {
  if (items.length === 0) return []

  const sorted = [...items].sort((a, b) => {
    const yDiff = b.transform[5] - a.transform[5]
    if (Math.abs(yDiff) > 3) return yDiff
    return a.transform[4] - b.transform[4]
  })

  const lines = []
  let currentLine = [sorted[0]]
  let currentY = sorted[0].transform[5]

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i]
    if (Math.abs(item.transform[5] - currentY) < 3) {
      currentLine.push(item)
    } else {
      lines.push(currentLine.map((it) => it.str).join(' '))
      currentLine = [item]
      currentY = item.transform[5]
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine.map((it) => it.str).join(' '))
  }

  return lines
}

const DATE_PATTERNS = [
  /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/,
  /^(\d{1,2}-\d{1,2}(?:-\d{2,4})?)/,
  /^([A-Z][a-z]{2}\s+\d{1,2}(?:,?\s*\d{4})?)/,
  /^(\d{1,2}\s+[A-Z][a-z]{2}(?:\s+\d{4})?)/,
]

const AMOUNT_PATTERN = /[-]?\$?\d{1,3}(?:,\d{3})*\.\d{2}\s*(?:CR|DR)?$/i

function parseTransactionLines(lines) {
  const transactions = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let hasDate = false
    for (const pattern of DATE_PATTERNS) {
      if (pattern.test(trimmed)) {
        hasDate = true
        break
      }
    }
    if (!hasDate) continue

    const amountMatch = trimmed.match(AMOUNT_PATTERN)
    if (!amountMatch) continue

    const amountStr = amountMatch[0]
    const beforeAmount = trimmed.slice(0, trimmed.lastIndexOf(amountStr)).trim()

    let dateStr = ''
    let description = beforeAmount
    for (const pattern of DATE_PATTERNS) {
      const m = beforeAmount.match(pattern)
      if (m) {
        dateStr = m[1]
        description = beforeAmount.slice(m[0].length).trim()
        break
      }
    }

    const cleanedAmount = amountStr.replace(/[$,]/g, '').trim()
    const isCredit = /CR$/i.test(cleanedAmount)
    const numericStr = cleanedAmount.replace(/\s*(CR|DR)$/i, '')
    let amount = parseFloat(numericStr)
    if (isNaN(amount)) continue

    if (isCredit) amount = -Math.abs(amount)

    if (description.length < 2) continue

    // Remove duplicate leading date from description
    for (const pattern of DATE_PATTERNS) {
      const m = description.match(pattern)
      if (m && description.startsWith(m[0])) {
        description = description.slice(m[0].length).trim()
        break
      }
    }

    transactions.push({
      id: transactions.length,
      date: dateStr,
      description: description.trim(),
      amount,
    })
  }

  return transactions
}
