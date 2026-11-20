import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import AuthProvider from './auth/AuthProvider';
import ThemeProvider from './theme/ThemeProvider';
import './styles/index.css';

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AuthProvider>
  </BrowserRouter>,
);
