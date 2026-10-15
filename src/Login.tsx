import { useState, type FormEvent } from 'react'
import { appUrl, loginErrorFromUrl, supabase } from './supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [linkSent, setLinkSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(loginErrorFromUrl)

  async function signInWithGitHub() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: appUrl },
    })
    // On success the browser goes to GitHub, so we only handle errors here
    if (error) {
      setError(error.message)
      setBusy(false)
    }
  }

  // Fallback: Supabase emails a login link. The link only works when opened in the
  // same browser that requested it (on iPhone it opens in Safari, not the Home Screen app).
  async function sendLink(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: appUrl },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setLinkSent(true)
  }

  return (
    <main className="page">
      <h1>Workout Log</h1>
      <p className="muted">Sign in to see and log your workouts.</p>

      <div className="stack">
        <button className="button" onClick={signInWithGitHub} disabled={busy}>
          Sign in with GitHub
        </button>

        <p className="divider">or use your email</p>

        {!linkSent ? (
          <form className="stack" onSubmit={sendLink}>
            <label className="field">
              Email
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button className="button secondary" disabled={busy}>
              Email me a login link
            </button>
          </form>
        ) : (
          <div className="stack">
            <p>
              We sent a login link to <strong>{email.trim()}</strong>. Open it in this
              same browser to sign in.
            </p>
            <button
              type="button"
              className="link-button"
              onClick={() => setLinkSent(false)}
            >
              Use a different email
            </button>
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    </main>
  )
}
