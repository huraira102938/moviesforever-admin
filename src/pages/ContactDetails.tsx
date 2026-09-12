import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import Button from '../components/Button'
import Input from '../components/Input'
import Label from '../components/Label'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

const SETTINGS_DOC_ID = 'contact'

export default function ContactDetails() {
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [groupTitle, setGroupTitle] = useState('')
  const [groupLink, setGroupLink] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      try {
        const snap = await getDoc(doc(db, 'settings', SETTINGS_DOC_ID))
        if (snap.exists()) {
          const data = snap.data()
          setWhatsappNumber(data.whatsappNumber || '')
          setGroupTitle(data.groupTitle || '')
          setGroupLink(data.groupLink || '')
        }
      } catch (err) {
        console.error(err)
        toast.error('Failed to load contact details')
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  async function handleSave() {
    if (!whatsappNumber.trim()) return toast.error('Enter the WhatsApp number')
    if (!groupTitle.trim()) return toast.error('Enter the WhatsApp group title')
    if (!groupLink.trim()) return toast.error('Enter the WhatsApp group link')

    setSaving(true)
    try {
      await setDoc(doc(db, 'settings', SETTINGS_DOC_ID), {
        whatsappNumber: whatsappNumber.trim(),
        groupTitle: groupTitle.trim(),
        groupLink: groupLink.trim(),
        updatedAt: new Date().toISOString(),
      })
      toast.success('Contact details saved')
    } catch (err) {
      toast.error('Failed to save contact details')
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
        <h1 className="text-2xl font-bold text-gray-900">Contact Details</h1>
        <p className="text-sm text-gray-500 mt-1">WhatsApp contact for payment screenshots and group link shown in the app</p>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            These values are read dynamically by the app. All three fields are required and cannot be removed.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>WhatsApp Number (payment screenshots) *</Label>
            <Input value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} placeholder="e.g. 923001234567" />
          </div>

          <div className="space-y-1.5">
            <Label>WhatsApp Group Title *</Label>
            <Input value={groupTitle} onChange={e => setGroupTitle(e.target.value)} placeholder="e.g. Join our WhatsApp group for latest details" />
          </div>

          <div className="space-y-1.5">
            <Label>WhatsApp Group Link *</Label>
            <Input value={groupLink} onChange={e => setGroupLink(e.target.value)} placeholder="e.g. https://chat.whatsapp.com/..." />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving} disabled={!whatsappNumber.trim() || !groupTitle.trim() || !groupLink.trim()}>
            <Save className="w-4 h-4 mr-2" /> Save Contact Details
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-3">Preview</h2>
        <div className="bg-gray-50 rounded-lg p-4 space-y-1 text-sm">
          <p>WhatsApp Number: <strong>{whatsappNumber.trim() || '—'}</strong></p>
          <p>Group Title: <strong>{groupTitle.trim() || '—'}</strong></p>
          <p>Group Link: <strong>{groupLink.trim() || '—'}</strong></p>
        </div>
      </div>
    </div>
  )
}