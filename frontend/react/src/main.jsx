import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import Login from "./login/Login.tsx"
import "./index.scss";
import "./login/login.scss"
import { BrowserRouter as Router, Routes, Route  } from "react-router-dom";
import { Provider } from 'react-redux';
import store from './store';

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <Provider store={store}>
    <Router>
      <Routes>
        {/* Define the routes */}
        <Route path="/" element={<Login />} />
        <Route path="/app" element={<App />} />
      </Routes>
    </Router>
  </Provider>,
)