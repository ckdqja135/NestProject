// 화이트보드(Excalidraw)는 글꼴을 우리 서버에서 못 받으면 바깥 CDN(esm.sh)에서 받으려 한다.
// 바깥으로 나가는 요청이 없도록 그 예비 주소도 우리 서버 주소로 바꾼다 (URL 의 기준 주소라 완전한 주소여야 한다).
const LOCAL = '(self.location.origin + "/dist/excalidraw-assets/")';

module.exports = function replaceFallbackUrl(source) {
  return source.replace(/`https:\/\/esm\.sh\/[\s\S]*?\/dist\/(?:prod|dev)\/`/g, LOCAL);
};
