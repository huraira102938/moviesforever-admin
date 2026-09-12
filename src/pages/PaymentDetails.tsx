import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import Button from '../components/Button'
import Input from '../components/Input'
import Label from '../components/Label'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

const SETTINGS_DOC_ID = 'payment-details'

export default function PaymentDetails() {
  const [bankName, setBankName] = useState('')
  const [accountTitle, setAccountTitle] = useState('')
  const [accountNumber, setAccountNumber] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      try {
        const snap = await getDoc(doc(db, 'settings', SETTINGS_DOC_ID))
        if (snap.exists()) {
          const data = snap.data()
          setBankName(data.bankName || '')
          setAccountTitle(data.accountTitle || '')
          setAccountNumber(data.accountNumber || '')
        }
      } catch (err) {
        console.error(err)
        toast.error('Failed to load payment details')
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  async function handleSave() {
    if (!bankName.trim()) return toast.error('Enter the bank name')
    if (!accountTitle.trim()) return toast.error('Enter the account title')
    if (!accountNumber.trim()) return toast.error('Enter the account number')

    setSaving(true)
    try {
      await setDoc(doc(db, 'settings', SETTINGS_DOC_ID), {
        bankName: bankName.trim(),
        accountTitle: accountTitle.trim(),
        accountNumber: accountNumber.trim(),
        updatedAt: new Date().toISOString(),
      })
      toast.success('Payment details saved')
    } catch (err) {
      toast.error('Failed to save payment details')
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
        <h1 className="text-2xl font-bold text-gray-900">Payment Details</h1>
        <p className="text-sm text-gray-500 mt-1">Bank account details shown to users for deposits</p>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            These values are read dynamically by the app. All three fields are required and cannot be removed.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Bank Name *</Label>
            <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. Meezan Bank" />
          </div>

          <div className="space-y-1.5">
            <Label>Account Title *</Label>
            <Input value={accountTitle} onChange={e => setAccountTitle(e.target.value)} placeholder="e.g. Muhammad Ahmed" />
          </div>

          <div className="space-y-1.5">
            <Label>Account Number *</Label>
            <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="e.g. 01020304050607" />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving} disabled={!bankName.trim() || !accountTitle.trim() || !accountNumber.trim()}>
            <Save className="w-4 h-4 mr-2" /> Save Payment Details
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-3">Preview</h2>
        <div className="bg-gray-50 rounded-lg p-4 space-y-1 text-sm">
          <p>Bank: <strong>{bankName.trim() || '—'}</strong></p>
          <p>Account Title: <strong>{accountTitle.trim() || '—'}</strong></p>
          <p>Account Number: <strong>{accountNumber.trim() || '—'}</strong></p>
        </div>
      </div>
    </div>
  )
}