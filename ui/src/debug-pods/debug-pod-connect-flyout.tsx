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
    const isSupportedEnv = selectedPod && ['gke', 'aks', 'eks'].includes(selectedPod.environment);

    const getEnvCommands = () => {
        if (!selectedPod) return '';

        switch (selectedPod.environment) {
            case 'gke':
                return `# Install kubectl if not installed
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
if ! kubectl config get-contexts -o name | grep -q " ${selectedPod.cluster} "; then
    echo "Getting credentials for the cluster..."
    gcloud container clusters get-credentials ${selectedPod.cluster} --region ${selectedPod.region} --project ${selectedPod.projectId}
    kubectl config rename-context gke_${selectedPod.projectId}_${selectedPod.region}_${selectedPod.cluster} ${selectedPod.cluster}
fi &&`;
            case 'aks':
                return `# Install Azure CLI if not installed
if ! command -v az &> /dev/null; then
    echo "Installing Azure CLI..."
    if command -v brew &> /dev/null; then
        brew install azure-cli
    else
        curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
    fi
fi &&

# Install kubelogin if not installed (required for AAD authentication)
if ! command -v kubelogin &> /dev/null; then
    echo "Installing kubelogin..."
    az aks install-cli
fi &&

# Get credentials for the cluster if not already present
if ! kubectl config get-contexts -o name | grep -q " ${selectedPod.cluster} "; then
    echo "Getting credentials for the cluster..."
    az aks get-credentials --resource-group ${selectedPod.projectId} --name ${selectedPod.cluster} --overwrite-existing
fi &&`;
            case 'eks':
                return `# Install AWS CLI if not installed
if ! command -v aws &> /dev/null; then
    echo "Installing AWS CLI..."
    if command -v brew &> /dev/null; then
        brew install awscli
    else
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
        unzip awscliv2.zip
        sudo ./aws/install
        rm -rf aws awscliv2.zip
    fi
fi &&

# Get credentials for the cluster if not already present
if ! kubectl config get-contexts -o name | grep -q " ${selectedPod.cluster} "; then
    echo "Getting credentials for the cluster..."
    aws eks update-kubeconfig --region ${selectedPod.region} --name ${selectedPod.cluster} --alias ${selectedPod.cluster}
fi &&`;
            default:
                return '';
        }
    };

    const connectClusterCode = `${getEnvCommands()}

# Switch to the context
echo "Switching kubectl context..."
kubectl config use-context ${selectedPod?.cluster}`;

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
            {isSupportedEnv ? (
                <div>
                    <div>
                        <CodeSection
                            title="Connect to the cluster"
                            desc={<span>Apply the following commands if you haven't connected to the cluster <b>{selectedPod.cluster}</b> before</span>}
                            code={connectClusterCode}
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
