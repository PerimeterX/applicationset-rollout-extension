import * as deepMerge from 'deepmerge';
import requests from '../requests/requests';
import { ApplicationSet, Resource, Application } from './models';

export function listApplicationSets(): Promise<ApplicationSet[]> {
    return requests.get('/applicationsets').then(res => res.body.items || []);
}

export function syncApplication(
    name: string,
    appNamespace: string
): Promise<boolean> {
    return requests
        .post(`/applications/${name}/sync`)
        .send({appNamespace})
        .then(() => true);
}

export function runResourceAction(name: string, appNamespace: string, resource: Resource, action: string): Promise<any> {
    return requests
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
        .then(res => (res.body.actions) || []);
}

export function getApplication(name: string, appNamespace: string, refresh?: 'normal' | 'hard'): Promise<Application> {
    const query: {[key: string]: string} = {};
    if (refresh) {
        query.refresh = refresh;
    }
    if (appNamespace) {
        query.appNamespace = appNamespace;
    }
    return requests
        .get(`/applications/${name}`)
        .query(query)
        .then(res => parseAppFields(res.body));
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
