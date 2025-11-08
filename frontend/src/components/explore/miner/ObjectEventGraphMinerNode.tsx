import { memo, useEffect, useMemo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Position } from '@xyflow/react';
import BaseMinerNode from '~/components/explore/miner/BaseMinerNode';
import { useGetOcel } from '~/services/queries';
import type {
    BaseExploreNodeAsset,
    BaseExploreNodeDropdownActionType,
    BaseExploreNodeDropdownOption,
} from '~/types/explore/nodeData/baseNodeData';
import { MinerNode } from '~/types/explore/nodes';

const ObjectEventGraphMinerNode = memo<NodeProps<MinerNode>>((node) => {
    const [fileId, setFileId] = useState<null | string>(null);
    const [fileName, setFileName] = useState<string>('');

    const hasMinedAsset = useMemo(() => {
        return node.data.assets.some((asset) => asset.io === 'output' && asset.origin === 'mined');
    }, [node.data.assets]);

    // Placeholder for a hook that would process an OCEL into a graph
    const { isLoading, data } = useGetOcel(fileId);

    useMemo(() => {
        const inputAsset = node.data.assets.find((asset) => asset.io === 'input');
        if (!inputAsset) return;

        setFileId(inputAsset.id);
        setFileName(inputAsset.name);
    }, [node]);

    useEffect(() => {
        const inputAsset = node.data.assets.find((asset) => asset.io === 'input');
        const outputAssets = node.data.assets.filter((asset) => asset.io === 'output');

        // Only run if we have an input, don't have an output, and the data is "loaded"
        if (!inputAsset || outputAssets.length > 0 || !data) return;

        const newOutputAsset: BaseExploreNodeAsset = {
            ...inputAsset,
            id: inputAsset.id, // Use same ID
            io: 'output',
            origin: 'mined',
            type: 'objectEventGraph',
            name: `oeg_${inputAsset.name}`,
        };

        const updatedAssets = [...node.data.assets, newOutputAsset];
        node.data.onDataChange(node.id, { assets: updatedAssets });
    }, [data, node.data.assets, node.id, node.data.onDataChange]);

    const handleDropdownAction = (action: BaseExploreNodeDropdownActionType) => {
        // No specific actions for now
    };

    const dropdownOptions: BaseExploreNodeDropdownOption[] = [
        { label: 'Change Source', action: 'changeSourceFile' as const },
    ];

    return (
        <BaseMinerNode
            {...node}
            title="Object Event-Graph Miner"
            iconName="workflow" // Using a different icon
            handleOptions={[
                { position: Position.Left, type: 'target' as const },
                { position: Position.Right, type: 'source' as const },
            ]}
            dropdownOptions={dropdownOptions}
            onDropdownAction={handleDropdownAction}
            isLoading={isLoading}
        />
    );
});

export default ObjectEventGraphMinerNode;
