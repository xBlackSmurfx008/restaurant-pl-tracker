# Flavor 91 Bistro - Brand Style Guide

> **Reference**: [flavor91.com](https://flavor91.com/)  
> **Last Updated**: January 2026

---

## Brand Colors

### Primary Colors

| Color | Hex | CSS Variable | Usage |
|-------|-----|--------------|-------|
| **Flavor Green** | `#9AC636` | `--flavor-green` | Primary brand color, buttons, accents, links |
| **Flavor Green Dark** | `#7BA328` | `--flavor-green-dark` | Hover states |
| **Flavor Green Light** | `#B8D95A` | `--flavor-green-light` | Highlights |

### Background Colors

| Color | Hex | CSS Variable | Usage |
|-------|-----|--------------|-------|
| **Charcoal** | `#1A1A1A` | `--flavor-charcoal` | Header, dark cards, table headers |
| **Dark** | `#2D2D2D` | `--flavor-dark` | Navigation background |
| **Gray** | `#3D3D3D` | `--flavor-gray` | Secondary buttons, borders |
| **Light Gray** | `#F5F5F5` | `--flavor-light-gray` | Main content background |
| **White** | `#FFFFFF` | `--flavor-white` | Cards, inputs |

### Text Colors

| Color | Hex | CSS Variable | Usage |
|-------|-----|--------------|-------|
| **Text** | `#333333` | `--flavor-text` | Body text on light backgrounds |
| **Text Light** | `#666666` | `--flavor-text-light` | Muted/helper text |

### Status Colors

| Color | Hex | CSS Variable | Usage |
|-------|-----|--------------|-------|
| **Success** | `#43A047` | `--success` | Success states, positive values |
| **Warning** | `#FFB300` | `--warning` | Warning states, caution |
| **Danger** | `#E53935` | `--danger` | Errors, negative values |
| **Danger Dark** | `#C62828` | `--danger-dark` | Danger hover |

---

## Typography

### Font Families

```css
/* Headings, Labels, Navigation */
font-family: 'Oswald', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Body text, Inputs, Content */
font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
```

### Usage Guidelines

- **Oswald**: All headings, navigation items, labels, button text, metric values
- **Lato**: Body content, form inputs, helper text, descriptions

---

## CSS Classes Reference

### ✅ ALWAYS USE THESE CLASSES

Instead of inline styles, use these CSS classes defined in `App.css`:

#### Text Colors
```jsx
// ❌ DON'T
<span style={{ color: '#9AC636' }}>Text</span>
<span style={{ color: '#666' }}>Muted text</span>

// ✅ DO
<span className="text-primary">Text</span>
<span className="text-muted">Muted text</span>
```

#### Value Display (Profit/Loss)
```jsx
// ❌ DON'T
<td style={{ color: profit >= 0 ? '#28a745' : '#dc3545' }}>{profit}</td>

// ✅ DO
<td className={profit >= 0 ? 'value-positive' : 'value-negative'}>{profit}</td>
```

#### Brand Values
```jsx
// ❌ DON'T
<div style={{ fontSize: '1.5rem', color: '#667eea', fontWeight: '600' }}>${total}</div>

// ✅ DO
<div className="brand-value">${total}</div>
<div className="brand-value-lg">${total}</div>  // For larger display
```

#### Selected Items
```jsx
// ❌ DON'T
<div style={{
  border: isSelected ? '2px solid #667eea' : '1px solid #e0e0e0',
  backgroundColor: isSelected ? '#f0f4ff' : 'white'
}}>

// ✅ DO
<div className={`item-card ${isSelected ? 'selected' : ''}`}>
```

#### Helper Text
```jsx
// ❌ DON'T
<small style={{ color: '#666', display: 'block', marginTop: '5px' }}>Help text</small>
<small style={{ color: '#28a745' }}>Success message</small>

// ✅ DO
<small className="helper-text">Help text</small>
<small className="helper-text-success">Success message</small>
```

#### Tips/Info Cards
```jsx
// ❌ DON'T
<div style={{ backgroundColor: '#f8f9fa' }}>
  <h4 style={{ marginBottom: '10px' }}>Tips</h4>
  <ul style={{ color: '#666' }}>...</ul>
</div>

// ✅ DO
<div className="tips-card">
  <h4>Tips</h4>
  <ul>...</ul>
</div>
```

#### Alert Boxes
```jsx
// ✅ DO
<div className="alert-box alert-box-warning">Warning message</div>
<div className="alert-box alert-box-danger">Error message</div>
<div className="alert-box alert-box-success">Success message</div>
<div className="alert-box alert-box-info">Info message</div>
```

---

## JavaScript Theme File

For cases where you MUST use inline styles (rare), import from `theme.js`:

```jsx
import { colors, inlineStyles } from '../theme';

// Use predefined inline style objects
<div style={inlineStyles.primaryText}>Text in brand green</div>
<div style={inlineStyles.selected}>Selected item</div>

// Or individual colors
<div style={{ borderColor: colors.primary }}>Border</div>
```

---

## Component-Specific Guidelines

### Buttons
- **Primary Action**: `className="btn btn-primary"` (Flavor Green)
- **Secondary Action**: `className="btn btn-secondary"` (Gray)
- **Danger Action**: `className="btn btn-danger"` (Red)
- **Success Action**: `className="btn btn-success"` (Green)

### Tables
- Headers automatically styled with `className="table"`
- Use `th-sortable` and `th-sortable sorted` for sortable columns

### Cards
- Standard card: `className="card"`
- Dark metric card: `className="metric-card"`
- Summary card: `className="summary-card"`

### Modals
- Use existing modal classes: `modal-overlay`, `modal-content`, `modal-header`, `modal-body`

---

## Migration Checklist

When updating old code, check for and replace:

| Find | Replace With |
|------|-------------|
| `#667eea` | `var(--flavor-green)` or `className="text-primary"` |
| `#28a745` | `var(--success)` or `className="value-positive"` |
| `#dc3545` | `var(--danger)` or `className="value-negative"` |
| `#666` | `var(--flavor-text-light)` or `className="text-muted"` |
| `#f8f9fa` | `var(--flavor-light-gray)` or `className="bg-light"` |
| `#f0f4ff` | Use `item-card.selected` class |

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    FLAVOR 91 BISTRO                         │
│                    Brand Quick Reference                     │
├─────────────────────────────────────────────────────────────┤
│  PRIMARY GREEN    │  #9AC636  │  --flavor-green             │
│  CHARCOAL         │  #1A1A1A  │  --flavor-charcoal          │
│  SUCCESS          │  #43A047  │  --success                  │
│  WARNING          │  #FFB300  │  --warning                  │
│  DANGER           │  #E53935  │  --danger                   │
│  MUTED TEXT       │  #666666  │  --flavor-text-light        │
├─────────────────────────────────────────────────────────────┤
│  FONTS: Oswald (headings) | Lato (body)                     │
├─────────────────────────────────────────────────────────────┤
│  ALWAYS use CSS classes over inline styles!                 │
│  Import from theme.js only when absolutely necessary        │
└─────────────────────────────────────────────────────────────┘
```

---

## File Locations

- **CSS Variables & Classes**: `client/src/App.css`
- **JavaScript Theme**: `client/src/theme.js`
- **Branding Guide**: `BRANDING_GUIDE.md` (this file)
- **Logo SVG**: `client/public/flavor91-logo.svg`

---

*For questions about branding, reference [flavor91.com](https://flavor91.com/)*

