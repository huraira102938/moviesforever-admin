import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import Button from '../components/Button'
import Input from '../components/Input'
import Label from '../components/Label'
import Textarea from '../components/Textarea'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from 'sonner'
import { Save, ShieldAlert, Power } from 'lucide-react'

// Firestore doc read live by every app build: settings/appUpdate
const SETTINGS_DOC_ID = 'appUpdate'

interface UpdateSettings {
  enabled: boolean
  minVersionCode: number
  title: string
  message: string
  contactNumber: string
  downloadUrl: string
}

const EMPTY: UpdateSettings = {
  enabled: false,
  minVersionCode: 0,
  title: '',
  message: '',
  contactNumber: '',
  downloadUrl: '',
}

export default function ForceUpdate() {
  const [form, setForm] = useState<UpdateSettings>(EMPTY)
  const [saved, setSaved] = useState<UpdateSettings>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'settings', SETTINGS_DOC_ID))
        if (snap.exists()) {
          const d = snap.data()
          const loaded: UpdateSettings = {
            enabled: d.enabled === true,
            minVersionCode: typeof d.minVersionCode === 'number' ? d.minVersionCode : 0,
            title: d.title || '',
            message: d.message || '',
            contactNumber: d.contactNumber || '',
            downloadUrl: d.downloadUrl || '',
          }
          setForm(loaded)
          setSaved(loaded)
        }
      } catch (err) {
        console.error(err)
        toast.error('Failed to load force update settings')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function set<K extends keyof UpdateSettings>(key: K, value: UpdateSettings[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function validate(): string | null {
    if (form.enabled) {
      if (!Number.isInteger(form.minVersionCode) || form.minVersionCode < 1) {
        return 'Enter the minimum allowed version code (a whole number, 1 or more)'
      }
      if (!form.contactNumber.trim() && !form.downloadUrl.trim()) {
        return 'Add a contact number or a download link, so blocked users know what to do'
      }
    }
    if (form.downloadUrl.trim() && !/^https?:\/\//i.test(form.downloadUrl.trim())) {
      return 'Download link must start with http:// or https://'
    }
    return null
  }

  async function write(next: UpdateSettings) {
    setSaving(true)
    try {
      await setDoc(doc(db, 'settings', SETTINGS_DOC_ID), {
        enabled: next.enabled,
        minVersionCode: next.minVersionCode,
        title: next.title.trim(),
        message: next.message.trim(),
        contactNumber: next.contactNumber.trim(),
        downloadUrl: next.downloadUrl.trim(),
        updatedAt: new Date().toISOString(),
      })
      setForm(next)
      setSaved(next)
      toast.success(next.enabled ? 'Force update is ON: older builds are now blocked' : 'Saved. Force update is OFF: every build can run')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function handleSave() {
    const problem = validate()
    if (problem) return toast.error(problem)
    // Switching blocking on (or raising the minimum while on) locks real users: ask first.
    const locksMore = form.enabled && (!saved.enabled || form.minVersionCode > saved.minVersionCode)
    if (locksMore) setConfirmOpen(true)
    else write(form)
  }

  async function turnOff() {
    await write({ ...form, enabled: false })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400">Loading...</p></div>
  }

  const isLive = saved.enabled
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Force Update</h1>
        <p className="text-sm text-gray-500 mt-1">
          Block old app builds. Blocked users see a full-screen message with your contact number / download link and cannot use the app.
        </p>
      </div>

      <div className={`rounded-xl border p-4 flex items-start gap-3 ${isLive ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
        <ShieldAlert className={`w-5 h-5 mt-0.5 ${isLive ? 'text-red-600' : 'text-green-600'}`} />
        <div className="flex-1">
          <p className={`text-sm font-semibold ${isLive ? 'text-red-800' : 'text-green-800'}`}>
            {isLive
              ? `ON: every build with version code below ${saved.minVersionCode} is blocked`
              : 'OFF: every build can run'}
          </p>
          <p className="text-xs text-gray-600 mt-1">This is the saved state that the apps are using right now.</p>
        </div>
        {isLive && (
          <Button variant="outline" size="sm" onClick={turnOff} loading={saving}>
            <Power className="w-4 h-4 mr-1" /> Turn OFF now
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 space-y-1">
          <p><strong>How it works:</strong> every build knows its own version code (<code>versionCode</code> in the app's <code>build.gradle.kts</code>).</p>
          <p>Builds with a version code <strong>lower than the minimum</strong> below are blocked. Raise <code>versionCode</code> in every new release.</p>
          <p>Only builds that already contain this feature can be blocked. Older builds from before this feature cannot be stopped from here.</p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            className="w-5 h-5"
            checked={form.enabled}
            onChange={e => set('enabled', e.target.checked)}
          />
          <span className="text-sm font-medium text-gray-900">Force update is ON (block builds below the minimum)</span>
        </label>

        <div className="space-y-1.5">
          <Label>Minimum allowed version code *</Label>
          <Input
            type="number"
            min={1}
            value={form.minVersionCode || ''}
            onChange={e => set('minVersionCode', e.target.value === '' ? 0 : Number(e.target.value))}
            placeholder="e.g. 5 (the version code of your newest good build)"
          />
          <p className="text-xs text-gray-500">
            Example: your newest build has version code 5. Enter 5 to block builds 1, 2, 3 and 4. Build 5 and above keep working.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>WhatsApp / phone number shown on the block screen</Label>
          <Input
            value={form.contactNumber}
            onChange={e => set('contactNumber', e.target.value)}
            placeholder="e.g. 923001234567"
          />
          <p className="text-xs text-gray-500">The "contact on WhatsApp" button opens this number. Use the country code, no + or spaces.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Download link for the new APK</Label>
          <Input
            value={form.downloadUrl}
            onChange={e => set('downloadUrl', e.target.value)}
            placeholder="e.g. https://moviesforever.online/download"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Title (optional)</Label>
          <Input
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Leave empty to use the default Urdu title"
            dir="auto"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Message (optional)</Label>
          <Textarea
            value={form.message}
            onChange={e => set('message', e.target.value)}
            placeholder="Leave empty to use the default Urdu message"
            rows={4}
            dir="auto"
          />
          <p className="text-xs text-gray-500">
            Default: "آپ کی ایپ کا یہ ورژن پرانا ہے اور اب کام نہیں کرے گا۔ براہ کرم نیا ورژن ڈاؤن لوڈ کریں یا ہم سے رابطہ کریں۔"
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
          <Button onClick={handleSave} loading={saving} disabled={!dirty}>
            <Save className="w-4 h-4 mr-2" /> Save
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-3">What blocked users will see</h2>
        <div className="bg-gray-900 rounded-lg p-6 text-center space-y-3" dir="rtl">
          <p className="text-white text-lg font-bold">{form.title.trim() || 'ایپ کا نیا ورژن ڈاؤن لوڈ کریں'}</p>
          <p className="text-gray-300 text-sm leading-7">
            {form.message.trim() || 'آپ کی ایپ کا یہ ورژن پرانا ہے اور اب کام نہیں کرے گا۔ براہ کرم نیا ورژن ڈاؤن لوڈ کریں یا ہم سے رابطہ کریں۔'}
          </p>
          {form.downloadUrl.trim() && (
            <div className="bg-yellow-600 text-white text-sm rounded-lg py-2">نیا ورژن ڈاؤن لوڈ کریں</div>
          )}
          {form.contactNumber.trim() && (
            <div>
              <div className="border border-yellow-600 text-yellow-500 text-sm rounded-lg py-2">واٹس ایپ پر رابطہ کریں</div>
              <p className="text-gray-400 text-xs mt-2" dir="ltr">{form.contactNumber.trim()}</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Block old builds?"
        message={`All installed apps with version code below ${form.minVersionCode} will be locked the next time they open (or immediately if they are open now). Make sure your newest build has version code ${form.minVersionCode} or higher and that people can download it.`}
        confirmLabel="Yes, block them"
        variant="danger"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          write(form)
        }}
      />
    </div>
  )
}
