const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

const groupKind = 'argoproj.io/ApplicationSet';
const webpack = require('webpack');
const config = {
    entry: {
        extension: './src/index.tsx',
    },
    output: {
        filename: 'extensions-applicationset.js',
        path: __dirname + `/dist/resources/${groupKind}/ui`,
        libraryTarget: 'window',
        library: ['extensions', 'resources', groupKind],
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.json', '.ttf', '.scss'],
    },
    optimization: {
        minimizer: [new TerserPlugin({
            extractComments: false,
        })],
    },
    externals: [
        {
            react: 'React'
        }
    ],
    plugins: [
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
            'process.env.NODE_ONLINE_ENV': JSON.stringify(process.env.NODE_ONLINE_ENV || 'offline'),
            'process.env.HOST_ARCH': JSON.stringify(process.env.HOST_ARCH || 'amd64'),
            'process.platform': JSON.stringify('browser'),
            'SYSTEM_INFO': JSON.stringify({
                version: process.env.ARGO_VERSION || 'latest'
            })
        })],
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                options: {
                    allowTsInNodeModules: true,
                    configFile: path.resolve('./src/tsconfig.json')
                },
            },
            {
                test: /\.scss$/,
                use: ['style-loader', 'css-loader', 'sass-loader'],
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'raw-loader'],
            }
        ],
    },
};

module.exports = config;