import * as React from 'react';
import { SlidingPanel } from '../shared-components/sliding-panel/sliding-panel';
import { Application, RevisionHistory } from './models';
import { rollback } from './service';
import './rollback-flyout.scss';

export interface RollbackFlyoutProps {
    show: boolean;
    apps: Application[];
    onClose: () => void;
    setLoading: (loading: boolean) => void;
    setIsInAction: (isInAction: boolean) => void;
    setNotification: (notification: {message: string; type: 'success' | 'error'; requireApproval?: boolean} | null) => void;
    setFetchProgress: React.Dispatch<React.SetStateAction<{
        completed: number;
        total: number;
    }>>;
    refreshApplications: () => void;
    setSelectedApps: React.Dispatch<React.SetStateAction<Set<string>>>;
}

interface RollbackEntry {
    apps: Set<string>;
    last: RevisionHistory;
}

function buildAppsHistory(apps: Application[]): RollbackEntry[] {
    const revisionMap = new Map<string, RollbackEntry>();
    for (const app of apps) {
        for (const entry of app.status?.history || []) {
            if (!entry.revision) continue;
            const existing = revisionMap.get(entry.revision);
            if (!existing) {
                revisionMap.set(entry.revision, { apps: new Set([app.metadata.name]), last: entry });
            } else {
                existing.apps.add(app.metadata.name);
                if (entry.deployedAt && existing.last.deployedAt && new Date(entry.deployedAt) < new Date(existing.last.deployedAt)) {
                    existing.last = entry;
                }
            }
        }
    }
    // Sort by deployedAt (oldest to newest)
    return Array.from(revisionMap.values()).sort((a, b) => {
        if (!a.last.deployedAt) return -1;
        if (!b.last.deployedAt) return 1;
        return new Date(a.last.deployedAt).getTime() - new Date(b.last.deployedAt).getTime();
    });
}

export const RollbackFlyout = ({
    show,
    apps,
    onClose,
    setLoading,
    setIsInAction,
    setNotification,
    setFetchProgress,
    refreshApplications,
    setSelectedApps
}: RollbackFlyoutProps) => {
    const history = buildAppsHistory(apps).slice(0, 10);

    const handleRollback = async (revision: string, appsCount: number) => {
        if (!window.confirm(`Are you sure you want to rollback ${appsCount} apps to this revision?`)) return;

        const matchingApps = apps.filter(app => app.status?.history?.some(h => h.revision === revision));

        setIsInAction(true);
        setLoading(true);
        setFetchProgress({completed: 0, total: matchingApps.length});
        onClose();

        const results = await Promise.all(
            matchingApps.map(async (app) => {
                try {
                    const revisionId = app.status?.history?.find(h => h.revision === revision)?.id;
                    await rollback(app.metadata.name, app.metadata.namespace, revisionId);
                    setFetchProgress(fp => ({...fp, completed: fp.completed + 1}));
                    return { success: true, name: app.metadata.name };
                } catch (e) {
                    setFetchProgress(fp => ({...fp, completed: fp.completed + 1}));
                    return { success: false, name: app.metadata.name, error: e.message };
                }
            })
        );
        const successCount = results.filter(r => r.success).length;
        const failedApps = results.filter(r => !r.success);
        setLoading(false);
        setIsInAction(false);
        if (failedApps.length > 0) {
            setNotification({
                message: `Successfully triggered rollback for ${successCount} applications. Failed to rollback: ${failedApps.map(a => a.name).join(', ')}`,
                type: 'error',
                requireApproval: true
            });
        } else {
            setNotification({
                message: `Successfully triggered rollback for ${successCount} applications`,
                type: 'success'
            });
            setSelectedApps(new Set());
            await refreshApplications();
        }
    };

    return (
        <SlidingPanel isMiddle={true} isShown={show} onClose={onClose} header={
            <>
                <button className='argo-button argo-button--base-o' onClick={onClose}>CANCEL</button>
            </>
        }>
            <div className='rollback-flyout'>
                {history.map((v, i) => (
                    <div key={i} className='rollback-flyout__entry'>
                        <div className='rollback-flyout__entry-info'>
                            <button
                                className='rollback-flyout__rollback-btn'
                                title='Rollback to this revision'
                                onClick={() => handleRollback(v.last.revision, v.apps.size)}
                            >
                                <i className='fa fa-undo'/>
                            </button>
                            <div className='rollback-flyout__row'>
                                <span className='rollback-flyout__icon'><i className='fa fa-hourglass-half'/></span>
                                <span className='rollback-flyout__label'>Revision:</span>
                                <span className='rollback-flyout__value'>{v.last.revision}</span>
                            </div>
                            <div className='rollback-flyout__row'>
                                <span className='rollback-flyout__icon'><i className='fa fa-cubes'/></span>
                                <span className='rollback-flyout__label'>Matching apps:</span>
                                <span className='rollback-flyout__value'>{v.apps.size}</span>
                            </div>
                            <div className='rollback-flyout__row'>
                                <span className='rollback-flyout__icon'><i className='fa fa-clock'/></span>
                                <span className='rollback-flyout__label'>Last sync at:</span>
                                <span className='rollback-flyout__value'>{v.last.deployedAt || '-'}</span>
                            </div>
                            <div className='rollback-flyout__row'>
                                <span className='rollback-flyout__icon'><i className='fa fa-user'/></span>
                                <span className='rollback-flyout__label'>Last synced by:</span>
                                <span className='rollback-flyout__value'>{v.last.initiatedBy?.username || '-'}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </SlidingPanel>
    );
}; 
