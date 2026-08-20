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
  LogOut,
  MapPin,
  ClipboardList,
  UserCheck
} from 'lucide-react';

const Layout = () => {
  const { user, logout } = useAuth();

  const sharedNav = [
    { to: "/dashboard", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
    { to: "/map", icon: <Map size={20} />, label: "Live Water Map" },
    { to: "/analytics", icon: <BarChart2 size={20} />, label: "Analytics & Trends" },
    { to: "/alerts", icon: <Bell size={20} />, label: "Alerts & Notifications" },
    { to: "/inspections", icon: <ClipboardList size={20} />, label: "Inspection Requests" },
  ];

  const inspectorNav = [
    { to: "/add-water-source", icon: <PlusCircle size={20} />, label: "Add Water Source" },
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

  const navItems = [...sharedNav, ...getRoleNav()];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-lg z-20">
        <div className="p-5 border-b border-slate-100 flex items-center space-x-3">
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
              {user?.role?.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {navItems.map((item) => (
            <NavLink 
              key={item.to}
              to={item.to}
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
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-700 to-cyan-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              {user?.full_name?.charAt(0) || 'S'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-slate-900 truncate">{user?.full_name}</p>
              <p className="text-xs text-slate-500 font-medium capitalize truncate">
                {user?.barangay ? `Brgy. ${user.barangay}` : 'City Health Office'}
              </p>
            </div>
          </div>

          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-700 text-sm font-medium transition-all shadow-sm"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">Staff Health Operations</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Operational
            </span>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
