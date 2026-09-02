import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import Button from '../components/Button'
import Input from '../components/Input'
import Label from '../components/Label'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

const SETTINGS_DOC_ID = 'pricing'

export default function PricingSettings() {
  const [standardPrice, setStandardPrice] = useState('')
  const [referralPrice, setReferralPrice] = useState('')
  const [referralPayout, setReferralPayout] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      try {
        const snap = await getDoc(doc(db, 'settings', SETTINGS_DOC_ID))
        if (snap.exists()) {
          const data = snap.data()
          setStandardPrice(String(data.standardPrice ?? ''))
          setReferralPrice(String(data.referralPrice ?? ''))
          setReferralPayout(String(data.referralPayout ?? ''))
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
        updatedAt: new Date().toISOString(),
      })
      toast.success('Pricing settings saved')
    } catch (err) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
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

      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-3">Preview</h2>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
          <p>Standard purchase: <strong>PKR {standardPrice || '—'}</strong></p>
          <p>With referral: <strong>PKR {referralPrice || '—'}</strong></p>
          <p>Referrer earns: <strong>PKR {referralPayout || '—'}</strong></p>
        </div>
      </div>
    </div>
  )
}