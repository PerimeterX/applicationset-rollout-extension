import requests from './requests';
import {call} from './call';
import {DebugPod, Pod} from '../models/pod-models';
import {map, Observable} from 'rxjs';
import {LogEntry} from '../models/log-models';
import {Event} from '../models/event-models';

const APPLICATION_HEADER_NAME = 'Argocd-Application-Name';
const APPLICATION_HEADER_VALUE = 'argocd:argocd-debug-pod-extension';
const PROJECT_HEADER_NAME = 'Argocd-Project-Name';
const PROJECT_HEADER_VALUE = 'default';

export function getDebugPods(): Promise<DebugPod[]> {
    return call(() => 
        requests.get('/extensions/debugpods/debug_pods', true)
            .set(APPLICATION_HEADER_NAME, APPLICATION_HEADER_VALUE)
            .set(PROJECT_HEADER_NAME, PROJECT_HEADER_VALUE)
            .then(res => res.body)
    );
}

export function createDebugPod(cluster: string, originalPodName: string, applicationName: string, pod: Pod): Promise<DebugPod> {
    return call(() => 
        requests.postJson('/extensions/debugpods/debug_pod', true)
            .set(APPLICATION_HEADER_NAME, APPLICATION_HEADER_VALUE)
            .set(PROJECT_HEADER_NAME, PROJECT_HEADER_VALUE)
            .send({cluster, originalPodName, applicationName, pod})
            .then(res => res.body)
    );
}

export function deleteDebugPod(cluster: string, pod: string): Promise<void> {
    return call(() => requests.deleteJson('/extensions/debugpods/debug_pod', true)
            .set(APPLICATION_HEADER_NAME, APPLICATION_HEADER_VALUE)
            .set(PROJECT_HEADER_NAME, PROJECT_HEADER_VALUE)
            .send({cluster, pod})
    );
}

export function getContainerLogs(cluster: string, namespace, pod: string, container: string): Observable<LogEntry> {
    const entries = requests.loadEventSource(`/extensions/debugpods/logs?container=${container}&namespace=${namespace}&pod=${pod}&cluster=${cluster}`, {
        [APPLICATION_HEADER_NAME]: APPLICATION_HEADER_VALUE,
        [PROJECT_HEADER_NAME]: PROJECT_HEADER_VALUE
    }, true)
            .pipe(map(content => ({content}) as LogEntry));
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

export function getPodEvents(cluster: string, namespace: string, pod: string): Observable<Event> {
    const entries = requests.loadEventSource(`/extensions/debugpods/events?namespace=${namespace}&pod=${pod}&cluster=${cluster}`, {
        [APPLICATION_HEADER_NAME]: APPLICATION_HEADER_VALUE,
        [PROJECT_HEADER_NAME]: PROJECT_HEADER_VALUE
    }, true).pipe(map(data => JSON.parse(data) as Event));
    return new Observable(observer => {
        const subscription = entries.subscribe(
            entry => {
                observer.next(entry);
            },
            err => {
                observer.error(err);
            },
            () => {
                observer.complete();
            }
        );
        return () => subscription.unsubscribe();
    });
}

export function getPod(
    application: string,
    name: string,
    appNamespace: string,
    namespace: string,
    resourceName: string
): Promise<Pod> {
    const params = new URLSearchParams({
        name,
        appNamespace,
        namespace,
        resourceName,
        version: 'v1',
        kind: 'Pod',
        group: ''
    });

    return call(() => 
        requests.get(`/applications/${application}/resource?${params.toString()}`)
            .then(res => res.body as {manifest: string})
            .then(res => JSON.parse(res.manifest) as Pod)
    );
}

export function copyFiles(
    files: File[],
    cluster: string,
    namespace: string,
    pod: string,
    container: string,
    destination: string,
    onProgress: (progress: number) => void,
): Promise<void> {
    const formData = new FormData();
    
    // Add all files to the form data
    files.forEach(file => {
        formData.append('files', file, (file as any).webkitRelativePath || file.name);
    });
    
    // Add other parameters
    formData.append('cluster', cluster);
    formData.append('namespace', namespace);
    formData.append('pod', pod);
    formData.append('container', container);
    formData.append('destination', destination);

    return call(() => 
        requests.post('/extensions/debugpods/copy_files', true)
            .set(APPLICATION_HEADER_NAME, APPLICATION_HEADER_VALUE)
            .set(PROJECT_HEADER_NAME, PROJECT_HEADER_VALUE)
            .buffer(false)
            .send(formData)
            .on('progress', (event) => {
                if (event.direction === 'upload') {
                    if (event.percent) {
                        const uploadProgress = event.percent / 100;
                        onProgress(uploadProgress / 2);
                    }
                } else if (event.direction === 'download') {
                    const parts = event?.target?.response?.split('\n');
                    if (parts.length > 1) {
                        const lastPart = parts[parts.length - 2];
                        try {
                            const downloadProgress = parseFloat(lastPart);
                            onProgress(0.5 + (downloadProgress / 2));
                        } catch (e) {}
                    }
                }
            })
    );
}