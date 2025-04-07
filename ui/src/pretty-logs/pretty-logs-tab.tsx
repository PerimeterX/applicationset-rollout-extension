import * as React from 'react';
import {useEffect, useState, useRef} from 'react';

import {Tooltip} from 'argo-ui';
import {bufferTime, delay, retryWhen} from 'rxjs/operators';

import {Application, State, LogEntry} from './models';
import {parseAnsiColors} from './ansi-colors';
import {getContainerLogs} from './service';
import {ToggleButton} from '../shared-components/toggle-button';

import './pretty-logs-tab.scss';

// Determine if a string is valid JSON
const isJson = (str: string): boolean => {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
};

// Determine the log mode based on the content of logs
const determineLogMode = (logs: LogEntry[]): 'json' | 'raw' => {
    if (logs.length === 0) return 'json';
    
    // Sample up to 10 logs to determine the mode
    const sampleSize = Math.min(10, logs.length);
    const sample = logs.slice(-sampleSize);
    
    // Count how many logs are valid JSON
    const jsonCount = sample.filter(log => isJson(log.content)).length;
    
    // If more than 50% are JSON, consider it JSON mode
    return jsonCount > sampleSize / 2 ? 'json' : 'raw';
};

const formatLogLine = (content: string) => {
    try {
        const json = JSON.parse(content);
        const level = json.level || 'info';
        const msg = json.msg || '';
        const time = json.time || '';
        
        // Get all fields except level, msg, and time
        const additionalFields = Object.entries(json)
            .filter(([key]) => !['level', 'msg', 'time'].includes(key))
            .map(([key, value]) => (
                <span key={key} className='log-additional-field'>
                    {key}={JSON.stringify(value)}
                </span>
            ));
        
        return (
            <div className='pretty-log-line'>
                <span className={`log-level log-level-${level.toLowerCase()}`}>{level.toUpperCase()}</span>
                <span className='log-time'>{time}</span>
                <span className='log-msg'>{msg}</span>
                {additionalFields.length > 0 && (
                    <span className='log-additional-fields'>
                        {additionalFields}
                    </span>
                )}
            </div>
        );
    } catch (e) {
        // If parsing fails, try to parse ANSI color codes
        return (
            <div className='pretty-log-line'>
                <span className='log-msg'>{parseAnsiColors(content)}</span>
            </div>
        );
    }
};

// Define container interface
interface Container {
    name: string;
    [key: string]: any;
}

interface ContainerGroup {
    offset: number;
    title: string;
    containers: Container[];
}

export const PrettyLogsTab: React.FC<{
    application: Application;
    resource: State;
}> = ({application, resource}) => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [wrapLines, setWrapLines] = useState(() => {
        // Get the stored preference from localStorage, default to true if not set
        const stored = localStorage.getItem('pretty-logs-wrap-lines');
        return stored === null ? true : stored === 'true';
    });
    const [followLogs, setFollowLogs] = useState(true);
    const [logMode, setLogMode] = useState<'json' | 'raw'>('json');
    const [selectedContainer, setSelectedContainer] = useState<string>('');
    const [filterText, setFilterText] = useState<string>('');
    const [uiMode, setUiMode] = useState<'dark' | 'bright'>(() => {
        // Get the stored preference from localStorage, default to dark if not set
        const stored = localStorage.getItem('pretty-logs-ui-mode');
        return stored === null ? 'dark' : stored as 'dark' | 'bright';
    });
    const [copySuccess, setCopySuccess] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // Save wrap lines preference to localStorage when it changes
    useEffect(() => {
        localStorage.setItem('pretty-logs-wrap-lines', wrapLines.toString());
    }, [wrapLines]);

    // Save UI mode preference to localStorage when it changes
    useEffect(() => {
        localStorage.setItem('pretty-logs-ui-mode', uiMode);
    }, [uiMode]);

    // Extract container information from the resource
    const containerGroups = React.useMemo<ContainerGroup[]>(() => {
        if (!resource.spec) return [];
        
        const groups: ContainerGroup[] = [];
        
        // Add regular containers
        if (resource.spec.containers && resource.spec.containers.length > 0) {
            groups.push({
                offset: 0,
                title: 'CONTAINERS',
                containers: resource.spec.containers
            });
        }
        
        // Add init containers
        if (resource.spec.initContainers && resource.spec.initContainers.length > 0) {
            groups.push({
                offset: (resource.spec.containers || []).length,
                title: 'INIT CONTAINERS',
                containers: resource.spec.initContainers
            });
        }
        
        return groups;
    }, [resource.spec]);

    // Set the initial container when the resource changes
    useEffect(() => {
        if (containerGroups.length > 0 && containerGroups[0].containers.length > 0) {
            setSelectedContainer(containerGroups[0].containers[0].name);
        }
    }, [containerGroups]);

    // Fetch logs for the selected container
    useEffect(() => {
        setLogs([]);
        if (!selectedContainer) {
            return;
        }

        const logsSource = getContainerLogs({
                applicationName: application.metadata.name,
                appNamespace: application.metadata.namespace,
                namespace: resource.metadata.namespace,
                podName: resource.metadata.name,
                resource: {
                    group: resource.kind === 'Pod' ? '' : resource.apiVersion?.split('/')[0] || '',
                    kind: resource.kind,
                    name: resource.metadata.name
                },
                containerName: selectedContainer,
                tail: 1000,
                follow: true,
                filter: filterText || undefined
            }) // accumulate log changes and render only once every 100ms to reduce CPU usage
            .pipe(bufferTime(100))
            .pipe(retryWhen(errors => errors.pipe(delay(500))))
            .subscribe(log => {
                if (!log || !log.length) {
                    return;
                }
                setLogs(previousLogs => previousLogs.concat(log))
            });

        return () => logsSource.unsubscribe();
    }, [application.metadata.name, application.metadata.namespace, resource.metadata.namespace, resource.metadata.name, resource.kind, selectedContainer, filterText]);

    // Update log mode when logs change
    useEffect(() => {
        // only determine the log mode in the first 100 logs
        if (logs.length > 0 && logs.length < 100) {
            setLogMode(determineLogMode(logs));
        }
    }, [logs]);

    useEffect(() => {
        if (followLogs && contentRef.current) {
            contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
    }, [logs, followLogs]);

    // Function to copy logs to clipboard
    const copyLogsToClipboard = () => {
        const rawLogs = logs.map(log => log.content).join('\n');
        navigator.clipboard.writeText(rawLogs)
            .then(() => {
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            })
            .catch(err => {
                console.error('Failed to copy logs: ', err);
            });
    };

    return (
        <div className={`pretty-logs-container ${uiMode}`}>
            <div className='pretty-logs-controls'>
                <div className='pretty-logs-controls-left'>
                    <ToggleButton
                        title='Wrap lines'
                        onToggle={() => setWrapLines(!wrapLines)}
                        toggled={wrapLines}
                        icon='fa fa-align-left'
                    />
                    <ToggleButton
                        title='Follow logs'
                        onToggle={() => setFollowLogs(!followLogs)}
                        toggled={followLogs}
                        icon='fa fa-arrow-down'
                    />
                    <ToggleButton
                        title={`Switch to ${uiMode === 'dark' ? 'bright' : 'dark'} mode`}
                        onToggle={() => setUiMode(uiMode === 'dark' ? 'bright' : 'dark')}
                        toggled={uiMode === 'bright'}
                        icon={uiMode === 'dark' ? 'fa fa-sun' : 'fa fa-moon'}
                    />
                    <ToggleButton
                        title='Copy logs to clipboard'
                        onToggle={copyLogsToClipboard}
                        toggled={false}
                        icon='fa fa-copy'
                    />
                    <ToggleButton
                        title='Clear logs'
                        onToggle={() => setLogs([])}
                        toggled={false}
                        icon='fa fa-trash'
                    />
                    {containerGroups.length > 0 && (
                        <Tooltip content='Select a container to view logs'>
                            <select 
                                className='argo-field' 
                                value={selectedContainer} 
                                onChange={e => setSelectedContainer(e.target.value)}
                                style={{marginLeft: '8px'}}
                            >
                                {containerGroups.map(group => (
                                    <optgroup key={group.title} label={group.title}>
                                        {group.containers.map((container: Container) => (
                                            <option key={container.name} value={container.name}>
                                                {container.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </Tooltip>
                    )}
                    <Tooltip content='Filter logs by text'>
                        <input
                            className='argo-field'
                            placeholder='Filter logs...'
                            value={filterText}
                            onChange={e => setFilterText(e.target.value)}
                            style={{marginLeft: '8px', width: '150px'}}
                        />
                    </Tooltip>
                </div>
                <div className='pretty-logs-controls-right'>
                    {copySuccess && (
                        <span className='copy-success-message'>
                            <i className='fa fa-check' style={{marginRight: '4px'}}></i>
                            Copied!
                        </span>
                    )}
                    <Tooltip content="Log formatting should be JSON">
                        <span className={`log-mode-indicator log-mode-${logMode}`}>
                            {logMode === 'json' ? (
                                <i className='fa fa-check' style={{marginRight: '4px'}}></i>
                            ) : (
                                <i className='fa fa-times' style={{marginRight: '4px'}}></i>
                            )}
                            {logMode.toUpperCase()}
                        </span>
                    </Tooltip>
                </div>
            </div>
            <div ref={contentRef} className={`pretty-logs-content ${wrapLines ? 'wrap-lines' : 'no-wrap'}`}>
                {logs.map((log, i) => (
                    <div key={i}>{formatLogLine(log.content)}</div>
                ))}
            </div>
        </div>
    );
}; 