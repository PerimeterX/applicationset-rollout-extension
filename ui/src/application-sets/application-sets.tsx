import * as React from 'react';
import * as moment from 'moment';

import {KeybindingProvider} from '../shared-components/keypress';
import {DataLoader} from '../shared-components/data-loader';
import {ApplicationSet, ApplicationSource} from '../models/application-set-models';
import {listApplicationSets} from '../service/application-set-service';
import {Tooltip} from '../shared-components/tooltip';
import {Paginate} from '../shared-components/paginate/paginate';
import {ApplicationSetScreen} from './application-set-screen';
import {NotificationBar, Notification} from '../shared-components/notification-bar/notification-bar';
import {NavigationManager} from '../shared-components/navigation';
import {SearchBar} from '../shared-components/search-bar';

import './application-sets.scss';

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
            case 'Progressing':
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

export const ApplicationSets = () => {
    const navigationManager = new NavigationManager();
    const urlParams = new URLSearchParams(navigationManager.history.location.search);
    const [showFavoritesOnly, setShowFavoritesOnly] = React.useState(urlParams.get('favorites') === 'true');
    const [applicationSets, setApplicationSets] = React.useState<ApplicationSet[]>([]);
    const [notification, setNotification] = React.useState<Notification | null>(null);
    const [search, setSearch] = React.useState(urlParams.get('search') || '');
    const [favorites, setFavorites] = React.useState<Set<string>>(getFavorites());
    const [selectedAppSet, setSelectedAppSet] = React.useState<ApplicationSet | null>(null);
    const [isClearingSelection, setIsClearingSelection] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const toggleShowFavoritesOnly = (value: boolean) => {
        setShowFavoritesOnly(value);
        navigationManager.goto('.', { search: search, favorites: value.toString() }, { replace: true });
    };

    const loadApplicationSets = async () => {
        try {
            setIsRefreshing(true);
            const appSets = await listApplicationSets();
            setApplicationSets(appSets);
        } catch (e) {
            setNotification({
                message: `Failed to load application sets: ${e}`,
                type: 'error'
            });
        } finally {
            setIsRefreshing(false);
        }
    };

    React.useEffect(() => {
        loadApplicationSets();
        const interval = setInterval(loadApplicationSets, 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const filteredAppSets = (search: string) => {
        if (!search) {
            return applicationSets;
        }
        return applicationSets.filter(appSet => appSet.metadata.name.toLowerCase().includes(search.toLowerCase()));
    };

    // Handle URL state for selectedAppSet
    React.useEffect(() => {
        const urlParams = new URLSearchParams(navigationManager.history.location.search);
        const currentParams = Object.fromEntries(urlParams.entries());
        const selectedAppSetName = urlParams.get('selected');

        // Only initialize from URL if we don't have a selected app set and we're not intentionally clearing it
        if (!selectedAppSet && selectedAppSetName && !isClearingSelection) {
            const appSet = applicationSets.find(app => app.metadata.name === selectedAppSetName);
            if (appSet) {
                setSelectedAppSet(appSet);
            }
        } 
        // Only update URL if we have a selected app set or if we're explicitly clearing it
        else if (selectedAppSet || currentParams.selected) {
            if (selectedAppSet) {
                currentParams.selected = selectedAppSet.metadata.name;
            } else {
                currentParams.selected = '';
            }
            navigationManager.goto('.', currentParams, {replace: true});
        }
    }, [selectedAppSet, applicationSets, isClearingSelection]);

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

    const searchAppSets = filteredAppSets(search);
    const filteredApplicationSets = showFavoritesOnly
        ? searchAppSets.filter(app => favorites.has(app.metadata.name))
        : searchAppSets;

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
            </div>
        );
    };

    return (
        <KeybindingProvider>
            <div className='application-sets'>
                <div className='application-sets__content'>
                    <DataLoader load={() => Promise.resolve(applicationSets)} loadingRenderer={() => <div>Loading...</div>}>
                        {() => (
                            <>
                                {selectedAppSet && (
                                    <ApplicationSetScreen
                                    appSet={selectedAppSet}
                                    onClose={() => {
                                        setIsClearingSelection(true);
                                        setSelectedAppSet(null);
                                        setTimeout(() => setIsClearingSelection(false), 100);
                                    }}
                                    />
                                )}
                                {!selectedAppSet && (
                                    <>
                                        <div className='top-bar row flex-top-bar'>
                                            <div className='flex-top-bar__actions'>
                                                <div className='application-set-tiles__header'>
                                                    <button
                                                        className='argo-button argo-button--base'
                                                        style={{marginRight: '8px'}}
                                                        disabled={isRefreshing}
                                                        onClick={() => loadApplicationSets()}>
                                                        <i className='fa fa-sync-alt' style={{marginRight: '4px'}} />
                                                        Refresh
                                                    </button>
                                                    <button
                                                        className={`argo-button argo-button--base-o favorites-toggle ${showFavoritesOnly ? 'favorites-toggle--active' : ''}`}
                                                        onClick={() => toggleShowFavoritesOnly(!showFavoritesOnly)}>
                                                        <i className='fa fa-star' />
                                                    </button>
                                                </div>
                                                <SearchBar 
                                                    content={search} 
                                                    values={applicationSets.map(appSet => appSet.metadata.name)} 
                                                    onChange={(value) => {
                                                        setSearch(value);
                                                        navigationManager.goto('.', {search: value, favorites: showFavoritesOnly.toString()}, {replace: true});
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className='flex-top-bar__padder' />
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
                                    </>
                                )}
                                {notification && (
                                    <NotificationBar
                                        message={notification.message}
                                        type={notification.type}
                                        onClose={() => setNotification(null)}
                                        requireApproval={notification.requireApproval}
                                    />
                                )}
                            </>
                        )}
                    </DataLoader>
                </div>
            </div>
            {notification && (
                <NotificationBar
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification(null)}
                    requireApproval={notification.requireApproval}
                />
            )}
        </KeybindingProvider>
    );
};
