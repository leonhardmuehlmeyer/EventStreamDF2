<<<<<<< HEAD
import { File, FileJson, FileSpreadsheet, Network, Pickaxe, TreePine, Workflow } from 'lucide-react';
=======
import {
    AlignEndHorizontal,
    Eye,
    File,
    FileJson,
    FileSpreadsheet,
    Network,
    Pickaxe,
    TreePine,
    Workflow,
} from 'lucide-react';
>>>>>>> main
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
} from '~/components/ui/sidebar';
import DndCard from '~/components/explore/DndCard';

interface ExploreSidebarProps {}

const ExploreSidebar: React.FC<ExploreSidebarProps> = ({}) => {
    return (
        <Sidebar side="right">
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>
                        <File />
                        <p className="ml-1">File Input</p>
                    </SidebarGroupLabel>
                    <SidebarGroupContent className="p-1">
                        <SidebarMenu className="flex flex-row">
                            <SidebarMenuItem className="ml-1">
                                <DndCard title="OCPT File" Icon={FileJson} nodeType="ocptFileNode" />
                            </SidebarMenuItem>
                            <SidebarMenuItem className="ml-1">
                                <DndCard title="OCEL File" Icon={FileSpreadsheet} nodeType="ocelFileNode" />
                            </SidebarMenuItem>
                            <SidebarMenuItem className="ml-1">
                                <DndCard title="Object Event-Graph" Icon={Network} nodeType="objectEventGraphNode" />
                            </SidebarMenuItem>
                            <SidebarMenuItem className="ml-1">
                                <DndCard
                                    title="Histogram Visualization"
                                    Icon={AlignEndHorizontal}
                                    nodeType="histVisualizationNode"
                                />
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                    <SidebarGroupLabel>
                        <Pickaxe />
                        <p className="ml-1">Miner</p>
                    </SidebarGroupLabel>
                    <SidebarGroupContent className="p-1">
                        <SidebarMenu className="flex flex-row">
                            <SidebarMenuItem className="ml-1">
                                <DndCard title="OCPT Miner" Icon={TreePine} nodeType="ocptMinerNode" />
                            </SidebarMenuItem>
                            <SidebarMenuItem className="ml-1">
                                <DndCard
                                    title="Object Event-Graph Miner"
                                    Icon={Workflow}
                                    nodeType="objectEventGraphMinerNode"
                                />
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
};

export default ExploreSidebar;
