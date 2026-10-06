import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Survey from './Survey';
import Admin from './Admin';
import './style.css';
function App(){const [hash,setHash]=useState(location.hash);useEffect(()=>{const change=()=>setHash(location.hash);window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);return hash==='#admin'?<Admin/>:<Survey/>;}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);

