import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

// Brand colors from theme
const brandColors = {
  primary: '#9AC636',
  primaryDark: '#7BA328',
  primaryLight: '#B8D95A',
  charcoal: '#1A1A1A',
  dark: '#2D2D2D',
  gray: '#3D3D3D',
  lightGray: '#F5F5F5',
  success: '#43A047',
  warning: '#FFB300',
  danger: '#E53935',
  dangerDark: '#C62828',
  info: '#1976D2'
};

// Color palette for expense types - using brand colors
const typeColors = {
  cogs: { bg: 'rgba(255,179,0,0.1)', border: brandColors.warning, text: brandColors.charcoal, accent: brandColors.warning },
  operating: { bg: 'rgba(25,118,210,0.1)', border: brandColors.info, text: brandColors.charcoal, accent: brandColors.info },
  marketing: { bg: 'rgba(154,198,54,0.1)', border: brandColors.primary, text: brandColors.charcoal, accent: brandColors.primary },
  payroll: { bg: 'rgba(67,160,71,0.1)', border: brandColors.success, text: brandColors.charcoal, accent: brandColors.success },
  other: { bg: 'rgba(61,61,61,0.08)', border: brandColors.gray, text: brandColors.charcoal, accent: brandColors.gray }
};

const typeIcons = {
  cogs: '',
  operating: '',
  marketing: '',
  payroll: '',
  other: ''
};

const typeLabels = {
  cogs: 'Cost of Goods',
  operating: 'Operating',
  marketing: 'Marketing',
  payroll: 'Payroll',
  other: 'Other'
};

function ExpenseDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  });
  const [preset, setPreset] = useState('mtd');
  const [activeView, setActiveView] = useState('overview'); // overview, categories, vendors, trends

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getExpenseDashboard(dateRange.start, dateRange.end);
      setDashboardData(data);
    } catch (error) {
      console.error('Error loading expense dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const setDatePreset = (presetName) => {
    const now = new Date();
    let start, end;
    
    switch (presetName) {
      case 'mtd':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
        break;
      case 'last-month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'qtd':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = now;
        break;
      case 'ytd':
        start = new Date(now.getFullYear(), 0, 1);
        end = now;
        break;
      default:
        return;
    }
    
    setPreset(presetName);
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '400px',
        background: 'linear-gradient(135deg, rgba(26,26,26,0.02) 0%, rgba(154,198,54,0.05) 100%)',
        borderRadius: '16px'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid rgba(154,198,54,0.2)',
          borderTop: '4px solid #9AC636',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const { grand_total, by_type, by_category, by_vendor, daily_trend, needs_attention } = dashboardData || {};

  return (
    <div style={{ padding: '0' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: '1.8rem',
            fontWeight: '600',
            color: '#1a1a1a',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            Expense Dashboard
          </h2>
          <p style={{
            color: '#666',
            margin: '4px 0 0 0',
            fontSize: '0.9rem'
          }}>
            {new Date(dateRange.start).toLocaleDateString()} - {new Date(dateRange.end).toLocaleDateString()}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { value: 'mtd', label: 'MTD' },
            { value: 'last-month', label: 'Last Month' },
            { value: 'qtd', label: 'QTD' },
            { value: 'ytd', label: 'YTD' }
          ].map(p => (
            <button
              key={p.value}
              onClick={() => setDatePreset(p.value)}
              style={{
                padding: '10px 20px',
                border: preset === p.value ? '2px solid #9AC636' : '2px solid #e0e0e0',
                borderRadius: '8px',
                background: preset === p.value ? 'rgba(154,198,54,0.1)' : '#fff',
                color: preset === p.value ? '#9AC636' : '#666',
                fontFamily: 'Oswald, sans-serif',
                fontSize: '0.85rem',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: preset === p.value ? '600' : '400'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* View Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '24px',
        background: '#f3f4f6',
        padding: '4px',
        borderRadius: '12px',
        width: 'fit-content'
      }}>
        {[
          { id: 'overview', label: 'Overview', icon: '' },
          { id: 'categories', label: 'By Category', icon: '' },
          { id: 'vendors', label: 'By Vendor', icon: '' },
          { id: 'trends', label: 'Trends', icon: '' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              background: activeView === tab.id ? '#fff' : 'transparent',
              color: activeView === tab.id ? '#1a1a1a' : '#666',
              fontFamily: 'Oswald, sans-serif',
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontWeight: activeView === tab.id ? '600' : '400',
              boxShadow: activeView === tab.id ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grand Total Hero Card */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #3d3d3d 100%)',
        borderRadius: '24px',
        padding: '32px 40px',
        marginBottom: '24px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Background accent */}
        <div style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(154,198,54,0.3) 0%, transparent 70%)',
        }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: '0.9rem',
            color: 'rgba(255,255,255,0.7)',
            fontFamily: 'Oswald, sans-serif',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}>
            Total Expenses
          </div>
          <div style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: '4rem',
            fontWeight: '700',
            color: '#9AC636',
            lineHeight: 1
          }}>
            {formatCurrency(grand_total)}
          </div>
          <div style={{
            marginTop: '16px',
            fontSize: '0.9rem',
            color: 'rgba(255,255,255,0.6)'
          }}>
            {by_type?.reduce((sum, t) => sum + t.expense_count, 0) || 0} expenses across {by_category?.length || 0} categories
          </div>
        </div>
      </div>

      {/* Overview View */}
      {activeView === 'overview' && (
        <>
          {/* Expense Type Breakdown */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            {(by_type || []).map(type => {
              const colors = typeColors[type.expense_type] || typeColors.other;
              return (
                <div
                  key={type.expense_type}
                  style={{
                    background: colors.bg,
                    borderRadius: '16px',
                    padding: '20px',
                    border: `2px solid ${colors.border}`,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    fontSize: '2.5rem',
                    opacity: 0.15
                  }}>
                    {typeIcons[type.expense_type] || ''}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: colors.text,
                    fontFamily: 'Oswald, sans-serif',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    marginBottom: '8px'
                  }}>
                    {typeLabels[type.expense_type] || type.expense_type}
                  </div>
                  <div style={{
                    fontFamily: 'Oswald, sans-serif',
                    fontSize: '1.8rem',
                    fontWeight: '700',
                    color: colors.accent,
                    lineHeight: 1
                  }}>
                    {formatCurrency(type.total_amount)}
                  </div>
                  <div style={{
                    marginTop: '8px',
                    fontSize: '0.8rem',
                    color: colors.text,
                    opacity: 0.8
                  }}>
                    {type.percent_of_total}% of total • {type.expense_count} expenses
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pie Chart Visualization */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.5fr',
            gap: '24px',
            marginBottom: '24px'
          }}>
            {/* Donut Chart */}
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '28px',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#1a1a1a',
                letterSpacing: '0.5px',
                marginBottom: '20px',
                textTransform: 'uppercase'
              }}>
                Expense Distribution
              </h3>
              
              <div style={{
                width: '200px',
                height: '200px',
                margin: '0 auto',
                position: 'relative'
              }}>
                {(() => {
                  const types = by_type || [];
                  const total = types.reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0);
                  let cumulativePercent = 0;
                  
                  if (total === 0) {
                    return (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        background: '#f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#999'
                      }}>
                        No data
                      </div>
                    );
                  }
                  
                  const gradientStops = types.map(t => {
                    const startPercent = cumulativePercent;
                    const percent = (parseFloat(t.total_amount || 0) / total) * 100;
                    cumulativePercent += percent;
                    const color = typeColors[t.expense_type]?.accent || '#6b7280';
                    return `${color} ${startPercent}% ${cumulativePercent}%`;
                  }).join(', ');
                  
                  return (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: `conic-gradient(${gradientStops})`,
                      position: 'relative'
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '60%',
                        height: '60%',
                        borderRadius: '50%',
                        background: '#fff',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <div style={{ 
                          fontFamily: 'Oswald', 
                          fontSize: '0.7rem', 
                          color: '#666', 
                          letterSpacing: '0.5px', 
                          textTransform: 'uppercase' 
                        }}>
                          Total
                        </div>
                        <div style={{ 
                          fontFamily: 'Oswald', 
                          fontSize: '1.1rem', 
                          fontWeight: '700', 
                          color: '#1a1a1a' 
                        }}>
                          {formatCurrency(total)}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              {/* Legend */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                marginTop: '20px',
                justifyContent: 'center'
              }}>
                {(by_type || []).map(t => (
                  <div key={t.expense_type} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      background: typeColors[t.expense_type]?.accent || '#6b7280'
                    }} />
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>
                      {typeLabels[t.expense_type] || t.expense_type}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Categories */}
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '28px',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#1a1a1a',
                letterSpacing: '0.5px',
                marginBottom: '20px',
                textTransform: 'uppercase'
              }}>
                Top Categories
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(by_category || []).slice(0, 8).map((cat, idx) => {
                  const colors = typeColors[cat.expense_type] || typeColors.other;
                  const percent = parseFloat(cat.percent_of_total || 0);
                  
                  return (
                    <div key={cat.category_id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: colors.accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontFamily: 'Oswald',
                        fontWeight: '600',
                        fontSize: '0.8rem'
                      }}>
                        {idx + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '4px'
                        }}>
                          <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>
                            {cat.category_name}
                          </span>
                          <span style={{ fontFamily: 'Oswald', fontWeight: '700' }}>
                            {formatCurrency(cat.total_amount)}
                          </span>
                        </div>
                        <div style={{
                          height: '6px',
                          background: '#f3f4f6',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(percent * 2, 100)}%`,
                            background: colors.accent,
                            borderRadius: '3px',
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.75rem',
                        color: '#999',
                        minWidth: '40px',
                        textAlign: 'right'
                      }}>
                        {percent}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Needs Attention Section */}
          {needs_attention && needs_attention.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              borderRadius: '16px',
              padding: '24px',
              border: '2px solid #fbbf24'
            }}>
              <h3 style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#92400e',
                letterSpacing: '0.5px',
                marginBottom: '16px',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: 'bold', color: '#FF9800' }}>!</span>
                Needs Attention
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#78350f', marginBottom: '16px' }}>
                These expenses may need better categorization:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {needs_attention.slice(0, 5).map(exp => (
                  <div key={exp.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.8)',
                    padding: '12px 16px',
                    borderRadius: '8px'
                  }}>
                    <div>
                      <div style={{ fontWeight: '500' }}>{exp.description}</div>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>
                        {exp.vendor_name || 'No vendor'} • {new Date(exp.expense_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ fontFamily: 'Oswald', fontWeight: '700', color: '#92400e' }}>
                      {formatCurrency(exp.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Categories View */}
      {activeView === 'categories' && (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '28px',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: '1.1rem',
            fontWeight: '600',
            color: '#1a1a1a',
            letterSpacing: '0.5px',
            marginBottom: '20px',
            textTransform: 'uppercase'
          }}>
            All Categories
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px'
          }}>
            {(by_category || []).map(cat => {
              const colors = typeColors[cat.expense_type] || typeColors.other;
              const budgetPercent = cat.budget_status ? parseFloat(cat.budget_status) : null;
              
              return (
                <div key={cat.category_id} style={{
                  background: colors.bg,
                  borderRadius: '12px',
                  padding: '20px',
                  border: `1px solid ${colors.border}`
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px'
                  }}>
                    <div>
                      <div style={{
                        fontSize: '0.7rem',
                        color: colors.text,
                        fontFamily: 'Oswald',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        marginBottom: '4px'
                      }}>
                        {typeLabels[cat.expense_type] || cat.expense_type}
                      </div>
                      <div style={{ fontWeight: '600', fontSize: '1rem' }}>
                        {cat.category_name}
                      </div>
                    </div>
                    <div style={{
                      background: colors.accent,
                      color: '#fff',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontFamily: 'Oswald'
                    }}>
                      {cat.expense_count} exp
                    </div>
                  </div>
                  
                  <div style={{
                    fontFamily: 'Oswald',
                    fontSize: '1.8rem',
                    fontWeight: '700',
                    color: colors.accent,
                    marginBottom: '8px'
                  }}>
                    {formatCurrency(cat.total_amount)}
                  </div>
                  
                  {budgetPercent !== null && (
                    <div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.75rem',
                        color: colors.text,
                        marginBottom: '4px'
                      }}>
                        <span>Budget Used</span>
                        <span style={{ 
                          fontWeight: '600',
                          color: budgetPercent > 100 ? brandColors.danger : budgetPercent > 80 ? brandColors.warning : colors.accent
                        }}>
                          {budgetPercent}%
                        </span>
                      </div>
                      <div style={{
                        height: '6px',
                        background: 'rgba(255,255,255,0.5)',
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(budgetPercent, 100)}%`,
                          background: budgetPercent > 100 ? brandColors.danger : budgetPercent > 80 ? brandColors.warning : colors.accent,
                          borderRadius: '3px'
                        }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vendors View */}
      {activeView === 'vendors' && (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '28px',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: '1.1rem',
            fontWeight: '600',
            color: '#1a1a1a',
            letterSpacing: '0.5px',
            marginBottom: '20px',
            textTransform: 'uppercase'
          }}>
            Top Vendors by Spend
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(by_vendor || []).map((vendor, idx) => (
              <div key={vendor.vendor_id || idx} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px 20px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: `hsl(${idx * 40}, 70%, 50%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontFamily: 'Oswald',
                  fontWeight: '700',
                  fontSize: '1.2rem'
                }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '1.1rem', marginBottom: '4px' }}>
                    {vendor.vendor_name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>
                    {vendor.expense_count} transactions
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Oswald', fontSize: '1.5rem', fontWeight: '700', color: '#1a1a1a' }}>
                    {formatCurrency(vendor.total_amount)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#9AC636', fontWeight: '600' }}>
                    {vendor.percent_of_total}% of total
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trends View */}
      {activeView === 'trends' && (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '28px',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: '1.1rem',
            fontWeight: '600',
            color: '#1a1a1a',
            letterSpacing: '0.5px',
            marginBottom: '20px',
            textTransform: 'uppercase'
          }}>
            Daily Expense Trend
          </h3>
          
          <div style={{
            height: '300px',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '4px',
            padding: '20px 0'
          }}>
            {(() => {
              const trend = daily_trend || [];
              if (trend.length === 0) {
                return (
                  <div style={{ 
                    width: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: '#999'
                  }}>
                    No trend data available
                  </div>
                );
              }
              
              const maxAmount = Math.max(...trend.map(d => parseFloat(d.total_amount || 0)));
              
              return trend.map((day, idx) => {
                const amount = parseFloat(day.total_amount || 0);
                const height = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
                
                return (
                  <div key={idx} style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '30px',
                        height: `${Math.max(height, 4)}%`,
                        background: 'linear-gradient(180deg, #9AC636 0%, #7BA328 100%)',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                      title={`${new Date(day.date).toLocaleDateString()}: ${formatCurrency(amount)}`}
                    />
                    {trend.length <= 31 && (
                      <div style={{
                        fontSize: '0.6rem',
                        color: '#999',
                        transform: 'rotate(-45deg)',
                        whiteSpace: 'nowrap',
                        marginTop: '8px'
                      }}>
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
          
          {/* Summary stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            marginTop: '20px',
            paddingTop: '20px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Avg Daily</div>
              <div style={{ fontFamily: 'Oswald', fontSize: '1.4rem', fontWeight: '700', color: '#1a1a1a' }}>
                {formatCurrency(grand_total / Math.max((daily_trend || []).length, 1))}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Highest Day</div>
              <div style={{ fontFamily: 'Oswald', fontSize: '1.4rem', fontWeight: '700', color: brandColors.danger }}>
                {formatCurrency(Math.max(...(daily_trend || []).map(d => parseFloat(d.total_amount || 0)), 0))}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Days with Expenses</div>
              <div style={{ fontFamily: 'Oswald', fontSize: '1.4rem', fontWeight: '700', color: brandColors.primary }}>
                {(daily_trend || []).length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpenseDashboard;

