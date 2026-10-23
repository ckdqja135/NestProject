import path from 'path';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import webpack, { Configuration as WebpackConfiguration } from 'webpack';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { Configuration as WebpackDevServerConfiguration } from 'webpack-dev-server';

interface Configuration extends WebpackConfiguration {
  devServer?: WebpackDevServerConfiguration;
}
const isDevelopment = process.env.NODE_ENV !== 'production';

const config: Configuration = {
  name: 'shlack',
  mode: isDevelopment ? 'development' : 'production',
  devtool: !isDevelopment ? 'hidden-source-map' : 'inline-source-map',
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      '@hooks': path.resolve(__dirname, 'hooks'),
      '@components': path.resolve(__dirname, 'components'),
      '@layouts': path.resolve(__dirname, 'layouts'),
      '@pages': path.resolve(__dirname, 'pages'),
      '@utils': path.resolve(__dirname, 'utils'),
      '@typings': path.resolve(__dirname, 'typings'),
    },
  },
  entry: {
    app: './client',
  },
  target: ['web', 'es5'],
  module: {
    rules: [
      {
        // React 17 의 react/jsx-runtime 은 exports 가 없어, 엄격한 ES 모듈(그림 도구 등)에서 확장자 없이 찾지 못한다
        test: /\.m?js$/,
        resolve: { fullySpecified: false },
      },
      {
        // 화이트보드(Excalidraw)는 React 18 의 hook 하나를 쓴다. 그 코드에만 빈 곳을 채운 react 를 준다
        test: /\.m?js$/,
        include: /node_modules[\\/]@excalidraw/,
        resolve: { alias: { react$: path.resolve(__dirname, 'shims/react.js') } },
        use: [path.resolve(__dirname, 'loaders/excalidraw-local-assets.js')],
      },
      {
        test: /\.tsx?$/,
        loader: 'babel-loader',
        options: {
          presets: [
            [
              '@babel/preset-env',
              {
                targets: { browsers: ['IE 10'] },
                debug: isDevelopment,
              },
            ],
            '@babel/preset-react',
            '@babel/preset-typescript',
          ],
          env: {
            development: {
              plugins: [['@emotion/babel-plugin', { sourceMap: true }], require.resolve('react-refresh/babel')],
            },
            production: {
              plugins: ['@emotion/babel-plugin'],
            },
          },
        },
      },
      {
        test: /\.css?$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({
      async: false,
      // eslint: {
      //   files: "./src/**/*",
      // },
    }),
    new webpack.EnvironmentPlugin({ NODE_ENV: isDevelopment ? 'development' : 'production' }),
    // 화이트보드(Excalidraw) 글꼴을 우리 서버에서 내려준다 (바깥 CDN 은 보안 정책상 막혀 있다)
    new CopyPlugin({
      patterns: [
        {
          from: path.join(__dirname, 'node_modules/@excalidraw/excalidraw/dist/prod/fonts'),
          to: 'excalidraw-assets/fonts',
        },
      ],
    }),
  ],
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
    publicPath: '/dist/',
    // 빌드할 때마다 예전 조각 파일을 지운다
    clean: true,
  },
  devServer: {
    historyApiFallback: true,
    port: 3090,
    devMiddleware: { publicPath: '/dist/' },
    static: { directory: path.resolve(__dirname) },
    proxy: {
      '/api/': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        ws: true,
      },
    },
  },
};

if (isDevelopment && config.plugins) {
  config.plugins.push(new webpack.HotModuleReplacementPlugin());
  config.plugins.push(
    new ReactRefreshWebpackPlugin({
      overlay: {
        useURLPolyfill: true,
      },
    }),
  );
  config.plugins.push(new BundleAnalyzerPlugin({ analyzerMode: 'server', openAnalyzer: false }));
}
if (!isDevelopment && config.plugins) {
  config.plugins.push(new webpack.LoaderOptionsPlugin({ minimize: true }));
  config.plugins.push(new BundleAnalyzerPlugin({ analyzerMode: 'static', openAnalyzer: false }));
}

export default config;
