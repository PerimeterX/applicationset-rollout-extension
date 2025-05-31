import * as React from 'react';
import {useCallback, useState} from 'react';
import {DebugPod} from '../models/pod-models';
import {SlidingPanel} from '../shared-components/sliding-panel/sliding-panel';
import {Tabs} from '../shared-components/tabs/tabs';
import {deleteDebugPod, getContainerLogs} from '../service/debug-pod-service';
import {Notification} from '../shared-components/notification-bar/notification-bar';
import {DebugPodManifest} from './debug-pod-manifest';
import {DebugPodConnectFlyout} from './debug-pod-connect-flyout';
import {PrettyLogs} from '../pretty-logs/pretty-logs-tab';
import {DebugPodEventsTab} from './debug-pod-events-tab';

import './debug-pod-flyout.scss';
import { DebugPodUploadTab } from './debug-pod-upload-tab';

interface DebugPodFlyoutProps {
    selectedPod: DebugPod;
    setNotification: (notification: Notification | null) => void;
    onClose: () => void;
}

export const DebugPodFlyout = ({ selectedPod, onClose, setNotification }: DebugPodFlyoutProps) => {
    const [activeTab, setActiveTab] = useState('events');
    const [isDeleting, setIsDeleting] = useState(false);
    const [showConnectFlyout, setShowConnectFlyout] = useState(false);

    const handleDelete = async () => {
        if (!isDeleting && window.confirm('Are you sure you want to delete this debug pod?')) {
            setIsDeleting(true);
            try {
                await deleteDebugPod(selectedPod.cluster, selectedPod.pod.metadata.name);
                setNotification({
                    message: 'Debug pod deleted successfully',
                    type: 'success'
                });
                onClose();
            } catch (e) {
                setNotification({
                    message: `Failed to delete debug pod: ${e}`,
                    type: 'error',
                    requireApproval: true
                });
            } finally {
                setIsDeleting(false);
            }
        }
    }

    const handleConnect = () => {
        setShowConnectFlyout(true);
    }

    return (
        <SlidingPanel
            isShown={!!selectedPod}
            onClose={onClose}
        >
            <div className="debug-pod-flyout__header">
                <div className="icon">
                    <i className='fa fa-bug' />
                </div>
                <div className="title">{selectedPod?.pod.metadata.name}</div>
                <div className="debug-pod-flyout__header-buttons">
                    <button onClick={handleDelete} className='argo-button argo-button--base' disabled={isDeleting}>
                        <i className='fa fa-trash' />{' '}
                        <span className='show-for-large'>
                            {isDeleting ? 'DELETING...' : 'DELETE'}
                        </span>
                    </button>
                    <button onClick={handleConnect} className='argo-button argo-button--base'>
                        <i className='fa fa-terminal' />{' '}
                        <span className='show-for-large'>
                            CONNECT
                        </span>
                    </button>
                </div>
            </div>
            {(selectedPod && (
                <div>
                    <Tabs
                        navTransparent={true}
                        tabs={[
                            {
                                title: 'EVENTS',
                                icon: 'fa fa-calendar-alt',
                                key: 'events',
                                content: (
                                    <DebugPodEventsTab cluster={selectedPod.cluster} namespace={selectedPod.pod.metadata.namespace} pod={selectedPod.pod.metadata.name} />
                                )
                            },
                            {
                                title: 'MANIFEST',
                                icon: 'fa fa-code',
                                key: 'manifest',
                                content: (
                                    <DebugPodManifest selectedPod={selectedPod} />
                                )
                            },
                            {
                                key: 'logs',
                                icon: 'fa fa-binoculars',
                                title: 'PRETTY LOGS',
                                content: (
                                    <LogsTab debugPod={selectedPod} />
                                )
                            },
                            {
                                key: 'upload',
                                icon: 'fa fa-upload',
                                title: 'UPLOAD',
                                content: (
                                    <DebugPodUploadTab selectedPod={selectedPod} setNotification={setNotification} />
                                )
                            }
                        ]}
                        selectedTabKey={activeTab}
                        onTabSelected={selected => setActiveTab(selected)}
                    />
                </div>
            ))}
            <DebugPodConnectFlyout
                show={showConnectFlyout}
                selectedPod={selectedPod}
                onClose={() => setShowConnectFlyout(false)}
            />
        </SlidingPanel>
    );
};

const LogsTab = ({debugPod}: {debugPod: DebugPod}) => {
    const getLogs = useCallback((container: string) => {
        return getContainerLogs(debugPod.cluster, debugPod.pod.metadata.namespace, debugPod.pod.metadata.name, container);
    }, [debugPod]);

    return <PrettyLogs resourceSpec={debugPod.pod.spec} getLogs={getLogs} />;
}