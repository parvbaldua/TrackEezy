import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider'
import { AppProvider } from './context/AppContext'
import { LanguageProvider } from './context/LanguageContext'
import { OfflineProvider } from './context/OfflineContext'
import DashboardLayout from './components/layout/DashboardLayout'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import InventoryPage from './pages/InventoryPage'

import BillingPage from './pages/BillingPage'
import ManualBillingPage from './pages/ManualBillingPage'
import BillingSelectorPage from './pages/BillingSelectorPage'
import ReportsPage from './pages/ReportsPage'
import ProfilePage from './pages/ProfilePage'
import InvoicePage from './pages/InvoicePage'
import AdminPage from './pages/AdminPage'
import KhataPage from './pages/KhataPage'

function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <OfflineProvider>
          <AuthProvider>
            <AppProvider>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/invoice" element={<InvoicePage />} />

                <Route element={<DashboardLayout />}>
                  <Route path="/home" element={<HomePage />} />
                  <Route path="/inventory" element={<InventoryPage />} />
                  <Route path="/sell" element={<BillingSelectorPage />} />
                  <Route path="/billing" element={<BillingPage />} />
                  <Route path="/manual-billing" element={<ManualBillingPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/khata" element={<KhataPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/admin" element={<AdminPage />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppProvider>
          </AuthProvider>
        </OfflineProvider>
      </LanguageProvider>
    </BrowserRouter>
  )
}

export default App




