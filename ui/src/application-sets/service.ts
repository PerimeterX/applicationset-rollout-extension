import * as deepMerge from 'deepmerge';
import requests from '../requests/requests';
import {ApplicationSet, Resource, Application, ResourceTree} from './models';

const MAX_RETRIES = 3;

function isUnauthorizedError(error: any): boolean {
    return error?.status === 401 || error?.response?.status === 401;
}

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (isUnauthorizedError(error)) {
            window.location.href = '/applications';
            throw error;
        }
        if (retries > 0) {
            return withRetry(fn, retries - 1);
        }
        throw error;
    }
}

export function listApplicationSets(): Promise<ApplicationSet[]> {
    return withRetry(() => 
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
    return withRetry(() =>
        requests
            .post(`/applications/${name}/sync`)
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
    return requests
        .post(`/applications/${name}/rollback`)
        .send({id, appNamespace})
        .then(() => true);
}

export function runResourceAction(name: string, appNamespace: string, resource: Resource, action: string): Promise<any> {
    return withRetry(() =>
        requests
            .post(`/applications/${name}/resource/actions`)
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
    return withRetry(() =>
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
    return withRetry(() =>
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
