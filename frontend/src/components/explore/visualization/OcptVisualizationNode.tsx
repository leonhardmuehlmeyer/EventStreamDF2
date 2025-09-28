import { memo, useEffect, useMemo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Position } from '@xyflow/react';
import { useNavigate } from 'react-router-dom';
import BaseVisualizationNode from '~/components/explore/visualization/BaseVisualizationNode';
import { useGetOcpt } from '~/services/queries';
import type { TVisualizationNode } from '~/types/explore';

const OcptVisualizationNode = memo<NodeProps<TVisualizationNode>>((node) => {
    const [fileId, setFileId] = useState<null | string>(null);
    const { data, isLoading } = useGetOcpt(fileId, true);
    const navigate = useNavigate();

    const visualize = (filter?: string) => {
        navigate(`/data/pipeline/explore/ocpt/${node.id}${filter ? `?filter=${filter}` : ''}`);
    };

    useMemo(() => {
        const inputAsset = node.data.assets.find((asset) => asset.io === 'input');
        if (inputAsset) setFileId(inputAsset.id);
    }, [node.data.assets]);

    useEffect(() => {
        if (data) node.data.processedData = data.ocpt;
    }, [data]);

    return (
        <BaseVisualizationNode
            {...node}
            title="OCPT Visualization"
            iconName="network"
            handleOptions={[
                { position: Position.Left, type: 'target' as const },
                { position: Position.Right, type: 'source' as const },
            ]}
            dropdownOptions={[{ label: 'Change Source', action: 'changeSourceFile' as const }]}
            visualize={visualize}
        />
    );
});

export default OcptVisualizationNode;
