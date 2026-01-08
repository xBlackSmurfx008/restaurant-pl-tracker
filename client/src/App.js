import React, { useState } from 'react';
import './App.css';
import VendorManagement from './components/VendorManagement';
import IngredientLocker from './components/IngredientLocker';
import RecipeBuilder from './components/RecipeBuilder';
import SalesInput from './components/SalesInput';
import Dashboard from './components/Dashboard';
import ExpenseTracker from './components/ExpenseTracker';
import ExpenseManager from './components/ExpenseManager';
import ProfitLossReport from './components/ProfitLossReport';
import TaxPrep from './components/TaxPrep';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSection, setActiveSection] = useState('operations'); // 'operations' or 'accounting'

  const operationsTabs = [
    { id: 'dashboard', label: '📊 Dashboard', icon: '📊' },
    { id: 'sales', label: '💵 Sales', icon: '💵' },
    { id: 'recipes', label: '🍳 Recipes', icon: '🍳' },
    { id: 'ingredients', label: '🥬 Ingredients', icon: '🥬' },
    { id: 'vendors', label: '🚚 Vendors', icon: '🚚' },
  ];

  const accountingTabs = [
    { id: 'pnl', label: '📈 P&L Report', icon: '📈' },
    { id: 'expenses-new', label: '💰 Expenses', icon: '💰' },
    { id: 'expenses-old', label: '📋 Expense Tracker', icon: '📋' },
    { id: 'tax', label: '📑 Tax Prep', icon: '📑' },
  ];

  const handleSectionChange = (section) => {
    setActiveSection(section);
    // Set default tab for each section
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
      </header>

      {/* Section Selector */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '10px', 
        padding: '15px 20px',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <button
          onClick={() => handleSectionChange('operations')}
          style={{
            padding: '12px 30px',
            background: activeSection === 'operations' 
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
              : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '25px',
            color: 'white',
            fontWeight: '600',
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: activeSection === 'operations' ? '0 4px 15px rgba(102, 126, 234, 0.4)' : 'none'
          }}
        >
          🍽️ Operations
        </button>
        <button
          onClick={() => handleSectionChange('accounting')}
          style={{
            padding: '12px 30px',
            background: activeSection === 'accounting' 
              ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' 
              : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '25px',
            color: 'white',
            fontWeight: '600',
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: activeSection === 'accounting' ? '0 4px 15px rgba(56, 239, 125, 0.4)' : 'none'
          }}
        >
          💼 Accounting & Tax
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
            {activeTab === 'pnl' && <ProfitLossReport />}
            {activeTab === 'expenses-new' && <ExpenseManager />}
            {activeTab === 'expenses-old' && <ExpenseTracker />}
            {activeTab === 'tax' && <TaxPrep />}
          </>
        )}
      </main>

      <footer style={{
        textAlign: 'center',
        padding: '20px',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        color: 'rgba(255,255,255,0.6)',
        fontSize: '0.9rem'
      }}>
        <p>Restaurant Accounting System v2.0 • Designed for Local-Sourcing Restaurants</p>
        <p style={{ marginTop: '5px', fontSize: '0.8rem' }}>
          📊 Full P&L • 💰 Expense Tracking • 📑 Tax Prep • 👥 Payroll Ready
        </p>
      </footer>
    </div>
  );
}

export default App;
