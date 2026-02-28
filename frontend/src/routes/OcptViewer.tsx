import { useCallback, useEffect, useRef, useState } from 'react';
import { scaleOrdinal } from '@visx/scale';
import { useParams, useSearchParams } from 'react-router-dom';
import { SidebarProvider } from '~/components/ui/sidebar';
import BreadcrumbNav from '~/components/BreadcrumbNav';
import OCPT from '~/components/ocpt/OCPT';
import OcptSidebar from '~/components/ocpt/OcptSidebar';
import { useExploreFlowStore } from '~/stores/exploreStore';
import { useIsOcptMode } from '~/stores/store';
import { addIdsToTree } from '~/lib/ocpt/ocptAddIds';
import { VisualizationNode } from '~/types/explore/nodes';
import { type Node, type OcptSchemaApi } from '~/types/ocpt/ocpt.types';

const OcptViewer: React.FC = () => {
    const [treeData, setTreeData] = useState<Node | null>(null);
    const [objectTypes, setObjectTypes] = useState<string[]>([]);
    const [filteredObjectTypes, setFilteredObjectTypes] = useState<string[]>([]);
    const [showDetails, setShowDetails] = useState(false);
    const exportFnRef = useRef<(() => void) | null>(null);
    const handleExportReady = useCallback((fn: () => void) => {
        exportFnRef.current = fn;
    }, []);
    const handleExport = useCallback(() => {
        exportFnRef.current?.();
    }, []);
    const { nodeId } = useParams<{ nodeId: string }>();
    const [searchParams] = useSearchParams();
    const { getNode, updateNodeData } = useExploreFlowStore();
    const { isOcptMode } = useIsOcptMode();

    const node = nodeId ? (getNode(nodeId) as VisualizationNode) : undefined;
    const nodeData = node?.data;
    const viewState = nodeData?.viewState;

    const colorScale = viewState
        ? scaleOrdinal<string, string>({ domain: viewState.colorScale.domain, range: viewState.colorScale.range })
        : scaleOrdinal<string, string>({ domain: [], range: [] });

    useEffect(() => {
        const filterFromUrl = searchParams.get('filter');
        // Only sync from the URL if the parameter exists.
        if (filterFromUrl !== null && nodeId && viewState) {
            const newFilteredObjectTypes = filterFromUrl === '' ? [] : filterFromUrl.split(',');

            // Update the store only if the URL state is different from the store state.
            if (JSON.stringify(viewState.filteredObjectTypes) !== JSON.stringify(newFilteredObjectTypes)) {
                updateNodeData(nodeId, { viewState: { ...viewState, filteredObjectTypes: newFilteredObjectTypes } });
            }
        }
        // We only want this effect to run when the component loads or the URL/node changes,
        // not when the viewState is updated by the user in the sidebar.
    }, [searchParams, nodeId]);

    useEffect(() => {
        if (nodeId) {
            const processedData = nodeData?.processedData;

            if (processedData) {
                const idTree = addIdsToTree(processedData.hierarchy);
                setTreeData(idTree);
                setObjectTypes(processedData.ots);
            }
        }
    }, [nodeId, nodeData]);


    return (
        <SidebarProvider>
            <div className="h-screen w-screen overflow-hidden">
                <BreadcrumbNav />
                <div className="flex flex-1 h-full w-full">
                    {isOcptMode && node ? (
                        <OCPT treeData={treeData} colorScale={colorScale} node={node} showDetails={showDetails} onExportReady={handleExportReady} />
                    ) : treeData ? (
                        <OCPT treeData={treeData} colorScale={colorScale} filteredObjectTypes={filteredObjectTypes} showDetails={showDetails} onExportReady={handleExportReady} />
                    ) : (
                        <div></div>
                    )}
                </div>
                {nodeId && viewState ? (
                    <OcptSidebar
                        objectTypes={objectTypes}
                        coloring={colorScale}
                        nodeId={nodeId}
                        filteredObjectTypes={viewState.filteredObjectTypes}
                        onFilteredObjectTypesChange={(newFilteredObjectTypes) => {
                            updateNodeData(nodeId, {
                                viewState: { ...viewState, filteredObjectTypes: newFilteredObjectTypes },
                            });
                        }}
                        conformanceData={nodeData?.conformanceData}
                        showDetails={showDetails}
                        onShowDetailsChange={setShowDetails}
                        onExport={handleExport}
                    />
                ) : treeData ? (
                    <OcptSidebar
                        objectTypes={objectTypes}
                        coloring={colorScale}
                        nodeId={undefined}
                        filteredObjectTypes={filteredObjectTypes}
                        onFilteredObjectTypesChange={setFilteredObjectTypes}
                        showDetails={showDetails}
                        onShowDetailsChange={setShowDetails}
                        onExport={handleExport}
                    />
                ) : (
                    <div>Can not load sidebar. No nodeId found.</div>
                )}
            </div>
        </SidebarProvider>
    );
};

export default OcptViewer;
