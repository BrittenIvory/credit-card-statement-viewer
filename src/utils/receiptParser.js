import Tesseract from 'tesseract.js'

export async function extractReceiptData(imageFile) {
  const { data } = await Tesseract.recognize(imageFile, 'eng', {
    tessedit_pageseg_mode: '6',
  })
  const text = data.text

  const date = extractDate(text)
  const amount = extractAmount(text)
  const name = extractName(text)

  return { date, amount, name, rawText: text }
}

function extractDate(text) {
  const patterns = [
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{1,2}\/\d{1,2}\/\d{2})\b/,
    /(\d{1,2}-\d{1,2}-\d{4})/,
    /(\d{1,2}-\d{1,2}-\d{2})\b/,
    /(\d{4}-\d{2}-\d{2})/,
    /([A-Z][a-z]{2,8}\s+\d{1,2},?\s*\d{4})/,
    /(\d{1,2}\s+[A-Z][a-z]{2,8}\s+\d{4})/,
    /(\d{1,2}\.\d{1,2}\.\d{2,4})/,
    /(\d{1,2}\/\d{1,2})/,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[1]
  }
  return null
}

function extractAmount(text) {
  const lines = text.split('\n')

  const totalPatterns = [
    /(?:total|grand\s*total|amount\s*due|balance\s*due|total\s*due|total\s*charged?|net\s*total|amount\s*charged?)[:\s]*\$?\s*([\d,]+\.\d{2})/i,
    /\$?\s*([\d,]+\.\d{2})\s*(?:total|due|charged)/i,
  ]

  for (const pattern of totalPatterns) {
    for (const line of lines) {
      const match = line.match(pattern)
      if (match) {
        const val = parseFloat(match[1].replace(/,/g, ''))
        if (!isNaN(val) && val > 0) return val
      }
    }
  }

  const dollarAmounts = []
  const dollarPattern = /\$\s*([\d,]+\.\d{2})/g
  let m
  while ((m = dollarPattern.exec(text)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''))
    if (!isNaN(val) && val > 0) dollarAmounts.push(val)
  }
  if (dollarAmounts.length > 0) {
    return Math.max(...dollarAmounts)
  }

  const bareAmounts = []
  const barePattern = /([\d,]+\.\d{2})\s*$/gm
  while ((m = barePattern.exec(text)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''))
    if (!isNaN(val) && val > 0) bareAmounts.push(val)
  }
  if (bareAmounts.length > 0) {
    return Math.max(...bareAmounts)
  }

  return null
}

function extractName(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 2)

  const skipPatterns = [
    /^\d+[/\\.:-]/,
    /^\$/,
    /^total/i,
    /^subtotal/i,
    /^sub\s*total/i,
    /^tax/i,
    /^change/i,
    /^cash/i,
    /^credit/i,
    /^debit/i,
    /^visa/i,
    /^mastercard/i,
    /^amex/i,
    /^discover/i,
    /^\d+\.\d{2}$/,
    /^#/,
    /^tel/i,
    /^phone/i,
    /^address/i,
    /^www\./i,
    /^http/i,
    /^thank/i,
    /^receipt/i,
    /^order/i,
    /^date/i,
    /^time/i,
    /^cashier/i,
    /^server/i,
    /^store/i,
    /^qty/i,
    /^item/i,
    /^\d+$/,
    /^[*=\-_]{3,}/,
    /^ref/i,
    /^trans/i,
    /^auth/i,
    /^card/i,
    /^payment/i,
    /^balance/i,
    /^tip/i,
    /^gratuity/i,
  ]

  for (const line of lines.slice(0, 8)) {
    const cleaned = line.replace(/[^\w\s&'.,\-#]/g, '').trim()
    if (cleaned.length < 3 || cleaned.length > 60) continue
    const isSkip = skipPatterns.some((p) => p.test(cleaned))
    if (!isSkip) {
      return cleaned
    }
  }

  return lines[0] ? lines[0].replace(/[^\w\s&'.-]/g, '').trim() : null
}

export function findBestMatch(receiptData, transactions) {
  if (receiptData.amount === null && !receiptData.date && !receiptData.name) {
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

  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return `${isoMatch[2]}/${isoMatch[3]}`
  }

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

  const dotMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/)
  if (dotMatch) {
    const m = dotMatch[1].padStart(2, '0')
    const d = dotMatch[2].padStart(2, '0')
    return `${m}/${d}`
  }

  const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' }
  const namedMatch = dateStr.match(/([A-Za-z]{3,9})\s+(\d{1,2})/i)
  if (namedMatch) {
    const monthKey = namedMatch[1].toLowerCase().slice(0, 3)
    if (months[monthKey]) {
      return `${months[monthKey]}/${namedMatch[2].padStart(2, '0')}`
    }
  }
  const namedMatch2 = dateStr.match(/(\d{1,2})\s+([A-Za-z]{3,9})/i)
  if (namedMatch2) {
    const monthKey = namedMatch2[2].toLowerCase().slice(0, 3)
    if (months[monthKey]) {
      return `${months[monthKey]}/${namedMatch2[1].padStart(2, '0')}`
    }
  }

  return dateStr.toLowerCase().replace(/,/g, '').trim()
}

export function imageFileToDataURL(file, maxDim = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Failed to load image'))
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
