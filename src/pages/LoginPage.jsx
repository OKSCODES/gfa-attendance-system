import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ShieldCheck, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

const LoginPage = () => {
  const [mode, setMode] = useState('user')
  const [form, setForm] = useState({ username: '', password: '', email: '' })
  const [loading, setLoading] = useState(false)
  const { loginAdmin, loginUser, session } = useAuth()
  const navigate = useNavigate()

  if (session?.role === 'admin') return <Navigate to="/admin" replace />
  if (session?.role === 'user') return <Navigate to="/user" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'admin') {
        await loginAdmin(form.email, form.password)
        navigate('/admin')
      } else {
        await loginUser(form.username, form.password)
        navigate('/user')
      }
    } catch (error) {
      toast.error(error.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-soft md:grid-cols-2">
        <div className="hidden bg-blue-600 p-10 text-white md:block">
          <div className="flex h-full flex-col justify-between">
            <div>
              <div className="mb-8 inline-flex rounded-2xl bg-white/15 p-3"><ShieldCheck size={34} /></div>
              <h1 className="text-4xl font-black leading-tight">GeoFence Attendance System</h1>
              <p className="mt-5 text-blue-100">Track attendance only from the allowed office location using GPS and Firebase Firestore.</p>
            </div>
            <div className="rounded-3xl bg-white/10 p-5 text-sm text-blue-50">Office radius validation: 100 meters by default. Change it in your `.env` file.</div>
          </div>
        </div>
        <div className="p-6 sm:p-10">
          <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-500">Login as admin or user.</p>

          <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-slate-100 p-2">
            <button onClick={() => setMode('user')} className={`rounded-xl py-3 text-sm font-bold ${mode === 'user' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><UserRound className="mx-auto mb-1" size={18} />User</button>
            <button onClick={() => setMode('admin')} className={`rounded-xl py-3 text-sm font-bold ${mode === 'admin' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><ShieldCheck className="mx-auto mb-1" size={18} />Admin</button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'admin' ? (
              <input className="input" type="email" placeholder="Admin email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            ) : (
              <input className="input" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            )}
            <input className="input" type="password" placeholder={mode === 'user' ? 'Password: last 6 digits of phone' : 'Admin password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <button disabled={loading} className="btn-primary w-full">{loading ? 'Logging in...' : 'Login'}</button>
          </form>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
            Demo admin: use values from `.env`. User password is auto-generated from the last 6 digits of phone number.
          </div>
        </div>
      </div>
    </div>
  )
}
export default LoginPage
