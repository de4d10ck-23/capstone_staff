import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Shared Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WaterMap from './pages/WaterMap';
import Analytics from './pages/Analytics';
import Alerts from './pages/Alerts';
import InspectionRequests from './pages/InspectionRequests';

// Inspector Pages
import WaterSources from './pages/WaterSources';
import GenerateReports from './pages/inspector/GenerateReports';
import EndorsedReports from './pages/inspector/EndorsedReports';

// CHO Pages
import ViewReports from './pages/cho/ViewReports';

// Barangay Official Pages
import ValidateReports from './pages/barangay/ValidateReports';
import SubmitReport from './pages/barangay/SubmitReport';
import EscalateConcern from './pages/barangay/EscalateConcern';
import BarangayOverview from './pages/barangay/BarangayOverview';

// Role Guard Component
const RoleRoute = ({ allowedRoles, children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            
            {/* Shared Staff Routes */}
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="map" element={<WaterMap />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="inspections" element={<InspectionRequests />} />
            
            {/* Inspector Specific */}
            <Route path="endorsed-reports" element={
              <RoleRoute allowedRoles={['sanitization_inspector']}><EndorsedReports /></RoleRoute>
            } />
            <Route path="water-sources" element={
              <RoleRoute allowedRoles={['sanitization_inspector']}><WaterSources /></RoleRoute>
            } />
            <Route path="add-water-source" element={<Navigate to="/water-sources" replace />} />
            <Route path="generate-reports" element={
              <RoleRoute allowedRoles={['sanitization_inspector']}><GenerateReports /></RoleRoute>
            } />

            {/* CHO Specific */}
            <Route path="view-reports" element={
              <RoleRoute allowedRoles={['city_health_officer']}><ViewReports /></RoleRoute>
            } />

            {/* Barangay Specific */}
            <Route path="barangay-overview" element={
              <RoleRoute allowedRoles={['barangay_official']}><BarangayOverview /></RoleRoute>
            } />
            <Route path="validate-reports" element={
              <RoleRoute allowedRoles={['barangay_official']}><ValidateReports /></RoleRoute>
            } />
            <Route path="submit-report" element={
              <RoleRoute allowedRoles={['barangay_official']}><SubmitReport /></RoleRoute>
            } />
            <Route path="escalate-concern" element={
              <RoleRoute allowedRoles={['barangay_official']}><EscalateConcern /></RoleRoute>
            } />
            
          </Route>
          
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
