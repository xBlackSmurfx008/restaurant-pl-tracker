import React, { useState } from 'react';
import './App.css';
import VendorManagement from './components/VendorManagement';
import IngredientLocker from './components/IngredientLocker';
import RecipeBuilder from './components/RecipeBuilder';
import SalesInput from './components/SalesInput';
import Dashboard from './components/Dashboard';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'vendors', label: 'Vendors' },
    { id: 'ingredients', label: 'Ingredients' },
    { id: 'recipes', label: 'Recipes' },
    { id: 'sales', label: 'Sales' },
  ];

  return (
    <div className="App">
      <header className="app-header">
        <h1>🍽️ Restaurant P&L Tracker</h1>
        <p className="tagline">Zero-Friction Profit Tracking</p>
      </header>

      <nav className="tab-navigation">
        {tabs.map(tab => (
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
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'vendors' && <VendorManagement />}
        {activeTab === 'ingredients' && <IngredientLocker />}
        {activeTab === 'recipes' && <RecipeBuilder />}
        {activeTab === 'sales' && <SalesInput />}
      </main>
    </div>
  );
}

export default App;
