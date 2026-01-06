# Restaurant Menu Costing & P&L Tracker

A zero-friction P&L application for restaurant owners that handles all conversions and calculations automatically.

## 🎯 Core Philosophy

**"Don't make me do math."** The system handles all conversions and calculations silently. The interface is tactile, fast, and visual.

## ✨ Features

### Smart Ingredient Setup
- Natural sentence-structure input: "I buy [Onions] from [Sysco] for [$25.00] per [50lb Bag]"
- Automatic unit conversion suggestions
- Real-time cost per usage unit calculation

### Live Plate Builder
- Visual recipe builder with real-time cost updates
- Instant food cost percentage calculation
- Profit bar visualization with color-coded warnings
- Target food cost tracking

### Unit Conversion Engine
- Pre-filled library of common conversions (lbs to oz, gallons to cups, etc.)
- Automatic conversion factor suggestions
- Support for custom conversions

### Sales Tracking
- Quick daily sales input (30-second routine)
- Keyboard-friendly navigation (Tab/Enter)
- Smart defaults for frequently sold items
- Instant profit calculation on save

### Menu Engineering Dashboard
- **Quadrant Matrix Visualization:**
  - ⭐ **Stars** (Top Right): High Profit, High Popularity - Keep!
  - 🧩 **Puzzles** (Top Left): High Profit, Low Popularity - Reprice
  - 🐴 **Plowhorses** (Bottom Right): Low Profit, High Popularity - Lower portion
  - 🐕 **Dogs** (Bottom Left): Low Profit, Low Popularity - Remove

### Time-Based Analytics
- Filters: Today, This Week, This Month, This Quarter, This Year, YTD
- Total Revenue, Profit, COGS, and Global Food Cost %
- Item-by-item profitability breakdown

### Price Watch Alerts
- Automatic notifications for ingredients not updated in 30+ days
- Keeps data accurate without forcing full inventory audits

## 🛠️ Tech Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL (see [POSTGRES_SETUP.md](./POSTGRES_SETUP.md) for setup instructions)
- **Frontend**: React
- **Styling**: Modern CSS with gradient themes and visual feedback

## 📦 Installation

1. **Set up PostgreSQL:**
   - See [POSTGRES_SETUP.md](./POSTGRES_SETUP.md) for detailed instructions
   - Create a database named `restaurant_pl`
   - Create a `.env` file with your database credentials:
     ```env
     DB_HOST=localhost
     DB_PORT=5432
     DB_NAME=restaurant_pl
     DB_USER=postgres
     DB_PASSWORD=your_password
     PORT=5000
     ```

2. **Install all dependencies:**
```bash
npm run install-all
```

This installs both backend and frontend dependencies.

## 🚀 Development

**Start both servers simultaneously:**
```bash
npm run dev
```

This starts:
- Backend API server on `http://localhost:5000`
- Frontend React app on `http://localhost:3000`

**Or run separately:**
```bash
# Backend only
npm run server

# Frontend only (in another terminal)
npm run client
```

## 📁 Project Structure

```
.
├── server/                    # Backend API
│   ├── index.js              # Express server entry point
│   ├── db.js                 # SQLite database setup & schema
│   ├── routes/               # API route handlers
│   │   ├── vendors.js        # Vendor CRUD operations
│   │   ├── ingredients.js    # Ingredient management + conversion
│   │   ├── menuItems.js      # Menu items + recipe builder
│   │   └── sales.js          # Sales logging + analytics
│   └── utils/
│       └── calculations.js   # Core P&L calculation engine
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── Dashboard.js
│   │   │   ├── VendorManagement.js
│   │   │   ├── IngredientLocker.js
│   │   │   ├── RecipeBuilder.js
│   │   │   └── SalesInput.js
│   │   ├── services/
│   │   │   └── api.js        # API service layer
│   │   ├── App.js            # Main app component
│   │   └── App.css           # Global styles
│   └── package.json
├── .env                        # Environment variables (create this)
├── POSTGRES_SETUP.md           # PostgreSQL setup guide
├── package.json               # Root package.json
└── README.md
```

## 🗄️ Database Schema

- **vendors**: Vendor information
- **ingredients**: Inventory with purchase/usage unit conversions
- **menu_items**: Menu items with selling prices and target costs
- **recipe_map**: Links ingredients to menu items (recipes)
- **sales_log**: Daily sales records

## 📊 API Endpoints

### Vendors
- `GET /api/vendors` - List all vendors
- `POST /api/vendors` - Create vendor
- `PUT /api/vendors/:id` - Update vendor
- `DELETE /api/vendors/:id` - Delete vendor

### Ingredients
- `GET /api/ingredients` - List all ingredients
- `POST /api/ingredients` - Create ingredient
- `POST /api/ingredients/suggest-conversion` - Get conversion suggestion
- `GET /api/ingredients/alerts/price-watch` - Price watch alerts
- `PUT /api/ingredients/:id` - Update ingredient
- `DELETE /api/ingredients/:id` - Delete ingredient

### Menu Items
- `GET /api/menu-items` - List all menu items with costs
- `GET /api/menu-items/:id` - Get menu item with full recipe
- `POST /api/menu-items` - Create menu item
- `PUT /api/menu-items/:id` - Update menu item
- `POST /api/menu-items/:id/recipe` - Add ingredient to recipe
- `DELETE /api/menu-items/:id/recipe/:recipeId` - Remove ingredient

### Sales
- `GET /api/sales` - Get sales (with optional date filters)
- `GET /api/sales/date/:date` - Get sales for specific date
- `POST /api/sales/daily` - Save daily sales (bulk)
- `GET /api/sales/analytics?period=month` - Get analytics for period

## 🎨 User Journey

### 1. Setup (First Time)
1. Create a Vendor (e.g., "Sysco")
2. Add Ingredients with purchase/usage units
3. Create Menu Items
4. Build Recipes by adding ingredients

### 2. Daily Routine
1. Go to Sales tab
2. Enter quantities sold for each menu item
3. Hit Save - see instant profit calculation

### 3. Analysis
1. View Dashboard for profitability insights
2. Check Menu Engineering Matrix for optimization opportunities
3. Review Price Watch Alerts to keep costs current

## 🔧 Configuration

The database is automatically created on first server start. No configuration needed!

For production, consider:
- Switching to PostgreSQL
- Adding authentication
- Setting up environment variables for API URLs

## 📝 License

ISC

