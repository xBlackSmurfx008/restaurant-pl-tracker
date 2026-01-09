import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

const brand = {
  green: '#9AC636',
  greenDark: '#7BA328',
  charcoal: '#1A1A1A',
  dark: '#2D2D2D',
  white: '#FFFFFF',
};

const tutorialSteps = [
  {
    title: 'Welcome to Flavor 91 Bistro!',
    content: 'This quick tour will show you how to use your restaurant management system. Let\'s walk through the key features together!',
    selector: null,
    position: 'center',
  },
  {
    title: 'Switch Between Modes',
    content: 'Use these buttons to switch between Operations (day-to-day restaurant tasks) and Accounting & Tax (financial tracking, payroll, taxes).',
    selector: '.section-selector',
    position: 'bottom',
  },
  {
    title: 'Navigation Tabs',
    content: 'Each mode has different tabs. In Operations you have: Dashboard, Sales, Recipes, Ingredients, and Vendors. Click a tab to view that section.',
    selector: '.tab-navigation',
    position: 'bottom',
  },
  {
    title: 'Your Dashboard',
    content: 'The Dashboard shows your revenue, profit, food costs, and labor costs at a glance. It also includes the Menu Engineering Matrix that categorizes items into Champions, Hidden Gems, Volume Drivers, and Needs Review.',
    selector: '.app-main',
    position: 'top',
  },
  {
    title: 'Quick Sales Entry',
    content: 'Recording daily sales is fast! Go to the Sales tab, enter quantities sold for each menu item, and hit Save. The system calculates your profit automatically.',
    selector: null,
    position: 'center',
  },
  {
    title: 'You\'re Ready!',
    content: 'That\'s it! Explore the system at your own pace. Remember: "Don\'t make me do math" — the system handles all calculations for you!',
    selector: null,
    position: 'center',
  },
];

function Tutorial({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightStyle, setHighlightStyle] = useState(null);
  const [tooltipStyle, setTooltipStyle] = useState({});

  const updateHighlight = useCallback(() => {
    const step = tutorialSteps[currentStep];
    
    if (!step.selector) {
      setHighlightStyle(null);
      setTooltipStyle({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      });
      return;
    }

    const element = document.querySelector(step.selector);
    if (!element) {
      setHighlightStyle(null);
      setTooltipStyle({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      });
      return;
    }

    const rect = element.getBoundingClientRect();
    const padding = 8;

    setHighlightStyle({
      position: 'fixed',
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + (padding * 2),
      height: rect.height + (padding * 2),
      borderRadius: '8px',
      border: `3px solid ${brand.green}`,
      boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.75), 0 0 30px 5px ${brand.green}`,
      zIndex: 9998,
      pointerEvents: 'none',
      transition: 'all 0.4s ease',
    });

    // Position tooltip
    const tooltipHeight = 220;
    const tooltipWidth = 420;
    let top, left;

    if (step.position === 'bottom') {
      top = rect.bottom + padding + 16;
      left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    } else if (step.position === 'top') {
      top = rect.top - padding - tooltipHeight - 16;
      left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    } else {
      top = rect.bottom + 16;
      left = rect.left;
    }

    // Keep tooltip in viewport
    left = Math.max(20, Math.min(left, window.innerWidth - tooltipWidth - 20));
    top = Math.max(20, Math.min(top, window.innerHeight - tooltipHeight - 20));

    setTooltipStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
    });
  }, [currentStep]);

  useEffect(() => {
    updateHighlight();
    window.addEventListener('resize', updateHighlight);
    window.addEventListener('scroll', updateHighlight);
    return () => {
      window.removeEventListener('resize', updateHighlight);
      window.removeEventListener('scroll', updateHighlight);
    };
  }, [updateHighlight]);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      localStorage.setItem('tutorialComplete', 'true');
      onComplete();
    }
  };

  const handleSkip = () => {
    localStorage.setItem('tutorialComplete', 'true');
    onComplete();
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = tutorialSteps[currentStep];
  const isLastStep = currentStep === tutorialSteps.length - 1;
  const isFirstStep = currentStep === 0;

  const content = (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'transparent',
          zIndex: 9997,
        }}
        onClick={handleSkip}
      />

      {/* Highlight Box */}
      {highlightStyle && <div style={highlightStyle} />}

      {/* Tooltip */}
      <div
        style={{
          ...tooltipStyle,
          background: brand.white,
          borderRadius: '12px',
          padding: '0',
          width: '420px',
          maxWidth: 'calc(100vw - 40px)',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)',
          zIndex: 10000,
          overflow: 'hidden',
        }}
      >
        {/* Green accent bar */}
        <div
          style={{
            height: '6px',
            background: `linear-gradient(90deg, ${brand.green}, ${brand.greenDark})`,
          }}
        />

        <div style={{ padding: '24px' }}>
          {/* Step dots */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '20px',
            }}
          >
            {tutorialSteps.map((_, idx) => (
              <div
                key={idx}
                style={{
                  width: idx === currentStep ? '24px' : '10px',
                  height: '10px',
                  borderRadius: '5px',
                  background: idx <= currentStep ? brand.green : '#E0E0E0',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>

          {/* Title */}
          <h3
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: '1.5rem',
              fontWeight: 600,
              color: brand.charcoal,
              letterSpacing: '1px',
              marginBottom: '12px',
              textAlign: 'center',
            }}
          >
            {step.title}
          </h3>

          {/* Content */}
          <p
            style={{
              fontFamily: "'Lato', sans-serif",
              fontSize: '1rem',
              color: '#555',
              lineHeight: 1.7,
              textAlign: 'center',
              marginBottom: '24px',
            }}
          >
            {step.content}
          </p>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontSize: '0.85rem',
                color: '#999',
                letterSpacing: '1px',
              }}
            >
              {currentStep + 1} / {tutorialSteps.length}
            </span>

            <div style={{ display: 'flex', gap: '12px' }}>
              {!isFirstStep && (
                <button
                  onClick={handlePrev}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    border: `2px solid ${brand.charcoal}`,
                    color: brand.charcoal,
                    fontFamily: "'Oswald', sans-serif",
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    letterSpacing: '1px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  BACK
                </button>
              )}
              
              {!isLastStep && (
                <button
                  onClick={handleSkip}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    border: 'none',
                    color: '#999',
                    fontFamily: "'Oswald', sans-serif",
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                >
                  SKIP
                </button>
              )}

              <button
                onClick={handleNext}
                style={{
                  padding: '10px 28px',
                  background: brand.green,
                  border: 'none',
                  color: brand.charcoal,
                  fontFamily: "'Oswald', sans-serif",
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  letterSpacing: '1px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => e.target.style.background = brand.greenDark}
                onMouseLeave={(e) => e.target.style.background = brand.green}
              >
                {isLastStep ? 'GET STARTED' : isFirstStep ? "LET'S GO" : 'NEXT'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return ReactDOM.createPortal(content, document.body);
}

export default Tutorial;
