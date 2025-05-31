export interface DebugPod {
    environment: string;
    projectId: string;
    bastionHost: string;
    region: string;
    cluster: string;
    pod: Pod;
}

export interface Pod {
    metadata: {
        name: string;
        namespace: string;
        creationTimestamp: string;
        labels?: {
            [key: string]: string;
        };
        annotations?: {
            [key: string]: string;
        };
        uid: string;
    };
    spec: {
        containers: Container[];
        initContainers: Container[];
        volumes?: Volume[];
        restartPolicy?: 'Always' | 'OnFailure' | 'Never';
        terminationGracePeriodSeconds?: number;
        dnsPolicy?: 'ClusterFirst' | 'ClusterFirstWithHostNet' | 'Default' | 'None';
        serviceAccountName?: string;
        nodeName?: string;
        securityContext?: any;
        affinity?: {
            nodeAffinity?: {
                requiredDuringSchedulingIgnoredDuringExecution?: {
                    nodeSelectorTerms: {
                        matchExpressions: {
                            key: string;
                            operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt';
                            values?: string[];
                        }[];
                    }[];
                };
            };
        };
        tolerations?: {
            key?: string;
            operator?: 'Exists' | 'Equal';
            value?: string;
            effect?: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
            tolerationSeconds?: number;
        }[];
    };
    status?: {
        phase?: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';
        conditions?: {
            type: string;
            status: 'True' | 'False' | 'Unknown';
            lastProbeTime?: string;
            lastTransitionTime?: string;
            reason?: string;
            message?: string;
        }[];
        hostIP?: string;
        podIP?: string;
        startTime?: string;
        containerStatuses?: ContainerStatus[];
    };
}

export interface Container {
    name: string;
    image: string;
    command?: string[];
    ports?: {
        name?: string;
        containerPort: number;
        protocol?: 'TCP' | 'UDP' | 'SCTP';
    }[];
    env?: {
        name: string;
        value?: string;
        valueFrom?: {
            resourceFieldRef?: {
                resource: string;
                divisor?: string;
            };
        };
    }[];
    resources?: {
        limits?: {
            cpu?: string;
            memory?: string;
        };
        requests?: {
            cpu?: string;
            memory?: string;
        };
    };
    volumeMounts?: {
        name: string;
        mountPath: string;
        readOnly?: boolean;
    }[];
    readinessProbe?: {
        httpGet?: {
            path: string;
            port: number;
            scheme: 'HTTP' | 'HTTPS';
        };
        initialDelaySeconds?: number;
        timeoutSeconds?: number;
        periodSeconds?: number;
        successThreshold?: number;
        failureThreshold?: number;
    };
    terminationMessagePath?: string;
    terminationMessagePolicy?: 'File' | 'FallbackToLogsOnError';
    imagePullPolicy?: 'Always' | 'Never' | 'IfNotPresent';
}

export interface Volume {
    name: string;
    hostPath?: {
        path: string;
        type?: string;
    };
    projected?: {
        sources: {
            serviceAccountToken?: {
                expirationSeconds?: number;
                path: string;
            };
            configMap?: {
                name: string;
                items?: {
                    key: string;
                    path: string;
                }[];
            };
            downwardAPI?: {
                items: {
                    path: string;
                    fieldRef: {
                        apiVersion: string;
                        fieldPath: string;
                    };
                }[];
            };
        }[];
        defaultMode?: number;
    };
}

export interface ContainerStatus {
    name: string;
    state: {
        running?: {
            startedAt: string;
        };
        waiting?: {
            reason: string;
            message: string;
        };
        terminated?: {
            exitCode: number;
            reason: string;
            startedAt: string;
            finishedAt: string;
        };
    };
    lastState?: any;
    ready: boolean;
    restartCount: number;
    image: string;
    imageID: string;
    containerID?: string;
    started?: boolean;
}
