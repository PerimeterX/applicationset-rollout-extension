import * as React from 'react';
import {useMemo} from 'react';
import {DebugPod} from '../models/pod-models';
import {YamlEditor} from '../shared-components/yaml-editor/yaml-editor';

import './debug-pod-manifest.scss';

interface DebugPodManifestProps {
    selectedPod: DebugPod;
}

export const DebugPodManifest = ({ selectedPod }: DebugPodManifestProps) => {
    const pod = useMemo(() => {
        const pod = selectedPod.pod;
        delete pod.metadata['managedFields'];
        return pod;
    }, [selectedPod]);

    return (
        <>
            <div className="debug-pod-manifest__manifest-title">
                <div className="debug-pod-manifest__manifest-title-text">Debug Pod Manifest</div>
            </div>
            <YamlEditor
                input={pod}
                hideModeButtons={true}
            />
        </>
    );
}