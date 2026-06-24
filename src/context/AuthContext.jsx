import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { auth, db } from '../firebase/firebase'

const AuthContext = createContext(null)
const SESSION_KEY = 'geofence_session'

const readSavedSession = () => {
  try {
    const saved = localStorage.getItem(SESSION_KEY)
    return saved ? JSON.parse(saved) : null
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export const AuthProvider = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [session, setSession] = useState(readSavedSession)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user)
      setLoading(false)
    }, () => {
      setFirebaseUser(null)
      setLoading(false)
    })

    return () => unsub()
  }, [])

  const saveSession = (nextSession) => {
    setSession(nextSession)
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession))
  }

  const clearSession = () => {
    setSession(null)
    localStorage.removeItem(SESSION_KEY)
  }

  const loginAdmin = async (email, password) => {
    const demoEmail = import.meta.env.VITE_DEMO_ADMIN_EMAIL
    const demoPassword = import.meta.env.VITE_DEMO_ADMIN_PASSWORD

    if (email === demoEmail && password === demoPassword) {
      saveSession({ role: 'admin', email, name: 'Admin' })
      toast.success('Admin logged in')
      return
    }

    const credential = await signInWithEmailAndPassword(auth, email, password)
    saveSession({ role: 'admin', email: credential.user.email, uid: credential.user.uid, name: 'Admin' })
    toast.success('Admin logged in')
  }

  const loginUser = async (username, password) => {
    const cleanUsername = username.trim()
    const q = query(collection(db, 'users'), where('username', '==', cleanUsername), limit(1))
    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      throw new Error('Invalid username or password.')
    }

    const userDoc = snapshot.docs[0]
    const user = { id: userDoc.id, ...userDoc.data() }

    if (String(user.password) !== String(password)) {
      throw new Error('Invalid username or password.')
    }

    // Do not block login if Firestore update rules are not published yet.
    try {
      await updateDoc(doc(db, 'users', userDoc.id), {
        lastLoginAt: serverTimestamp(),
      })
    } catch (error) {
      console.warn('Could not update lastLoginAt:', error)
    }

    saveSession({
      role: 'user',
      uid: userDoc.id,
      appUserId: userDoc.id,
      username: user.username,
      email: user.email || '',
    })

    toast.success('User logged in')
  }

  const logout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.warn('Firebase sign out skipped:', error)
    }

    clearSession()
    toast.success('Logged out')
  }

  const value = useMemo(
    () => ({ firebaseUser, session, loading, loginAdmin, loginUser, logout, clearSession }),
    [firebaseUser, session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
