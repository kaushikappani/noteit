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
function App() {
  return (
    <BrowserRouter>
    
      <main>

        <Route path="/" component={Landing} exact />
        <Route path="/notes" component={() => <Notes />} exact />
        <Route path="/register" component={() => <Register />} exact />
        <Route path="/createnote" component={Create} exact />
        <Route path="/profile" component={Profile} exact />
        <Route path="/confirm/:id" component={confirm} exact />
        <Route path="/archived" component={Archived} exact />
        <Route path = "/forgotpassword" component={ForgotPassword} exact />
        <Route path="/passwordreset/:id" component={PasswordReset} exact />
        <Route path="/stock/screener" component = {StockScreener} exact />
      </main>
    </BrowserRouter>
  );
}

export default App;
