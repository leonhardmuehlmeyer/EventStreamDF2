import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SidebarProvider } from '~/components/ui/sidebar';
import AppSidebar from '~/components/AppSidebar';
import BreadcrumbNav from '~/components/BreadcrumbNav';
// import OcelVisualization from '~/components/ocel/OcelVisualization';
import OcelVisualization from '~/components/graph_visualization/OcelVisualization';
import { useExploreFlowStore } from '~/stores/exploreStore';
// import { useColorScaleStore } from '~/stores/store';
import type { VisualizationExploreNodeData } from '~/types/explore';

const OcelViewer: React.FC = () => {
    const [fileId, setFileId] = useState<string | null>(null);
    const { nodeId } = useParams<{ nodeId: string }>();
    const { getNode } = useExploreFlowStore();
    // const { colorScale } = useColorScaleStore();

    // Restore the saved flow from localStorage
    useEffect(() => {
        const savedFlow = localStorage.getItem('currentExploreFlow');
        if (savedFlow) {
            const { nodes, edges } = JSON.parse(savedFlow);
            useExploreFlowStore.setState({ nodes, edges });
        }
    }, []);

    // Extract the fileId from the node
    useEffect(() => {
        if (!nodeId) return;

        const node = getNode(nodeId);
        if (!node) {
            console.warn(` Node with ID ${nodeId} not found.`);
            return;
        }

        const nodeData = node.data as VisualizationExploreNodeData;
        const processedData: any = nodeData?.processedData;

        console.dir(node, { depth: null });
        console.log('Node found:', node);
        console.log('Processed data:', processedData);

        if (processedData?.fileId) {
            console.log('File ID from processedData:', processedData.fileId);
            setFileId(processedData.fileId);
            return;
        }

        if (nodeData?.assets?.length > 0) {
            const firstAsset = nodeData.assets[0];
            console.log(' Extracted file ID from assets:', firstAsset.id);
            setFileId(firstAsset.id);
        } else {
            console.warn(' No assets found in node data.');
        }
    }, [nodeId, getNode]);

    return (
        <SidebarProvider>
            <div className="h-screen w-screen overflow-hidden">
                <BreadcrumbNav />
                <div className="flex flex-1 h-full w-full">
                    {fileId ? (
                        <OcelVisualization fileId={fileId} />
                    ) : (
                        <div className="flex flex-1 items-center justify-center">
                            <p className="text-gray-500">No OCEL file connected.</p>
                        </div>
                    )}
                </div>
                {/* <AppSidebar coloring={colorScale} objectTypes={[]} /> */}
            </div>
        </SidebarProvider>
    );
};

export default OcelViewer;
