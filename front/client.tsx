import 'core-js/stable';
import 'regenerator-runtime/runtime';
import React from 'react';
import { render } from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import SWRDevtools from '@jjordy/swr-devtools';

import App from './layouts/App';
import { initTheme } from '@utils/theme';

// 첫 화면부터 저장된 테마(라이트/다크)로 그린다
initTheme();

axios.defaults.withCredentials = true;
axios.defaults.baseURL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3090'; // 배포 시에는 같은 서버(same origin)
console.log('env', process.env.NODE_ENV === 'production');
render(
  <BrowserRouter>
    {process.env.NODE_ENV === 'production' ? (
      <App />
    ) : (
      <SWRDevtools>
        <App />
      </SWRDevtools>
    )}
  </BrowserRouter>,
  document.querySelector('#app'),
);
