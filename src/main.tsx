import React from 'react';
import {createRoot} from 'react-dom/client';
import Survey from './Survey';
import Admin from './Admin';
import './style.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode>{location.hash==='#admin'?<Admin/>:<Survey/>}</React.StrictMode>);

