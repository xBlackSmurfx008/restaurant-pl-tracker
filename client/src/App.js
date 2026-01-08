import React, { useState, useEffect } from 'react';
import './App.css';
import VendorManagement from './components/VendorManagement';
import IngredientLocker from './components/IngredientLocker';
import RecipeBuilder from './components/RecipeBuilder';
import SalesInput from './components/SalesInput';
import Dashboard from './components/Dashboard';
import ExpenseTracker from './components/ExpenseTracker';
import ReportsPanel from './components/ReportsPanel';
import TaxCenter from './components/TaxCenter';
import PayrollManager from './components/PayrollManager';
import AccountingDashboard from './components/AccountingDashboard';
import Login from './components/Login';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSection, setActiveSection] = useState('operations');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (userData, token) => {
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const operationsTabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'sales', label: 'Sales' },
    { id: 'recipes', label: 'Recipes' },
    { id: 'ingredients', label: 'Ingredients' },
    { id: 'vendors', label: 'Vendors' },
  ];

  const accountingTabs = [
    { id: 'pnl', label: 'P&L Report' },
    { id: 'expenses-new', label: 'Expenses' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'accounting', label: 'Accounting' },
    { id: 'tax', label: 'Tax Prep' },
  ];

  const handleSectionChange = (section) => {
    setActiveSection(section);
    if (section === 'operations') {
      setActiveTab('dashboard');
    } else {
      setActiveTab('pnl');
    }
  };

  const currentTabs = activeSection === 'operations' ? operationsTabs : accountingTabs;

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-brand">
          <h1>
            FLAVOR <span className="brand-91">91</span> BISTRO
          </h1>
          <p className="tagline">Restaurant Accounting & Profit Management</p>
        </div>
        <div className="header-user">
          <span className="user-info">
            👤 {user?.first_name} {user?.last_name}
            <span className="user-role">({user?.role})</span>
          </span>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Section Selector */}
      <div className="section-selector">
        <button
          onClick={() => handleSectionChange('operations')}
          className={`section-btn ${activeSection === 'operations' ? 'active' : ''}`}
        >
          Operations
        </button>
        <button
          onClick={() => handleSectionChange('accounting')}
          className={`section-btn ${activeSection === 'accounting' ? 'active-alt' : ''}`}
        >
          Accounting & Tax
        </button>
      </div>

      <nav className="tab-navigation">
        {currentTabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {/* Operations Section */}
        {activeSection === 'operations' && (
          <>
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'vendors' && <VendorManagement />}
            {activeTab === 'ingredients' && <IngredientLocker />}
            {activeTab === 'recipes' && <RecipeBuilder />}
            {activeTab === 'sales' && <SalesInput />}
          </>
        )}

        {/* Accounting Section */}
        {activeSection === 'accounting' && (
          <>
            {activeTab === 'pnl' && <ReportsPanel />}
            {activeTab === 'expenses-new' && <ExpenseTracker />}
            {activeTab === 'payroll' && <PayrollManager />}
            {activeTab === 'accounting' && <AccountingDashboard />}
            {activeTab === 'tax' && <TaxCenter />}
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>Restaurant Accounting System v2.0</p>
        <p className="footer-features">Full P&L | Expense Tracking | Tax Prep | Payroll</p>
      </footer>
    </div>
  );
}

export default App;
