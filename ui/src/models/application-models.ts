export interface Application {
    metadata: ObjectMeta;
    spec: ApplicationSpec;
}

export interface ApplicationSpec {
    destination: ApplicationDestination;
}

export interface ApplicationDestination {
    name: string;
    namespace: string;
}

export interface State {
    kind?: string;
    apiVersion?: string;
    metadata: ObjectMeta;
    spec: any;
}

export interface ObjectMeta {
    name: string;
    namespace: string;
}