import * as React from 'react';
import './notification-bar.scss';

export interface NotificationBarProps {
    message: string;
    type: 'success' | 'error';
    onClose: () => void;
    requireApproval?: boolean;
}

export interface Notification {
    message: string;
    type: 'success' | 'error';
    requireApproval?: boolean;
}

export const NotificationBar: React.FC<NotificationBarProps> = ({ message, type, onClose, requireApproval }) => {
    React.useEffect(() => {
        if (!requireApproval) {
            const timer = setTimeout(() => {
                onClose();
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [onClose, requireApproval]);

    return (
        <div className={`notification-bar notification-bar--${type}`}>
            <span className='notification-bar__message'>{message}</span>
            <button className='notification-bar__close' onClick={onClose}>
                <i className='fa fa-times'/>
            </button>
        </div>
    );
}; 