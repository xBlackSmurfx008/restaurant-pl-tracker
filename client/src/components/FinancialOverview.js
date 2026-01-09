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

function FinancialOverview() {
  const [loading, setLoading] = useState(true);
  const [pnlData, setPnlData] = useState(null);
  const [cashFlow, setCashFlow] = useState(null);
  const [vendorData, setVendorData] = useState(null);
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  });
  const [preset, setPreset] = useState('mtd');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pnl, flow, vendors] = await Promise.all([
        api.getPnLStatement(dateRange.start, dateRange.end),
        api.getCashFlowReport(dateRange.start, dateRange.end),
        api.getVendorAnalysis(dateRange.start, dateRange.end)
      ]);
      setPnlData(pnl);
      setCashFlow(flow);
      setVendorData(vendors);
    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const formatPercent = (value) => {
    return `${parseFloat(value || 0).toFixed(1)}%`;
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

  // Calculate some derived values
  const netIncome = pnlData?.net_income || 0;
  const revenue = pnlData?.revenue?.net_revenue || 0;
  const grossProfit = pnlData?.gross_profit || 0;
  const totalExpenses = pnlData?.total_expenses || 0;

  // Cash flow summary
  const totalCashIn = cashFlow?.totals?.total_in || 0;
  const totalCashOut = cashFlow?.totals?.total_out || 0;
  const netCashFlow = cashFlow?.totals?.net_change || 0;

  // Top vendors
  const topVendors = vendorData?.vendors?.slice(0, 5) || [];

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
            margin: 0
          }}>
            Financial Overview
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

      {/* P&L Summary Hero */}
      <div style={{
        background: netIncome >= 0 
          ? `linear-gradient(135deg, ${brandColors.primaryDark} 0%, ${brandColors.primary} 50%, ${brandColors.primaryLight} 100%)`
          : `linear-gradient(135deg, ${brandColors.dangerDark} 0%, ${brandColors.danger} 100%)`,
        borderRadius: '24px',
        padding: '40px',
        marginBottom: '32px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: netIncome >= 0 
          ? '0 20px 60px rgba(154,198,54,0.3)'
          : '0 20px 60px rgba(229,57,53,0.3)'
      }}>
        {/* Background Pattern */}
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          transform: 'translate(100px, -100px)'
        }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '40px'
          }}>
            {/* Net Income */}
            <div>
              <div style={{
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.8)',
                fontFamily: 'Oswald, sans-serif',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                marginBottom: '8px'
              }}>
                Net Income
              </div>
              <div style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: '3.5rem',
                fontWeight: '700',
                color: '#fff',
                lineHeight: 1
              }}>
                {formatCurrency(netIncome)}
              </div>
              <div style={{
                marginTop: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255,255,255,0.15)',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.9rem',
                color: '#fff'
              }}>
                {formatPercent(pnlData?.net_income_margin)} margin
              </div>
            </div>

            {/* Revenue */}
            <div>
              <div style={{
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.8)',
                fontFamily: 'Oswald, sans-serif',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                marginBottom: '8px'
              }}>
                Net Revenue
              </div>
              <div style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: '2.5rem',
                fontWeight: '600',
                color: '#fff',
                lineHeight: 1
              }}>
                {formatCurrency(revenue)}
              </div>
            </div>

            {/* Gross Profit */}
            <div>
              <div style={{
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.8)',
                fontFamily: 'Oswald, sans-serif',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                marginBottom: '8px'
              }}>
                Gross Profit
              </div>
              <div style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: '2.5rem',
                fontWeight: '600',
                color: '#fff',
                lineHeight: 1
              }}>
                {formatCurrency(grossProfit)}
              </div>
              <div style={{
                fontSize: '0.8rem',
                color: 'rgba(255,255,255,0.6)',
                marginTop: '4px'
              }}>
                {formatPercent(pnlData?.gross_profit_margin)} margin
              </div>
            </div>

            {/* Total Expenses */}
            <div>
              <div style={{
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.8)',
                fontFamily: 'Oswald, sans-serif',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                marginBottom: '8px'
              }}>
                Total Expenses
              </div>
              <div style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: '2.5rem',
                fontWeight: '600',
                color: '#fff',
                lineHeight: 1
              }}>
                {formatCurrency(totalExpenses)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Ratios */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        {[
          { 
            label: 'Food Cost %', 
            value: pnlData?.ratios?.food_cost_percent,
            target: 30,
            max: 35,
            color: parseFloat(pnlData?.ratios?.food_cost_percent || 0) > 35 ? brandColors.danger : brandColors.success,
            icon: ''
          },
          { 
            label: 'Labor Cost %', 
            value: pnlData?.ratios?.labor_cost_percent,
            target: 30,
            max: 35,
            color: parseFloat(pnlData?.ratios?.labor_cost_percent || 0) > 35 ? brandColors.danger : brandColors.info,
            icon: ''
          },
          { 
            label: 'Prime Cost %', 
            value: pnlData?.ratios?.prime_cost_percent,
            target: 60,
            max: 65,
            color: parseFloat(pnlData?.ratios?.prime_cost_percent || 0) > 65 ? brandColors.danger : brandColors.primary,
            icon: '⚡'
          },
          { 
            label: 'Operating %', 
            value: pnlData?.ratios?.operating_expense_percent,
            target: 20,
            max: 25,
            color: brandColors.info,
            icon: ''
          }
        ].map(ratio => (
          <div
            key={ratio.label}
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid #e5e7eb',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              fontSize: '2rem',
              opacity: 0.15
            }}>
              {ratio.icon}
            </div>
            <div style={{
              fontSize: '0.8rem',
              color: '#666',
              fontFamily: 'Oswald, sans-serif',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '8px'
            }}>
              {ratio.label}
            </div>
            <div style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: '2.5rem',
              fontWeight: '700',
              color: ratio.color,
              lineHeight: 1
            }}>
              {formatPercent(ratio.value)}
            </div>
            <div style={{
              marginTop: '16px',
              background: '#f3f4f6',
              borderRadius: '6px',
              height: '6px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min((parseFloat(ratio.value || 0) / ratio.max) * 100, 100)}%`,
                background: ratio.color,
                borderRadius: '6px',
                transition: 'width 0.5s ease'
              }} />
            </div>
            <div style={{
              fontSize: '0.7rem',
              color: '#999',
              marginTop: '6px'
            }}>
              Target: {ratio.target}% | Max: {ratio.max}%
            </div>
          </div>
        ))}
      </div>

      {/* Cash Flow & Vendor Analysis */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.5fr 1fr',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Cash Flow Chart */}
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
            Weekly Cash Flow
          </h3>

          {/* Summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{
              background: 'rgba(67,160,71,0.08)',
              padding: '16px',
              borderRadius: '12px',
              border: `1px solid rgba(67,160,71,0.3)`
            }}>
              <div style={{ fontSize: '0.75rem', color: brandColors.success, marginBottom: '4px', fontFamily: 'Oswald', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Cash In
              </div>
              <div style={{ fontFamily: 'Oswald', fontSize: '1.4rem', fontWeight: '700', color: brandColors.success }}>
                {formatCurrency(totalCashIn)}
              </div>
            </div>
            <div style={{
              background: 'rgba(229,57,53,0.08)',
              padding: '16px',
              borderRadius: '12px',
              border: `1px solid rgba(229,57,53,0.3)`
            }}>
              <div style={{ fontSize: '0.75rem', color: brandColors.dangerDark, marginBottom: '4px', fontFamily: 'Oswald', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Cash Out
              </div>
              <div style={{ fontFamily: 'Oswald', fontSize: '1.4rem', fontWeight: '700', color: brandColors.danger }}>
                {formatCurrency(totalCashOut)}
              </div>
            </div>
            <div style={{
              background: netCashFlow >= 0 ? 'rgba(25,118,210,0.08)' : 'rgba(255,179,0,0.08)',
              padding: '16px',
              borderRadius: '12px',
              border: `1px solid ${netCashFlow >= 0 ? 'rgba(25,118,210,0.3)' : 'rgba(255,179,0,0.3)'}`
            }}>
              <div style={{ fontSize: '0.75rem', color: netCashFlow >= 0 ? brandColors.info : brandColors.warning, marginBottom: '4px', fontFamily: 'Oswald', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Net Flow
              </div>
              <div style={{ fontFamily: 'Oswald', fontSize: '1.4rem', fontWeight: '700', color: netCashFlow >= 0 ? brandColors.info : brandColors.warning }}>
                {formatCurrency(netCashFlow)}
              </div>
            </div>
          </div>

          {/* Weekly Bars */}
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-end',
            height: '160px'
          }}>
            {(cashFlow?.weekly || []).map((week, idx) => {
              const maxVal = Math.max(...(cashFlow?.weekly || []).map(w => Math.max(w.cash_in || 0, w.total_out || 0)), 1);
              const inHeight = (week.cash_in / maxVal) * 100;
              const outHeight = (week.total_out / maxVal) * 100;
              
              return (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '140px' }}>
                    <div
                      style={{
                        flex: 1,
                        height: `${inHeight}%`,
                        background: `linear-gradient(180deg, ${brandColors.success} 0%, #357a38 100%)`,
                        borderRadius: '4px 4px 0 0',
                        minHeight: '4px'
                      }}
                      title={`In: ${formatCurrency(week.cash_in)}`}
                    />
                    <div
                      style={{
                        flex: 1,
                        height: `${outHeight}%`,
                        background: `linear-gradient(180deg, ${brandColors.danger} 0%, ${brandColors.dangerDark} 100%)`,
                        borderRadius: '4px 4px 0 0',
                        minHeight: '4px'
                      }}
                      title={`Out: ${formatCurrency(week.total_out)}`}
                    />
                  </div>
                  <div style={{
                    fontSize: '0.6rem',
                    color: '#999',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                  }}>
                    {new Date(week.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '20px',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #f3f4f6'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', background: brandColors.success, borderRadius: '2px' }} />
              <span style={{ fontSize: '0.75rem', color: '#666' }}>Cash In</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', background: brandColors.danger, borderRadius: '2px' }} />
              <span style={{ fontSize: '0.75rem', color: '#666' }}>Cash Out</span>
            </div>
          </div>
        </div>

        {/* Top Vendors */}
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
            Top Vendors
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {topVendors.length > 0 ? topVendors.map((vendor, idx) => (
              <div
                key={vendor.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: `hsl(${idx * 60}, 70%, 50%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontFamily: 'Oswald',
                  fontWeight: '600',
                  fontSize: '0.9rem'
                }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#1a1a1a', fontSize: '0.9rem' }}>
                    {vendor.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>
                    {vendor.transaction_count} transactions
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Oswald', fontWeight: '700', color: '#1a1a1a' }}>
                    {formatCurrency(vendor.total_spent)}
                  </div>
                  <div style={{
                    fontSize: '0.7rem',
                    color: '#9AC636',
                    fontWeight: '600'
                  }}>
                    {vendor.percent_of_total}%
                  </div>
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                No vendor data available
              </div>
            )}
          </div>

          {vendorData?.total_spend && (
            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '2px solid #9AC636',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontFamily: 'Oswald', letterSpacing: '0.5px', color: '#666', textTransform: 'uppercase' }}>
                Total Vendor Spend
              </span>
              <span style={{ fontFamily: 'Oswald', fontSize: '1.3rem', fontWeight: '700', color: '#1a1a1a' }}>
                {formatCurrency(vendorData.total_spend)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '28px',
        border: '1px solid #e5e7eb',
        marginBottom: '32px'
      }}>
        <h3 style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: '1.1rem',
          fontWeight: '600',
          color: '#1a1a1a',
          letterSpacing: '0.5px',
          marginBottom: '24px',
          textTransform: 'uppercase'
        }}>
          Revenue Breakdown
        </h3>

        <div style={{
          display: 'flex',
          gap: '32px',
          flexWrap: 'wrap'
        }}>
          {/* Donut Chart Placeholder */}
          <div style={{
            width: '200px',
            height: '200px',
            position: 'relative'
          }}>
            {(() => {
              const categories = [
                { name: 'Food', value: pnlData?.revenue?.food_sales || 0, color: brandColors.success },
                { name: 'Beverage', value: pnlData?.revenue?.beverage_sales || 0, color: brandColors.info },
                { name: 'Alcohol', value: pnlData?.revenue?.alcohol_sales || 0, color: brandColors.primary },
                { name: 'Catering', value: pnlData?.revenue?.catering_sales || 0, color: brandColors.warning },
                { name: 'Other', value: pnlData?.revenue?.other_sales || 0, color: brandColors.gray }
              ].filter(c => c.value > 0);
              
              const total = categories.reduce((sum, c) => sum + c.value, 0);
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

              // Create conic gradient
              const gradientStops = categories.map(cat => {
                const startPercent = cumulativePercent;
                const percent = (cat.value / total) * 100;
                cumulativePercent += percent;
                return `${cat.color} ${startPercent}% ${cumulativePercent}%`;
              }).join(', ');

              return (
                <>
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
                      <div style={{ fontFamily: 'Oswald', fontSize: '0.7rem', color: '#666', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        Total
                      </div>
                      <div style={{ fontFamily: 'Oswald', fontSize: '1.2rem', fontWeight: '700', color: '#1a1a1a' }}>
                        {formatCurrency(total)}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Legend & Values */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { name: 'Food Sales', value: pnlData?.revenue?.food_sales || 0, color: brandColors.success, icon: '🍽️' },
              { name: 'Beverage Sales', value: pnlData?.revenue?.beverage_sales || 0, color: brandColors.info, icon: '☕' },
              { name: 'Alcohol Sales', value: pnlData?.revenue?.alcohol_sales || 0, color: brandColors.primary, icon: '🍷' },
              { name: 'Catering', value: pnlData?.revenue?.catering_sales || 0, color: brandColors.warning, icon: '' },
              { name: 'Other', value: pnlData?.revenue?.other_sales || 0, color: brandColors.gray, icon: '' }
            ].filter(cat => cat.value > 0).map(cat => {
              const total = (pnlData?.revenue?.food_sales || 0) + 
                           (pnlData?.revenue?.beverage_sales || 0) + 
                           (pnlData?.revenue?.alcohol_sales || 0) + 
                           (pnlData?.revenue?.catering_sales || 0) + 
                           (pnlData?.revenue?.other_sales || 0);
              const percent = total > 0 ? (cat.value / total * 100).toFixed(1) : 0;
              
              return (
                <div
                  key={cat.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    background: '#f8fafc',
                    borderRadius: '8px'
                  }}
                >
                  <div style={{
                    width: '8px',
                    height: '32px',
                    background: cat.color,
                    borderRadius: '4px'
                  }} />
                  <span style={{ fontSize: '1.2rem' }}>{cat.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{cat.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Oswald', fontWeight: '700' }}>{formatCurrency(cat.value)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>{percent}%</div>
                  </div>
                </div>
              );
            })}
            
            {/* Discounts Row */}
            {(pnlData?.revenue?.discounts || 0) > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 12px',
                background: 'rgba(229,57,53,0.08)',
                borderRadius: '8px',
                border: `1px solid rgba(229,57,53,0.3)`
              }}>
                <div style={{
                  width: '8px',
                  height: '32px',
                  background: brandColors.danger,
                  borderRadius: '4px'
                }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500', fontSize: '0.9rem', color: brandColors.dangerDark }}>Discounts</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Oswald', fontWeight: '700', color: brandColors.danger }}>
                    -{formatCurrency(pnlData?.revenue?.discounts)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expense Categories */}
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
          marginBottom: '24px',
          textTransform: 'uppercase'
        }}>
          Expense Categories
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {/* COGS */}
          <div style={{
            padding: '20px',
            background: `linear-gradient(135deg, rgba(255,179,0,0.15) 0%, rgba(255,179,0,0.25) 100%)`,
            borderRadius: '12px',
            border: `1px solid ${brandColors.warning}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}></span>
              <span style={{ fontFamily: 'Oswald', fontSize: '0.85rem', color: brandColors.charcoal, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Cost of Goods Sold
              </span>
            </div>
            <div style={{ fontFamily: 'Oswald', fontSize: '2rem', fontWeight: '700', color: brandColors.charcoal }}>
              {formatCurrency(pnlData?.cost_of_goods_sold?.total_cogs)}
            </div>
          </div>

          {/* Operating */}
          <div style={{
            padding: '20px',
            background: `linear-gradient(135deg, rgba(25,118,210,0.1) 0%, rgba(25,118,210,0.2) 100%)`,
            borderRadius: '12px',
            border: `1px solid ${brandColors.info}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}></span>
              <span style={{ fontFamily: 'Oswald', fontSize: '0.85rem', color: brandColors.charcoal, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Operating Expenses
              </span>
            </div>
            <div style={{ fontFamily: 'Oswald', fontSize: '2rem', fontWeight: '700', color: brandColors.info }}>
              {formatCurrency(pnlData?.operating_expenses?.total)}
            </div>
          </div>

          {/* Payroll */}
          <div style={{
            padding: '20px',
            background: `linear-gradient(135deg, rgba(154,198,54,0.1) 0%, rgba(154,198,54,0.2) 100%)`,
            borderRadius: '12px',
            border: `1px solid ${brandColors.primary}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}></span>
              <span style={{ fontFamily: 'Oswald', fontSize: '0.85rem', color: brandColors.charcoal, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Payroll & Labor
              </span>
            </div>
            <div style={{ fontFamily: 'Oswald', fontSize: '2rem', fontWeight: '700', color: brandColors.primaryDark }}>
              {formatCurrency(pnlData?.payroll?.total)}
            </div>
            <div style={{ fontSize: '0.8rem', color: brandColors.primary, marginTop: '4px' }}>
              Wages: {formatCurrency(pnlData?.payroll?.gross_wages)} | Taxes: {formatCurrency(pnlData?.payroll?.payroll_taxes)}
            </div>
          </div>

          {/* Marketing */}
          <div style={{
            padding: '20px',
            background: `linear-gradient(135deg, rgba(67,160,71,0.1) 0%, rgba(67,160,71,0.2) 100%)`,
            borderRadius: '12px',
            border: `1px solid ${brandColors.success}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}></span>
              <span style={{ fontFamily: 'Oswald', fontSize: '0.85rem', color: brandColors.charcoal, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Marketing
              </span>
            </div>
            <div style={{ fontFamily: 'Oswald', fontSize: '2rem', fontWeight: '700', color: brandColors.success }}>
              {formatCurrency(pnlData?.marketing_expenses?.total)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FinancialOverview;

