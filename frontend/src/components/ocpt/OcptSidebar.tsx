import { ScaleOrdinal } from 'd3';
import { ShieldCheck } from 'lucide-react';
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
} from '~/components/ui/sidebar';
import ObjectTypeLegend from '~/components/ocpt/ui/ObjectTypeLegend';

interface OcptSidebarProps {
    objectTypes: string[];
    coloring: ScaleOrdinal<string, string, never>;
    nodeId: string | undefined;
    filteredObjectTypes: string[];
    onFilteredObjectTypesChange: (newFilteredObjectTypes: string[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conformanceData?: any;
}

const OcptSidebar: React.FC<OcptSidebarProps> = ({
    objectTypes,
    coloring,
    nodeId,
    filteredObjectTypes,
    onFilteredObjectTypesChange,
    conformanceData,
}) => {
    return (
        <Sidebar side="right">
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Project onto Object Type(s)</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem className="ml-1">
                                <ObjectTypeLegend
                                    objectTypes={objectTypes}
                                    coloring={coloring}
                                    nodeId={nodeId}
                                    filteredObjectTypes={filteredObjectTypes}
                                    onFilteredObjectTypesChange={onFilteredObjectTypesChange}
                                />
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                {conformanceData && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Conformance</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem className="ml-1">
                                    <div className="flex items-center gap-2 text-sm">
                                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                                        <span className="font-medium">
                                            Fitness: {(conformanceData.fitness * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                </SidebarMenuItem>
                                <SidebarMenuItem className="ml-1">
                                    <div className="flex items-center gap-2 text-sm">
                                        <ShieldCheck className="h-4 w-4 text-orange-600" />
                                        <span className="font-medium">
                                            Precision: {(conformanceData.precision * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>
        </Sidebar>
    );
};

export default OcptSidebar;
