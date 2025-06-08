import {Observable} from "rxjs";
import {map} from "rxjs/operators";

import requests from './requests';
import {LogEntry} from "../models/log-models";

export function getContainerLogs(query: {
    applicationName: string;
    appNamespace: string;
    namespace: string;
    podName: string;
    resource: {group: string; kind: string; name: string};
    containerName: string;
    tail?: number;
    follow?: boolean;
    sinceSeconds?: number;
    untilTime?: string;
    filter?: string;
    previous?: boolean;
}): Observable<LogEntry> {
    const {applicationName} = query;
    const search = getLogsQuery(query);
    const entries = requests.loadEventSource(`/applications/${applicationName}/logs?${search.toString()}`).pipe(map(data => JSON.parse(data).result as LogEntry));
    let first = true;
    return new Observable(observer => {
        const subscription = entries.subscribe(
            entry => {
                if (entry.last) {
                    first = true;
                    observer.complete();
                    subscription.unsubscribe();
                } else {
                    observer.next({...entry, first});
                    first = false;
                }
            },
            err => {
                first = true;
                observer.error(err);
            },
            () => {
                first = true;
                observer.complete();
            }
        );
        return () => subscription.unsubscribe();
    });
}

function getLogsQuery(query: {
    namespace: string;
    appNamespace: string;
    podName: string;
    resource: {group: string; kind: string; name: string};
    containerName: string;
    tail?: number;
    follow?: boolean;
    sinceSeconds?: number;
    untilTime?: string;
    filter?: string;
    previous?: boolean;
}): URLSearchParams {
    const {appNamespace, containerName, namespace, podName, resource, tail, sinceSeconds, untilTime, filter, previous} = query;
    let {follow} = query;
    if (follow === undefined || follow === null) {
        follow = true;
    }
    const search = new URLSearchParams();
    search.set('appNamespace', appNamespace);
    search.set('container', containerName);
    search.set('namespace', namespace);
    search.set('follow', follow.toString());
    if (podName) {
        search.set('podName', podName);
    } else {
        search.set('group', resource.group);
        search.set('kind', resource.kind);
        search.set('resourceName', resource.name);
    }
    if (tail) {
        search.set('tailLines', tail.toString());
    }
    if (sinceSeconds) {
        search.set('sinceSeconds', sinceSeconds.toString());
    }
    if (untilTime) {
        search.set('untilTime', untilTime);
    }
    if (filter) {
        search.set('filter', filter);
    }
    if (previous) {
        search.set('previous', previous.toString());
    }
    // The API requires that this field be set to a non-empty string.
    search.set('sinceSeconds', '0');
    return search;
}