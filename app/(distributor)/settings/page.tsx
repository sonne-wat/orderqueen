'use client'

import { useState, useEffect } from 'react'

interface Profile {
  id: string
  name: string
  company: string | null
  email: string
  phone: string | null
  address: string | null
  shippingAddress: string | null
  notificationEmails: string[]
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    address: '',
    shippingAddress: '',
  })
  const [notificationEmails, setNotificationEmails] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings/profile')
      .then((r) => r.json())
      .then((p: Profile) => {
        setProfile(p)
        setForm({
          name: p.name ?? '',
          company: p.company ?? '',
          phone: p.phone ?? '',
          email: p.email ?? '',
          address: p.address ?? '',
          shippingAddress: p.shippingAddress ?? '',
        })
        setNotificationEmails(p.notificationEmails ?? [])
      })
  }, [])

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/settings/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name || null,
        company: form.company || null,
        phone: form.phone || null,
        address: form.address || null,
        shippingAddress: form.shippingAddress || null,
        notificationEmails,
      }),
    })
    const updated = await res.json()
    setProfile(updated)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addEmail() {
    const trimmed = newEmail.trim().toLowerCase()
    if (!trimmed) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Please enter a valid email address.')
      return
    }
    if (notificationEmails.includes(trimmed)) {
      setEmailError('This email has already been added.')
      return
    }
    setNotificationEmails((prev) => [...prev, trimmed])
    setNewEmail('')
    setEmailError('')
  }

  function removeEmail(email: string) {
    setNotificationEmails((prev) => prev.filter((e) => e !== email))
  }

  if (!profile) return <div className="p-8 text-gray-400">Loading...</div>

  const fields: { label: string; key: keyof typeof form; placeholder: string; textarea?: boolean; readOnly?: boolean }[] = [
    { label: 'Name', key: 'name', placeholder: 'Your full name' },
    { label: 'Email', key: 'email', placeholder: profile.email, readOnly: true },
    { label: 'Phone Number', key: 'phone', placeholder: '+82-10-0000-0000' },
    { label: 'Company Name', key: 'company', placeholder: 'Your company name' },
    { label: 'Company Address', key: 'address', placeholder: '123 Main St, Seoul, Korea', textarea: true },
    { label: 'Shipping Address', key: 'shippingAddress', placeholder: 'Shipping destination address', textarea: true },
  ]

  return (
    <div>
      <main className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold mb-6">Settings</h1>

        {saved && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
            Saved successfully.
          </div>
        )}

        <div className="bg-white rounded-xl border p-6 space-y-5 mb-4">
          <h2 className="font-semibold text-gray-700">Profile Information</h2>

          {fields.map(({ label, key, placeholder, textarea, readOnly }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
              {textarea ? (
                <textarea
                  value={form[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  placeholder={placeholder}
                  rows={2}
                  disabled={readOnly}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-50 disabled:text-gray-400"
                />
              ) : (
                <input
                  type="text"
                  value={form[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  placeholder={placeholder}
                  disabled={readOnly}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
              )}
              {readOnly && (
                <p className="text-[11px] text-gray-400 mt-0.5">Email cannot be changed.</p>
              )}
            </div>
          ))}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Notification Emails */}
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-700">Notification Emails</h2>
            <p className="text-xs text-gray-400 mt-0.5">Register additional email addresses to receive notifications from admin.</p>
          </div>

          {/* Existing emails */}
          {notificationEmails.length > 0 && (
            <ul className="space-y-2">
              {notificationEmails.map((email) => (
                <li key={email} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border text-sm">
                  <span className="text-gray-700">{email}</span>
                  <button
                    onClick={() => removeEmail(email)}
                    className="text-gray-400 hover:text-red-500 text-xs font-medium ml-3"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {notificationEmails.length === 0 && (
            <p className="text-xs text-gray-400">No notification emails registered.</p>
          )}

          {/* Add new email */}
          <div className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => { setNewEmail(e.target.value); setEmailError('') }}
              onKeyDown={(e) => e.key === 'Enter' && addEmail()}
              placeholder="Email address to add"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addEmail}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
            >
              Add
            </button>
          </div>
          {emailError && <p className="text-xs text-red-500">{emailError}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </main>
    </div>
  )
}
