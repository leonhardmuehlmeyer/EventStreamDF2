import { FileExploreNodeData } from '~/types/explore/nodeData/fileNodeData';
import { VisualizationExploreNodeData } from '~/types/explore/nodeData/visualizationNodeData';
import { ExploreNode, ExploreNodeData, FileNode, MinerNode } from '~/types/explore/nodes';
import {
    ExploreFileNodeType,
    ExploreMinerNodeType,
    ExploreNodeCategory,
    ExploreNodeType,
    ExploreVisualizationNodeType,
    fileNodeTypes,
    getNodeCategory,
    minerNodeTypes,
    visualizationNodeTypes,
} from '~/types/explore/nodeTypesCategories';
import { AssetType } from '~/types/files.types';
import type { VisualizationExploreNode } from '~/model/explore/visualization-node.model';

export const getNodeCategoryByType = (type: ExploreNodeType): ExploreNodeCategory => {
    return getNodeCategory[type];
};

export function isFileNode(node: ExploreNode): node is FileNode {
    return node.data.nodeCategory === 'file';
}

export function isFileNodeData(data: ExploreNodeData): data is FileExploreNodeData {
    return data.nodeCategory === 'file';
}

export function isVisualizationNode(node: ExploreNode): node is VisualizationExploreNode {
    return node.data.nodeCategory === 'visualization';
}

export function isFullVisualizationData(data: ExploreNodeData): data is VisualizationExploreNodeData {
    return data.nodeCategory === 'visualization';
}

export function isExploreFileNodeType(nodeType: ExploreNodeType): nodeType is ExploreFileNodeType {
    return fileNodeTypes.includes(nodeType as ExploreFileNodeType);
}

export function isExploreVisualizationNodeType(nodeType: ExploreNodeType): nodeType is ExploreVisualizationNodeType {
    return visualizationNodeTypes.includes(nodeType as ExploreVisualizationNodeType);
}

export function isMinerNode(node: ExploreNode): node is MinerNode {
    return node.data.nodeCategory === 'miner';
}

export function isExploreMinerNodeType(nodeType: ExploreNodeType): nodeType is ExploreMinerNodeType {
    return minerNodeTypes.includes(nodeType as ExploreMinerNodeType);
}

export const assetTypeToNodeType = (assetType: AssetType): ExploreFileNodeType | null => {
    if (assetType === 'ocptFile' || assetType === 'ocptAsset') {
        return 'ocptFileNode';
    }
    if (assetType === 'ocelFile' || assetType === 'ocelAsset') {
        return 'ocelFileNode';
    }
    if (assetType === 'objectEventGraph') {
        return 'objectEventGraphNode';
    }
    return null;
};
