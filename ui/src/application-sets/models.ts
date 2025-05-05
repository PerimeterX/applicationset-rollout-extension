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

export type HealthStatusCode = 'Unknown' | 'Missing' | 'Processing' | 'Suspended' | 'Degraded' | 'Healthy';
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
    };
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
