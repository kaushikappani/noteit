import './App.css';
import Landing from "./pages/Landingpage"
import { BrowserRouter, Route } from 'react-router-dom';
import Notes from './pages/Notes';
import Register from './pages/Register';
import Create from './pages/Create';
import Profile from './pages/Profile';
import confirm from "./pages/confirm"
import Archived from './pages/Archived';
import ForgotPassword from "./pages/ForgotPassword";
import PasswordReset from "./pages/PasswordReset";
import StockScreener from './pages/StockScreener';
import ExpenseTracker from './pages/ExpenseTracker';
import Portfolio from './pages/Portfolio';
import NotesV2 from './pages/NotesV2';
import NoteItChat from './pages/NoteItChat';
import McpLogin from './pages/McpLogin';
import TradeBook from './pages/TradeBook';
import ScreenerDashboard from './marketdesk/pages/ScreenerDashboard';
import CompanySnapshot from './marketdesk/pages/CompanySnapshot';
import EditionView from './marketdesk/pages/EditionView';
import MarketDeskSettings from './marketdesk/pages/MarketDeskSettings';
function App() {
  return (
    <BrowserRouter>

      <main>

        <Route path="/" component={Landing} exact />
        <Route path="/notes" component={() => <Notes />} exact />
        <Route path="/notesv2" component={() => <NotesV2 />} exact />
        <Route path="/register" component={() => <Register />} exact />
        <Route path="/createnote" component={Create} exact />
        <Route path="/profile" component={Profile} exact />
        <Route path="/confirm/:id" component={confirm} exact />
        <Route path="/archived" component={Archived} exact />
        <Route path="/forgotpassword" component={ForgotPassword} exact />
        <Route path="/passwordreset/:id" component={PasswordReset} exact />
        <Route path="/stock/screener" component={StockScreener} exact />
        <Route path="/expensetracker" component={ExpenseTracker} exact />
        <Route path="/stock/portfolio" component={Portfolio} exact />
        <Route path="/genai" component={NoteItChat} exact />
        <Route path="/mcp-login" component={McpLogin} exact />
        <Route path="/tradebook" component={TradeBook} exact />

        {/* MarketDesk - admin-only AI market newspaper. Pages live under
            src/marketdesk/ so the feature can move out as one unit. */}
        <Route path="/marketdesk" component={ScreenerDashboard} exact />
        <Route path="/marketdesk/settings" component={MarketDeskSettings} exact />
        <Route path="/marketdesk/company/:symbol" component={CompanySnapshot} exact />
        <Route path="/marketdesk/edition/:date/:slot" component={EditionView} exact />
      </main>
    </BrowserRouter>
  );
}

export default App;
