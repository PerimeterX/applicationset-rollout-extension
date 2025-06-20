import * as React from 'react';
import {useEffect, useMemo, useState} from 'react';
import {YamlEditor} from '../shared-components/yaml-editor/yaml-editor';
import {Pod} from '../models/pod-models';
import {Application, State} from '../models/application-models';
import {getPod, createDebugPod, getDebugPods} from '../service/debug-pod-service';
import {Tooltip} from '../shared-components/tooltip';
import {NotificationBar, Notification} from '../shared-components/notification-bar/notification-bar';
import {DebugPodEventsTab, DebugPodEventsTabProps} from '../debug-pods/debug-pod-events-tab';
import './debug-pod-tab.scss';
import { Loader } from '../shared-components/loader/loader';

export const DebugPodTab: React.FC<{resource: State, application: Application}> = (props: {resource: State, application: Application}) => {
    const [sourcePod, setSourcePod] = useState<Pod | null>(null);
    const [debugContainers, setDebugContainers] = useState<Set<string>>(new Set());
    const [retainLiveness, setRetainLiveness] = useState<boolean>(false);
    const [retainReadiness, setRetainReadiness] = useState<boolean>(false);
    const [retainStartupProbe, setRetainStartupProbe] = useState<boolean>(false);
    const [retainLabels, setRetainLabels] = useState<boolean>(true);
    const [customYaml, setCustomYaml] = useState<any>(null);
    const [notification, setNotification] = useState<Notification | null>(null);
    const [createdPod, setCreatedPod] = useState<DebugPodEventsTabProps | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isYamlEditing, setIsYamlEditing] = useState<boolean>(false);

    useEffect(() => {
        if (sourcePod) {
            setDebugContainers(new Set(sourcePod.spec.containers.length > 0 ? [sourcePod.spec.containers[0].name] : []));
            setRetainLabels(true);
            setRetainReadiness(true);
            setRetainLiveness(false);
            setRetainStartupProbe(false);
            setCustomYaml(null);
        }
    }, [sourcePod]);

    const targetPod = useMemo(() => {
        if (!sourcePod) {
            return null;
        }

        if (customYaml) {
            return customYaml;
        }
        
        // create a deep copy of the source pod
        const targetPod = JSON.parse(JSON.stringify(sourcePod));

        // remove the liveness probe
        if (!retainLiveness) {
            targetPod.spec.containers.forEach(container => {
                delete container.livenessProbe;
            });
        }

        // remove the readiness probe
        if (!retainReadiness) {
            targetPod.spec.containers.forEach(container => {
                delete container.readinessProbe;
            });
        }

        // remove the startup probe
        if (!retainStartupProbe) {
            targetPod.spec.containers.forEach(container => {
                delete container.startupProbe;
            });
        }

        // remove the labels
        if (!retainLabels) {
            targetPod.metadata.labels = undefined;
        }

        for (const container of targetPod.spec.containers) {
            if (debugContainers.has(container.name)) {
                container.command = ['sleep', 'infinity'];
            }
        }

        return targetPod;
    }, [sourcePod, debugContainers, retainLiveness, retainLabels, customYaml]);

    useEffect(() => {
        setIsLoading(true);
        getPod(
            props.application.metadata.name,
            props.resource.metadata.name,
            'argocd',
            props.resource.metadata.namespace,
            props.resource.metadata.name,
        ).then(pod => {
            delete pod.metadata['managedFields'];
            setSourcePod(pod);
            setIsLoading(false);
        });
    }, [props.resource.metadata.name, props.resource.metadata.namespace, props.application.metadata.name]);

    const isDagerousPod = (targetPod: any, sourcePod: any) => {
        if (!targetPod) {
            return false;
        }

        const hasLabels = targetPod.metadata.labels && Object.keys(targetPod.metadata.labels).length > 0;
        const hasReadinessProbe = targetPod.spec.containers.some(container => container.readinessProbe);
        const sourcePodHasReadinessProbe = sourcePod.spec.containers.some(container => container.readinessProbe);
        
        return hasLabels && !hasReadinessProbe && sourcePodHasReadinessProbe;
    }

    const handleCreateDebugPod = async () => {
        if (isDagerousPod(targetPod, sourcePod)) {
            if (!window.confirm('You are about to create a pod with labels and without readiness probes. If this pod has a service, it will receive traffic even though it is not ready, which will lead to timeouts and errors. Do you want to continue?')) {
                return;
            }
        }

        if (!window.confirm('Are you sure you want to create a debug pod?')) {
            return;
        }
        try {
            setIsLoading(true);
            const debugPod = await createDebugPod(props.application.spec.destination.name, props.resource.metadata.name, props.application.metadata.name, targetPod);
            setCreatedPod({
                cluster: debugPod.cluster,
                namespace: debugPod.pod.metadata.namespace,
                pod: debugPod.pod.metadata.name
            });
        } catch (e: any) {
            setNotification({ message: e?.message || 'Failed to create debug pod', type: 'error', requireApproval: true });
        } finally {
            setIsLoading(false);
        }
    };

    const goToDebugPodPage = async () => {
        setIsLoading(true);
        try {
            const debugPods = await getDebugPods();
            const debugPod = debugPods.find(pod => pod.pod.metadata.name === createdPod.pod);
            if (!debugPod) {
                setNotification({ message: 'Debug pod already removed. Check the events above to identify the issue. ', type: 'error', requireApproval: true });
                return;
            }
            window.location.href = `/debug-pods?selected=${createdPod.pod}`;
        } catch (e: any) {
            setNotification({ message: e?.message || 'Failed to get debug pods', type: 'error', requireApproval: true });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className='debug-pod-tab'>
            <div className='debug-pod-tab__content'>
                {notification && (
                    <NotificationBar
                        message={notification.message}
                        type={notification.type}
                        onClose={() => setNotification(null)}
                        requireApproval={notification.requireApproval}
                    />
                )}
                {isLoading ? (
                    <Loader />
                ) : createdPod ? (
                    <>
                        <div className="debug-pod-tab__create-btn-row">
                            <button
                                className="argo-button argo-button--base"
                                onClick={() => goToDebugPodPage()}
                            >
                                <i className="fa fa-plug-circle-check" style={{marginRight: 6}} />
                                Open Debug Pod Page
                            </button>
                        </div>
                        <DebugPodEventsTab cluster={createdPod.cluster} namespace={createdPod.namespace} pod={createdPod.pod} />
                    </>
                ) : sourcePod ? (
                    <>
                        <div className="debug-pod-tab__create-btn-row">
                            <div className="debug-pod-tab__instructions">
                                Edit the Pod manifest using the quick options and the manual edit below, and click the Create Debug Pod button to spin up a new Debug Pod
                            </div>
                            <Tooltip content="Please save or cancel your manual edits before creating the debug pod" enabled={isYamlEditing}>
                                <div style={{display: 'inline-block'}}>
                                    <button
                                        className="argo-button argo-button--base"
                                        onClick={handleCreateDebugPod}
                                        disabled={isYamlEditing}
                                    >
                                        <i className="fa fa-bug" style={{marginRight: 6}} />
                                        Create Debug Pod
                                    </button>
                                </div>
                            </Tooltip>
                        </div>
                        <Tooltip content={customYaml ? 'To use quick options, clear manual changes first' : ''} enabled={!!customYaml}>
                            <div className="debug-pod-tab__quick-options">
                                <div className="debug-pod-tab__quick-options-title">Quick Options</div>
                                <div className={`debug-pod-tab__form${customYaml ? ' debug-pod-tab__form--disabled' : ''}`}>
                                    <div className='debug-pod-tab__form-section'>
                                        <div className='debug-pod-tab__form-title'>Debug Containers</div>
                                        <div className='debug-pod-tab__form-checkbox-group'>
                                            {sourcePod.spec.containers.map(container => (
                                                <div key={container.name} className='debug-pod-tab__form-checkbox'>
                                                    <span className='argo-checkbox'>
                                                        <input
                                                            type='checkbox'
                                                            id={`debug-${container.name}`}
                                                            checked={debugContainers.has(container.name)}
                                                            disabled={!!customYaml}
                                                            onChange={e => {
                                                                const newSet = new Set(debugContainers);
                                                                if (e.target.checked) {
                                                                    newSet.add(container.name);
                                                                } else {
                                                                    newSet.delete(container.name);
                                                                }
                                                                setDebugContainers(newSet);
                                                            }}
                                                        />
                                                        <span><i className='fa fa-check'/></span>
                                                    </span>
                                                    <label htmlFor={`debug-${container.name}`}>{container.name}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className='debug-pod-tab__form-section'>
                                        <div className='debug-pod-tab__form-title'>Options</div>
                                        <div className='debug-pod-tab__form-checkbox-group'>
                                            <div className='debug-pod-tab__form-checkbox'>
                                                <span className='argo-checkbox'>
                                                    <input
                                                        type='checkbox'
                                                        id='retain-labels'
                                                        checked={retainLabels}
                                                        onChange={e => setRetainLabels(e.target.checked)}
                                                        disabled={!!customYaml}
                                                    />
                                                    <span><i className='fa fa-check'/></span>
                                                </span>
                                                <label htmlFor='retain-labels'>Retain Labels</label>
                                            </div>
                                            <div className='debug-pod-tab__form-checkbox'>
                                                <span className='argo-checkbox'>
                                                    <input
                                                        type='checkbox'
                                                        id='retain-readiness'
                                                        checked={retainReadiness}
                                                        onChange={e => setRetainReadiness(e.target.checked)}
                                                        disabled={!!customYaml}
                                                    />
                                                    <span><i className='fa fa-check'/></span>
                                                </span>
                                                <label htmlFor='retain-readiness'>Retain Readiness Probes</label>
                                            </div>
                                            <div className='debug-pod-tab__form-checkbox'>
                                                <span className='argo-checkbox'>
                                                    <input
                                                        type='checkbox'
                                                        id='retain-liveness'
                                                        checked={retainLiveness}
                                                        onChange={e => setRetainLiveness(e.target.checked)}
                                                        disabled={!!customYaml}
                                                    />
                                                    <span><i className='fa fa-check'/></span>
                                                </span>
                                                <label htmlFor='retain-liveness'>Retain Liveness Probes</label>
                                            </div>
                                            <div className='debug-pod-tab__form-checkbox'>
                                                <span className='argo-checkbox'>
                                                    <input
                                                        type='checkbox'
                                                        id='retain-startup-probe'
                                                        checked={retainStartupProbe}
                                                        onChange={e => setRetainStartupProbe(e.target.checked)}
                                                        disabled={!!customYaml}
                                                    />
                                                    <span><i className='fa fa-check'/></span>
                                                </span>
                                                <label htmlFor='retain-startup-probe'>Retain Startup Probe</label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Tooltip>
                        <div className="debug-pod-tab__manifest-title">
                            <div className="debug-pod-tab__manifest-title-text">Manual Edit</div>
                            {customYaml && (
                                <button
                                    className="argo-button argo-button--base-o"
                                    onClick={() => setCustomYaml(null)}
                                >
                                    Clear Manual Changes
                                </button>
                            )}
                        </div>
                        <YamlEditor 
                            input={targetPod} 
                            onSave={async customYaml => setCustomYaml(customYaml)}
                            onEditingStateChange={setIsYamlEditing}
                        />
                    </>
                ) : (
                    <Loader />
                )}
            </div>
        </div>
    );
};