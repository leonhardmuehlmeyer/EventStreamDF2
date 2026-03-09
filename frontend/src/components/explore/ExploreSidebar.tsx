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
import { iconMap } from '~/lib/iconMap';

const ExploreSidebar: React.FC = () => {
    return (
        <Sidebar side="right">
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>
                        <iconMap.file />
                        <p className="ml-1">File Input</p>
                    </SidebarGroupLabel>
                    <SidebarGroupContent className="p-1">
                        <SidebarMenu className="flex flex-row">
                            <SidebarMenuItem className="ml-1">
                                <DndCard title="OCPT File" Icon={iconMap.fileJson} nodeType="ocptFileNode" />
                            </SidebarMenuItem>
                            <SidebarMenuItem className="ml-1">
                                <DndCard title="OCEL File" Icon={iconMap.fileSpreadsheet} nodeType="ocelFileNode" />
                            </SidebarMenuItem>
                            <SidebarMenuItem className="ml-1">
                                <DndCard title="Event Stream" Icon={iconMap.activity} nodeType="eventStreamNode" />
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                    <SidebarGroupLabel>
                        <iconMap.pickaxe />
                        <p className="ml-1">Miner</p>
                    </SidebarGroupLabel>
                    <SidebarGroupContent className="p-1">
                        <SidebarMenu className="flex flex-row flex-wrap gap-y-2">
                            <SidebarMenuItem className="ml-1">
                                <DndCard title="OCPT Miner" Icon={iconMap.treePine} nodeType="ocptMinerNode" />
                            </SidebarMenuItem>
                            <SidebarMenuItem className="ml-1">
                                <DndCard title="DF2 Live" Icon={iconMap.activity} nodeType="df2StreamMinerNode" />
                            </SidebarMenuItem>
                            <SidebarMenuItem className="ml-1">
                                <DndCard title="OCPT Live" Icon={iconMap.treePine} nodeType="ocptStreamMinerNode" />
                            </SidebarMenuItem>
                            <SidebarMenuItem className="ml-1">
                                <DndCard
                                    title="Histogram Filter"
                                    Icon={iconMap.chartBar}
                                    nodeType="histogramMinerNode"
                                />
                            </SidebarMenuItem>
                            <SidebarMenuItem className="ml-1">
                                <DndCard title="Case Notions" Icon={iconMap.waves} nodeType="caseNotionMinerNode" />
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
};

export default ExploreSidebar;
