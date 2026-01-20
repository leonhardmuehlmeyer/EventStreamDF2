import { Connection } from '@xyflow/react';
import { useExploreFlowStore } from '~/stores/exploreStore';
import { isFileNode } from '~/lib/explore/exploreNodes.utils';
import { BaseExploreNodeAsset } from '~/types/explore/nodeData/baseNodeData';
import { ExploreNodeType } from '~/types/explore/nodeTypesCategories';
import { AssetType } from '~/types/files.types';
import { NodeFactory } from '~/model/explore/node-factory.model';

/**
 * Handles the connection of two nodes and propagates assets.
 * This can be used outside of a React component/hook context.
 */
export const handleConnect = (connection: Connection) => {
    const { source, target } = connection;
    const { updateNodeData, onConnect, getNode } = useExploreFlowStore.getState();

    const sourceNode = getNode(source);
    const targetNode = getNode(target);

    // Add Edge
    onConnect(connection);

    // Propagate Assets
    if (sourceNode && targetNode) {
        const propagatedAssets: BaseExploreNodeAsset[] = (sourceNode.data.assets || [])
            .filter((asset) => asset.io === 'output')
            .flatMap((asset) => {
                // If the target is a File Node, it acts as a pass-through/source.
                // We strictly set it as an OUTPUT asset so it can be chained immediately.
                if (isFileNode(targetNode)) {
                    return [{ ...asset, io: 'output' } as BaseExploreNodeAsset];
                }

                // For other nodes (miners), it comes in as input
                return [{ ...asset, io: 'input' } as BaseExploreNodeAsset];
            });

        if (propagatedAssets.length > 0) {
            updateNodeData(target, (prev) => {
                const existingAssets = prev.assets || [];
                const uniqueNewAssets = propagatedAssets.filter(
                    (newAsset) =>
                        !existingAssets.some((existing) => existing.id === newAsset.id && existing.io === newAsset.io)
                );
                return { assets: [...existingAssets, ...uniqueNewAssets] };
            });
        }
    }
};

/**
 * Spawns a downstream node and connects it to the source node.
 */
export const spawnDownstreamNode = (sourceNodeId: string, nodeType: ExploreNodeType) => {
    const { nodes, addNode } = useExploreFlowStore.getState();
    const sourceNode = nodes.find((n) => n.id === sourceNodeId);
    if (!sourceNode) return;

    const newNodePosition = {
        x: sourceNode.position.x + 400,
        y: sourceNode.position.y,
    };

    const newNode = NodeFactory.createNode(newNodePosition, nodeType);
    addNode(newNode);

    const connection: Connection = {
        source: sourceNode.id,
        target: newNode.id,
        sourceHandle: null,
        targetHandle: null,
    };
    handleConnect(connection);
};

export interface HandleMinerOutputParams {
    nodeId: string;
    outputAssetId: string | null | undefined;
    outputAssetType: AssetType;
    outputNodeType: ExploreNodeType;
    inputFileName: string;
}

/**
 * Handles the output of a miner node, updating the node's assets and spawning a downstream node if needed.
 */
export const handleMinerOutput = ({
    nodeId,
    outputAssetId,
    outputAssetType,
    outputNodeType,
    inputFileName,
}: HandleMinerOutputParams) => {
    if (!outputAssetId || !inputFileName) return;

    const { updateNodeData, getNode } = useExploreFlowStore.getState();
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
            const currentAssets = prev.assets.filter((a) => a.io !== 'output');
            return {
                assets: [...currentAssets, newAsset],
            };
        });
        spawnDownstreamNode(nodeId, outputNodeType);
    }
};
