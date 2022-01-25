import './App.css';
import Landing from "./pages/Landingpage"
import { BrowserRouter, Route } from 'react-router-dom';
import Notes from './pages/Notes';
import Register from './pages/Register';
import Create from './pages/Create';
import SingleNote from './pages/SingleNote';
import Profile from './pages/Profile';
import confirm from "./components/confirm"
import Archived from './pages/Archived';
function App() {
  return (
    <BrowserRouter>
      <main>
        <Route path="/" component={Landing} exact />
        <Route path="/notes" component={() => <Notes />} exact />
        <Route path="/register" component={() => <Register />} exact />
        <Route path="/createnote" component={Create} exact />
        <Route path="/note/:id" component={SingleNote} exact />
        <Route path="/profile" component={Profile} exact />
        <Route path="/confirm/:id" component={confirm} exact />
        <Route path="/archived" component = {Archived} exact />
      </main>
    </BrowserRouter>
  );
}

export default App;
