import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './styles.css';
import {startAdmin} from './staging-entry.mjs';
startAdmin(window.location, () => createRoot(document.getElementById('root')).render(<App/>));
