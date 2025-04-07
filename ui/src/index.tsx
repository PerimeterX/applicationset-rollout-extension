import { ApplicationSetTab } from "./application-set-tab/application-set-tab";
import {ApplicationSets} from './application-sets/application-sets';
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

    // Register the Pretty Logs tab extension using the global extensions API
    (window as any).extensionsAPI.registerResourceExtension(
        PrettyLogsTab,
        '**',
        'Pod',
        'Pretty Logs',
        {icon: 'fa fa-binoculars'}
    );

})(window);