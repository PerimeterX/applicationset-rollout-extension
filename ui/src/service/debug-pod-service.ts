import requests from './requests';
import {call} from './call';
import {DebugPod, Pod} from '../models/pod-models';
import {map, Observable} from 'rxjs';
import {LogEntry} from '../models/log-models';
import {Event} from '../models/event-models';

export function getDebugPods(): Promise<DebugPod[]> {
    return call(() => requests.get('http://localhost:8223/debug_pods', true).then(res => res.body));
}

export function createDebugPod(cluster: string, pod: Pod): Promise<DebugPod> {
    return call(() => requests.post('http://localhost:8223/debug_pod', true).send({cluster, pod}).then(res => res.body));
}

export function deleteDebugPod(cluster: string, pod: string): Promise<void> {
    return call(() => requests.delete('http://localhost:8223/debug_pod', true).send({cluster, pod}));
}

export function getContainerLogs(cluster: string, namespace, pod: string, container: string): Observable<LogEntry> {
    const entries = requests.loadEventSource(`http://localhost:8223/logs?container=${container}&namespace=${namespace}&pod=${pod}&cluster=${cluster}`, true).pipe(map(content => ({content}) as LogEntry));
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
    const entries = requests.loadEventSource(`http://localhost:8223/events?namespace=${namespace}&pod=${pod}&cluster=${cluster}`, true).pipe(map(data => JSON.parse(data) as Event));
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
    destination: string
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
        requests.postFormData('http://localhost:8223/copy_files', formData, true)
            .then(res => res.body)
    );
}