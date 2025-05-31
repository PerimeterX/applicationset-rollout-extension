import * as React from 'react';
import './loader.scss';

export const Loader = () => (
    <div className="debug-pod-tab__loader">
        <div className="spinner" />
        <span>Loading...</span>
    </div>
);