import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import Button from '../components/Button'
import Input from '../components/Input'
import Label from '../components/Label'
import { toast } from 'sonner'
import { Save, Trash2, Plus, Pencil } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

const SETTINGS_DOC_ID = 'pricing'

export interface BonusDeal {
  id: string
  text: string
  money: number
  liveDate: string
  unlocksRequired: number
}

export default function PricingSettings() {
  const [standardPrice, setStandardPrice] = useState('')
  const [referralPrice, setReferralPrice] = useState('')
  const [referralPayout, setReferralPayout] = useState('')

  const [deals, setDeals] = useState<BonusDeal[]>([])
  const [dealText, setDealText] = useState('')
  const [dealMoney, setDealMoney] = useState('')
  const [dealLiveDate, setDealLiveDate] = useState('')
  const [dealUnlocksRequired, setDealUnlocksRequired] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BonusDeal | null>(null)

  useEffect(() => {
    async function loadSettings() {
      try {
        const snap = await getDoc(doc(db, 'settings', SETTINGS_DOC_ID))
        if (snap.exists()) {
          const data = snap.data()
          setStandardPrice(String(data.standardPrice ?? ''))
          setReferralPrice(String(data.referralPrice ?? ''))
          setReferralPayout(String(data.referralPayout ?? ''))
          if (Array.isArray(data.bonusDeals)) {
            setDeals(data.bonusDeals as BonusDeal[])
          } else if (data.bonusDealText) {
            setDeals([{
              id: 'legacy',
              text: data.bonusDealText,
              money: data.bonusMoney ? Number(data.bonusMoney) : 0,
              liveDate: data.bonusLiveDate || '',
              unlocksRequired: data.bonusUnlocksRequired ? Number(data.bonusUnlocksRequired) : 0,
            }])
          }
        }
      } catch (err) {
        console.error(err)
        toast.error('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  async function handleSave() {
    if (!standardPrice || isNaN(Number(standardPrice))) return toast.error('Enter a valid standard price')
    if (!referralPrice || isNaN(Number(referralPrice))) return toast.error('Enter a valid referral price')
    if (!referralPayout || isNaN(Number(referralPayout))) return toast.error('Enter a valid referral payout')

    setSaving(true)
    try {
      await setDoc(doc(db, 'settings', SETTINGS_DOC_ID), {
        standardPrice: Number(standardPrice),
        referralPrice: Number(referralPrice),
        referralPayout: Number(referralPayout),
        bonusDeals: deals,
        updatedAt: new Date().toISOString(),
      })
      toast.success('Pricing settings saved')
    } catch (err) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  function resetDealForm() {
    setEditingId(null)
    setDealText('')
    setDealMoney('')
    setDealLiveDate('')
    setDealUnlocksRequired('')
  }

  function startEdit(deal: BonusDeal) {
    setEditingId(deal.id)
    setDealText(deal.text)
    setDealMoney(String(deal.money))
    setDealLiveDate(deal.liveDate)
    setDealUnlocksRequired(String(deal.unlocksRequired))
  }

  function handleAddOrUpdateDeal() {
    if (!dealText.trim()) return toast.error('Enter the bonus deal text')
    if (!dealMoney || isNaN(Number(dealMoney))) return toast.error('Enter a valid bonus money amount')
    if (!dealUnlocksRequired || isNaN(Number(dealUnlocksRequired))) return toast.error('Enter a valid unlocks required')

    if (editingId) {
      setDeals(prev => prev.map(d => d.id === editingId
        ? { ...d, text: dealText.trim(), money: Number(dealMoney), liveDate: dealLiveDate || d.liveDate, unlocksRequired: Number(dealUnlocksRequired) }
        : d))
      toast.success('Bonus deal updated')
    } else {
      const newDeal: BonusDeal = {
        id: Date.now().toString(),
        text: dealText.trim(),
        money: Number(dealMoney),
        liveDate: dealLiveDate || '',
        unlocksRequired: Number(dealUnlocksRequired),
      }
      setDeals(prev => [...prev, newDeal])
      toast.success('Bonus deal added')
    }
    resetDealForm()
  }

  function handleDeleteDeal() {
    if (!deleteTarget) return
    setDeals(prev => prev.filter(d => d.id !== deleteTarget.id))
    if (editingId === deleteTarget.id) resetDealForm()
    setDeleteTarget(null)
    toast.success('Bonus deal deleted')
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400">Loading...</p></div>
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pricing Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage pricing values shown to users in the app</p>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            These values are read dynamically by the app. Changes here take effect immediately without an app update.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Standard Price (no referral) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">PKR</span>
              <Input type="number" min="0" value={standardPrice} onChange={e => setStandardPrice(e.target.value)} placeholder="e.g. 500" className="pl-12" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Referral Price (when referral is used) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">PKR</span>
              <Input type="number" min="0" value={referralPrice} onChange={e => setReferralPrice(e.target.value)} placeholder="e.g. 400" className="pl-12" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Referral Payout (paid to referrer) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">PKR</span>
              <Input type="number" min="0" value={referralPayout} onChange={e => setReferralPayout(e.target.value)} placeholder="e.g. 100" className="pl-12" />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving}>
            <Save className="w-4 h-4 mr-2" /> Save Settings
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Bonus Deals</h2>
          <p className="text-sm text-gray-500">Add, edit, or remove unlock-friends bonus deals</p>
        </div>

        <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
          <p className="text-sm font-medium text-gray-700">{editingId ? 'Edit Bonus Deal' : 'Add Bonus Deal'}</p>
          <div className="space-y-1.5">
            <Label>Bonus Deal Text</Label>
            <Input value={dealText} onChange={e => setDealText(e.target.value)} placeholder="e.g. Unlock 10 friends and get 500 extra bonus" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Bonus Money (PKR)</Label>
              <Input type="number" min="0" value={dealMoney} onChange={e => setDealMoney(e.target.value)} placeholder="e.g. 500" />
            </div>
            <div className="space-y-1.5">
              <Label>Deal Live Date</Label>
              <Input type="date" value={dealLiveDate} onChange={e => setDealLiveDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Unlocks Required</Label>
              <Input type="number" min="1" value={dealUnlocksRequired} onChange={e => setDealUnlocksRequired(e.target.value)} placeholder="e.g. 10" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAddOrUpdateDeal} disabled={!dealText.trim()}>
              {editingId ? <><Plus className="w-4 h-4 mr-2" /> Update Deal</> : <><Plus className="w-4 h-4 mr-2" /> Add Deal</>}
            </Button>
            {editingId && <Button variant="ghost" onClick={resetDealForm}>Cancel</Button>}
          </div>
        </div>

        {deals.length === 0 ? (
          <p className="text-sm text-gray-400">No bonus deals yet</p>
        ) : (
          <div className="space-y-3">
            {deals.map(deal => (
              <div key={deal.id} className="border rounded-lg p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">{deal.text}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Bonus: <strong>PKR {deal.money}</strong> · Live from: <strong>{deal.liveDate ? new Date(deal.liveDate).toLocaleDateString() : '—'}</strong> · Unlocks required: <strong>{deal.unlocksRequired}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(deal)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-indigo-600" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteTarget(deal)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-3">Preview</h2>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
          <p>Standard purchase: <strong>PKR {standardPrice || '—'}</strong></p>
          <p>With referral: <strong>PKR {referralPrice || '—'}</strong></p>
          <p>Referrer earns: <strong>PKR {referralPayout || '—'}</strong></p>
          {deals.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-gray-500">Bonus deals:</p>
              {deals.map(deal => (
                <p key={deal.id} className="text-amber-700 font-medium mt-1">
                  {deal.text} — PKR {deal.money} · Live from {deal.liveDate ? new Date(deal.liveDate).toLocaleDateString() : '—'} · {deal.unlocksRequired} unlocks
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal open={Boolean(deleteTarget)} title="Delete Bonus Deal" message={`Delete "${deleteTarget?.text}"?`} onConfirm={handleDeleteDeal} onCancel={() => setDeleteTarget(null)} confirmLabel="Delete" />
    </div>
  )
}
