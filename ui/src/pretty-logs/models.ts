export interface Application {
    metadata: ObjectMeta;
}

export interface ObjectMeta {
    name: string;
    namespace: string;
}

export interface State {
    kind?: string;
    apiVersion?: string;
    metadata: ObjectMeta;
    spec: any;
}

export interface LogEntry {
    content: string;
    first?: boolean;
    last: boolean;
}
