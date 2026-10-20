'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setError('Не удалось войти: ' + error.message)
    }
    setBusy(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (checking) {
    return <main className="max-w-sm mx-auto p-8 text-gray-500">Загрузка...</main>
  }

  if (!session) {
    return (
      <main className="max-w-sm mx-auto p-8 mt-16">
        <h1 className="text-2xl font-semibold mb-6">Вход в Тендер-CRM</h1>
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            className="border rounded px-3 py-2 w-full"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2 w-full"
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-black text-white rounded px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? 'Входим...' : 'Войти'}
          </button>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </form>
      </main>
    )
  }

  return (
    <>
      <div className="bg-gray-100 text-xs text-gray-600">
        <div className="max-w-3xl mx-auto px-8 py-1 flex justify-end gap-3">
          <span>{session.user.email}</span>
          <button onClick={handleLogout} className="text-blue-600 hover:underline">
            Выйти
          </button>
        </div>
      </div>
      {children}
    </>
  )
}