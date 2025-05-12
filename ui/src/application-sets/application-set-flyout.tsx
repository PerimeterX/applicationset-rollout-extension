import * as React from 'react';
import {useState, useEffect} from 'react';

import * as moment from 'moment';
import {SlidingPanel} from '../shared-components/sliding-panel/sliding-panel';
import {DropDownMenu} from '../shared-components/dropdown-menu';
import {ApplicationSet, Application, ApplicationResource, ResourceTree} from './models';
import {getApplication, runResourceAction, syncApplication, getResourceTree} from './service';
import {NotificationBar, Notification} from "../shared-components/notification-bar/notification-bar";

import './application-set-flyout.scss';
import { Tooltip } from '../shared-components/tooltip';

export interface ApplicationSetFlyoutProps {
    show: boolean;
    appSet: ApplicationSet;
    onClose: () => void;
}

export const ApplicationSetFlyout = ({ show, appSet, onClose }: ApplicationSetFlyoutProps) => {
    const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [applications, setApplications] = useState<{[key: string]: ApplicationResource}>({});
    const [isInAction, setIsInAction] = useState(false);
    const [notification, setNotification] = useState<Notification | null>(null);
    const [fetchProgress, setFetchProgress] = useState<{completed: number, total: number}>({completed: 0, total: 0});

    const isRolloutSuspended = (app: Application) => {
        const rollout = app.status.resources?.find(r => 
            r.kind === 'Rollout' && 
            r.group === 'argoproj.io'
        );
        return rollout && rollout.health?.status === 'Suspended';
    };

    const handleSync = async (app: Application, e: React.MouseEvent) => { 
        e.stopPropagation();
        setIsInAction(true);
        try {
            await syncApplication(app.metadata.name, app.metadata.namespace);
            setNotification({
                message: `Successfully started sync for application ${app.metadata.name}`,
                type: 'success'
            });
        } catch (e) {
            setNotification({
                message: `Failed to sync application ${app.metadata.name}: ${e.message}`,
                type: 'error'
            });
        } finally {
            setIsInAction(false);
        }
    };

    const handleSyncAll = async (e: React.MouseEvent) => {
        e.stopPropagation();
        
        setIsInAction(true);
        const results = await Promise.all(
            Array.from(selectedApps).map(async appKey => {
                const appResource = applications[appKey];
                if (!appResource?.application) {
                    return { success: false, name: appKey, error: 'Application not found' };
                }
                const app = appResource.application;
                try {
                    await syncApplication(app.metadata.name, app.metadata.namespace);
                    return { success: true, name: app.metadata.name };
                } catch (e) {
                    return { success: false, name: app.metadata.name, error: e.message };
                }
            })
        );

        const successCount = results.filter(r => r.success).length;
        const failedApps = results.filter(r => !r.success);

        if (failedApps.length > 0) {
            setNotification({
                message: `Successfully started sync for ${successCount} applications. Failed to sync: ${failedApps.map(a => a.name).join(', ')}`,
                type: 'error'
            });
        } else {
            setNotification({
                message: `Successfully started sync for ${successCount} applications`,
                type: 'success'
            });
            setSelectedApps(new Set());
            await refreshApplications(true);
        }
        setIsInAction(false);
    };

    const handleRolloutAction = async (
        action: string,
        app: Application,
        e?: React.MouseEvent
    ) => {
        e?.stopPropagation();
        
        setIsInAction(true);
        try {
            await runRolloutAction(action, app);

            setNotification({
                message: `Successfully executed ${action} for ${app.metadata.name}`,
                type: 'success'
            });

            await refreshApplications(true);
        } catch (e) {
            setNotification({
                message: `Failed to execute ${action} for ${app.metadata.name}: ${e.message}`,
                type: 'error'
            });
        } finally {
            setIsInAction(false);
        }
    };

    const handleRolloutActionAll = async (action: string) => {
        setIsInAction(true);
        const apps = Array.from(selectedApps)
            .map(appKey => applications[appKey]?.application)
            .filter((app): app is Application => !!app && isRolloutSuspended(app));
        try {
            await Promise.all(apps.map(app => runRolloutAction(action, app)));

            setNotification({
                message: `Successfully executed ${action} for ${apps.length} applications`,
                type: 'success'
            });

            setSelectedApps(new Set());
            await refreshApplications(true);
        } catch (e) {
            setNotification({
                message: `Failed to execute ${action}: ${e.message}`,
                type: 'error'
            });
        } finally {
            setIsInAction(false);
        }
    };

    const runRolloutAction = async (action: string, app: Application) => {
        const rollout = app.status.resources?.find(r => 
            r.kind === 'Rollout' && 
            r.group === 'argoproj.io'
        );
        
        if (!rollout) {
            throw new Error('No Rollout resource found');
        }

        await runResourceAction(
            app.metadata.name,
            app.metadata.namespace,
            {
                group: rollout.group,
                kind: rollout.kind,
                name: rollout.name,
                namespace: rollout.namespace,
                version: rollout.version
            },
            action
        );
    };

    // Auto-refresh every 10 seconds when the flyout is shown
    useEffect(() => {
        if (!show) {
            return;
        }

        const interval = setInterval(() => refreshApplications(true), 10000);
        return () => clearInterval(interval);
    }, [show]);

    // Load applications when appSet changes
    useEffect(() => {
        setSelectedApps(new Set());
        if (appSet?.status?.resources) {
            setLoading(true);
            setFetchProgress({completed: 0, total: appSet.status.resources.length});
            let completed = 0;
            Promise.all(
                appSet.status.resources.map(async resource => {
                    try {
                        const [app, resourceTree] = await Promise.all([
                            getApplication(resource.name, resource.namespace),
                            getResourceTree(resource.name, resource.namespace)
                        ]);
                        return {
                            key: `${resource.namespace}/${resource.name}`,
                            appResource: {
                                application: app,
                                resourceTree
                            }
                        };
                    } catch (e) {
                        return {
                            key: `${resource.namespace}/${resource.name}`,
                            appResource: null
                        };
                    } finally {
                        completed++;
                        setFetchProgress(fp => ({completed, total: appSet.status.resources.length}));
                    }
                })
            ).then(results => {
                const newApps = results.reduce((acc, {key, appResource}) => {
                    if (appResource) {
                        acc[key] = appResource;
                    }
                    return acc;
                }, {} as {[key: string]: ApplicationResource});
                setApplications(newApps);
                setLoading(false);
            });
        } else {
            setApplications({});
        }
    }, [appSet]);

    const refreshApplications = async (isSilent = false) => {
        if (!appSet?.status?.resources) {
            return;
        }

        if (!isSilent) {
            setIsRefreshing(true);
        }
        
        try {
            const results = await Promise.all(
                appSet.status.resources.map(async resource => {
                    try {
                        const [app, resourceTree] = await Promise.all([
                            getApplication(resource.name, resource.namespace, 'normal'),
                            getResourceTree(resource.name, resource.namespace)
                        ]);
                        return {
                            key: `${resource.namespace}/${resource.name}`,
                            appResource: {
                                application: app,
                                resourceTree
                            },
                            success: true
                        };
                    } catch (e) {
                        if (!isSilent) {
                            setNotification({
                                message: `Failed to refresh application ${resource.name}: ${e.message}`,
                                type: 'error'
                            });
                        }
                        return {
                            key: `${resource.namespace}/${resource.name}`,
                            appResource: null,
                            success: false
                        };
                    }
                })
            );

            const newApps = results.reduce((acc, {key, appResource}) => {
                if (appResource) {
                    acc[key] = appResource;
                }
                return acc;
            }, {} as {[key: string]: ApplicationResource});
            
            setApplications(newApps);
        } finally {
            if (!isSilent) {
                setIsRefreshing(false);
            }
        }
    };

    // Get unique labels from all applications
    const getUniqueLabels = () => {
        const labelMap = new Map<string, Set<string>>();
        
        appSet?.status?.resources?.forEach(resource => {
            const appResource = applications[`${resource.namespace}/${resource.name}`];
            if (appResource?.application?.metadata?.labels) {
                Object.entries(appResource.application.metadata.labels).forEach(([key, value]) => {
                    if (!labelMap.has(key)) {
                        labelMap.set(key, new Set());
                    }
                    labelMap.get(key).add(value);
                });
            }
        });

        return labelMap;
    };

    const selectByLabel = (labelKey: string, labelValue: string) => {
        const matchingApps = new Set(
            appSet?.status?.resources?.filter(resource => {
                const appResource = applications[`${resource.namespace}/${resource.name}`];
                return appResource?.application?.metadata?.labels?.[labelKey] === labelValue;
            }).map(resource => `${resource.namespace}/${resource.name}`) || []
        );
        setSelectedApps(matchingApps);
    };

    const toggleSelection = (appKey: string) => {
        setSelectedApps(prev => {
            const newSet = new Set(prev);
            if (newSet.has(appKey)) {
                newSet.delete(appKey);
            } else {
                newSet.add(appKey);
            }
            return newSet;
        });
    };

    const selectNone = () => {
        setSelectedApps(new Set());
    };

    const selectAll = () => {
        const allApps = new Set(
            appSet?.status?.resources?.map(
                resource => `${resource.namespace}/${resource.name}`
            ) || []
        );
        setSelectedApps(allApps);
    };

    const selectOutOfSync = () => {
        const outOfSyncApps = new Set(
            appSet?.status?.resources?.filter(resource => {
                const appResource = applications[`${resource.namespace}/${resource.name}`];
                return appResource?.application && appResource.application.status.sync.status !== 'Synced';
            }).map(resource => `${resource.namespace}/${resource.name}`) || []
        );
        setSelectedApps(outOfSyncApps);
    };

    const selectSuspended = () => {
        const suspendedApps = new Set(
            appSet?.status?.resources?.filter(resource => {
                const appResource = applications[`${resource.namespace}/${resource.name}`];
                return appResource?.application && isRolloutSuspended(appResource.application);
            }).map(resource => `${resource.namespace}/${resource.name}`) || []
        );
        setSelectedApps(suspendedApps);
    };

    const getRolloutState = (app: Application, resourceTree: ResourceTree) => {
        const rollout = app.status.resources?.find(r => 
            r.kind === 'Rollout' && 
            r.group === 'argoproj.io'
        );

        if (!rollout) {
            return null;
        }

        if (rollout.health?.status !== 'Processing' && rollout.health?.status !== 'Progressing') {
            return {status: rollout.health?.status};
        }

        // Find the latest replica set by looking at the revision number
        const replicaSets = resourceTree.nodes.filter(node => 
            node.group === 'apps' && 
            node.kind === 'ReplicaSet' &&
            node.parentRefs?.some(parent => 
                parent.group === 'argoproj.io' && 
                parent.kind === 'Rollout' && 
                parent.name === rollout.name
            )
        );

        if (replicaSets.length === 0) {
            return {status: rollout.health?.status, updatedPods: 0, totalPods: 0};
        }

        // Get the latest replica set by comparing revision numbers
        const latestReplicaSet = replicaSets.reduce((latest, current) => {
            const latestRev = parseInt(latest.info?.find(i => i.name === 'Revision')?.value?.replace('Rev:', '') || '0');
            const currentRev = parseInt(current.info?.find(i => i.name === 'Revision')?.value?.replace('Rev:', '') || '0');
            return currentRev > latestRev ? current : latest;
        });

        // Get all pods
        const allPods = resourceTree.nodes.filter(node => 
            node.kind === 'Pod' &&
            node.parentRefs?.some(parent => 
                parent.group === 'apps' && 
                parent.kind === 'ReplicaSet'
            )
        );

        // Get pods from the latest replica set
        const latestReplicaSetPods = allPods.filter(pod => 
            pod.parentRefs?.some(parent => 
                parent.group === 'apps' && 
                parent.kind === 'ReplicaSet' && 
                parent.uid === latestReplicaSet.uid
            )
        );

        const totalPods = allPods.length;
        const updatedPods = latestReplicaSetPods.length;

        if (totalPods === 0) {
            return {status: rollout.health?.status, updatedPods: 0, totalPods: 0};
        }

        if (updatedPods === totalPods) {
            return {status: 'Healthy'};
        }

        return {status: rollout.health?.status, updatedPods, totalPods};
    }

    const renderRolloutStatus = (app: Application, resourceTree: ResourceTree) => {
        const state = getRolloutState(app, resourceTree);
        if (!state) {
            return null;
        }

        const {status, updatedPods, totalPods} = state;
        const ratio = updatedPods && totalPods ? updatedPods / totalPods : 0;
        return (
            <div className='row'>
                <div className='label'>Rollout Status:</div>
                <div className='value'>
                    <span className={`status status--${status.toLowerCase().split(' ')[0]}`}>
                        {status === 'Suspended' ? (
                            <i className='fa fa-pause-circle' />
                        ) : status === 'Processing' ? (
                            <i className='fa fa-circle-notch fa-spin' />
                        ) : status === 'Progressing' ? (
                            <i className='fa fa-circle-notch fa-spin' />
                        ) : (
                            <i className='fa fa-heart' />
                        )} {status}
                        {(status === 'Processing' || status === 'Progressing') && (
                            <Tooltip content={`${updatedPods} / ${totalPods}`}>
                                <span className='progress-percentage'> ({Math.round(ratio * 100)}%)</span>
                            </Tooltip>
                        )}
                    </span>
                </div>
            </div>
        );
    };

    const totalApps = appSet?.status?.resources?.length || 0;
    const uniqueLabels = getUniqueLabels();
    const resumeCount = Array.from(selectedApps)
        .filter(appKey => {
            const appResource = applications[appKey];
            return appResource?.application && isRolloutSuspended(appResource.application);
        }).length;

    return (
        <SlidingPanel
            isShown={show}
            onClose={() => onClose()}
            header={(
                <div className='top-actions'>
                    <button 
                        className='argo-button argo-button--base' 
                        onClick={handleSyncAll} 
                        disabled={selectedApps.size === 0 || isInAction}
                    >
                        <i className='fa fa-sync-alt'/> Sync {selectedApps.size} / {totalApps}
                    </button>
                    <div className='rollout-actions'>
                        <button className='argo-button argo-button--base rollout-action-main' onClick={() => handleRolloutActionAll('resume')} disabled={resumeCount === 0 || isInAction}>
                            <i className='fa fa-play'/> Resume {resumeCount} / {totalApps}
                        </button>
                        <DropDownMenu 
                            anchor={() => (
                                <button className='argo-button argo-button--base rollout-action-caret top-caret' disabled={resumeCount === 0 || isInAction}>
                                    <i style={{display: 'inline-block'}} className='fa fa-caret-down'/>
                                </button>
                            )}
                            items={[
                                { title: 'Abort', action: () => handleRolloutActionAll('abort') },
                                { title: 'Promote Full', action: () => handleRolloutActionAll('promote-full') },
                                { title: 'Rrestart', action: () => handleRolloutActionAll('restart') },
                                { title: 'Resume', action: () => handleRolloutActionAll('resume') },
                                { title: 'Retry', action: () => handleRolloutActionAll('retry') }
                            ]}
                        />
                    </div>
                    <button 
                        className='argo-button argo-button--base-o' 
                        onClick={async (e) => {
                            e.stopPropagation();
                            await refreshApplications(false);
                        }}
                        disabled={isRefreshing}
                    >
                        <i className={`fa fa-redo ${isRefreshing ? 'fa-spin' : ''}`}/> Refresh
                    </button>
                    <button className='argo-button argo-button--base-o close-button' onClick={() => onClose()}>
                        Cancel
                    </button>
                </div>
            )}>
            <div className='application-set-flyout'>
                <div className='application-set-header'>
                    <div className='header-content'>
                        <div className='header-top'>
                            <div className='title'>
                                {appSet?.metadata?.name}
                            </div>
                            {!loading &&appSet && totalApps > 0 && (() => {
                                const pausedRollouts = appSet.status.resources.filter(resource => {
                                    const appResource = applications[`${resource.namespace}/${resource.name}`];
                                    return appResource?.application && isRolloutSuspended(appResource.application);
                                }).length;

                                const processingRollouts = appSet.status.resources.filter(resource => {
                                    const appResource = applications[`${resource.namespace}/${resource.name}`];
                                    if (!appResource?.application) return false;
                                    const state = getRolloutState(appResource.application, appResource.resourceTree);
                                    return state?.status === 'Processing' || state?.status === 'Progressing';
                                });

                                const totalProgress = processingRollouts.reduce((sum, resource) => {
                                    const appResource = applications[`${resource.namespace}/${resource.name}`];
                                    const state = getRolloutState(appResource.application, appResource.resourceTree);
                                    return {
                                        updatedPods: sum.updatedPods + state?.updatedPods || 0,
                                        totalPods: sum.totalPods + state?.totalPods || 0
                                    };
                                }, {updatedPods: 0, totalPods: 0});

                                const ratio = totalProgress.updatedPods && totalProgress.totalPods ? totalProgress.updatedPods / totalProgress.totalPods : 0;

                                if (pausedRollouts === 0 && processingRollouts.length === 0) {
                                    return null;
                                }

                                return (
                                    <div className='rollout-summary'>
                                        <div className='rollout-summary-content'>
                                            {pausedRollouts > 0 && (
                                                <div className='summary-item'>
                                                    <span className='label'>
                                                        <i className='fa fa-pause-circle' />
                                                        Paused Rollouts
                                                    </span>
                                                    <span className='value'>
                                                        <span className='status-badge paused'>
                                                            {pausedRollouts}
                                                        </span>
                                                    </span>
                                                </div>
                                            )}
                                            {processingRollouts.length > 0 && (
                                                <div className='summary-item'>
                                                    <span className='label'>
                                                        <i className='fa fa-circle-notch fa-spin' />
                                                        Processing Rollouts
                                                    </span>
                                                    <span className='value'>
                                                        <span className='status-badge processing'>
                                                            {processingRollouts.length}
                                                        </span>
                                                        <Tooltip content={`${totalProgress.updatedPods} / ${totalProgress.totalPods} pods updated`}>
                                                            <span className='progress-percentage'>
                                                                ({Math.round(ratio * 100)}%)
                                                            </span>
                                                        </Tooltip>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                        </div>
                        
                        {!loading &&appSet && totalApps > 0 && (
                            <div className='selection-info'>
                                <div className='selection-links label-selection'>
                                    <span className='label-key'>status:</span>
                                    <div className='label-values'>
                                        <span className='selection-link' onClick={selectAll}>all</span>
                                        <span className='separator'>/</span>
                                        <span className='selection-link' onClick={selectOutOfSync}>out of sync</span>
                                        <span className='separator'>/</span>
                                        <span className='selection-link' onClick={selectSuspended}>rollout suspended</span>
                                        <span className='separator'>/</span>
                                        <span className='selection-link' onClick={selectNone}>none</span>
                                    </div>
                                </div>
                                {uniqueLabels.size > 0 && Array.from(uniqueLabels.entries()).map(([key, values]) => (
                                    <div key={key} className='selection-links label-selection'>
                                        <span className='label-key'>{key}:</span>
                                        <div className='label-values'>
                                            {Array.from(values).map((value, i) => (
                                                <React.Fragment key={`${key}=${value}`}>
                                                    {i > 0 && <span className='separator'>/</span>}
                                                    <span 
                                                        className='selection-link' 
                                                        onClick={() => selectByLabel(key, value)}
                                                        title={`Select all applications with ${key}=${value}`}
                                                    >
                                                        {value}
                                                    </span>
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                {loading && fetchProgress.total > 0 && (
                    <div className='fetch-progress-bar-container'>
                        <div
                            className='fetch-progress-bar'
                            style={{
                                width: `${(fetchProgress.completed / fetchProgress.total) * 100}%`,
                                transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                        />
                        <div className='fetch-progress-label'>
                            Loading {Math.round(fetchProgress.completed / fetchProgress.total * 100)}%
                        </div>
                    </div>
                )}
                {!loading && (
                    <div className='application-set-resources'>
                        {appSet?.status?.resources?.slice()
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((resource, i) => {
                            const appResource = applications[`${resource.namespace}/${resource.name}`];
                            if (!appResource) {
                                return null;
                            }
                            const app = appResource.application;
                            const resourceTree = appResource.resourceTree;
                            const isSelected = selectedApps.has(`${resource.namespace}/${resource.name}`);

                            return (
                                <div
                                    key={i}
                                    className={`application-set-resource ${isSelected ? 'application-set-resource--selected' : ''}`}
                                    onClick={() => toggleSelection(`${resource.namespace}/${resource.name}`)}
                                >
                                    <div className='title'>
                                        <i className='argo-icon argo-icon-application' /> 
                                        <a 
                                            href={`/applications/${resource.namespace}/${resource.name}`}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            onClick={e => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                window.open(`/applications/${resource.namespace}/${resource.name}`, '_blank');
                                            }}
                                        >
                                            {resource.name}
                                            <i className='fa fa-external-link-alt' style={{marginLeft: '4px', fontSize: '0.8em'}}/>
                                        </a>
                                    </div>
                                    <div className='row'>
                                        <div className='label'>Sync Status:</div>
                                        <div className='value'>
                                            <span className={`status status--${app.status.sync.status.toLowerCase()}`}>
                                                {app.status.sync.status === 'OutOfSync' ? (
                                                    <i className='fa fa-arrow-alt-circle-up' />
                                                ) : app.status.sync.status === 'Unknown' ? (
                                                    <i className='fa fa-question-circle' />
                                                ) : (
                                                    <i className='fa fa-check-circle' />
                                                )} {app.status.sync.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className='row'>
                                        <div className='label'>App Status:</div>
                                        <div className='value'>
                                            <span className={`status status--${app.status.health.status.toLowerCase()}`}>
                                                {app.status.health.status === 'Degraded' ? (
                                                    <i className='fa fa-heart-broken' />
                                                ) : app.status.health.status === 'Missing' ? (
                                                    <i className='fa fa-ghost' />
                                                ) : app.status.health.status === 'Processing' ? (
                                                    <i className='fa fa-circle-notch fa-spin' />
                                                ) : app.status.health.status === 'Progressing' ? (
                                                    <i className='fa fa-circle-notch fa-spin' />
                                                ) : app.status.health.status === 'Suspended' ? (
                                                    <i className='fa fa-pause-circle' />
                                                ) : app.status.health.status === 'Unknown' ? (
                                                    <i className='fa fa-question-circle' />
                                                ) : (
                                                    <i className='fa fa-heart' />
                                                )} {app.status.health.status}
                                            </span>
                                        </div>
                                    </div>
                                    {renderRolloutStatus(app, resourceTree)}
                                    <div className='row'>
                                        <div className='label'>Destination:</div>
                                        <div className='value'>
                                            <span className='label-pair'>
                                                <i className='fa fa-server' /> {app.spec.destination.name || '(default)'}
                                            </span>
                                        </div>
                                    </div>
                                    {app.metadata.labels && Object.keys(app.metadata.labels).length > 0 && (
                                        <div className='row'>
                                            <div className='label'>Labels:</div>
                                            <div className='value'>
                                                {Object.entries(app.metadata.labels).map(([key, value], i) => (
                                                    <span key={i} className='label-pair'>
                                                        {key}={value}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className='row'>
                                        <div className='label'>Last Sync:</div>
                                        <div className='value'>
                                            {app.status?.operationState?.finishedAt && (
                                                <>{moment(app.status.operationState.finishedAt).format('MMM. D, YY HH:mm')} ({moment(app.status.operationState.finishedAt).fromNow()})</>
                                            )}
                                        </div>
                                    </div>
                                    <div className='actions'>
                                        <button 
                                            className='argo-button argo-button--base-o' 
                                            disabled={isInAction}
                                            onClick={async (e) => handleSync(app, e)}>
                                            <i className='fa fa-sync'/> Sync
                                        </button>
                                        {isRolloutSuspended(app) && (
                                            <div className='rollout-actions'>
                                                <button className='argo-button argo-button--base-o rollout-action-main' onClick={(e) => handleRolloutAction('resume', app, e)} disabled={isInAction}>
                                                    <i className='fa fa-play'/> 
                                                    Resume 
                                                </button>
                                                <DropDownMenu 
                                                    anchor={() => (
                                                        <button className='argo-button argo-button--base-o rollout-action-caret' disabled={isInAction}>
                                                            <i style={{display: 'inline-block'}} className='fa fa-caret-down'/>
                                                        </button>
                                                    )}
                                                    items={[
                                                        { title: 'Abort', action: () => handleRolloutAction('abort', app) },
                                                        { title: 'Promote Full', action: () => handleRolloutAction('promote-full', app) },
                                                        { title: 'Restart', action: () => handleRolloutAction('restart', app) },
                                                        { title: 'Resume', action: () => handleRolloutAction('resume', app) },
                                                        { title: 'Retry', action: () => handleRolloutAction('retry', app) }
                                                    ]}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {notification && (
                <NotificationBar
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification(null)}
                />
            )}
        </SlidingPanel>
    );
};