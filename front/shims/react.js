// 화이트보드(Excalidraw, React 18 기준)가 이 앱의 React 17 에서 돌도록 빠진 hook 만 채운다.
// webpack 설정에서 Excalidraw 코드가 'react' 를 가져올 때만 이 파일을 쓴다.
import * as ReactNamespace from 'react/index.js';

export * from 'react/index.js';

// 기본 내보내기는 평범한 객체로 (webpack 이 React.useTransition 같은 접근을 '없는 이름'으로 막지 않게)
const React = { ...ReactNamespace };

// 값을 미루지 않고 바로 쓴다 (Mermaid 가져오기 창에서만 쓰인다)
export const useDeferredValue = React.useDeferredValue || ((value) => value);

export default React;
