export const fileNodeTypes = ['ocptFileNode', 'ocelFileNode', 'objectEventGraphNode'] as const;
export type ExploreFileNodeType = (typeof fileNodeTypes)[number];

export const visualizationNodeTypes = [
    'ocptVisualizationNode',
    'lbofVisualizationNode',
    'eventGraphVisualizationNode',
] as const;
export type ExploreVisualizationNodeType = (typeof visualizationNodeTypes)[number];

export const minerNodeTypes = ['ocptMinerNode', 'objectEventGraphMinerNode'] as const;
export type ExploreMinerNodeType = (typeof minerNodeTypes)[number];

export type ExploreNodeType = ExploreFileNodeType | ExploreVisualizationNodeType | ExploreMinerNodeType;

export const exploreNodeCategories = ['file', 'visualization', 'miner'] as const;
export type ExploreNodeCategory = (typeof exploreNodeCategories)[number];

export type NodeId = string;

const buildNodeTypeCategoryMap = (): Record<ExploreNodeType, ExploreNodeCategory> => {
    const map: Partial<Record<ExploreNodeType, ExploreNodeCategory>> = {};

    for (const type of fileNodeTypes) {
        map[type] = 'file';
    }
    for (const type of visualizationNodeTypes) {
        map[type] = 'visualization';
    }
    for (const type of minerNodeTypes) {
        map[type] = 'miner';
    }

    return map as Record<ExploreNodeType, ExploreNodeCategory>;
};

export const getNodeCategory = buildNodeTypeCategoryMap();
