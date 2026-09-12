import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { installDebug } from './core/debug';
import './styles/global.css';

installDebug();

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
