import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n'; // Import i18n config
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


//import * as serviceWorkerRegistration from './serviceWorkerRegistration';

//serviceWorkerRegistration.unregister();
