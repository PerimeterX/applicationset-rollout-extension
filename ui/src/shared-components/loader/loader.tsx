import * as React from 'react';
import './loader.scss';

export const Loader = ({percent}: {percent?: number}) => (
    <div className="loader">
        <div className="spinner" />
        <span>{percent ? `${Math.round(percent * 100)}%` : 'Loading...'}</span>
    </div>
);