import * as React from 'react';
import {useCallback, useRef, useState} from 'react';
import {DebugPod} from '../models/pod-models';
import {copyFiles} from '../service/debug-pod-service';
import {Notification} from '../shared-components/notification-bar/notification-bar';
import './debug-pod-upload-tab.scss';
import { Loader } from '../shared-components/loader/loader';

export interface DebugPodUploadTabProps {
    setNotification: (notification: Notification | null) => void;
    selectedPod: DebugPod;
}

export const DebugPodUploadTab = ({ selectedPod, setNotification }: DebugPodUploadTabProps) => {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedContainer, setSelectedContainer] = useState<string>('');
    const [destinationPath, setDestinationPath] = useState<string>('/');
    const [loader, setLoader] = useState<{percent: number} | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dirInputRef = useRef<HTMLInputElement>(null);

    // Set initial container if available
    React.useEffect(() => {
        if (selectedPod.pod.spec.containers.length > 0 && !selectedContainer) {
            setSelectedContainer(selectedPod.pod.spec.containers[0].name);
        }
    }, [selectedPod, selectedContainer]);

    const addFiles = useCallback(async (files: File[]) => {
        const newFiles = [...selectedFiles];
        for (const file of files) {
            if (!await containsFile(selectedFiles, file)) {
                newFiles.push(file);
            }
        }
        setSelectedFiles(newFiles);
    }, [selectedFiles]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            addFiles(files);
            e.target.value = '';
        }
    };

    const handleDirectoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            addFiles(files);
            e.target.value = '';
        }
    };

    const handleRemoveFile = (idx: number) => {
        setSelectedFiles(files => {
            const newFiles = files.filter((_, i) => i !== idx);
            if (newFiles.length === 0 && fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return newFiles;
        });
    };

    const handleClearAll = () => {
        setSelectedFiles([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            const files = await getAllFileEntries(e.dataTransfer.items);
            addFiles(files);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addFiles(Array.from(e.dataTransfer.files));
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleUpload = async () => {
        setLoader({percent: 0});
        try {
            await copyFiles(selectedFiles, selectedPod.cluster, selectedPod.pod.metadata.namespace, selectedPod.pod.metadata.name, selectedContainer, destinationPath, (progress) => {
                setLoader({percent: progress});
            });
            setNotification({
                message: `Successfully uploaded ${selectedFiles.length} files to ${selectedContainer}`,
                type: 'success'
            });
            setSelectedFiles([]);
        } catch (error) {
            setNotification({
                message: `Failed to upload files: ${error}`,
                type: 'error',
                requireApproval: true
            });
        } finally {
            setLoader(null);
        }
    }

    if (loader) {
        return <Loader percent={loader.percent} />;
    }

    return (
        <div
            className={`debug-pod-upload-tab full-width${isDragging ? ' drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="upload-header">Upload Files to Debug Pod</div>
            
            <div className="upload-settings">
                <div className="upload-settings-row">
                    <div className="upload-settings-label">Target Container</div>
                    <select 
                        className="argo-select"
                        value={selectedContainer}
                        onChange={(e) => setSelectedContainer(e.target.value)}
                    >
                        {selectedPod.pod.spec.containers.map(container => (
                            <option key={container.name} value={container.name}>
                                {container.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="upload-settings-row">
                    <div className="upload-settings-label">Destination Path</div>
                    <input
                        type="text"
                        className="argo-input"
                        value={destinationPath}
                        onChange={(e) => setDestinationPath(e.target.value)}
                        placeholder="/"
                    />
                </div>
            </div>

            <div className="upload-controls">
                <div className="upload-controls-left">
                    <button
                        className="argo-button argo-button--base"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <i className="fa fa-upload" style={{ marginRight: 6 }} />
                        Select Files
                    </button>
                    <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />
                    <button
                        className="argo-button argo-button--base"
                        style={{ marginLeft: 4 }}
                        onClick={() => dirInputRef.current?.click()}
                    >
                        <i className="fa fa-folder-open" style={{ marginRight: 6 }} />
                        Select Directory
                    </button>
                    <input
                        type="file"
                        multiple
                        ref={dirInputRef}
                        style={{ display: 'none' }}
                        onChange={handleDirectoryChange}
                        {...{ webkitdirectory: '' }}
                    />
                    {selectedFiles.length > 0 && (
                        <button
                            className="argo-button argo-button--base-o"
                            style={{ marginLeft: 12 }}
                            onClick={handleClearAll}
                        >
                            <i className="fa fa-trash" style={{ marginRight: 6 }} />
                            Clear All
                        </button>
                    )}
                </div>
                <div className="upload-controls-right">
                    <button
                        className="argo-button argo-button argo-button--base"
                        style={{ marginLeft: 16 }}
                        disabled={selectedFiles.length === 0 || !selectedContainer}
                        onClick={handleUpload}
                    >
                        <i className="fa fa-cloud-upload-alt" style={{ marginRight: 6 }} />
                        Upload
                    </button>
                </div>
            </div>
            {selectedFiles.length > 0 ? (
                <div className="selected-files-table-container">
                    <table className="selected-files-table">
                        <thead>
                            <tr>
                                <th>File Name</th>
                                <th>Size</th>
                                <th>Type</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {selectedFiles.map((file, idx) => (
                                <tr key={file.name + idx}>
                                    <td><i className="fa fa-file" style={{ marginRight: 6 }} />{file.name}</td>
                                    <td>{(file.size / 1024).toFixed(1)} KB</td>
                                    <td>{file.type || '—'}</td>
                                    <td>
                                        <button
                                            className="remove-file-btn"
                                            title="Remove file"
                                            onClick={() => handleRemoveFile(idx)}
                                        >
                                            <i className="fa fa-times" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="drop-message">
                    <i className="fa fa-cloud-upload-alt" style={{ fontSize: 32, marginBottom: 12 }} />
                    <div>Drop files to upload</div>
                </div>
            )}
            {isDragging && (
                <div className="drop-overlay">
                    <div className="drop-message">
                        <i className="fa fa-cloud-upload-alt" style={{ fontSize: 32, marginBottom: 12 }} />
                        <div>Drop files to upload</div>
                    </div>
                </div>
            )}
        </div>
    );
};

async function containsFile(files: File[], file: File) {
    for (const f of files) {
        if (await isSameFile(f, file)) {
            return true;
        }
    }

    return false;
}

async function isSameFile(file1: File, file2: File) {
    if (file1.name !== file2.name && file1.size !== file2.size && file1.type !== file2.type) {
        return false;
    }

    const arrayBuffer1 = await file1.arrayBuffer();
    const arrayBuffer2 = await file2.arrayBuffer();

    const uint8Array1 = new Uint8Array(arrayBuffer1);
    const uint8Array2 = new Uint8Array(arrayBuffer2);

    for (let i = 0; i < uint8Array1.length; i++) {
        if (uint8Array1[i] !== uint8Array2[i]) {
            return false;
        }
    }

    return true;
}

async function getAllFileEntries(dataTransferItemList: DataTransferItemList): Promise<File[]> {
    const files: File[] = [];

    async function traverseFileTree(entry: any, path: string): Promise<void> {
        if (entry.isFile) {
            await new Promise<void>(resolve => {
                entry.file((file: File) => {
                    Object.defineProperty(file, 'webkitRelativePath', {
                        value: path
                    });
                    files.push(file);
                    resolve();
                });
            });
        } else if (entry.isDirectory) {
            await new Promise<void>((resolve, reject) => {
                const dirReader = entry.createReader();
                const readEntries = () => {
                    dirReader.readEntries(async (entries: any[]) => {
                        if (!entries.length) {
                            resolve();
                            return;
                        }
                        try { 
                            await Promise.all(entries.map((entry: any) =>
                                traverseFileTree(entry, path + (path && !path.endsWith('/') ? '/' : '') + entry.name)
                            ));
                        } catch (e) {
                            reject(e);
                        }
                        readEntries();
                    });
                };
                readEntries();
            });
        }
    }

    const entries: any[] = [];
    for (let i = 0; i < dataTransferItemList.length; i++) {
        const entry = dataTransferItemList[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
    }
    await Promise.all(entries.map(entry => traverseFileTree(entry, entry.isDirectory ? entry.name + '/' : '')));
    return files;
}
