import { ObjectMeta } from "./application-models";

export interface Event {
    apiVersion?: string;
    kind?: string;
    metadata: ObjectMeta;
    involvedObject: ObjectReference;
    reason: string;
    message: string;
    source: EventSource;
    firstTimestamp: string;
    lastTimestamp: string;
    count: number;
    type: string;
    eventTime: string;
    series: EventSeries;
    action: string;
    related: ObjectReference;
    reportingController: string;
    reportingInstance: string;
}

export interface ObjectReference {
    kind: string;
    namespace: string;
    name: string;
    uid: string;
    apiVersion: string;
    resourceVersion: string;
    fieldPath: string;
}

export interface EventSeries {
    count: number;
    lastObservedTime: string;
    state: string;
}