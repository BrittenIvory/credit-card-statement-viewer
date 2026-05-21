import Tesseract from 'tesseract.js'

export async function extractReceiptData(imageFile) {
  const { data } = await Tesseract.recognize(imageFile, 'eng')
  const text = data.text

  const date = extractDate(text)
  const amount = extractAmount(text)
  const name = extractName(text)

  return { date, amount, name, rawText: text }
}

function extractDate(text) {
  const patterns = [
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    /(\d{1,2}-\d{1,2}-\d{2,4})/,
    /([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})/,
    /(\d{1,2}\s+[A-Z][a-z]{2,}\s+\d{4})/,
    /(\d{1,2}\/\d{1,2})/,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[1]
  }
  return null
}

function extractAmount(text) {
  const patterns = [
    /(?:total|amount|due|charged?|balance)[:\s]*\$?([\d,]+\.\d{2})/i,
    /\$\s*([\d,]+\.\d{2})/,
    /([\d,]+\.\d{2})\s*$/m,
  ]

  let bestAmount = null
  for (const pattern of patterns) {
    const matches = [...text.matchAll(new RegExp(pattern, 'gi'))]
    for (const match of matches) {
      const val = parseFloat(match[1].replace(/,/g, ''))
      if (!isNaN(val) && (bestAmount === null || val > bestAmount)) {
        bestAmount = val
      }
    }
    if (bestAmount !== null) break
  }
  return bestAmount
}

function extractName(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 2)

  const skipPatterns = [
    /^\d+[/\\.:-]/,
    /^\$/,
    /^total/i,
    /^subtotal/i,
    /^tax/i,
    /^change/i,
    /^cash/i,
    /^credit/i,
    /^debit/i,
    /^visa/i,
    /^mastercard/i,
    /^amex/i,
    /^\d+\.\d{2}$/,
    /^#/,
    /^tel/i,
    /^phone/i,
    /^address/i,
    /^www\./i,
    /^http/i,
  ]

  for (const line of lines.slice(0, 5)) {
    const isSkip = skipPatterns.some((p) => p.test(line))
    if (!isSkip && line.length >= 3 && line.length <= 60) {
      return line.replace(/[^\w\s&'.-]/g, '').trim()
    }
  }

  return lines[0] || null
}

export function findBestMatch(receiptData, transactions) {
  if (!receiptData.amount && !receiptData.date && !receiptData.name) {
    return null
  }

  let bestMatch = null
  let bestScore = 0

  for (const t of transactions) {
    let score = 0

    if (receiptData.amount !== null) {
      const diff = Math.abs(Math.abs(t.amount) - receiptData.amount)
      if (diff < 0.01) score += 50
      else if (diff < 1) score += 30
      else if (diff < 5) score += 10
    }

    if (receiptData.date) {
      const receiptDateNorm = normalizeDate(receiptData.date)
      const txDateNorm = normalizeDate(t.date)
      if (receiptDateNorm && txDateNorm && receiptDateNorm === txDateNorm) {
        score += 30
      }
    }

    if (receiptData.name) {
      const nameWords = receiptData.name.toLowerCase().split(/\s+/)
      const descLower = t.description.toLowerCase()
      let nameScore = 0
      for (const word of nameWords) {
        if (word.length >= 3 && descLower.includes(word)) {
          nameScore += 10
        }
      }
      score += Math.min(nameScore, 20)
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = t
    }
  }

  return bestScore >= 30 ? { transaction: bestMatch, score: bestScore } : null
}

function normalizeDate(dateStr) {
  if (!dateStr) return null

  const slashMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (slashMatch) {
    const m = slashMatch[1].padStart(2, '0')
    const d = slashMatch[2].padStart(2, '0')
    return `${m}/${d}`
  }

  const dashMatch = dateStr.match(/(\d{1,2})-(\d{1,2})(?:-(\d{2,4}))?/)
  if (dashMatch) {
    const m = dashMatch[1].padStart(2, '0')
    const d = dashMatch[2].padStart(2, '0')
    return `${m}/${d}`
  }

  return dateStr.toLowerCase().replace(/,/g, '').trim()
}

export function imageFileToDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.readAsDataURL(file)
  })
}
