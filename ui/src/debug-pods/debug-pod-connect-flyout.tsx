import * as React from 'react';
import { useState } from 'react';

import {DebugPod} from '../models/pod-models';
import {SlidingPanel} from '../shared-components/sliding-panel/sliding-panel';

import './debug-pod-connect-flyout.scss';

interface DebugPodConnectFlyoutProps {
    show: boolean;
    selectedPod: DebugPod;
    onClose: () => void;
}

function CollapsibleCodeSection({ title, desc, code }) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    };

    return (
        <div className="debug-pod-connect-section">
            <div title='Show and copy the code' className="section-header" onClick={() => {
                setOpen(true);
                handleCopy();
            }}>
                <div className="section-title">
                    {title}
                    {copied ? (
                        <span className="section-copy-icon-copied">Copied to clipboard <i className="section-copy-icon fa fa-check" /></span>
                    ) : (
                        <i className="section-copy-icon fa fa-copy" />
                    )}
                </div>
                <div className="section-desc">{desc}</div>
            </div>
            {open && (
                <div className="code-bar" style={{ position: 'relative' }}>
                    <pre style={{ margin: 0, flex: 1 }}>{code}</pre>
                </div>
            )}
        </div>
    );
}

export const DebugPodConnectFlyout = ({ show, selectedPod, onClose }: DebugPodConnectFlyoutProps) => {
    return (
        <SlidingPanel
            isShown={show}
            onClose={onClose}
            header={(
                <div className="debug-pod-connect-flyout__header">
                    <div className="icon">
                        <i className='fa fa-terminal' />
                    </div>
                    <div>
                        <div className="title">Connect to the pod</div>
                    </div>
                </div>
            )}
        >
            {selectedPod?.environment === 'gke' ? (
                <div>
                    <div>
                        <CollapsibleCodeSection
                            title="Install kubectl"
                            desc="Apply the following commands only once on your machine"
                            code={`gcloud components install kubectl
gcloud components install gke-gcloud-auth-plugin`}
                        />
                    </div>
                    <div>
                        <CollapsibleCodeSection
                            title="Connect to the cluster"
                            desc={`Apply the following commands if you haven't connected to the cluster ${selectedPod.cluster} before`}
                            code={`gcloud container clusters get-credentials ${selectedPod.cluster} --region ${selectedPod.region} --project ${selectedPod.projectId}
kubectl config set clusters.gke_${selectedPod.projectId}_${selectedPod.region}_${selectedPod.cluster}.proxy-url http://${selectedPod.bastionHost}:8888`}
                        />
                    </div>
                    <div>
                        <CollapsibleCodeSection
                            title="Choose the cluster context"
                            desc="Apply the following commands once"
                            code={`kubectl config set-context gke_${selectedPod.projectId}_${selectedPod.region}_${selectedPod.cluster} --namespace=${selectedPod.pod.metadata.namespace}`}
                        />
                    </div>
                    <div>
                        <CollapsibleCodeSection
                            title="Copy files to the pod"
                            desc="Apply the following commands for each file you want to copy"
                            code={`kubectl cp -n ${selectedPod.pod.metadata.namespace} <FILE_PATH> ${selectedPod.pod.metadata.name}-debug:<PATH_ON_POD>`}
                        />
                    </div>
                    <div>
                        <CollapsibleCodeSection
                            title="Connect to the pod"
                            desc="Apply the following commands once"
                            code={`kubectl exec -it ${selectedPod.pod.metadata.name} -- sh`}
                        />
                    </div>
                </div>
            ) : (<span>Unsupported k8s environment</span>)}
        </SlidingPanel>
    );
}
