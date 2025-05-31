import {ApplicationSetTab} from "./application-set-tab/application-set-tab";
import {ApplicationSets} from './application-sets/application-sets';
import {DebugPodTab} from "./debug-pod-tab/debug-pod-tab";
import {DebugPods} from "./debug-pods/debug-pods";
import {PrettyLogsTab} from './pretty-logs/pretty-logs-tab';

((window: any) => {
    
    // Register the ApplicationSetTab component as a resource extension
    window?.extensionsAPI?.registerResourceExtension(
        ApplicationSetTab, 
        'argoproj.io', 
        'ApplicationSet', 
        'Application Set', 
        {icon: 'fa-sharp fa-light fa-bars-progress fa-lg'}
    );

    // Register the ApplicationSets component as a system level extension
    window.extensionsAPI.registerSystemLevelExtension(
        ApplicationSets,
        'Application Sets',
        '/application-sets',
        'fa-solid fa-server'
    );

    // Register the DebugPods component as a system level extension
    window.extensionsAPI.registerSystemLevelExtension(
        DebugPods,
        'Debug Pods',
        '/debug-pods',
        'fa-solid fa-bug'
    );

    // Register the Pretty Logs tab extension using the global extensions API
    (window as any).extensionsAPI.registerResourceExtension(
        PrettyLogsTab,
        '**',
        'Pod',
        'Pretty Logs',
        {icon: 'fa fa-binoculars'}
    );

    // Register the Debug Pod tab extension using the global extensions API
    (window as any).extensionsAPI.registerResourceExtension(
        DebugPodTab,
        '**',
        'Pod',
        'Debug Pod',
        {icon: 'fa fa-bug'}
    );

})(window);