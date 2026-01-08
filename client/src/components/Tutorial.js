import React, { useState, useEffect } from 'react';

const brand = {
  green: '#9AC636',
  greenDark: '#7BA328',
  charcoal: '#1A1A1A',
  dark: '#2D2D2D',
  white: '#FFFFFF',
};

const tutorialSteps = [
  {
    title: 'Welcome to Flavor 91!',
    content: 'This quick tour will show you the key features of your restaurant management system. Let\'s get started!',
    target: null,
    position: 'center',
  },
  {
    title: 'Operations vs Accounting',
    content: 'Switch between Operations (daily restaurant tasks) and Accounting & Tax (financial tracking) using these buttons.',
    target: '.section-selector',
    position: 'bottom',
  },
  {
    title: 'Navigation Tabs',
    content: 'Each section has tabs for different features. In Operations: Dashboard, Sales, Recipes, Ingredients, and Vendors.',
    target: '.tab-navigation',
    position: 'bottom',
  },
  {
    title: 'Dashboard Overview',
    content: 'Your Dashboard shows menu performance, revenue, profit, and the Menu Engineering Matrix that categorizes items into Champions, Hidden Gems, Volume Drivers, and Needs Review.',
    target: '.app-main',
    position: 'top',
  },
  {
    title: 'Quick Tip: Sales Entry',
    content: 'End-of-day sales entry takes just 30 seconds! Go to Sales tab, enter quantities sold, and hit Save. That\'s it!',
    target: null,
    position: 'center',
  },
  {
    title: 'You\'re All Set!',
    content: 'Explore the system at your own pace. Remember: "Don\'t make me do math" — the system handles all calculations for you!',
    target: null,
    position: 'center',
  },
];

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(26, 26, 26, 0.85)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  },
  spotlight: {
    position: 'fixed',
    boxShadow: `0 0 0 9999px rgba(26, 26, 26, 0.85)`,
    borderRadius: '8px',
    zIndex: 9998,
    transition: 'all 0.3s ease',
  },
  tooltip: {
    position: 'fixed',
    background: brand.white,
    borderRadius: '8px',
    padding: '24px',
    maxWidth: '400px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
    zIndex: 10000,
    animation: 'fadeIn 0.3s ease',
  },
  tooltipCenter: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: brand.white,
    borderRadius: '8px',
    padding: '32px',
    maxWidth: '500px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
    zIndex: 10000,
    textAlign: 'center',
    animation: 'fadeIn 0.3s ease',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: brand.green,
    borderRadius: '8px 8px 0 0',
  },
  title: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: '1.4rem',
    fontWeight: 600,
    color: brand.charcoal,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginBottom: '12px',
  },
  content: {
    fontFamily: "'Lato', sans-serif",
    fontSize: '1rem',
    color: '#666',
    lineHeight: 1.6,
    marginBottom: '20px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '16px',
  },
  progress: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: '0.85rem',
    color: '#999',
    letterSpacing: '1px',
  },
  buttons: {
    display: 'flex',
    gap: '12px',
  },
  btnPrimary: {
    padding: '10px 24px',
    background: brand.green,
    border: 'none',
    color: brand.charcoal,
    fontFamily: "'Oswald', sans-serif",
    fontSize: '0.9rem',
    fontWeight: 600,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  btnSecondary: {
    padding: '10px 24px',
    background: 'transparent',
    border: `2px solid ${brand.charcoal}`,
    color: brand.charcoal,
    fontFamily: "'Oswald', sans-serif",
    fontSize: '0.9rem',
    fontWeight: 500,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  btnSkip: {
    padding: '8px 16px',
    background: 'transparent',
    border: 'none',
    color: '#999',
    fontFamily: "'Oswald', sans-serif",
    fontSize: '0.8rem',
    letterSpacing: '1px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  stepIndicator: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  stepDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#ddd',
    transition: 'all 0.2s ease',
  },
  stepDotActive: {
    background: brand.green,
    transform: 'scale(1.2)',
  },
};

function Tutorial({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  useEffect(() => {
    const step = tutorialSteps[currentStep];
    if (step.target) {
      try {
        const element = document.querySelector(step.target);
        if (element) {
          const rect = element.getBoundingClientRect();
          setTargetRect({
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
          });
        } else {
          setTargetRect(null);
        }
      } catch (e) {
        setTargetRect(null);
      }
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

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

  const step = tutorialSteps[currentStep];
  const isLastStep = currentStep === tutorialSteps.length - 1;
  const isFirstStep = currentStep === 0;
  const isCentered = step.position === 'center' || !targetRect;

  const getTooltipPosition = () => {
    if (!targetRect || isCentered) return {};
    
    const padding = 16;
    let top, left;

    if (step.position === 'bottom') {
      top = targetRect.top + targetRect.height + padding;
      left = targetRect.left + (targetRect.width / 2) - 200;
    } else if (step.position === 'top') {
      top = targetRect.top - 200;
      left = targetRect.left + (targetRect.width / 2) - 200;
    }

    return { top: `${top}px`, left: `${Math.max(20, left)}px` };
  };

  return (
    <>
      {/* Dark overlay */}
      <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && handleSkip()} />

      {/* Spotlight on target element */}
      {targetRect && (
        <div
          style={{
            ...styles.spotlight,
            top: `${targetRect.top}px`,
            left: `${targetRect.left}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
          }}
        />
      )}

      {/* Tooltip */}
      <div style={isCentered ? styles.tooltipCenter : { ...styles.tooltip, ...getTooltipPosition() }}>
        <div style={styles.accentBar} />
        
        {/* Step indicators */}
        <div style={styles.stepIndicator}>
          {tutorialSteps.map((_, idx) => (
            <div
              key={idx}
              style={{
                ...styles.stepDot,
                ...(idx === currentStep ? styles.stepDotActive : {}),
                ...(idx < currentStep ? { background: brand.green } : {}),
              }}
            />
          ))}
        </div>

        <h3 style={styles.title}>{step.title}</h3>
        <p style={styles.content}>{step.content}</p>

        <div style={styles.footer}>
          <span style={styles.progress}>
            Step {currentStep + 1} of {tutorialSteps.length}
          </span>
          <div style={styles.buttons}>
            {!isLastStep && (
              <button style={styles.btnSkip} onClick={handleSkip}>
                Skip Tour
              </button>
            )}
            <button
              style={styles.btnPrimary}
              onClick={handleNext}
              onMouseOver={(e) => {
                e.target.style.background = brand.greenDark;
              }}
              onMouseOut={(e) => {
                e.target.style.background = brand.green;
              }}
            >
              {isLastStep ? 'Get Started' : isFirstStep ? "Let's Go!" : 'Next'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

export default Tutorial;

