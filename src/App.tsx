import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import MovieUpload from './pages/MovieUpload'
import MovieList from './pages/MovieList'
import CategoryManager from './pages/CategoryManager'
import GenreManager from './pages/GenreManager'
import CodeGenerator from './pages/CodeGenerator'
import PaymentVerify from './pages/PaymentVerify'
import ReferralTracking from './pages/ReferralTracking'
import UserManagement from './pages/UserManagement'
import BannerManager from './pages/BannerManager'
import PricingSettings from './pages/PricingSettings'

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="movies/upload" element={<MovieUpload />} />
          <Route path="movies/list" element={<MovieList />} />
          <Route path="movies/edit/:id" element={<MovieUpload />} />
          <Route path="categories" element={<CategoryManager />} />
          <Route path="genres" element={<GenreManager />} />
          <Route path="codes" element={<CodeGenerator />} />
          <Route path="payments" element={<PaymentVerify />} />
          <Route path="referrals" element={<ReferralTracking />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="banners" element={<BannerManager />} />
          <Route path="pricing" element={<PricingSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App