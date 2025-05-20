import * as React from 'react';
import { SlidingPanel } from '../shared-components/sliding-panel/sliding-panel';
import { Application } from './models';
import './sync-flyout.scss';

export interface SyncOptions {
    revision: string;
    prune: boolean;
    dryRun: boolean;
}

interface SyncFlyoutProps {
    show: boolean;
    apps: Application[];
    onClose: () => void;
    onSync: (options: SyncOptions) => void;
}

const getDefaultOptions = (apps: Application[]) => {
    return {
        revision: getRevision(apps),
        prune: false,
        dryRun: false,
    };
};

const getRevision = (apps: Application[]) => {
    if (apps.length === 0) {
        return 'HEAD';
    }

    const app = apps[0];
    if (app.spec.sources && app.spec.sources.length > 0) {
        return app.spec.sources[0].targetRevision;
    }

    return app.spec.source.targetRevision || 'HEAD';
};

export const SyncFlyout: React.FC<SyncFlyoutProps> = ({ show, apps, onClose, onSync }) => {
    const [options, setOptions] = React.useState<SyncOptions>(getDefaultOptions(apps));

    React.useEffect(() => {
        setOptions(getDefaultOptions(apps));
    }, [show]);

    const handleChange = (key: keyof SyncOptions, value: boolean | string) => {
        setOptions(prev => ({ ...prev, [key]: value }));
    };

    return (
        <SlidingPanel isMiddle={true} isShown={show} onClose={onClose} header={
            <>
                <button className='argo-button argo-button--base' onClick={() => onSync(options)}>
                    SYNCHRONIZE
                </button>
                <button className='argo-button argo-button--base-o' onClick={onClose} style={{marginLeft: 8}}>
                    CANCEL
                </button>
            </>
        }>
            <div className='sync-flyout'>
                <div className='sync-flyout__row'>
                    <label className='sync-flyout__label' htmlFor='sync-revision'>Revision</label>
                    <input
                        id='sync-revision'
                        className='sync-flyout__input'
                        type='text'
                        value={options.revision}
                        onChange={e => handleChange('revision', e.target.value)}
                    />
                </div>
                <div className='sync-flyout__checkbox-row'>
                    <div>
                        <span className='argo-checkbox'>
                            <input id='sync-prune' type='checkbox' checked={options.prune} onChange={e => handleChange('prune', e.target.checked)} />
                            <span><i className='fa fa-check'/></span>
                        </span>
                        <label htmlFor='sync-prune'>PRUNE</label>
                    </div>
                    <div>
                        <span className='argo-checkbox'>
                            <input id='sync-dry-run' type='checkbox' checked={options.dryRun} onChange={e => handleChange('dryRun', e.target.checked)} />
                            <span><i className='fa fa-check'/></span>
                        </span>
                        <label htmlFor='sync-dry-run'>DRY RUN</label>
                    </div>
                </div>
            </div>
        </SlidingPanel>
    );
}; 