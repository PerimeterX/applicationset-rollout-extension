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

function CodeSection({ title, desc, code }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    };

    return (
        <div className="debug-pod-connect-section">
            <div title='Show and copy the code' className="section-header">
                <div className="section-title">
                    {title}
                </div>
                <div className="section-desc">{desc}</div>
            </div>
            <div className="code-bar" style={{ position: 'relative' }}>
                <div className="copy-btn" onClick={handleCopy}>
                    {copied ? (
                        <i className="fa fa-check" />
                    ) : (
                        <i className="fa fa-copy" />
                    )}
                </div>
                <pre style={{ margin: 0, flex: 1 }}>{code}</pre>
            </div>
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
                        <CodeSection
                            title="Connect to the cluster"
                            desc={<span>Apply the following commands if you haven't connected to the cluster <b>{selectedPod.cluster}</b> before</span>}
                            code={`# Install kubectl if not installed
if ! command -v kubectl &> /dev/null; then
    echo "Installing kubectl..."
    gcloud components install kubectl
fi &&

# Install gke-gcloud-auth-plugin if not installed
if ! command -v gke-gcloud-auth-plugin &> /dev/null; then
    echo "Installing gke-gcloud-auth-plugin..."
    gcloud components install gke-gcloud-auth-plugin
fi &&

# Get credentials for the cluster if not already present
if ! kubectl config get-contexts -o name | grep -q "gke_px-common-dev_europe-west1_common-stg-data-europe-west1"; then
    echo "Getting credentials for the cluster..."
    gcloud container clusters get-credentials ${selectedPod.cluster} --region ${selectedPod.region} --project ${selectedPod.projectId}
fi &&

# Switch to the context
echo "Switching kubectl context..."
kubectl config use-context gke_${selectedPod.projectId}_${selectedPod.region}_${selectedPod.cluster}
`}
                        />
                    </div>
                    <div>
                        <CodeSection
                            title="Copy files to the pod"
                            desc="Apply the following commands for each file you want to copy"
                            code={`kubectl cp -n ${selectedPod.pod.metadata.namespace} <FILE_PATH> ${selectedPod.pod.metadata.name}:<PATH_ON_POD>`}
                        />
                    </div>
                    <div>
                        <CodeSection
                            title="Connect to the pod"
                            desc="Run this to connect to the pod"
                            code={`kubectl exec -n ${selectedPod.pod.metadata.namespace} -it ${selectedPod.pod.metadata.name} -- sh`}
                        />
                    </div>
                </div>
            ) : (<span>Unsupported k8s environment</span>)}
        </SlidingPanel>
    );
}
