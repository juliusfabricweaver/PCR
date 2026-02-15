import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'

type AcronymCategory =
  | 'General'
  | 'Assessment'
  | 'Respiratory'
  | 'Cardiac'
  | 'Neuro'
  | 'Transfer'

interface AcronymItem {
  acronym: string
  meaning: string
  category: AcronymCategory
}

const DashboardPage = () => {
  const { user } = useAuth()

  // Medical Acronyms
  const medicalAcronyms: AcronymItem[] = [
    { acronym: 'SOB', meaning: 'Shortness of breath', category: 'Respiratory' },
    { acronym: 'CP', meaning: 'Chest pain', category: 'Cardiac' },
    { acronym: 'LOC', meaning: 'Level of consciousness', category: 'Neuro' },
    { acronym: 'GCS', meaning: 'Glasgow Coma Scale', category: 'Neuro' },
    { acronym: 'A&O x3', meaning: 'Alert and oriented to person, place, and time', category: 'Assessment'},
    { acronym: 'N/V', meaning: 'Nausea and vomiting', category: 'General' },
    { acronym: 'Hx', meaning: 'History', category: 'Assessment' },
    { acronym: 'Tx', meaning: 'Treatment', category: 'Assessment' },
    { acronym: 'SpO2', meaning: 'Peripheral oxygen saturation', category: 'Respiratory' },
    { acronym: 'RR', meaning: 'Respiratory rate', category: 'Respiratory' },
    { acronym: 'HR', meaning: 'Heart rate', category: 'Cardiac' },
    { acronym: 'BP', meaning: 'Blood pressure', category: 'Cardiac' },
    { acronym: 'PRN', meaning: 'As needed', category: 'General' },
    { acronym: 'PTA', meaning: 'Prior to arrival', category: 'Transfer' },
    { acronym: 'ETA', meaning: 'Estimated time of arrival', category: 'Transfer' },
    { acronym: 'TOC', meaning: 'Transfer of care', category: 'Transfer' },
    { acronym: 'NKA', meaning: 'No known allergies', category: 'Assessment' },
    { acronym: 'NKDA', meaning: 'No known drug allergies', category: 'Assessment' },
    { acronym: 'Hypotension', meaning: 'Low blood pressure', category: 'Cardiac' },
    { acronym: 'Hypertension', meaning: 'High blood pressure', category: 'Cardiac' },
    { acronym: 'Tachycardia', meaning: 'Fast heart rate', category: 'Cardiac' },
    { acronym: 'Bradycardia', meaning: 'Slow heart rate', category: 'Cardiac' },
    { acronym: 'Poor perfusion', meaning: 'Weak peripheral circulation', category: 'Cardiac' },
    { acronym: 'CRT', meaning: 'Capillary refill time', category: 'Cardiac' },
    { acronym: 'Edema', meaning: 'Swelling', category: 'Cardiac' },
    { acronym: 'Diaphoretic', meaning: 'Sweaty/clammy', category: 'General' },
    { acronym: 'O2', meaning: 'Oxygen', category: 'Respiratory' },
    { acronym: 'NC', meaning: 'Nasal cannula', category: 'Respiratory' },
    { acronym: 'NRB', meaning: 'Non-rebreather mask', category: 'Respiratory' },
    { acronym: 'BVM', meaning: 'Bag-valve-mask', category: 'Respiratory' },
    { acronym: 'Wheeze', meaning: 'Wheezing on auscultation', category: 'Respiratory' },
    { acronym: 'Crackles', meaning: 'Crackles/rales present', category: 'Respiratory' },
    { acronym: 'Stridor', meaning: 'Upper airway high-pitched sound', category: 'Respiratory' },
    { acronym: 'Dyspnea', meaning: 'Difficult or labored breathing (shortness of breath)', category: 'Respiratory' },
    { acronym: 'Distension', meaning: 'Abdominal bloating/swelling', category: 'General' },
    { acronym: 'Melena', meaning: 'Black tarry stool', category: 'General' },
    { acronym: 'Hematemesis', meaning: 'Blood in vomit', category: 'General' },
    { acronym: 'Dysuria', meaning: 'Painful urination', category: 'General' },
    { acronym: 'Hematuria', meaning: 'Blood in urine', category: 'General' },
    { acronym: 'WNL', meaning: 'Within normal limits', category: 'Assessment' },
    { acronym: 'Acute', meaning: 'Sudden/recent onset', category: 'Assessment' },
    { acronym: 'Chronic', meaning: 'Ongoing/longstanding', category: 'Assessment' },
    { acronym: 'Baseline', meaning: 'Usual condition', category: 'Assessment' },
    { acronym: 'MOI', meaning: 'Mechanism of injury', category: 'Assessment' },
    { acronym: 'NOI', meaning: 'Nature of illness', category: 'Assessment' },
    { acronym: 'Deformity', meaning: 'Visible structural change', category: 'Assessment' },
    { acronym: 'Ecchymosis', meaning: 'Bruising', category: 'Assessment' },
    { acronym: 'Lac', meaning: 'Laceration', category: 'Assessment' },
    { acronym: 'Abrasion', meaning: 'Superficial skin injury', category: 'Assessment' },
    { acronym: 'Avulsion', meaning: 'Tissue torn away', category: 'Assessment' },
    { acronym: 'ROM', meaning: 'Range of motion', category: 'Assessment' },
    { acronym: 'RRR', meaning: 'Regular rate and rhythm (cardiac exam)', category: 'Cardiac' },
    { acronym: 'AVPU', meaning: 'Alert, Voice, Pain, Unresponsive responsiveness scale', category: 'Neuro' },
    { acronym: 'VS', meaning: 'Vital signs', category: 'Assessment' },
    { acronym: 'PERRLA', meaning: 'Pupils equal, round, reactive to light and accommodation', category: 'Assessment' },
    { acronym: 'WDN', meaning: 'Warm, dry, normal skin', category: 'Assessment' },
  ]

  const categories: Array<'All' | AcronymCategory> = [
    'All',
    'General',
    'Assessment',
    'Respiratory',
    'Cardiac',
    'Neuro',
    'Transfer',
  ]

  const [acronymQuery, setAcronymQuery] = useState('')
  const [acronymCategory, setAcronymCategory] = useState<'All' | AcronymCategory>('All')
  const [showAllAcronyms, setShowAllAcronyms] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const filteredAcronyms = useMemo(() => {
    const q = acronymQuery.trim().toLowerCase()

    const filtered = medicalAcronyms.filter((item) => {
      const matchesCategory = acronymCategory === 'All' || item.category === acronymCategory
      const matchesQuery =
        q.length === 0 ||
        item.acronym.toLowerCase().includes(q) ||
        item.meaning.toLowerCase().includes(q)

      return matchesCategory && matchesQuery
    })

    // Alphabetical order by acronym
    return [...filtered].sort((a, b) =>
      a.acronym.localeCompare(b.acronym, undefined, { sensitivity: 'base' })
    )
  }, [acronymQuery, acronymCategory])

  const displayedAcronyms = showAllAcronyms ? filteredAcronyms : filteredAcronyms.slice(0, 8)

  const handleCopyAcronym = async (item: AcronymItem) => {
    const text = `${item.acronym}: ${item.meaning}`
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(item.acronym)
      setTimeout(() => setCopiedKey(null), 1200)
    } catch {
      // Clipboard can fail in some browser contexts
    }
  }

return (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    {/* Welcome section */}
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Welcome back{user?.firstName ? `, ${user.firstName}` : ''}!
      </h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Use the acronym reference below while writing patient care reports.
      </p>
    </div>


      {/* Medical Acronyms section */}
      <div className="mt-2">
        <div className="card">
          <div className="card-header">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Medical Acronyms</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Quick reference to speed up patient care report writing
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={acronymQuery}
                  onChange={(e) => setAcronymQuery(e.target.value)}
                  placeholder="Search acronym or meaning..."
                  className="w-full sm:w-72 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <select
                  value={acronymCategory}
                  onChange={(e) => setAcronymCategory(e.target.value as 'All' | AcronymCategory)}
                  className="w-full sm:w-56 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="card-body">
            {filteredAcronyms.length === 0 ? (
              <div className="text-sm text-gray-600">No acronyms found for this filter.</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayedAcronyms.map((item) => (
                    <div
                      key={`${item.acronym}-${item.category}`}
                      className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">{item.acronym}</span>
                            <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                              {item.category}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-700">{item.meaning}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyAcronym(item)}
                          className="shrink-0 text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 text-gray-700"
                        >
                          {copiedKey === item.acronym ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredAcronyms.length > 8 && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setShowAllAcronyms((prev) => !prev)}
                      className="text-sm font-medium text-primary-600 hover:text-primary-500"
                    >
                      {showAllAcronyms ? 'Show less' : `Show all (${filteredAcronyms.length})`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
