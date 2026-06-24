import { useEffect, useMemo, useState } from 'react'
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { Building2, CalendarCheck, Crosshair, FileText, MapPin, Printer, UsersRound } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import StatCard from '../components/StatCard'
import { db } from '../firebase/firebase'
import { formatDateTime, localMonthKey, todayKey } from '../utils/date'
import { DEFAULT_OFFICE_LOCATION, OFFICE_LOCATION_DOC_ID, SETTINGS_COLLECTION, normalizeOfficeLocation } from '../utils/geofence'

const emptyForm = { username: '', gender: 'Male', dob: '', address: '', qualification: '', phone: '', email: '' }
const navItems = [{ to: '/admin', label: 'Dashboard' }]

const currentMonthKey = () => localMonthKey()

const getNextMonthKey = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number)
  const next = new Date(year, month, 1)
  return localMonthKey(next)
}

const monthLabel = (monthKey) => {
  if (!monthKey) return '-'
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' })
}

const AdminDashboard = () => {
  const [users, setUsers] = useState([])
  const [todayCount, setTodayCount] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingLocation, setSavingLocation] = useState(false)
  const [monthFilter, setMonthFilter] = useState(currentMonthKey())
  const [monthlyAttendance, setMonthlyAttendance] = useState([])
  const [monthlyLoading, setMonthlyLoading] = useState(false)
  const [officeLocation, setOfficeLocation] = useState({
    ...DEFAULT_OFFICE_LOCATION,
    address: '',
  })

  const loadMonthlyAttendance = async (selectedMonth = monthFilter) => {
    if (!selectedMonth) return

    setMonthlyLoading(true)
    try {
      const monthStart = `${selectedMonth}-01`
      const nextMonthStart = `${getNextMonthKey(selectedMonth)}-01`

      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('date', '>=', monthStart),
        where('date', '<', nextMonthStart),
      )

      const attendanceSnap = await getDocs(attendanceQuery)
      const rows = attendanceSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.username).localeCompare(String(b.username)))

      setMonthlyAttendance(rows)
    } catch (error) {
      console.error('Failed to load monthly attendance:', error)
      toast.error(error.message || 'Failed to load monthly attendance')
    } finally {
      setMonthlyLoading(false)
    }
  }

  const loadData = async () => {
    setLoading(true)

    try {
      const usersSnap = await getDocs(collection(db, 'users'))
      const userRows = usersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || a.updatedAt?.toMillis?.() || 0
          const bTime = b.createdAt?.toMillis?.() || b.updatedAt?.toMillis?.() || 0
          return bTime - aTime || String(a.username || '').localeCompare(String(b.username || ''))
        })
      setUsers(userRows)

      const attSnap = await getDocs(query(collection(db, 'attendance'), where('date', '==', todayKey())))
      setTodayCount(attSnap.size)

      const locationSnap = await getDoc(doc(db, SETTINGS_COLLECTION, OFFICE_LOCATION_DOC_ID))
      if (locationSnap.exists()) {
        setOfficeLocation(normalizeOfficeLocation(locationSnap.data()))
      } else {
        setOfficeLocation({ ...DEFAULT_OFFICE_LOCATION, address: '' })
      }

      await loadMonthlyAttendance(monthFilter)
    } catch (error) {
      console.error('Failed to load admin dashboard:', error)
      toast.error(error.message || 'Failed to load dashboard. Check Firestore rules.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const passwordFromPhone = (phone) => phone.replace(/\D/g, '').slice(-6)

  const monthlyUserRows = useMemo(() => {
    const grouped = users.map((user) => {
      const records = monthlyAttendance.filter((row) => row.appUserId === user.id || row.userId === user.id || row.username === user.username)
      const presentDays = new Set(records.map((row) => row.date)).size
      const completedDays = records.filter((row) => row.clockInTime && row.clockOutTime).length
      const incompleteDays = records.filter((row) => row.clockInTime && !row.clockOutTime).length

      return {
        ...user,
        records,
        presentDays,
        completedDays,
        incompleteDays,
      }
    })

    return grouped.sort((a, b) => b.presentDays - a.presentDays || String(a.username).localeCompare(String(b.username)))
  }, [users, monthlyAttendance])

  const handleMonthChange = async (value) => {
    setMonthFilter(value)
    await loadMonthlyAttendance(value)
  }

  const printMonthlyPdf = () => {
    const monthName = monthLabel(monthFilter)
    const totalPresent = monthlyUserRows.reduce((sum, user) => sum + user.presentDays, 0)

    const rowsHtml = monthlyUserRows.map((user, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${user.username || '-'}</td>
        <td>${user.phone || '-'}</td>
        <td>${user.email || '-'}</td>
        <td>${user.presentDays}</td>
        <td>${user.completedDays}</td>
        <td>${user.incompleteDays}</td>
      </tr>
    `).join('')

    const detailHtml = monthlyUserRows.map((user) => {
      const records = user.records.map((record) => `
        <tr>
          <td>${record.date || '-'}</td>
          <td>${formatDateTime(record.clockInTime)}</td>
          <td>${formatDateTime(record.clockOutTime)}</td>
          <td>${record.location?.distanceMeters ?? record.clockOutLocation?.distanceMeters ?? '-'} m</td>
        </tr>
      `).join('')

      return `
        <section class="user-section">
          <h3>${user.username || '-'} <span>${user.presentDays} present day(s)</span></h3>
          <table>
            <thead><tr><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Distance</th></tr></thead>
            <tbody>${records || '<tr><td colspan="4" class="empty">No attendance in this month.</td></tr>'}</tbody>
          </table>
        </section>
      `
    }).join('')

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Popup blocked. Please allow popups to print the PDF.')
      return
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Monthly Attendance - ${monthName}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 28px; }
            .header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px; }
            h1 { margin: 0; font-size: 24px; }
            h2 { margin: 26px 0 12px; font-size: 18px; }
            h3 { display: flex; justify-content: space-between; margin: 22px 0 8px; font-size: 15px; }
            h3 span { color: #2563eb; font-size: 13px; }
            p { margin: 4px 0; color: #475569; font-size: 13px; }
            .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0 22px; }
            .stat { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
            .stat b { display: block; font-size: 20px; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; page-break-inside: auto; }
            th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f1f5f9; text-transform: uppercase; color: #475569; }
            .empty { text-align: center; color: #64748b; }
            .user-section { page-break-inside: avoid; margin-top: 14px; }
            @media print { body { margin: 16px; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>GeoFence Attendance System</h1>
              <p>Monthly Attendance Report: <b>${monthName}</b></p>
            </div>
            <div>
              <p>Generated: ${new Date().toLocaleString()}</p>
              <p>Office: ${officeLocation.address || 'Office Location'}</p>
            </div>
          </div>

          <div class="stats">
            <div class="stat">Total Users<b>${users.length}</b></div>
            <div class="stat">Users Present This Month<b>${monthlyUserRows.filter((u) => u.presentDays > 0).length}</b></div>
            <div class="stat">Total Attendance Days<b>${totalPresent}</b></div>
          </div>

          <h2>User Monthly Summary</h2>
          <table>
            <thead>
              <tr><th>#</th><th>User</th><th>Phone</th><th>Email</th><th>Present Days</th><th>Completed</th><th>Missing Clock Out</th></tr>
            </thead>
            <tbody>${rowsHtml || '<tr><td colspan="7" class="empty">No users found.</td></tr>'}</tbody>
          </table>

          <h2>Detailed Attendance</h2>
          ${detailHtml}

          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `)

    printWindow.document.close()
  }

  const useCurrentLocationForOffice = () => {
    if (!navigator.geolocation) {
      toast.error('GPS is not supported in this browser')
      return
    }

    setSavingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOfficeLocation((current) => ({
          ...current,
          lat: Number(position.coords.latitude.toFixed(7)),
          lng: Number(position.coords.longitude.toFixed(7)),
        }))
        setSavingLocation(false)
        toast.success('Current location selected. Click Save Office Location.')
      },
      () => {
        setSavingLocation(false)
        toast.error('Please allow location permission to use current location')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const saveOfficeLocation = async (e) => {
    e.preventDefault()

    const lat = Number(officeLocation.lat)
    const lng = Number(officeLocation.lng)
    const radiusMeters = Number(officeLocation.radiusMeters)

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      toast.error('Latitude must be between -90 and 90')
      return
    }

    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      toast.error('Longitude must be between -180 and 180')
      return
    }

    if (!Number.isFinite(radiusMeters) || radiusMeters < 10) {
      toast.error('Radius must be at least 10 meters')
      return
    }

    setSavingLocation(true)
    try {
      await setDoc(doc(db, SETTINGS_COLLECTION, OFFICE_LOCATION_DOC_ID), {
        lat,
        lng,
        radiusMeters,
        address: officeLocation.address || '',
        updatedAt: serverTimestamp(),
      })
      toast.success('Office location saved')
      await loadData()
    } catch (error) {
      toast.error(error.message || 'Failed to save office location')
    } finally {
      setSavingLocation(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (passwordFromPhone(form.phone).length < 6) {
      toast.error('Phone number must contain at least 6 digits')
      return
    }
    setSaving(true)
    try {
      const id = editingId || crypto.randomUUID()
      const avatarName = form.username || form.email || 'User'
      const photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}&background=2563eb&color=fff&bold=true`

      const payload = {
        ...form,
        photoUrl,
        password: passwordFromPhone(form.phone),
        updatedAt: serverTimestamp(),
      }

      if (editingId) {
        await updateDoc(doc(db, 'users', editingId), payload)
        toast.success('User updated')
      } else {
        await setDoc(doc(db, 'users', id), { ...payload, createdAt: serverTimestamp(), authUid: null })
        toast.success(`User added. Password: ${payload.password}`)
      }

      setForm(emptyForm)
      setEditingId(null)
      await loadData()
    } catch (error) {
      toast.error(error.message || 'Failed to save user')
    } finally {
      setSaving(false)
    }
  }

  const editUser = (user) => {
    setEditingId(user.id)
    setForm({ username: user.username || '', gender: user.gender || 'Male', dob: user.dob || '', address: user.address || '', qualification: user.qualification || '', phone: user.phone || '', email: user.email || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const removeUser = async (id) => {
    if (!confirm('Delete this user?')) return
    await deleteDoc(doc(db, 'users', id))
    toast.success('User deleted')
    loadData()
  }

  return (
    <Layout navItems={navItems}>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900">Admin Dashboard</h1>
        <p className="mt-2 text-slate-500">Manage users and view attendance summary.</p>
      </div>

      {loading ? <Spinner /> : (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            <StatCard title="Total Users" value={users.length} icon={UsersRound} />
            <StatCard title="Today Attendance Count" value={todayCount} icon={CalendarCheck} />
          </div>

          <form onSubmit={saveOfficeLocation} className="card mt-8">
            <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="text-blue-600" />
                  <h2 className="text-xl font-bold">Office GeoFence Location</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">Set the office coordinates and allowed attendance radius used for Clock In / Clock Out.</p>
              </div>
              <button type="button" disabled={savingLocation} onClick={useCurrentLocationForOffice} className="btn-secondary">
                <Crosshair size={18} /> Use Current Location
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <label className="space-y-2">
                <span className="text-sm font-bold text-slate-700">Latitude</span>
                <input className="input" type="number" step="any" value={officeLocation.lat} onChange={(e) => setOfficeLocation({ ...officeLocation, lat: e.target.value })} required />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-bold text-slate-700">Longitude</span>
                <input className="input" type="number" step="any" value={officeLocation.lng} onChange={(e) => setOfficeLocation({ ...officeLocation, lng: e.target.value })} required />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-bold text-slate-700">Radius Meter</span>
                <input className="input" type="number" min="10" value={officeLocation.radiusMeters} onChange={(e) => setOfficeLocation({ ...officeLocation, radiusMeters: e.target.value })} required />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-bold text-slate-700">Location Name</span>
                <input className="input" placeholder="Office / Campus" value={officeLocation.address || ''} onChange={(e) => setOfficeLocation({ ...officeLocation, address: e.target.value })} />
              </label>
            </div>

            <div className="mt-4 flex flex-col justify-between gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-700 md:flex-row md:items-center">
              <p className="flex items-center gap-2"><MapPin size={18} /> Current allowed area: {officeLocation.lat}, {officeLocation.lng} within {officeLocation.radiusMeters} meters.</p>
              <button disabled={savingLocation} className="btn-primary">{savingLocation ? 'Saving...' : 'Save Office Location'}</button>
            </div>
          </form>

          <div className="card mt-8">
            <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="text-blue-600" />
                  <h2 className="text-xl font-bold">Monthly Attendance Report</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">Filter users by month and print the monthly report as PDF.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input className="input sm:w-52" type="month" value={monthFilter} onChange={(e) => handleMonthChange(e.target.value)} />
                <button type="button" disabled={monthlyLoading} onClick={printMonthlyPdf} className="btn-primary">
                  <Printer size={18} /> Print Monthly PDF
                </button>
              </div>
            </div>

            <div className="mb-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Selected Month</p>
                <p className="mt-1 text-lg font-black text-slate-900">{monthLabel(monthFilter)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Users Present</p>
                <p className="mt-1 text-lg font-black text-slate-900">{monthlyUserRows.filter((user) => user.presentDays > 0).length}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Total Attendance Days</p>
                <p className="mt-1 text-lg font-black text-slate-900">{monthlyUserRows.reduce((sum, user) => sum + user.presentDays, 0)}</p>
              </div>
            </div>

            {monthlyLoading ? <Spinner text="Loading monthly report..." /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="p-3">User</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Present Days</th>
                      <th className="p-3">Completed Days</th>
                      <th className="p-3">Missing Clock Out</th>
                      <th className="p-3">Dates Present</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthlyUserRows.length === 0 ? (
                      <tr><td colSpan="7" className="p-6 text-center text-slate-500">No users found.</td></tr>
                    ) : monthlyUserRows.map((user) => (
                      <tr key={user.id}>
                        <td className="p-3"><div className="flex items-center gap-3"><img src={user.photoUrl || 'https://ui-avatars.com/api/?name=User&background=2563eb&color=fff&bold=true'} className="h-10 w-10 rounded-full object-cover" alt="User" /><div><p className="font-bold">{user.username}</p><p className="text-xs text-slate-500">{user.qualification || '-'}</p></div></div></td>
                        <td className="p-3">{user.phone || '-'}</td>
                        <td className="p-3">{user.email || '-'}</td>
                        <td className="p-3"><span className="badge bg-green-50 text-green-700">{user.presentDays}</span></td>
                        <td className="p-3">{user.completedDays}</td>
                        <td className="p-3">{user.incompleteDays}</td>
                        <td className="p-3 text-xs text-slate-600">{user.records.map((row) => row.date).join(', ') || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[420px_1fr]">
            <form onSubmit={handleSubmit} className="card space-y-4">
              <h2 className="text-xl font-bold">{editingId ? 'Update User' : 'Add User'}</h2>
              <input className="input" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              <div className="grid grid-cols-2 gap-3">
                <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option>Male</option><option>Female</option></select>
                <input className="input" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} required />
              </div>
              <textarea className="input min-h-24" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
              <input className="input" placeholder="Highest Qualification" value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} required />
              <input className="input" placeholder="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
              <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                Profile photo upload is disabled. A free automatic avatar will be generated from the username.
              </div>
              <div className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-700">Auto password: <b>{passwordFromPhone(form.phone) || 'last 6 phone digits'}</b></div>
              <button disabled={saving} className="btn-primary w-full">{saving ? 'Saving...' : editingId ? 'Update User' : 'Add User'}</button>
              {editingId && <button type="button" className="btn-secondary w-full" onClick={() => { setEditingId(null); setForm(emptyForm) }}>Cancel Edit</button>}
            </form>

            <div className="card overflow-hidden">
              <h2 className="mb-4 text-xl font-bold">All Users</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr><th className="p-3">User</th><th className="p-3">Gender</th><th className="p-3">Phone</th><th className="p-3">Email</th><th className="p-3">Password</th><th className="p-3">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="p-3"><div className="flex items-center gap-3"><img src={user.photoUrl || 'https://placehold.co/80x80?text=User'} className="h-11 w-11 rounded-full object-cover" alt="User" /><div><p className="font-bold">{user.username}</p><p className="text-xs text-slate-500">{user.qualification}</p></div></div></td>
                        <td className="p-3">{user.gender}</td><td className="p-3">{user.phone}</td><td className="p-3">{user.email}</td><td className="p-3"><span className="badge bg-slate-100 text-slate-700">{user.password}</span></td>
                        <td className="p-3"><div className="flex gap-2"><button className="btn-secondary py-2" onClick={() => editUser(user)}>Edit</button><button className="rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-600" onClick={() => removeUser(user.id)}>Delete</button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
export default AdminDashboard
