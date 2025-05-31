import * as React from 'react';
import * as moment from 'moment';
import {useEffect} from 'react';

import {KeybindingProvider} from '../shared-components/keypress';
import {DataLoader} from '../shared-components/data-loader';
import {Paginate} from '../shared-components/paginate/paginate';
import {NotificationBar, Notification} from '../shared-components/notification-bar/notification-bar';
import {NavigationManager} from '../shared-components/navigation';
import {DebugPod} from '../models/pod-models';
import {getDebugPods} from '../service/debug-pod-service';
import {SearchBar} from '../shared-components/search-bar';
import {DebugPodFlyout} from './debug-pod-flyout';

import './debug-pods.scss';

const ICONS = {
    waiting: 'clock',
    terminated: 'times-circle',
    unknown: 'question-circle',
    pending: 'clock',
    running: 'play-circle',
    succeeded: 'circle',
    failed: 'times-circle',
    terminating: 'circle'
};

export const DebugPods = () => {
    const navigationManager = new NavigationManager();
    const urlParams = new URLSearchParams(navigationManager.history.location.search);
    const [debugPods, setDebugPods] = React.useState<DebugPod[]>([]);
    const [notification, setNotification] = React.useState<Notification | null>(null);
    const [search, setSearch] = React.useState(urlParams.get('search') || '');
    const [isLoading, setIsLoading] = React.useState<boolean>(false);
    const [selectedPod, setSelectedPod] = React.useState<DebugPod | null>(null);
    const [isClearingSelection, setIsClearingSelection] = React.useState(false);

    const loadDebugPods = async () => {
        try {
            setIsLoading(true);
            const debugPods = await getDebugPods();
            setDebugPods(debugPods);
        } catch (e) {
            setNotification({
                message: `Failed to load debug pods: ${e}`,
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDebugPods();
        const interval = setInterval(loadDebugPods, 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Handle URL state for selectedAppSet
    useEffect(() => {
        const urlParams = new URLSearchParams(navigationManager.history.location.search);
        const currentParams = Object.fromEntries(urlParams.entries());
        const selectedPodName = urlParams.get('selected');

        // Only initialize from URL if we don't have a selected pod and we're not intentionally clearing it
        if (!selectedPod && selectedPodName && !isClearingSelection) {
            const pod = debugPods.find(pod => pod.pod.metadata.name === selectedPodName);
            if (pod) {
                setSelectedPod(pod);
            }
        } 
        // Only update URL if we have a selected pod or if we're explicitly clearing it
        else if (selectedPod || currentParams.selected) {
            if (selectedPod) {
                currentParams.selected = selectedPod.pod.metadata.name;
            } else {
                currentParams.selected = '';
            }
            navigationManager.goto('.', currentParams, {replace: true});
        }
    }, [selectedPod, debugPods, isClearingSelection]);

    const filteredDebugPods = search ? debugPods.filter(pod => pod.pod.metadata.name.toLowerCase().includes(search.toLowerCase())) : debugPods;

    return (
        <KeybindingProvider>
            <div className='debug-pods'>
                <div className='debug-pods__content'>
                    <DataLoader load={() => Promise.resolve(debugPods)} loadingRenderer={() => <div>Loading...</div>}>
                        {() => (
                            <>
                                <div className='top-bar row flex-top-bar'>
                                    <div className='flex-top-bar__actions'>
                                        <button
                                            className="argo-button argo-button--base"
                                            onClick={loadDebugPods}
                                            disabled={isLoading}
                                            title="Refresh debug pods"
                                        >
                                            <i className={`fa fa-refresh ${isLoading ? 'fa-spin' : ''}`} style={{marginRight: 8, color: 'white'}} />
                                            Refresh
                                        </button>
                                        <SearchBar 
                                            content={search} 
                                            values={debugPods.map(pod => pod.pod.metadata.name)} 
                                            onChange={(value) => {
                                                setSearch(value);
                                                navigationManager.goto('.', {search: value}, {replace: true});
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className='flex-top-bar__padder' />
                                <DataLoader load={() => Promise.resolve(debugPods)} loadingRenderer={() => <div>Loading...</div>}>
                                    {() => (
                                        <div className='debug-pods__list__wrapper'>
                                            <Paginate
                                                preferencesKey='debug-pods-list'
                                                data={filteredDebugPods || []}
                                                sortOptions={[
                                                    {title: 'Name', compare: (a, b) => a.pod.metadata.name.localeCompare(b.pod.metadata.name)}
                                                ]}>
                                                {data => (
                                                    <div className='debug-pods__list'>
                                                        {data.map(pod => {
                                                            const createdAtDate = moment(pod.pod.metadata.creationTimestamp).format('MMM. D, YY HH:mm');
                                                            const createdAtAgo = moment(pod.pod.metadata.creationTimestamp).fromNow();
                                                            const createdAt = `${createdAtDate} (${createdAtAgo})`;
                                                    
                                                            return (
                                                                <div
                                                                    key={`${pod.pod.metadata.namespace}/${pod.pod.metadata.name}`}
                                                                    className={`debug-pods__list__item status--${(pod.pod.status?.phase || '').toLowerCase()}`}
                                                                    onClick={() => setSelectedPod(pod)}
                                                                    style={{cursor: 'pointer'}}>
                                                                    <div className='debug-pods__list__details'>
                                                                        <div className='title'>
                                                                            <i className='fa fa-bug' />
                                                                            {pod.pod.metadata.name}
                                                                        </div>
                                                                        <div className='row'>
                                                                            <div className='label'>Cluster:</div>
                                                                            <div className='value'>{pod.cluster}</div>
                                                                        </div>
                                                                        <div className='row'>
                                                                            <div className='label'>Namespace:</div>
                                                                            <div className='value'>{pod.pod.metadata.namespace}</div>
                                                                        </div>
                                                                        <div className='row'>
                                                                            <div className='label'>Created At:</div>
                                                                            <div className='value'>{createdAt}</div>
                                                                        </div>
                                                                        <div className='row'>
                                                                            <div className='label'>Phase:</div>
                                                                            <div className='value'>
                                                                                {(() => {
                                                                                    const icon = ICONS[pod.pod.status?.phase?.toLowerCase()] || 'question-circle';
                                                                                    return (
                                                                                        <span className={`status status--${(pod.pod.status?.phase || '').toLowerCase()}`}>
                                                                                            <i className={`fa fa-${icon}`} />
                                                                                            <span>{pod.pod.status?.phase || '-'}</span>
                                                                                        </span>
                                                                                    );
                                                                                })()}
                                                                            </div>
                                                                        </div>
                                                                        <div className='row'>
                                                                            <div className='label'>Container State:</div>
                                                                            <div className='value'>
                                                                                {pod.pod.status?.containerStatuses && pod.pod.status.containerStatuses.length > 0 ? (
                                                                                    (() => {
                                                                                        // Count states
                                                                                        const stateCounts: {[key: string]: number} = {};
                                                                                        pod.pod.status.containerStatuses.forEach(cs => {
                                                                                            let state = 'Unknown';
                                                                                            if (cs.state?.running) state = 'Running';
                                                                                            else if (cs.state?.waiting) state = 'Waiting';
                                                                                            else if (cs.state?.terminated) state = 'Terminated';
                                                                                            stateCounts[state] = (stateCounts[state] || 0) + 1;
                                                                                        });

                                                                                        // Render each state with count
                                                                                        return Object.entries(stateCounts).map(([state, count]) => (
                                                                                            <span key={state} className={`status status--${state.toLowerCase()}`}>
                                                                                                <i className={`fa fa-${ICONS[state.toLowerCase()] || 'question-circle'}`} />
                                                                                                {state} ({count})
                                                                                            </span>
                                                                                        ));
                                                                                    })()
                                                                                ) : '-'}
                                                                            </div>
                                                                        </div>
                                                                        <div className='row'>
                                                                            <div className='label'>Labels:</div>
                                                                            <div className='value'>
                                                                                {pod.pod.metadata.labels
                                                                                    ? Object.entries(pod.pod.metadata.labels).map(([key, value]) => (
                                                                                        <span key={key} className='value-label label'>
                                                                                            {key}={value}
                                                                                        </span>
                                                                                    ))
                                                                                    : '-'}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </Paginate>
                                        </div>
                                    )}
                                </DataLoader>
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
                <DebugPodFlyout 
                    selectedPod={selectedPod} 
                    setNotification={setNotification}
                    onClose={() => {
                        setIsClearingSelection(true);
                        setSelectedPod(null);
                        setTimeout(() => setIsClearingSelection(false), 100);
                    }}
                />
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
