import { useEffect } from 'react';
import { useExploreFlowStore } from '~/stores/exploreStore';
import { BaseExploreNodeAsset } from '~/types/explore/nodeData/baseNodeData';
import { ExploreNodeType } from '~/types/explore/nodeTypesCategories';
import { AssetType } from '~/types/files.types';
import { useSpawnNode } from './useSpawnNode';

interface UseHandleMinerOutputParams {
    nodeId: string;
    outputAssetId: string | null | undefined;
    outputAssetType: AssetType;
    outputNodeType: ExploreNodeType;
    inputFileName: string;
}

export const useHandleMinerOutput = ({
    nodeId,
    outputAssetId,
    outputAssetType,
    outputNodeType,
    inputFileName,
}: UseHandleMinerOutputParams) => {
    const { updateNodeData, getNode } = useExploreFlowStore();
    const { spawnDownstreamNode } = useSpawnNode();

    useEffect(() => {
        if (!outputAssetId || !inputFileName) return;

        const node = getNode(nodeId);
        if (!node) return;

        const newAsset: BaseExploreNodeAsset = {
            id: outputAssetId,
            io: 'output',
            origin: 'mined',
            type: outputAssetType,
            name: inputFileName,
        };

        const alreadyExists = node.data.assets.some((a) => a.id === newAsset.id && a.io === 'output');

        if (!alreadyExists) {
            updateNodeData(nodeId, (prev) => {
                // Replace any existing output assets with the new one to ensure single output
                const currentAssets = prev.assets.filter((a) => a.io !== 'output');
                return {
                    ...extraNodeData,
                    assets: [...currentAssets, newAsset],
                    isStale: false, // Mark node as fresh/evaluated
                };
            });

            spawnDownstreamNode(nodeId, outputNodeType);
        }
    }, [
        outputAssetId,
        inputFileName,
        outputAssetType,
        outputNodeType,
        nodeId,
        updateNodeData,
        getNode,
        spawnDownstreamNode,
    ]);
};
