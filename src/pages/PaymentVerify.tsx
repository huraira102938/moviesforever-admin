import { useState } from 'react'
import { collection, doc, setDoc, updateDoc, query, where, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import Button from '../components/Button'
import Input from '../components/Input'
import Label from '../components/Label'
import { toast } from 'sonner'
import { CheckCircle } from 'lucide-react'

function generateCodeString(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function generateUsername(): string {
  const adj = ['golden', 'silver', 'crimson', 'shadow', 'star', 'royal', 'elegant', 'bold', 'swift', 'fierce']
  const noun = ['lion', 'tiger', 'eagle', 'panther', 'hawk', 'wolf', 'dragon', 'phoenix', 'cobra', 'falcon']
  const a = adj[Math.floor(Math.random() * adj.length)]
  const n = noun[Math.floor(Math.random() * noun.length)]
  const num = Math.floor(Math.random() * 1000)
  return `${a}${n}${num}`
}

export default function PaymentVerify() {
  const [realName, setRealName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [jazzCashNumber, setJazzCashNumber] = useState('')
  const [jazzCashTitle, setJazzCashTitle] = useState('')
  const [referralUsername, setReferralUsername] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleVerify() {
    if (!realName.trim()) return toast.error('Real name is required')
    if (!phoneNumber.trim()) return toast.error('Phone number is required')
    if (!jazzCashNumber.trim()) return toast.error('JazzCash number is required')
    if (!jazzCashTitle.trim()) return toast.error('JazzCash title is required')

    setSaving(true)
    try {
      const userId = generateCodeString()
      const username = generateUsername()

      let referredBy: string | undefined
      if (referralUsername.trim()) {
        const referrerSnap = await getDocs(query(collection(db, 'users'), where('username', '==', referralUsername.trim())))
        if (referrerSnap.empty) {
          toast.warning('Referrer username not found — proceeding without referral link')
        } else {
          referredBy = referralUsername.trim()
          const referrerDoc = referrerSnap.docs[0]
          const currentCount = referrerDoc.data().referralCount || 0
          await updateDoc(doc(db, 'users', referrerDoc.id), { referralCount: currentCount + 1 })

          const claimId = `${referralUsername.trim()}-${userId}`
          await setDoc(doc(db, 'referral-claims', claimId), {
            referrerUsername: referralUsername.trim(),
            newUser: userId,
            newUsername: username,
            timestamp: new Date().toISOString(),
          })
        }
      }

      await setDoc(doc(db, 'users', userId), {
        id: userId,
        username,
        realName: realName.trim(),
        phoneNumber: phoneNumber.trim(),
        jazzCashNumber: jazzCashNumber.trim(),
        jazzCashTitle: jazzCashTitle.trim(),
        referralCount: 0,
        referredBy: referredBy || null,
        createdAt: new Date().toISOString(),
      })

      await setDoc(doc(db, 'codes', userId), {
        id: userId,
        username,
        status: 'unused',
        createdAt: new Date().toISOString(),
      })

      toast.success(
        <div>
          <p className="font-semibold">Payment verified! User created.</p>
          <p className="text-sm mt-1">Code: <code className="bg-gray-100 px-1 rounded">{userId}</code></p>
          <p className="text-sm">Username: <code className="bg-gray-100 px-1 rounded">{username}</code></p>
        </div>,
        { duration: 15000 }
      )

      setRealName('')
      setPhoneNumber('')
      setJazzCashNumber('')
      setJazzCashTitle('')
      setReferralUsername('')
    } catch (err) {
      console.error(err)
      toast.error('Failed to verify payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payment Verification</h1>
        <p className="text-sm text-gray-500 mt-1">Verify a payment and issue access to a new user</p>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-5">
        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-lg p-3">
          <CheckCircle className="w-5 h-5" />
          <p className="text-sm">Once verified, this will auto-generate a unique code + username for the user.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Real Name *</Label>
            <Input value={realName} onChange={e => setRealName(e.target.value)} placeholder="Full name" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone Number *</Label>
            <Input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="e.g. 03001234567" />
          </div>
          <div className="space-y-1.5">
            <Label>JazzCash Number *</Label>
            <Input value={jazzCashNumber} onChange={e => setJazzCashNumber(e.target.value)} placeholder="e.g. 03001234567" />
          </div>
          <div className="space-y-1.5">
            <Label>JazzCash Title (Account Holder) *</Label>
            <Input value={jazzCashTitle} onChange={e => setJazzCashTitle(e.target.value)} placeholder="Name on JazzCash account" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Referral Username (optional)</Label>
          <Input value={referralUsername} onChange={e => setReferralUsername(e.target.value)} placeholder="Enter referrer's username if any" />
        </div>

        <Button onClick={handleVerify} loading={saving} className="w-full">Verify Payment & Issue Code</Button>
      </div>
    </div>
  )
}