import * as React from 'react';

import * as moment from 'moment';
import {DataLoader, Tooltip} from 'argo-ui';
import classNames from 'classnames';

import {ApplicationSet, ApplicationSource} from './models';
import {Paginate} from '../paginate/paginate';
import {getApplication} from './service';
import {ApplicationSetFlyout} from './application-set-flyout';
import {NotificationBar, Notification} from './notification-bar';
import './application-set-tiles.scss';

export interface ApplicationSetTilesProps {
    applicationSets: ApplicationSet[];
    showFavoritesOnly: boolean;
}

const getStatusInfo = (appSet: ApplicationSet) => {
    const resources = appSet.status?.resources || [];
    
    // Count health statuses
    const healthCounts = resources.reduce((acc, r) => {
        acc[r.health.status] = (acc[r.health.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Count sync statuses
    const syncCounts = resources.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Convert health counts to status objects
    const healthStatuses = Object.entries(healthCounts).map(([health, count]) => {
        switch (health) {
            case 'Healthy':
                return {
                    icon: 'fa fa-heart',
                    className: 'status--healthy',
                    text: `Healthy (${count})`
                };
            case 'Degraded':
                return {
                    icon: 'fa fa-heart-broken',
                    className: 'status--degraded',
                    text: `Degraded (${count})`
                };
            case 'Missing':
                return {
                    icon: 'fa fa-ghost',
                    className: 'status--missing',
                    text: `Missing (${count})`
                };
            case 'Processing':
                return {
                    icon: 'fa fa-circle-notch fa-spin',
                    className: 'status--processing',
                    text: `Processing (${count})`
                };
            case 'Suspended':
                return {
                    icon: 'fa fa-pause-circle',
                    className: 'status--suspended',
                    text: `Suspended (${count})`
                };
            default:
                return {
                    icon: 'fa fa-question-circle',
                    className: 'status--unknown',
                    text: `Unknown (${count})`
                };
        }
    });

    // Convert sync counts to status objects
    const syncStatuses = Object.entries(syncCounts).map(([status, count]) => {
        switch (status) {
            case 'OutOfSync':
                return {
                    icon: 'fa fa-arrow-alt-circle-up',
                    className: 'status--out-of-sync',
                    text: `OutOfSync (${count})`
                };
            case 'Unknown':
                return {
                    icon: 'fa fa-circle-notch fa-spin',
                    className: 'status--unknown',
                    text: `Unknown (${count})`
                };
            default:
                return {
                    icon: 'fa fa-heart',
                    className: 'status--synced',
                    text: `Synced (${count})`
                };
        }
    });

    return { healthStatuses, syncStatuses };
};

const getTileStatusClass = (appSet: ApplicationSet) => {
    const resources = appSet.status?.resources || [];
    
    // Check statuses in order of precedence
    if (resources.some(r => r.health.status === 'Degraded')) {
        return 'status--degraded';
    }
    if (resources.some(r => r.health.status === 'Missing' || r.status === 'OutOfSync')) {
        return 'status--warning';
    }
    if (resources.some(r => r.health.status === 'Processing')) {
        return 'status--processing';
    }
    if (resources.some(r => r.health.status === 'Suspended')) {
        return 'status--suspended';
    }
    if (resources.some(r => r.health.status === 'Unknown' || r.status === 'Unknown')) {
        return 'status--unknown';
    }
    return 'status--healthy';
};

const FAVORITE_STORAGE_KEY = 'application-sets.favorites';

const getFavorites = (): Set<string> => {
    const favoritesStr = localStorage.getItem(FAVORITE_STORAGE_KEY) || '[]';
    return new Set(JSON.parse(favoritesStr));
};

const saveFavorites = (favorites: Set<string>) => {
    localStorage.setItem(FAVORITE_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
};

export const ApplicationSetTiles = ({applicationSets, showFavoritesOnly}: ApplicationSetTilesProps) => {
    const [favorites, setFavorites] = React.useState<Set<string>>(getFavorites());
    const [isRefreshing, setIsRefreshing] = React.useState<{[key: string]: boolean}>({});
    const [selectedAppSet, setSelectedAppSet] = React.useState<ApplicationSet | null>(null);
    const [notification, setNotification] = React.useState<Notification | null>(null);

    const refreshApplications = async (appSet: ApplicationSet) => {
        if (!appSet.status?.resources) {
            return;
        }

        setIsRefreshing(prev => ({...prev, [appSet.metadata.name]: true}));
        
        try {
            const refreshPromises = appSet.status.resources.map(async resource => {
                try {
                    await getApplication(resource.name, resource.namespace, 'normal');
                    return true;
                } catch (e) {
                    setNotification({message: `Failed to refresh application ${resource.name}`, type: 'error'});
                    return false;
                }
            });

            const results = await Promise.all(refreshPromises);
            const successCount = results.filter(success => success).length;
            
            setNotification({
                message: `Successfully refreshed ${successCount} of ${appSet.status.resources.length} applications`,
                type: 'success'
            });
        } finally {
            setIsRefreshing(prev => ({...prev, [appSet.metadata.name]: false}));
        }
    };

    const toggleFavorite = (appSetName: string) => {
        const newFavorites = new Set(favorites);
        if (newFavorites.has(appSetName)) {
            newFavorites.delete(appSetName);
        } else {
            newFavorites.add(appSetName);
        }
        setFavorites(newFavorites);
        saveFavorites(newFavorites);
    };

    const filteredApplicationSets = showFavoritesOnly
        ? applicationSets.filter(app => favorites.has(app.metadata.name))
        : applicationSets;

    const renderAppSet = (appSet: ApplicationSet) => {
        const statusInfo = getStatusInfo(appSet);
        const createdAtDate = moment(appSet.metadata.creationTimestamp).format('MMM. D, YY HH:mm');
        const createdAtAgo = moment(appSet.metadata.creationTimestamp).fromNow();
        const createdAt = `${createdAtDate} (${createdAtAgo})`;
        const source = (appSet.spec?.template?.spec?.source || {}) as ApplicationSource;
        const tileStatusClass = getTileStatusClass(appSet);
        const isFavorite = favorites.has(appSet.metadata.name);

        return (
            <div
                key={`${appSet.metadata.namespace}/${appSet.metadata.name}`}
                className={`application-set-tiles__item ${tileStatusClass}`}
                onClick={() => setSelectedAppSet(appSet)}
                style={{cursor: 'pointer'}}>
                <button
                    className={`favorite-button ${isFavorite ? 'favorite-button--active' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(appSet.metadata.name);
                    }}>
                    <i className={isFavorite ? 'fa fa-star' : 'far fa-star'} />
                </button>
                <div className='title'>
                    <i className='fa fa-code-branch' />
                    {appSet.metadata.name}
                </div>

                <div className='row'>
                    <div className='label'>Applications:</div>
                    <div className='value'>{appSet.status?.resources?.length || 0}</div>
                </div>

                <div className='row'>
                    <div className='label'>Health Status:</div>
                    <div className='value'>
                        {statusInfo.healthStatuses.map((status, i) => (
                            <span key={i} className={`status ${status.className}`}>
                                <i className={`fa ${status.icon}`} />
                                {status.text}
                            </span>
                        ))}
                    </div>
                </div>

                <div className='row'>
                    <div className='label'>Sync Status:</div>
                    <div className='value'>
                        {statusInfo.syncStatuses.map((status, i) => (
                            <span key={i} className={`status ${status.className}`}>
                                <i className={`fa ${status.icon}`} />
                                {status.text}
                            </span>
                        ))}
                    </div>
                </div>

                {source.repoURL && (
                    <div className='row'>
                        <div className='label'>Repository:</div>
                        <div className='value'>
                            <Tooltip content={source.repoURL}>
                                <a 
                                    className='repository-link' 
                                    href={source.repoURL} 
                                    target='_blank' 
                                    rel='noopener noreferrer'
                                    onClick={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        window.open(source.repoURL, '_blank');
                                    }}>
                                    {source.repoURL?.substring(source.repoURL.lastIndexOf('/') + 1) || source.repoURL}
                                </a>
                            </Tooltip>
                        </div>
                    </div>
                )}

                {source.targetRevision && (
                    <div className='row'>
                        <div className='label'>Target Revision:</div>
                        <div className='value'>
                            <span className='value-label'>
                                {source.repoURL ? (
                                    <Tooltip content={`${source.repoURL}/tree/${source.targetRevision}`}>
                                        <a 
                                            href={`${source.repoURL}/tree/${source.targetRevision}`}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            onClick={e => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                window.open(`${source.repoURL}/tree/${source.targetRevision}`, '_blank');
                                            }}>
                                            {source.targetRevision}
                                        </a>
                                    </Tooltip>
                                ) : (
                                    source.targetRevision
                                )}
                            </span>
                        </div>
                    </div>
                )}

                {source.path && (
                    <div className='row'>
                        <div className='label'>Path:</div>
                        <div className='value'>
                            <span className='value-label'>
                                {source.repoURL && source.targetRevision ? (
                                    <Tooltip content={`${source.repoURL}/tree/${source.targetRevision}/${source.path}`}>
                                        <a 
                                            href={`${source.repoURL}/tree/${source.targetRevision}/${source.path}`}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            onClick={e => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                window.open(`${source.repoURL}/tree/${source.targetRevision}/${source.path}`, '_blank');
                                            }}>
                                            {source.path}
                                        </a>
                                    </Tooltip>
                                ) : (
                                    source.path
                                )}
                            </span>
                        </div>
                    </div>
                )}

                <div className='row'>
                    <div className='label'>Created:</div>
                    <div className='value'>{createdAt}</div>
                </div>

                <div className='actions'>
                    <button 
                        className='argo-button argo-button--base'
                        onClick={(e) => {
                            e.stopPropagation();
                            refreshApplications(appSet);
                        }}
                        disabled={!appSet.status?.resources?.length || isRefreshing[appSet.metadata.name]}
                    >
                        <i className={classNames('fa fa-redo', {'fa-spin': isRefreshing[appSet.metadata.name]})} /> 
                        {isRefreshing[appSet.metadata.name] ? 'Refreshing...' : 'Refresh Applications'}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            <DataLoader load={() => Promise.resolve(applicationSets)} loadingRenderer={() => <div>Loading...</div>}>
                {() => (
                    <div className='application-set-tiles__wrapper'>
                        <Paginate
                            preferencesKey='application-sets-list'
                            data={filteredApplicationSets || []}
                            sortOptions={[
                                {title: 'Name', compare: (a, b) => a.metadata.name.localeCompare(b.metadata.name)},
                                {
                                    title: 'Created At',
                                    compare: (b, a) => a.metadata.creationTimestamp.localeCompare(b.metadata.creationTimestamp)
                                }
                            ]}>
                            {data => (
                                <div className='application-set-tiles'>
                                    {data.map(appSet => renderAppSet(appSet))}
                                </div>
                            )}
                        </Paginate>
                    </div>
                )}
            </DataLoader>
            <ApplicationSetFlyout
                show={selectedAppSet !== null}
                appSet={selectedAppSet}
                onClose={() => setSelectedAppSet(null)}
            />
            {notification && (
                <NotificationBar
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification(null)}
                />
            )}
        </>
    );
}; 