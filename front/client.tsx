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

// 화이트보드(Excalidraw) 글꼴을 우리 서버에서 받는다 (바깥 CDN 은 보안 정책상 막혀 있다).
// Excalidraw 가 처음 불러와질 때 이 값을 읽으므로 앱이 시작할 때 정해 둔다
(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = '/dist/excalidraw-assets/';

axios.defaults.withCredentials = true;
axios.defaults.baseURL = ''; // 지금 보고 있는 주소 기준 (개발 서버는 /api 를 백엔드로 넘겨준다)
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
