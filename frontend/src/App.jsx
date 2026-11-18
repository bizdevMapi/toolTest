import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import VendorUpload from './components/VendorUpload';
import IntermediateTables from './components/IntermediateTables';
import FinalSummary from './components/FinalSummary';
import ScoreBreakdownPage from './components/ScoreBreakdownPage';

function Navigation() {
  const location = useLocation();

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex justify-center gap-2 py-3">
          <Link
            to="/"
            className={`px-6 py-2 rounded-md font-semibold transition-colors ${
              location.pathname === '/'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📤 העלאת תוצאות
          </Link>
          <Link
            to="/intermediate-tables"
            className={`px-6 py-2 rounded-md font-semibold transition-colors ${
              location.pathname === '/intermediate-tables'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📋 טבלאות ביניים
          </Link>
          <Link
            to="/final-summary"
            className={`px-6 py-2 rounded-md font-semibold transition-colors ${
              location.pathname === '/final-summary'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ✨ סיכום סופי
          </Link>
          <Link
            to="/score-breakdown"
            className={`px-6 py-2 rounded-md font-semibold transition-colors ${
              location.pathname === '/score-breakdown'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📊 ניתוח מפורט
          </Link>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <ToastContainer
          position="top-right"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />

        <header className="bg-gradient-to-r from-primary-700 to-primary-900 text-white shadow-lg">
          <div className="container mx-auto px-4 py-6 text-right">
            <h1 className="text-3xl font-bold">מערכת הערכת ספקים</h1>
            <p className="text-primary-100 mt-1">פלטפורמת הערכה לחילוץ מידע ממסמכים</p>
          </div>
        </header>

        <Navigation />

        <main className="container mx-auto px-4 py-8 max-w-6xl flex-grow">
          <Routes>
            <Route path="/" element={<VendorUpload />} />
            <Route path="/intermediate-tables" element={<IntermediateTables />} />
            <Route path="/final-summary" element={<FinalSummary />} />
            <Route path="/score-breakdown" element={<ScoreBreakdownPage />} />
          </Routes>
        </main>

        <footer className="bg-gray-800 text-gray-300 mt-12">
          <div className="container mx-auto px-4 py-6 text-center">
            <p className="text-sm">
              © 2026 Vendor Evaluation System | Built with Node.js, Express, MongoDB, React & Tailwind CSS
            </p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
