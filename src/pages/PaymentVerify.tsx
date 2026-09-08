import { useState } from 'react'
import { collection, doc, setDoc, updateDoc, query, where, getDocs, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { REFERRAL_PAYOUT_OPTIONS } from '../lib/types'
import Button from '../components/Button'
import Input from '../components/Input'
import Label from '../components/Label'
import { toast } from 'sonner'
import { CheckCircle, Copy, Check } from 'lucide-react'

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
  const [paymentMethod, setPaymentMethod] = useState('none')
  const [paymentNumber, setPaymentNumber] = useState('')
  const [accountTitle, setAccountTitle] = useState('')
  const [totalReceived, setTotalReceived] = useState('')
  const [referralUsername, setReferralUsername] = useState('')
  const [referrerPendingAmount, setReferrerPendingAmount] = useState<number>(REFERRAL_PAYOUT_OPTIONS[0])
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ code: string; username: string; referredBy?: string; pendingAmount: number } | null>(null)

  async function handleVerify() {
    if (!realName.trim()) return toast.error('Real name is required')
    if (!phoneNumber.trim()) return toast.error('Phone number is required')
    if (!totalReceived || isNaN(Number(totalReceived))) return toast.error('Enter a valid total payment received')

    const referralUsed = referralUsername.trim() !== ''
    const pendingAmount = referralUsed ? referrerPendingAmount : 0

    let referrerId: string | undefined
    if (referralUsed) {
      const referrerSnap = await getDocs(query(collection(db, 'users'), where('username', '==', referralUsername.trim())))
      if (referrerSnap.empty) {
        return toast.error(`Referral username "${referralUsername.trim()}" not found. Enter a valid username or leave it empty to verify without a referral.`)
      }
      referrerId = referrerSnap.docs[0].id
    }

    setSaving(true)
    try {
      const userId = generateCodeString()
      const username = generateUsername()

      let referredBy: string | undefined
      if (referralUsed) {
        referredBy = referralUsername.trim()
        const currentCount = (await getDoc(doc(db, 'users', referrerId!))).data()?.referralCount || 0
        await updateDoc(doc(db, 'users', referrerId!), { referralCount: currentCount + 1 })

        const claimId = `${referralUsername.trim()}-${userId}`
        await setDoc(doc(db, 'referral-claims', claimId), {
          referrerUsername: referralUsername.trim(),
          newUser: userId,
          newUsername: username,
          timestamp: new Date().toISOString(),
        })
      }

      await setDoc(doc(db, 'users', userId), {
        id: userId,
        username,
        realName: realName.trim(),
        phoneNumber: phoneNumber.trim(),
        paymentMethod: paymentMethod === 'none' ? null : paymentMethod,
        paymentNumber: paymentMethod === 'none' ? null : paymentNumber.trim() || null,
        accountTitle: paymentMethod === 'none' ? null : accountTitle.trim() || null,
        jazzCashNumber: paymentMethod === 'jazzcash' ? paymentNumber.trim() : '',
        jazzCashTitle: paymentMethod === 'jazzcash' ? accountTitle.trim() : '',
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

      await setDoc(doc(db, 'transactions', userId), {
        id: userId,
        clientUserId: userId,
        clientUsername: username,
        clientRealName: realName.trim(),
        clientPhoneNumber: phoneNumber.trim(),
        paymentMethod: paymentMethod === 'none' ? null : paymentMethod,
        paymentNumber: paymentMethod === 'none' ? null : paymentNumber.trim() || null,
        accountTitle: paymentMethod === 'none' ? null : accountTitle.trim() || null,
        clientJazzCashNumber: paymentMethod === 'jazzcash' ? paymentNumber.trim() : '',
        clientJazzCashTitle: paymentMethod === 'jazzcash' ? accountTitle.trim() : '',
        totalReceived: Number(totalReceived),
        referralUsername: referredBy || null,
        referrerPendingAmount: pendingAmount,
        status: 'pending',
        createdAt: new Date().toISOString(),
        paidAt: null,
      })

      setResult({ code: userId, username, referredBy, pendingAmount })

      setRealName('')
      setPhoneNumber('')
      setPaymentMethod('none')
      setPaymentNumber('')
      setAccountTitle('')
      setTotalReceived('')
      setReferralUsername('')
      setReferrerPendingAmount(REFERRAL_PAYOUT_OPTIONS[0])
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
            <Label>Payment Method</Label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
              className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="none">None</option>
              <option value="jazzcash">JazzCash</option>
              <option value="easypaisa">EasyPaisa</option>
            </select>
          </div>
          {paymentMethod !== 'none' && <div className="space-y-1.5">
            <Label>{paymentMethod === 'jazzcash' ? 'JazzCash' : 'EasyPaisa'} Number</Label>
            <Input value={paymentNumber} onChange={e => setPaymentNumber(e.target.value)} placeholder="e.g. 03001234567" />
          </div>}
          {paymentMethod !== 'none' && <div className="space-y-1.5">
            <Label>Account Title (Account Holder)</Label>
            <Input value={accountTitle} onChange={e => setAccountTitle(e.target.value)} placeholder="Name on the account" />
          </div>}
          <div className="space-y-1.5">
            <Label>Total Payment Received *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">PKR</span>
              <Input type="number" min="0" value={totalReceived} onChange={e => setTotalReceived(e.target.value)} placeholder="e.g. 500" className="pl-12" />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Referral Username (optional)</Label>
          <Input value={referralUsername} onChange={e => setReferralUsername(e.target.value)} placeholder="Enter referrer's username if any" />
        </div>

        {referralUsername.trim() && (
          <div className="space-y-1.5">
            <Label>Referrer Pending Payout (adds to the referrer's profile) *</Label>
            <select value={referrerPendingAmount} onChange={e => setReferrerPendingAmount(Number(e.target.value))}
              className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {REFERRAL_PAYOUT_OPTIONS.map(amt => <option key={amt} value={amt}>PKR {amt}</option>)}
            </select>
            <p className="text-xs text-gray-400">This pending amount ({referrerPendingAmount}) will be added to <strong>{referralUsername}</strong>'s pending payments.</p>
          </div>
        )}

        <Button onClick={handleVerify} loading={saving} className="w-full">Verify Payment & Issue Code</Button>
      </div>

      {result && (
        <div className="bg-white rounded-xl border border-emerald-200 p-6 space-y-4">
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-lg p-3">
            <CheckCircle className="w-5 h-5" />
            <p className="text-sm font-medium">Payment verified! Share these credentials with the user.</p>
          </div>
          <div className="divide-y">
            <CopyRow label="Code" value={result.code} />
            <CopyRow label="Username" value={result.username} />
            {result.referredBy && (
              <CopyRow label="Referrer" value={result.referredBy} />
            )}
          </div>
          {result.referredBy && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <span className="text-sm text-amber-800">Pending payout to <strong>{result.referredBy}</strong></span>
              <span className="text-sm font-bold text-amber-700">PKR {result.pendingAmount}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="text-sm text-gray-500 w-24 shrink-0">{label}</span>
      <code className="flex-1 text-sm font-semibold text-gray-900 bg-gray-50 rounded-lg px-3 py-1.5 border">{value}</code>
      <button
        onClick={copy}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}