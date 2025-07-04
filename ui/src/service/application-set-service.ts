import * as deepMerge from 'deepmerge';
import requests from './requests';
import {callWithRetries, call} from './call';
import {ApplicationSet, Resource, Application, ResourceTree} from '../models/application-set-models';

const RETRIES = 3;

export function listApplicationSets(): Promise<ApplicationSet[]> {
    return call(() => 
        requests.get('/applicationsets').then(res => res.body.items || [])
    );
}

export function syncApplication(
    name: string,
    appNamespace: string,
    revision: string,
    prune: boolean,
    dryRun: boolean,
): Promise<boolean> {
    return callWithRetries(RETRIES, () =>
        requests
            .postJson(`/applications/${name}/sync`)
            .send({
                appNamespace,
                revision,
                prune: !!prune,
                dryRun: !!dryRun
            })
            .then(() => true)
    );
}

export function rollback(name: string, appNamespace: string, id: number): Promise<boolean> {
    return callWithRetries(RETRIES, () => 
        requests
            .postJson(`/applications/${name}/rollback`)
            .send({id, appNamespace})
            .then(() => true)
    );
}

export function runResourceAction(name: string, appNamespace: string, resource: Resource, action: string): Promise<any> {
    return callWithRetries(RETRIES, () =>
        requests
            .postJson(`/applications/${name}/resource/actions`)
            .query({
                appNamespace,
                namespace: resource.namespace,
                resourceName: resource.name,
                version: resource.version,
                kind: resource.kind,
                group: resource.group
            })
            .send(JSON.stringify(action))
            .then(res => (res.body.actions) || [])
    );
}

export function getApplication(name: string, appNamespace: string, refresh?: 'normal' | 'hard'): Promise<Application> {
    const query: {[key: string]: string} = {};
    if (refresh) {
        query.refresh = refresh;
    }
    if (appNamespace) {
        query.appNamespace = appNamespace;
    }
    return callWithRetries(RETRIES, () =>
        requests
            .get(`/applications/${name}`)
            .query(query)
            .then(res => parseAppFields(res.body))
    );
}

export function getResourceTree(name: string, appNamespace: string): Promise<ResourceTree> {
    const query: {[key: string]: string} = {};
    if (appNamespace) {
        query.appNamespace = appNamespace;
    }
    return callWithRetries(RETRIES, () =>
        requests
            .get(`/applications/${name}/resource-tree`)
            .query(query)
            .then(res => res.body as ResourceTree)
    );
}

function parseAppFields(data: any): Application {
    data = deepMerge(
        {
            apiVersion: 'argoproj.io/v1alpha1',
            kind: 'Application',
            spec: {
                project: 'default'
            },
            status: {
                resources: [],
                summary: {}
            }
        },
        data
    );

    return data as Application;
}
