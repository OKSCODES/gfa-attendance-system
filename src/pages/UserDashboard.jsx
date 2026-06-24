import { useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { CalendarDays, Clock, LogIn, LogOut, MapPin, Phone, GraduationCap, Home, Mail, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import { useAuth } from '../context/AuthContext'
import { db } from '../firebase/firebase'
import { formatDateTime, todayKey } from '../utils/date'
import { DEFAULT_OFFICE_LOCATION, OFFICE_LOCATION_DOC_ID, SETTINGS_COLLECTION, getCurrentPosition, isInsideOfficeRadius, normalizeOfficeLocation } from '../utils/geofence'

const navItems = [
  { to: '/user', label: 'Dashboard' },
  { to: '/user/attendance', label: 'Attendance' },
]

const shortTime = (value) => {
  if (!value) return '-'
  const date = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const displayDate = (value) => {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
}

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
    <span className="mt-0.5 rounded-xl bg-white p-2 text-blue-600 shadow-sm">
      <Icon size={16} />
    </span>
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="break-words text-sm font-semibold text-slate-800">{value || '-'}</p>
    </div>
  </div>
)

const UserDashboard = () => {
  const { session, logout } = useAuth()
  const [profile, setProfile] = useState(null)
  const [history, setHistory] = useState([])
  const [todayAttendance, setTodayAttendance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [officeLocation, setOfficeLocation] = useState(DEFAULT_OFFICE_LOCATION)

  const loadData = async () => {
    if (!session?.appUserId) {
      toast.error('Session expired. Please login again.')
      await logout()
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const profileSnap = await getDoc(doc(db, 'users', session.appUserId))

      if (!profileSnap.exists()) {
        toast.error('User profile was not found. Please contact admin.')
        await logout()
        return
      }

      const profileData = { id: profileSnap.id, ...profileSnap.data() }
      setProfile(profileData)

      const locationSnap = await getDoc(doc(db, SETTINGS_COLLECTION, OFFICE_LOCATION_DOC_ID))
      setOfficeLocation(locationSnap.exists() ? normalizeOfficeLocation(locationSnap.data()) : DEFAULT_OFFICE_LOCATION)

      const attQ = query(collection(db, 'attendance'), where('appUserId', '==', session.appUserId))
      const attSnap = await getDocs(attQ)
      const rows = attSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))

      setHistory(rows)
      setTodayAttendance(rows.find((row) => row.date === todayKey()) || null)
    } catch (error) {
      console.error('Failed to load user dashboard:', error)
      toast.error(error.message || 'Failed to load dashboard. Check Firestore rules.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.appUserId])

  const verifyLocation = async () => {
    const position = await getCurrentPosition()
    const result = isInsideOfficeRadius(position.lat, position.lng, officeLocation)

    if (!result.allowed) {
      throw new Error(`You are outside the allowed area. Distance: ${Math.round(result.distance)} meters.`)
    }

    return { position, distance: result.distance }
  }

  const clockIn = async () => {
    setActionLoading(true)

    try {
      if (todayAttendance?.clockInTime) throw new Error('You already clocked in today.')

      const { position, distance } = await verifyLocation()
      const id = `${session.appUserId}_${todayKey()}`

      await setDoc(doc(db, 'attendance', id), {
        userId: session.uid || session.appUserId,
        appUserId: session.appUserId,
        username: session.username,
        date: todayKey(),
        clockInTime: serverTimestamp(),
        clockOutTime: null,
        location: {
          lat: position.lat,
          lng: position.lng,
          accuracy: position.accuracy,
          distanceMeters: Math.round(distance),
        },
        officeLocation: {
          lat: officeLocation.lat,
          lng: officeLocation.lng,
          radiusMeters: officeLocation.radiusMeters,
          address: officeLocation.address || '',
        },
        createdAt: serverTimestamp(),
      })

      toast.success('Clock in successful')
      await loadData()
    } catch (error) {
      toast.error(error.message || 'Clock in failed')
    } finally {
      setActionLoading(false)
    }
  }

  const clockOut = async () => {
    setActionLoading(true)

    try {
      if (!todayAttendance?.clockInTime) throw new Error('Clock in first before clocking out.')
      if (todayAttendance?.clockOutTime) throw new Error('You already clocked out today.')

      const { position, distance } = await verifyLocation()

      await updateDoc(doc(db, 'attendance', todayAttendance.id), {
        clockOutTime: serverTimestamp(),
        clockOutLocation: {
          lat: position.lat,
          lng: position.lng,
          accuracy: position.accuracy,
          distanceMeters: Math.round(distance),
        },
        officeLocation: {
          lat: officeLocation.lat,
          lng: officeLocation.lng,
          radiusMeters: officeLocation.radiusMeters,
          address: officeLocation.address || '',
        },
        updatedAt: serverTimestamp(),
      })

      toast.success('Clock out successful')
      await loadData()
    } catch (error) {
      toast.error(error.message || 'Clock out failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <Layout navItems={navItems}>
        <Spinner text="Loading user dashboard..." />
      </Layout>
    )
  }

  return (
    <Layout navItems={navItems}>
      <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-blue-100 bg-white p-4 shadow-sm sm:p-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-wide text-blue-600">User Dashboard</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">Welcome, {profile?.username || session?.username}</h1>
            <p className="mt-1 text-sm text-slate-500 sm:text-base">Mark attendance only when you are inside the office radius.</p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2 md:w-[420px]">
            <div className="rounded-2xl bg-blue-50 px-4 py-3 font-bold text-blue-700">
              Radius: {officeLocation.radiusMeters} m
            </div>
            <div className="min-w-0 rounded-2xl bg-slate-50 px-4 py-3 text-slate-600">
              <p className="truncate font-bold text-slate-800">{officeLocation.address || 'Office Location'}</p>
              <p className="truncate text-xs">{officeLocation.lat}, {officeLocation.lng}</p>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
          <div className="card min-w-0 p-4 sm:p-6">
            <div className="flex items-center gap-4 lg:block">
              <img src={profile?.photoUrl || 'https://ui-avatars.com/api/?name=User&background=2563eb&color=fff&bold=true'} className="h-20 w-20 shrink-0 rounded-3xl object-cover sm:h-24 sm:w-24 lg:h-28 lg:w-28" alt="Profile" />
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-black text-slate-900 lg:mt-4">{profile?.username || '-'}</h2>
                <p className="truncate text-sm text-slate-500">{profile?.email || '-'}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <InfoRow icon={UserRound} label="Gender" value={profile?.gender} />
              <InfoRow icon={CalendarDays} label="DOB" value={profile?.dob} />
              <InfoRow icon={Phone} label="Phone" value={profile?.phone} />
              <InfoRow icon={GraduationCap} label="Qualification" value={profile?.qualification} />
              <InfoRow icon={Home} label="Address" value={profile?.address} />
              <InfoRow icon={Mail} label="Email" value={profile?.email} />
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            <div className="card min-w-0 overflow-hidden p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black text-slate-900 sm:text-2xl">Today Attendance</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{displayDate(todayKey())}</span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Clock In</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{shortTime(todayAttendance?.clockInTime)}</p>
                  <p className="mt-1 text-xs text-slate-500">{todayAttendance?.clockInTime ? formatDateTime(todayAttendance.clockInTime) : 'Not clocked in yet'}</p>
                </div>
                <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Clock Out</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{shortTime(todayAttendance?.clockOutTime)}</p>
                  <p className="mt-1 text-xs text-slate-500">{todayAttendance?.clockOutTime ? formatDateTime(todayAttendance.clockOutTime) : 'Not clocked out yet'}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button disabled={actionLoading || todayAttendance?.clockInTime} onClick={clockIn} className="btn-primary min-h-12 w-full whitespace-nowrap text-sm">
                  <LogIn size={18} />
                  <span>{actionLoading ? 'Please wait...' : 'Clock In'}</span>
                </button>
                <button disabled={actionLoading || !todayAttendance?.clockInTime || todayAttendance?.clockOutTime} onClick={clockOut} className="btn-secondary min-h-12 w-full whitespace-nowrap text-sm">
                  <LogOut size={18} />
                  <span>{actionLoading ? 'Please wait...' : 'Clock Out'}</span>
                </button>
              </div>
            </div>

            <div className="card min-w-0 overflow-hidden p-4 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="rounded-2xl bg-blue-50 p-2 text-blue-600"><Clock size={22} /></span>
                <h2 className="text-xl font-black text-slate-900 sm:text-2xl">Recent Attendance</h2>
              </div>

              {history.length === 0 ? (
                <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">No attendance yet.</div>
              ) : (
                <>
                  <div className="grid gap-3 md:hidden">
                    {history.map((row) => (
                      <div key={row.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-black text-slate-900">{displayDate(row.date)}</p>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">
                            {row.location?.distanceMeters ?? row.clockOutLocation?.distanceMeters ?? '-'} m
                          </span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Clock In</p>
                            <p className="mt-1 font-bold text-slate-900">{shortTime(row.clockInTime)}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Clock Out</p>
                            <p className="mt-1 font-bold text-slate-900">{shortTime(row.clockOutTime)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[650px] text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Clock In</th>
                          <th className="p-3">Clock Out</th>
                          <th className="p-3">Distance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {history.map((row) => (
                          <tr key={row.id}>
                            <td className="p-3 font-bold">{displayDate(row.date)}</td>
                            <td className="p-3">{formatDateTime(row.clockInTime)}</td>
                            <td className="p-3">{formatDateTime(row.clockOutTime)}</td>
                            <td className="p-3">{row.location?.distanceMeters ?? row.clockOutLocation?.distanceMeters ?? '-'} m</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default UserDashboard
