import { Route, Routes } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import AdminDashboard from './pages/AdminDashboard'
import UserDashboard from './pages/UserDashboard'
import AttendancePage from './pages/AttendancePage'
import ProtectedRoute from './components/ProtectedRoute'

const App = () => (
  <Routes>
    <Route path="/" element={<LoginPage />} />
    <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
    <Route path="/user" element={<ProtectedRoute role="user"><UserDashboard /></ProtectedRoute>} />
    <Route path="/user/attendance" element={<ProtectedRoute role="user"><AttendancePage /></ProtectedRoute>} />
  </Routes>
)

export default App
