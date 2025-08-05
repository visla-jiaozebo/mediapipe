const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './webgl-face-beauty.ts',
  mode: 'development',
  
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(vert|frag)$/,
        type: 'asset/source',
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/,
        type: 'asset/resource',
      },
    ],
  },
  
  resolve: {
    extensions: ['.ts', '.js'],
  },
  
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  
  plugins: [
    new HtmlWebpackPlugin({
      template: './webgl-beauty.html',
      filename: 'index.html',
      inject: 'body',
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'gl', to: 'gl' },
        { from: 'res', to: 'res' },
        { from: 'demo.png', to: 'demo.png', noErrorOnMissing: true },
        { from: 'demo1.png', to: 'demo1.png', noErrorOnMissing: true },
        { from: 'favicon.svg', to: 'favicon.svg', noErrorOnMissing: true },
      ],
    }),
  ],
  
  devServer: {
    static: [
      {
        directory: path.join(__dirname, '.'),
      },
    ],
    compress: true,
    port: 8000,
    hot: true,
    open: true,
  },
  
  // 添加source map支持调试
  devtool: 'source-map',
};
