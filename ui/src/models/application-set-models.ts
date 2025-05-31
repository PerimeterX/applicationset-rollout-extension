export interface ApplicationSet {
    metadata: {
        name: string;
        namespace: string;
        creationTimestamp: string;
        labels?: {[key: string]: string};
    };
    spec: {
        template: {
            spec: {
                source: ApplicationSource;
            };
        };
    };
    status?: {
        resources?: Array<ResourceStatus>;
    };
}

export interface ResourceStatus {
    group: string;
    version: string;
    kind: string;
    namespace: string;
    name: string;
    status: SyncStatusCode;
    health: HealthStatus;
}

export interface HealthStatus {
    status: HealthStatusCode;
}

export type HealthStatusCode = 'Unknown' | 'Missing' | 'Processing' | 'Progressing' | 'Suspended' | 'Degraded' | 'Healthy';
export type SyncStatusCode = 'Unknown' | 'OutOfSync' | 'Synced';

export interface Application {
    metadata: {
        name: string;
        namespace: string;
        labels?: {[key: string]: string};
    };
    spec: {
        destination: {
            name: string;
        };
        source: ApplicationSource;
        sources: ApplicationSource[];
    };
    status: {
        resources: ResourceStatus[];
        sync: {
            status: SyncStatusCode;
        };
        health: HealthStatus;
        operationState?: {
            finishedAt: string;
        };
        history: RevisionHistory[];
    };
}

export interface RevisionHistory {
    id: number;
    revision: string;
    source: ApplicationSource;
    revisions: string[];
    sources: ApplicationSource[];
    deployStartedAt: string;
    deployedAt: string;
    initiatedBy: OperationInitiator;
}

export interface OperationInitiator {
    username: string;
    automated: boolean;
}

export interface ApplicationSource {
    targetRevision: string;
    repoURL: string;
    path?: string;
}

export interface Resource {
    namespace: string;
    name: string;
    version: string;
    kind: string;
    group: string;
}

export interface Rollout {
    metadata: {
        name: string;
        namespace: string;
        creationTimestamp: string;
        labels?: {[key: string]: string};
        annotations?: {[key: string]: string};
    };
    spec: {
        replicas: number;
        selector: {
            matchLabels: {[key: string]: string};
        };
        template: {
            metadata: {
                labels: {[key: string]: string};
            };
            spec: {
                containers: Array<{
                    name: string;
                    image: string;
                    resources?: {
                        requests?: {[key: string]: string};
                        limits?: {[key: string]: string};
                    };
                }>;
            };
        };
        strategy: {
            blueGreen?: {
                activeService: string;
                previewService: string;
                autoPromotionEnabled: boolean;
            };
            canary?: {
                steps: Array<{
                    setWeight?: number;
                    pause?: {
                        duration?: string;
                    };
                }>;
            };
        };
    };
    status?: {
        phase: string;
        message?: string;
        currentStepIndex?: number;
        updatedReplicas?: number;
        readyReplicas?: number;
        availableReplicas?: number;
        currentStepHash?: string;
        collisionCount?: number;
        observedGeneration?: number;
        conditions?: Array<{
            type: string;
            status: string;
            lastUpdateTime: string;
            lastTransitionTime: string;
            reason: string;
            message: string;
        }>;
    };
}

export interface ResourceTree {
    nodes: ResourceNode[];
    hosts: Host[];
}

export interface ResourceNode {
    version: string;
    kind: string;
    namespace: string;
    name: string;
    uid: string;
    parentRefs?: ParentRef[];
    info?: ResourceInfo[];
    networkingInfo?: NetworkingInfo;
    resourceVersion: string;
    images?: string[];
    health?: HealthStatus;
    createdAt: string;
    group?: string;
}

export interface ParentRef {
    group?: string;
    kind: string;
    namespace: string;
    name: string;
    uid: string;
}

export interface ResourceInfo {
    name: string;
    value: string;
}

export interface NetworkingInfo {
    labels?: {[key: string]: string};
    targetLabels?: {[key: string]: string};
}

export interface Host {
    name: string;
    resourcesInfo: ResourceInfo[];
    systemInfo: SystemInfo;
}

export interface SystemInfo {
    machineID: string;
    systemUUID: string;
    bootID: string;
    kernelVersion: string;
    osImage: string;
    containerRuntimeVersion: string;
    kubeletVersion: string;
    kubeProxyVersion: string;
    operatingSystem: string;
    architecture: string;
}

export interface ApplicationResource {
    application: Application;
    resourceTree?: ResourceTree;
}
