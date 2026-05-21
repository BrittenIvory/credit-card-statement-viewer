import { useState, useMemo } from 'react'
import './TransactionTable.css'

const SORT_DIRECTIONS = { ASC: 'asc', DESC: 'desc' }

export default function TransactionTable({ transactions }) {
  const [nameFilter, setNameFilter] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [sortField, setSortField] = useState(null)
  const [sortDirection, setSortDirection] = useState(SORT_DIRECTIONS.ASC)

  const filtered = useMemo(() => {
    let result = [...transactions]

    if (nameFilter.trim()) {
      const query = nameFilter.toLowerCase()
      result = result.filter((t) =>
        t.description.toLowerCase().includes(query)
      )
    }

    if (minAmount !== '') {
      const min = parseFloat(minAmount)
      if (!isNaN(min)) {
        result = result.filter((t) => t.amount >= min)
      }
    }

    if (maxAmount !== '') {
      const max = parseFloat(maxAmount)
      if (!isNaN(max)) {
        result = result.filter((t) => t.amount <= max)
      }
    }

    if (sortField) {
      result.sort((a, b) => {
        let cmp = 0
        if (sortField === 'description') {
          cmp = a.description.localeCompare(b.description)
        } else if (sortField === 'amount') {
          cmp = a.amount - b.amount
        } else if (sortField === 'date') {
          cmp = a.id - b.id
        }
        return sortDirection === SORT_DIRECTIONS.ASC ? cmp : -cmp
      })
    }

    return result
  }, [transactions, nameFilter, minAmount, maxAmount, sortField, sortDirection])

  function handleSort(field) {
    if (sortField === field) {
      setSortDirection((d) =>
        d === SORT_DIRECTIONS.ASC ? SORT_DIRECTIONS.DESC : SORT_DIRECTIONS.ASC
      )
    } else {
      setSortField(field)
      setSortDirection(SORT_DIRECTIONS.ASC)
    }
  }

  function getSortIndicator(field) {
    if (sortField !== field) return ' \u2195'
    return sortDirection === SORT_DIRECTIONS.ASC ? ' \u2191' : ' \u2193'
  }

  function formatAmount(amount) {
    const abs = Math.abs(amount)
    const formatted = abs.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    })
    if (amount < 0) return `−${formatted}`
    return formatted
  }

  function clearFilters() {
    setNameFilter('')
    setMinAmount('')
    setMaxAmount('')
  }

  const hasActiveFilters = nameFilter || minAmount || maxAmount

  const totalAmount = filtered.reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="transaction-table">
      <div className="filters">
        <div className="filters__row">
          <div className="filter-group">
            <label className="filter-label" htmlFor="nameFilter">
              Search by name
            </label>
            <input
              id="nameFilter"
              type="text"
              placeholder="e.g. Amazon, Starbucks..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="filter-input"
            />
          </div>
          <div className="filter-group filter-group--amount">
            <label className="filter-label" htmlFor="minAmount">
              Amount range
            </label>
            <div className="amount-range">
              <input
                id="minAmount"
                type="number"
                placeholder="Min"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="filter-input filter-input--small"
                step="0.01"
              />
              <span className="amount-range__separator">to</span>
              <input
                id="maxAmount"
                type="number"
                placeholder="Max"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="filter-input filter-input--small"
                step="0.01"
              />
            </div>
          </div>
          {hasActiveFilters && (
            <button className="clear-btn" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="table-info">
        <span>
          Showing {filtered.length} of {transactions.length} transactions
        </span>
        <span className={`table-info__total ${totalAmount < 0 ? 'amount--credit' : ''}`}>
          Total: {formatAmount(totalAmount)}
        </span>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th
                className="sortable"
                onClick={() => handleSort('date')}
              >
                Date{getSortIndicator('date')}
              </th>
              <th
                className="sortable"
                onClick={() => handleSort('description')}
              >
                Description{getSortIndicator('description')}
              </th>
              <th
                className="sortable th-amount"
                onClick={() => handleSort('amount')}
              >
                Amount{getSortIndicator('amount')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="3" className="no-results">
                  No transactions match your filters
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id}>
                  <td className="td-date">{t.date}</td>
                  <td className="td-description">{t.description}</td>
                  <td
                    className={`td-amount ${
                      t.amount < 0 ? 'amount--credit' : 'amount--debit'
                    }`}
                  >
                    {formatAmount(t.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
