import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Map, 
  BarChart2, 
  FileText, 
  Bell, 
  PlusCircle, 
  FileCheck, 
  Send, 
  AlertOctagon, 
  ShieldAlert,
  LogOut, 
  MapPin, 
  ClipboardList, 
  UserCheck, 
  Menu, 
  X, 
  Droplets
} from 'lucide-react';

const Layout = () => {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sharedNav = [
    { to: "/dashboard", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
    { to: "/map", icon: <Map size={20} />, label: "Live Water Map" },
    { to: "/analytics", icon: <BarChart2 size={20} />, label: "Analytics & Trends" },
    { to: "/alerts", icon: <Bell size={20} />, label: "Broadcast Alerts & Advisories" },
    { to: "/inspections", icon: <ClipboardList size={20} />, label: "Inspection Requests" },
  ];

  const inspectorNav = [
    { to: "/endorsed-reports", icon: <ShieldAlert size={20} />, label: "Endorsed Reports & Sources" },
    { to: "/water-sources", icon: <Droplets size={20} />, label: "Water Sources Registry" },
    { to: "/generate-reports", icon: <FileText size={20} />, label: "Generate Reports" },
  ];

  const choNav = [
    { to: "/view-reports", icon: <FileText size={20} />, label: "View Reports" },
  ];

  const barangayNav = [
    { to: "/barangay-overview", icon: <MapPin size={20} />, label: "My Barangay" },
    { to: "/validate-reports", icon: <FileCheck size={20} />, label: "Validate Reports" },
    { to: "/submit-report", icon: <Send size={20} />, label: "Submit Report" },
    { to: "/escalate-concern", icon: <AlertOctagon size={20} />, label: "Escalate Concern" },
  ];

  const getRoleNav = () => {
    switch (user?.role) {
      case 'sanitization_inspector': return inspectorNav;
      case 'city_health_officer': return choNav;
      case 'barangay_official': return barangayNav;
      default: return [];
    }
  };

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'city_health_officer':
        return 'City Health Officer';
      case 'sanitization_inspector':
        return 'Sanitization Inspector';
      case 'barangay_official':
        return 'Barangay Official';
      case 'admin':
        return 'Administrator';
      case 'resident':
        return 'Resident';
      default:
        return role
          ? role
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (char) => char.toUpperCase())
          : 'Staff';
    }
  };

  const navItems = [...sharedNav, ...getRoleNav()];

  const renderNavContent = () => (
    <>
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img
            src="/images/logo/cropped_circle_image.png"
            alt="WaterWatch Logo"
            className="w-10 h-10 rounded-full border-2 border-blue-200 object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <div>
            <h1 className="font-bold text-base text-slate-900 leading-tight">WaterWatch</h1>
            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">
              {getRoleDisplayName(user?.role)}
            </p>
          </div>
        </div>

        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        >
          <X size={20} />
        </button>
      </div>
      
      <nav className="flex-1 overflow-y-auto p-4 space-y-1.5">
        {navItems.map((item) => (
          <NavLink 
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive 
                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/20 font-semibold" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-700 to-cyan-600 text-white flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0">
            {user?.full_name?.charAt(0) || 'S'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-slate-900 truncate">{user?.full_name}</p>
            <p className="text-xs text-blue-600 font-medium truncate">
              {user?.role === "barangay_official" && user?.barangay
                ? `Brgy. ${user.barangay} Official`
                : getRoleDisplayName(user?.role)}
            </p>
          </div>
        </div>

        <button 
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-700 text-sm font-medium transition-all shadow-sm cursor-pointer"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200 flex-col shadow-lg z-20 flex-shrink-0">
        {renderNavContent()}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Slide-over Drawer */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {renderNavContent()}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100"
              aria-label="Open Navigation Menu"
            >
              <Menu size={20} />
            </button>
            <span className="text-xs sm:text-sm font-semibold text-slate-700 truncate">Staff Operational Portal</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-xs font-semibold px-3 py-1 bg-blue-50 text-blue-800 rounded-full border border-blue-200 truncate">
              {getRoleDisplayName(user?.role)}
            </span>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
