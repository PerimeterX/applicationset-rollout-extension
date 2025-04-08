import * as React from 'react';
import './notification-bar.scss';

export interface NotificationBarProps {
    message: string;
    type: 'success' | 'error';
    onClose: () => void;
}

export interface Notification {
    message: string;
    type: 'success' | 'error';
}

export const NotificationBar: React.FC<NotificationBarProps> = ({ message, type, onClose }) => {
    React.useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 5000);

        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`notification-bar notification-bar--${type}`}>
            <span className='notification-bar__message'>{message}</span>
            <button className='notification-bar__close' onClick={onClose}>
                <i className='fa fa-times'/>
            </button>
        </div>
    );
}; 